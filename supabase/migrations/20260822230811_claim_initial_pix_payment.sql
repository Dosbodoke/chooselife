do $$
begin
  create type public.payment_claim_payer_type_enum as enum (
    'applicant',
    'other'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.payment_claim_status_enum as enum (
    'under_review',
    'approved',
    'rejected'
  );
exception
  when duplicate_object then null;
end;
$$;

create table public.payment_claims (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references public.payment_obligations(id),
  organization_id uuid not null references public.organizations(id),
  claimant_user_id uuid not null references public.profiles(id),
  payer_type public.payment_claim_payer_type_enum not null,
  payer_name text,
  status public.payment_claim_status_enum not null default 'under_review',
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  decided_at timestamp with time zone,
  decision_reason text,
  check (
    (payer_type = 'applicant'::public.payment_claim_payer_type_enum
      and payer_name is null)
    or (
      payer_type = 'other'::public.payment_claim_payer_type_enum
      and nullif(btrim(payer_name), '') is not null
      and char_length(payer_name) <= 120
    )
  ),
  check (decision_reason is null or char_length(decision_reason) <= 500),
  check (
    status <> 'under_review'::public.payment_claim_status_enum
    or (decided_at is null and decision_reason is null)
  )
);

comment on table public.payment_claims is
  'Immutable payment-claim submissions. Claim decisions are server-controlled and never settle the obligation by themselves.';
comment on column public.payment_claims.payer_name is
  'Normalized payer name when another person made the deposit. No receipt or banking metadata is stored.';
comment on column public.payment_claims.status is
  'Current server-controlled decision state. Submission evidence remains immutable; transitions are appended to payment_claim_audit_events.';

create or replace function public.reject_payment_claim_evidence_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Payment claim evidence is immutable.'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.obligation_id is distinct from new.obligation_id
    or old.organization_id is distinct from new.organization_id
    or old.claimant_user_id is distinct from new.claimant_user_id
    or old.payer_type is distinct from new.payer_type
    or old.payer_name is distinct from new.payer_name
    or old.created_at is distinct from new.created_at then
    raise exception 'Payment claim evidence is immutable.'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger payment_claims_evidence_immutable
before update or delete on public.payment_claims
for each row
execute function public.reject_payment_claim_evidence_mutation();

revoke all on function public.reject_payment_claim_evidence_mutation() from public;
revoke all on function public.reject_payment_claim_evidence_mutation() from anon;
revoke all on function public.reject_payment_claim_evidence_mutation() from authenticated;

create unique index payment_claims_one_under_review_per_obligation_idx
  on public.payment_claims (obligation_id)
  where status = 'under_review'::public.payment_claim_status_enum;

create index payment_claims_claimant_created_at_idx
  on public.payment_claims (claimant_user_id, created_at desc);

create index payment_claims_organization_status_idx
  on public.payment_claims (organization_id, status, created_at desc);

alter table public.payment_claims enable row level security;

create policy "Claimants can read their own payment claims"
  on public.payment_claims
  for select
  to authenticated
  using ((select auth.uid()) = claimant_user_id);

create policy "Organization admins can read payment claims"
  on public.payment_claims
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = payment_claims.organization_id
        and om.user_id = (select auth.uid())
        and om.role = 'admin'::public.organization_role_enum
    )
  );

revoke all on table public.payment_claims from public;
revoke all on table public.payment_claims from anon;
revoke all on table public.payment_claims from authenticated;
grant select on table public.payment_claims to authenticated;

create table public.payment_claim_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  obligation_id uuid not null references public.payment_obligations(id),
  claim_id uuid not null references public.payment_claims(id),
  actor_user_id uuid not null references public.profiles(id),
  previous_state text not null check (
    previous_state in ('payment_available', 'under_review', 'payment_settled')
  ),
  next_state text not null check (
    next_state in ('payment_available', 'under_review', 'payment_settled')
  ),
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (claim_id, next_state)
);

comment on table public.payment_claim_audit_events is
  'Append-only claim transition evidence containing server-derived actor, obligation, claim, state change, time, and optional reason.';

alter table public.payment_claim_audit_events enable row level security;

create policy "Claimants can read their own payment claim audit events"
  on public.payment_claim_audit_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.payment_claims pc
      where pc.id = payment_claim_audit_events.claim_id
        and pc.claimant_user_id = (select auth.uid())
    )
  );

create policy "Organization admins can read payment claim audit events"
  on public.payment_claim_audit_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = payment_claim_audit_events.organization_id
        and om.user_id = (select auth.uid())
        and om.role = 'admin'::public.organization_role_enum
    )
  );

revoke all on table public.payment_claim_audit_events from public;
revoke all on table public.payment_claim_audit_events from anon;
revoke all on table public.payment_claim_audit_events from authenticated;
grant select on table public.payment_claim_audit_events to authenticated;

create or replace function public.reject_payment_claim_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Payment claim audit events are immutable.'
    using errcode = '55000';
end;
$$;

create trigger payment_claim_audit_events_immutable
before update or delete on public.payment_claim_audit_events
for each row
execute function public.reject_payment_claim_audit_mutation();

revoke all on function public.reject_payment_claim_audit_mutation() from public;
revoke all on function public.reject_payment_claim_audit_mutation() from anon;
revoke all on function public.reject_payment_claim_audit_mutation() from authenticated;

drop function if exists public.get_payment_obligation_instructions(uuid);

create function public.get_payment_obligation_instructions(
  p_obligation_id uuid
)
returns table (
  obligation_id uuid,
  organization_id uuid,
  purpose public.payment_obligation_purpose_enum,
  status public.payment_obligation_status_enum,
  plan_type public.subscription_plan_type_enum,
  amount integer,
  currency text,
  payment_method text,
  pix_copy_paste text,
  available_at timestamp with time zone,
  claim_id uuid,
  claim_status public.payment_claim_status_enum,
  payer_type public.payment_claim_payer_type_enum,
  payer_name text,
  claim_created_at timestamp with time zone,
  claim_decision_reason text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    po.id,
    po.organization_id,
    po.purpose,
    po.status,
    po.plan_type,
    po.amount,
    po.currency,
    po.payment_method,
    po.pix_copy_paste,
    po.available_at,
    claim.id,
    claim.status,
    claim.payer_type,
    claim.payer_name,
    claim.created_at,
    claim.decision_reason
  from public.payment_obligations po
  left join lateral (
    select
      pc.id,
      pc.status,
      pc.payer_type,
      pc.payer_name,
      pc.created_at,
      pc.decision_reason
    from public.payment_claims pc
    where pc.obligation_id = po.id
      and pc.claimant_user_id = auth.uid()
    order by pc.created_at desc, pc.id desc
    limit 1
  ) claim on true
  where po.id = p_obligation_id
    and po.user_id = auth.uid();
$$;

comment on function public.get_payment_obligation_instructions(uuid) is
  'Returns authoritative PIX instructions and the signed-in owner''s latest claim for an obligation.';

revoke all on function public.get_payment_obligation_instructions(uuid) from public;
revoke all on function public.get_payment_obligation_instructions(uuid) from anon;
grant execute on function public.get_payment_obligation_instructions(uuid) to authenticated;

create or replace function public.claim_initial_payment(
  p_obligation_id uuid,
  p_paid_by_applicant boolean,
  p_payer_name text default null
)
returns table (
  claim_id uuid,
  obligation_id uuid,
  payer_type public.payment_claim_payer_type_enum,
  payer_name text,
  claim_status public.payment_claim_status_enum,
  claim_created_at timestamp with time zone,
  audit_event_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  obligation_record public.payment_obligations%rowtype;
  existing_claim public.payment_claims%rowtype;
  existing_audit_event public.payment_claim_audit_events%rowtype;
  inserted_claim public.payment_claims%rowtype;
  normalized_payer_name text;
  inserted_audit_event public.payment_claim_audit_events%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_obligation_id is null or p_paid_by_applicant is null then
    raise exception 'The payment claim request is incomplete.'
      using errcode = '22023';
  end if;

  normalized_payer_name = nullif(
    btrim(regexp_replace(coalesce(p_payer_name, ''), '\s+', ' ', 'g')),
    ''
  );

  if p_paid_by_applicant and normalized_payer_name is not null then
    raise exception 'Payer name is only allowed when another person paid.'
      using errcode = '22023';
  end if;

  if not p_paid_by_applicant and normalized_payer_name is null then
    raise exception 'Enter the name of the person who made the payment.'
      using errcode = '22023';
  end if;

  if normalized_payer_name is not null
    and char_length(normalized_payer_name) > 120 then
    raise exception 'Payer name must be 120 characters or fewer.'
      using errcode = '22023';
  end if;

  select po.*
  into obligation_record
  from public.payment_obligations po
  where po.id = p_obligation_id
    and po.user_id = actor_id
  for update;

  if not found then
    raise exception 'Payment obligation is unavailable.' using errcode = '42501';
  end if;

  if obligation_record.purpose <> 'initial_admission'::public.payment_obligation_purpose_enum
    or obligation_record.status <> 'available'::public.payment_obligation_status_enum
    or obligation_record.payment_method <> 'manual_pix'
    or nullif(btrim(obligation_record.pix_copy_paste), '') is null then
    raise exception 'This payment obligation cannot be claimed.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.membership_application_revisions mar
    join public.membership_applications ma on ma.id = mar.application_id
    where mar.id = obligation_record.application_revision_id
      and mar.user_id = actor_id
      and ma.status = 'submitted'::public.membership_application_status_enum
  ) then
    raise exception 'This payment obligation is not attached to a submitted application.'
      using errcode = '23514';
  end if;

  select pc.*
  into existing_claim
  from public.payment_claims pc
  where pc.obligation_id = obligation_record.id
    and pc.status = 'under_review'::public.payment_claim_status_enum
  for update;

  if found then
    if existing_claim.payer_type <> (
      case
        when p_paid_by_applicant then 'applicant'::public.payment_claim_payer_type_enum
        else 'other'::public.payment_claim_payer_type_enum
      end
    )
    or existing_claim.payer_name is distinct from normalized_payer_name then
      raise exception 'A payment claim is already under review with different payer details.'
        using errcode = '40001';
    end if;

    select pcae.*
    into existing_audit_event
    from public.payment_claim_audit_events pcae
    where pcae.claim_id = existing_claim.id
      and pcae.next_state = 'under_review'
    order by pcae.created_at asc
    limit 1;

    return query
    select
      existing_claim.id,
      existing_claim.obligation_id,
      existing_claim.payer_type,
      existing_claim.payer_name,
      existing_claim.status,
      existing_claim.created_at,
      existing_audit_event.id;
    return;
  end if;

  if exists (
    select 1
    from public.payment_claims pc
    where pc.obligation_id = obligation_record.id
      and pc.status = 'approved'::public.payment_claim_status_enum
  ) then
    raise exception 'This payment obligation has already been approved.'
      using errcode = '23514';
  end if;

  insert into public.payment_claims (
    obligation_id,
    organization_id,
    claimant_user_id,
    payer_type,
    payer_name,
    status
  )
  values (
    obligation_record.id,
    obligation_record.organization_id,
    actor_id,
    case
      when p_paid_by_applicant then 'applicant'::public.payment_claim_payer_type_enum
      else 'other'::public.payment_claim_payer_type_enum
    end,
    case when p_paid_by_applicant then null else normalized_payer_name end,
    'under_review'::public.payment_claim_status_enum
  )
  returning * into inserted_claim;

  insert into public.payment_claim_audit_events (
    organization_id,
    obligation_id,
    claim_id,
    actor_user_id,
    previous_state,
    next_state
  )
  values (
    obligation_record.organization_id,
    obligation_record.id,
    inserted_claim.id,
    actor_id,
    'payment_available',
    'under_review'
  )
  returning * into inserted_audit_event;

  return query
  select
    inserted_claim.id,
    inserted_claim.obligation_id,
    inserted_claim.payer_type,
    inserted_claim.payer_name,
    inserted_claim.status,
    inserted_claim.created_at,
    inserted_audit_event.id;
end;
$$;

comment on function public.claim_initial_payment(uuid, boolean, text) is
  'Atomically records one authenticated applicant claim for an available initial manual-PIX obligation without settling it or creating membership.';

revoke all on function public.claim_initial_payment(uuid, boolean, text) from public;
revoke all on function public.claim_initial_payment(uuid, boolean, text) from anon;
grant execute on function public.claim_initial_payment(uuid, boolean, text) to authenticated;
