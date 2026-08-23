-- Verify an initial payment claim and admit the applicant in one transaction.
--
-- The initial-admission workflow deliberately does not use the generic payment
-- settlement path. A payment row is a renewal billing primitive; an initial
-- obligation becomes settled only after an authorized association admin
-- verifies a claim.

create index if not exists payment_claims_current_queue_idx
  on public.payment_claims (organization_id, created_at asc, id)
  where status = 'under_review'::public.payment_claim_status_enum;

create index if not exists payment_obligations_initial_queue_idx
  on public.payment_obligations (organization_id, status, application_revision_id)
  where purpose = 'initial_admission'::public.payment_obligation_purpose_enum;

-- A generic succeeded-payment webhook must not turn a legacy initial payment
-- into admission. The admin command below is the only admission boundary.
create or replace function public.apply_payment_settlement_effects(
  p_payment_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_record record;
  subscription_record record;
  period_start timestamp with time zone;
begin
  select
    p.id,
    p.subscription_id,
    p.user_id,
    p.organization_id,
    p.status,
    p.settlement_applied_at
  into payment_record
  from public.payments p
  where p.id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment % was not found.', p_payment_id
      using errcode = 'P0002';
  end if;

  if payment_record.status <> 'succeeded'::public.payment_status_enum then
    return false;
  end if;

  -- Legacy rows can be linked to an initial obligation during migration. They
  -- remain reconciliation evidence; succeeding them is never admission.
  if exists (
    select 1
    from public.payment_obligations po
    where po.legacy_payment_id = payment_record.id
      and po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
  ) then
    return false;
  end if;

  if payment_record.settlement_applied_at is not null then
    return false;
  end if;

  select s.current_period_end, s.plan_type
  into subscription_record
  from public.subscriptions s
  where s.id = payment_record.subscription_id
  for update;

  if not found then
    raise warning 'Cannot apply payment effects. Subscription % was not found for payment %.',
      payment_record.subscription_id,
      payment_record.id;
    return false;
  end if;

  period_start = greatest(
    coalesce(subscription_record.current_period_end, timezone('utc'::text, now())),
    timezone('utc'::text, now())
  );

  update public.subscriptions s
  set
    status = 'active'::public.subscription_status_enum,
    current_period_end = period_start + case subscription_record.plan_type
      when 'annual'::public.subscription_plan_type_enum then interval '1 year'
      else interval '1 month'
    end
  where s.id = payment_record.subscription_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (
    payment_record.organization_id,
    payment_record.user_id,
    'member'::public.organization_role_enum
  )
  on conflict (organization_id, user_id) do update
  set role = case
    when public.organization_members.role = 'admin'::public.organization_role_enum
      then 'admin'::public.organization_role_enum
    else excluded.role
  end;

  update public.payments p
  set settlement_applied_at = timezone('utc'::text, now())
  where p.id = payment_record.id
    and p.settlement_applied_at is null;

  return true;
end;
$$;

comment on function public.apply_payment_settlement_effects(uuid) is
  'Applies renewal payment effects exactly once. Initial-admission obligations are excluded; admission uses approve_initial_claim.';

revoke all on function public.apply_payment_settlement_effects(uuid) from public;
revoke all on function public.apply_payment_settlement_effects(uuid) from anon;
revoke all on function public.apply_payment_settlement_effects(uuid) from authenticated;
grant execute on function public.apply_payment_settlement_effects(uuid) to service_role;

create or replace function public.apply_succeeded_payment_effects()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'succeeded'::public.payment_status_enum then
    return new;
  end if;

  perform public.apply_payment_settlement_effects(new.id);
  return new;
end;
$$;

revoke all on function public.apply_succeeded_payment_effects() from public;
revoke all on function public.apply_succeeded_payment_effects() from anon;
revoke all on function public.apply_succeeded_payment_effects() from authenticated;

-- Only the intention-revealing decision commands may change decision fields.
-- Evidence fields remain immutable as before.
create or replace function public.reject_payment_claim_evidence_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
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

  if old.status is distinct from new.status
    or old.decided_at is distinct from new.decided_at
    or old.decision_reason is distinct from new.decision_reason then
    if current_setting('app.payment_claim_decision_command', true) <> 'on' then
      raise exception 'Payment claim decisions must use the decision command.'
        using errcode = '42501';
    end if;

    if old.status <> 'under_review'::public.payment_claim_status_enum
      or new.status not in (
        'approved'::public.payment_claim_status_enum,
        'rejected'::public.payment_claim_status_enum
      )
      or new.decided_at is null
      or (new.status = 'approved'::public.payment_claim_status_enum
        and new.decision_reason is not null)
      or (new.status = 'rejected'::public.payment_claim_status_enum
        and nullif(btrim(new.decision_reason), '') is null) then
      raise exception 'Invalid payment claim decision transition.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.reject_payment_claim_evidence_mutation() from public;
revoke all on function public.reject_payment_claim_evidence_mutation() from anon;
revoke all on function public.reject_payment_claim_evidence_mutation() from authenticated;

create or replace function public.get_initial_payment_claim_queue()
returns table (
  claim_id uuid,
  obligation_id uuid,
  application_revision_id uuid,
  organization_id uuid,
  organization_name text,
  claimant_user_id uuid,
  applicant_name text,
  applicant_handle text,
  applicant_profile_picture text,
  payer_type public.payment_claim_payer_type_enum,
  payer_name text,
  plan_type public.subscription_plan_type_enum,
  amount integer,
  currency text,
  claim_created_at timestamp with time zone,
  attempt_count bigint,
  claim_status public.payment_claim_status_enum
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pc.id,
    po.id,
    po.application_revision_id,
    pc.organization_id,
    o.name,
    pc.claimant_user_id,
    p.name,
    p.username,
    p.profile_picture,
    pc.payer_type,
    pc.payer_name,
    po.plan_type,
    po.amount,
    po.currency,
    pc.created_at,
    (
      select count(*)
      from public.payment_claims attempts
      where attempts.obligation_id = po.id
    ),
    pc.status
  from public.payment_claims pc
  join public.payment_obligations po on po.id = pc.obligation_id
  join public.membership_application_revisions mar
    on mar.id = po.application_revision_id
  join public.membership_applications ma on ma.id = mar.application_id
  join public.organizations o on o.id = pc.organization_id
  join public.profiles p on p.id = pc.claimant_user_id
  where pc.status = 'under_review'::public.payment_claim_status_enum
    and po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
    and po.status = 'available'::public.payment_obligation_status_enum
    and pc.organization_id = po.organization_id
    and po.organization_id = mar.organization_id
    and po.user_id = mar.user_id
    and ma.organization_id = mar.organization_id
    and ma.user_id = mar.user_id
    and ma.status = 'submitted'::public.membership_application_status_enum
    and o.organization_type = 'association'::public.organization_type_enum
    and pc.claimant_user_id <> (select auth.uid())
    and exists (
      select 1
      from public.organization_members reviewer_membership
      where reviewer_membership.organization_id = pc.organization_id
        and reviewer_membership.user_id = (select auth.uid())
        and reviewer_membership.role = 'admin'::public.organization_role_enum
    )
  order by pc.created_at asc, pc.id asc;
$$;

comment on function public.get_initial_payment_claim_queue() is
  'Returns a privacy-preserving queue of current initial claims for associations where the caller is an admin.';

revoke all on function public.get_initial_payment_claim_queue() from public;
revoke all on function public.get_initial_payment_claim_queue() from anon;
grant execute on function public.get_initial_payment_claim_queue() to authenticated;

create or replace function public.get_initial_payment_claim_detail(
  p_claim_id uuid
)
returns table (
  claim_id uuid,
  obligation_id uuid,
  application_id uuid,
  application_revision_id uuid,
  revision_number integer,
  draft_version bigint,
  organization_id uuid,
  organization_name text,
  organization_slug text,
  claimant_user_id uuid,
  applicant_name text,
  applicant_handle text,
  applicant_profile_picture text,
  claim_status public.payment_claim_status_enum,
  payer_type public.payment_claim_payer_type_enum,
  payer_name text,
  claim_created_at timestamp with time zone,
  decided_at timestamp with time zone,
  decision_reason text,
  attempt_count bigint,
  plan_type public.subscription_plan_type_enum,
  amount integer,
  currency text,
  terms_version text,
  accepted_terms_at timestamp with time zone,
  submitted_at timestamp with time zone,
  full_name text,
  birth_date date,
  nationality text,
  marital_status public.marital_status_enum,
  profession text,
  birthplace text,
  cpf text,
  id_document_number text,
  id_document_issuer text,
  postal_code text,
  address_line text,
  city text,
  state text,
  email text,
  phone text,
  blood_type public.blood_type_enum,
  has_allergies boolean,
  allergies text,
  has_dietary_restrictions boolean,
  dietary_restrictions text,
  highline_experience public.highline_experience_enum,
  has_rescue_course boolean,
  first_aid_course public.first_aid_course_enum,
  emergency_contact_name text,
  emergency_contact_relationship text,
  emergency_contact_phone text,
  claim_history jsonb,
  audit_history jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pc.id,
    po.id,
    mar.application_id,
    mar.id,
    mar.revision_number,
    mar.draft_version,
    pc.organization_id,
    o.name,
    o.slug,
    pc.claimant_user_id,
    p.name,
    p.username,
    p.profile_picture,
    pc.status,
    pc.payer_type,
    pc.payer_name,
    pc.created_at,
    pc.decided_at,
    pc.decision_reason,
    (
      select count(*)
      from public.payment_claims attempts
      where attempts.obligation_id = po.id
    ),
    mar.plan_type,
    mar.plan_amount,
    mar.currency,
    mar.terms_version,
    mar.accepted_terms_at,
    mar.submitted_at,
    mar.full_name,
    mar.birth_date,
    mar.nationality,
    mar.marital_status,
    mar.profession,
    mar.birthplace,
    mar.cpf,
    mar.id_document_number,
    mar.id_document_issuer,
    mar.postal_code,
    mar.address_line,
    mar.city,
    mar.state,
    mar.email,
    mar.phone,
    mar.blood_type,
    mar.has_allergies,
    mar.allergies,
    mar.has_dietary_restrictions,
    mar.dietary_restrictions,
    mar.highline_experience,
    mar.has_rescue_course,
    mar.first_aid_course,
    mar.emergency_contact_name,
    mar.emergency_contact_relationship,
    mar.emergency_contact_phone,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'claim_id', history.id,
            'status', history.status,
            'payer_type', history.payer_type,
            'payer_name', history.payer_name,
            'created_at', history.created_at,
            'decided_at', history.decided_at,
            'decision_reason', history.decision_reason
          )
          order by history.created_at asc, history.id asc
        )
        from public.payment_claims history
        where history.obligation_id = po.id
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', audit.id,
            'claim_id', audit.claim_id,
            'actor_user_id', audit.actor_user_id,
            'previous_state', audit.previous_state,
            'next_state', audit.next_state,
            'reason', audit.reason,
            'created_at', audit.created_at
          )
          order by audit.created_at asc, audit.id asc
        )
        from public.payment_claim_audit_events audit
        where audit.obligation_id = po.id
      ),
      '[]'::jsonb
    )
  from public.payment_claims pc
  join public.payment_obligations po on po.id = pc.obligation_id
  join public.membership_application_revisions mar
    on mar.id = po.application_revision_id
  join public.membership_applications ma on ma.id = mar.application_id
  join public.organizations o on o.id = pc.organization_id
  join public.profiles p on p.id = pc.claimant_user_id
  where pc.id = p_claim_id
    and pc.organization_id = po.organization_id
    and po.organization_id = mar.organization_id
    and po.user_id = mar.user_id
    and ma.organization_id = mar.organization_id
    and ma.user_id = mar.user_id
    and ma.status = 'submitted'::public.membership_application_status_enum
    and o.organization_type = 'association'::public.organization_type_enum
    and pc.claimant_user_id <> (select auth.uid())
    and exists (
      select 1
      from public.organization_members reviewer_membership
      where reviewer_membership.organization_id = pc.organization_id
        and reviewer_membership.user_id = (select auth.uid())
        and reviewer_membership.role = 'admin'::public.organization_role_enum
    );
$$;

comment on function public.get_initial_payment_claim_detail(uuid) is
  'Returns the exact immutable submitted application revision and authorized claim history for an association admin.';

revoke all on function public.get_initial_payment_claim_detail(uuid) from public;
revoke all on function public.get_initial_payment_claim_detail(uuid) from anon;
grant execute on function public.get_initial_payment_claim_detail(uuid) to authenticated;

create or replace function public.approve_initial_claim(
  p_claim_id uuid
)
returns table (
  claim_id uuid,
  obligation_id uuid,
  claim_status public.payment_claim_status_enum,
  obligation_status public.payment_obligation_status_enum,
  membership_user_id uuid,
  subscription_id uuid,
  subscription_status public.subscription_status_enum,
  subscription_current_period_end timestamp with time zone,
  audit_event_id uuid,
  decision_applied_now boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  claim_record public.payment_claims%rowtype;
  organization_record public.organizations%rowtype;
  reviewer_membership public.organization_members%rowtype;
  obligation_record public.payment_obligations%rowtype;
  revision_record public.membership_application_revisions%rowtype;
  application_record public.membership_applications%rowtype;
  applicant_membership public.organization_members%rowtype;
  subscription_record public.subscriptions%rowtype;
  audit_record public.payment_claim_audit_events%rowtype;
  applicant_membership_found boolean;
  subscription_found boolean;
  audit_found boolean;
  decision_timestamp timestamp with time zone := timezone('utc'::text, clock_timestamp());
  subscription_end timestamp with time zone;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select pc.*
  into claim_record
  from public.payment_claims pc
  where pc.id = p_claim_id
  for update;

  if not found then
    raise exception 'This claim is unavailable to the current reviewer.'
      using errcode = '42501';
  end if;

  select o.*
  into organization_record
  from public.organizations o
  where o.id = claim_record.organization_id
  for update;

  if not found then
    raise exception 'This claim is unavailable to the current reviewer.'
      using errcode = '42501';
  end if;

  if organization_record.organization_type <> 'association'::public.organization_type_enum then
    raise exception 'This claim is unavailable to the current reviewer.'
      using errcode = '42501';
  end if;

  select om.*
  into reviewer_membership
  from public.organization_members om
  where om.organization_id = claim_record.organization_id
    and om.user_id = actor_id
  for update;

  if not found then
    raise exception 'This claim is unavailable to the current reviewer.'
      using errcode = '42501';
  end if;

  if reviewer_membership.role <> 'admin'::public.organization_role_enum
    or claim_record.claimant_user_id = actor_id then
    raise exception 'This claim is unavailable to the current reviewer.'
      using errcode = '42501';
  end if;

  select po.*
  into obligation_record
  from public.payment_obligations po
  where po.id = claim_record.obligation_id
  for update;

  if not found then
    raise exception 'This claim no longer has a valid payment obligation.'
      using errcode = '23514';
  end if;

  select mar.*
  into revision_record
  from public.membership_application_revisions mar
  where mar.id = obligation_record.application_revision_id
  for update;

  if not found then
    raise exception 'This claim no longer has a valid application revision.'
      using errcode = '23514';
  end if;

  select ma.*
  into application_record
  from public.membership_applications ma
  where ma.id = revision_record.application_id
  for update;

  if not found then
    raise exception 'This claim no longer has a valid application.'
      using errcode = '23514';
  end if;

  -- Lock the applicant membership and subscription in the same order for
  -- approve and reject. This keeps concurrent decisions deterministic.
  select om.*
  into applicant_membership
  from public.organization_members om
  where om.organization_id = obligation_record.organization_id
    and om.user_id = obligation_record.user_id
  for update;
  applicant_membership_found := found;

  select s.*
  into subscription_record
  from public.subscriptions s
  where s.organization_id = obligation_record.organization_id
    and s.user_id = obligation_record.user_id
  for update;
  subscription_found := found;

  if claim_record.status = 'approved'::public.payment_claim_status_enum then
    if obligation_record.status <> 'settled'::public.payment_obligation_status_enum then
      raise exception 'The approved claim is missing its settled obligation.'
        using errcode = '23514';
    end if;

    select pcae.*
    into audit_record
    from public.payment_claim_audit_events pcae
    where pcae.claim_id = claim_record.id
      and pcae.next_state = 'payment_settled'
    order by pcae.created_at asc, pcae.id asc
    limit 1;
    audit_found := found;

    if not audit_found then
      raise exception 'The approved claim is missing its audit event.'
        using errcode = '23514';
    end if;

    if not applicant_membership_found
      or not subscription_found
      or subscription_record.status <> 'active'::public.subscription_status_enum then
      raise exception 'The approved claim is missing its admission effects.'
        using errcode = '23514';
    end if;

    return query
    select
      claim_record.id,
      obligation_record.id,
      claim_record.status,
      obligation_record.status,
      applicant_membership.user_id,
      subscription_record.id,
      subscription_record.status,
      subscription_record.current_period_end,
      audit_record.id,
      false;
    return;
  end if;

  if claim_record.status = 'rejected'::public.payment_claim_status_enum then
    raise exception 'This claim was already rejected. Refresh before deciding.'
      using errcode = '40001';
  end if;

  if claim_record.status <> 'under_review'::public.payment_claim_status_enum then
    raise exception 'This claim is no longer awaiting review. Refresh before deciding.'
      using errcode = '40001';
  end if;

  if obligation_record.purpose <> 'initial_admission'::public.payment_obligation_purpose_enum
    or obligation_record.status <> 'available'::public.payment_obligation_status_enum
    or obligation_record.payment_method <> 'manual_pix'
    or nullif(btrim(obligation_record.pix_copy_paste), '') is null
    or obligation_record.organization_id <> claim_record.organization_id
    or obligation_record.user_id <> claim_record.claimant_user_id
    or obligation_record.plan_type <> revision_record.plan_type
    or obligation_record.amount <> revision_record.plan_amount
    or obligation_record.currency <> revision_record.currency
    or obligation_record.application_revision_id <> revision_record.id
    or revision_record.organization_id <> claim_record.organization_id
    or revision_record.user_id <> claim_record.claimant_user_id
    or application_record.organization_id <> claim_record.organization_id
    or application_record.user_id <> claim_record.claimant_user_id
    or application_record.status <> 'submitted'::public.membership_application_status_enum then
    raise exception 'This claim no longer matches an actionable initial application.'
      using errcode = '40001';
  end if;

  if subscription_found
    and subscription_record.plan_type <> revision_record.plan_type then
    raise exception 'The applicant has a conflicting subscription plan.'
      using errcode = '23514';
  end if;

  -- Preserve an existing admin role. A prior member row is also reused so the
  -- approval is idempotent at the organization-membership boundary.
  insert into public.organization_members (organization_id, user_id, role)
  values (
    obligation_record.organization_id,
    obligation_record.user_id,
    'member'::public.organization_role_enum
  )
  on conflict (organization_id, user_id) do update
  set role = case
    when public.organization_members.role = 'admin'::public.organization_role_enum
      then 'admin'::public.organization_role_enum
    else excluded.role
  end
  returning * into applicant_membership;

  subscription_end = case revision_record.plan_type
    when 'annual'::public.subscription_plan_type_enum
      then decision_timestamp + interval '1 year'
    else decision_timestamp + interval '1 month'
  end;

  if subscription_found then
    update public.subscriptions s
    set
      plan_type = revision_record.plan_type,
      status = 'active'::public.subscription_status_enum,
      current_period_end = case
        when subscription_record.status = 'active'::public.subscription_status_enum
          and subscription_record.current_period_end is not null
          and subscription_record.current_period_end > decision_timestamp
          then subscription_record.current_period_end
        else subscription_end
      end
    where s.id = subscription_record.id
    returning * into subscription_record;
  else
    insert into public.subscriptions (
      organization_id,
      user_id,
      plan_type,
      status,
      current_period_end
    )
    values (
      obligation_record.organization_id,
      obligation_record.user_id,
      revision_record.plan_type,
      'active'::public.subscription_status_enum,
      subscription_end
    )
    returning * into subscription_record;
  end if;

  perform set_config('app.payment_claim_decision_command', 'on', true);

  update public.payment_claims pc
  set
    status = 'approved'::public.payment_claim_status_enum,
    decided_at = decision_timestamp,
    decision_reason = null
  where pc.id = claim_record.id;

  perform set_config('app.payment_claim_decision_command', 'off', true);

  update public.payment_obligations po
  set
    status = 'settled'::public.payment_obligation_status_enum,
    settled_at = decision_timestamp
  where po.id = obligation_record.id;

  insert into public.payment_claim_audit_events (
    organization_id,
    obligation_id,
    claim_id,
    actor_user_id,
    previous_state,
    next_state,
    reason,
    created_at
  )
  values (
    obligation_record.organization_id,
    obligation_record.id,
    claim_record.id,
    actor_id,
    'under_review',
    'payment_settled',
    null,
    decision_timestamp
  )
  returning * into audit_record;

  return query
  select
    claim_record.id,
    obligation_record.id,
    'approved'::public.payment_claim_status_enum,
    'settled'::public.payment_obligation_status_enum,
    applicant_membership.user_id,
    subscription_record.id,
    subscription_record.status,
    subscription_record.current_period_end,
    audit_record.id,
    true;
end;
$$;

comment on function public.approve_initial_claim(uuid) is
  'Atomically verifies an actionable initial claim, settles its obligation, admits the applicant, activates the selected subscription schedule, and appends one audit event.';

revoke all on function public.approve_initial_claim(uuid) from public;
revoke all on function public.approve_initial_claim(uuid) from anon;
grant execute on function public.approve_initial_claim(uuid) to authenticated;

create or replace function public.reject_initial_claim(
  p_claim_id uuid,
  p_reason text
)
returns table (
  claim_id uuid,
  obligation_id uuid,
  claim_status public.payment_claim_status_enum,
  obligation_status public.payment_obligation_status_enum,
  decision_reason text,
  audit_event_id uuid,
  decision_applied_now boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  claim_record public.payment_claims%rowtype;
  organization_record public.organizations%rowtype;
  reviewer_membership public.organization_members%rowtype;
  obligation_record public.payment_obligations%rowtype;
  revision_record public.membership_application_revisions%rowtype;
  application_record public.membership_applications%rowtype;
  applicant_membership public.organization_members%rowtype;
  subscription_record public.subscriptions%rowtype;
  audit_record public.payment_claim_audit_events%rowtype;
  normalized_reason text;
  decision_timestamp timestamp with time zone := timezone('utc'::text, clock_timestamp());
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  normalized_reason = nullif(
    btrim(regexp_replace(coalesce(p_reason, ''), '\s+', ' ', 'g')),
    ''
  );

  if normalized_reason is null then
    raise exception 'A rejection reason is required.' using errcode = '22023';
  end if;

  if char_length(normalized_reason) > 500 then
    raise exception 'The rejection reason must be 500 characters or fewer.'
      using errcode = '22023';
  end if;

  select pc.*
  into claim_record
  from public.payment_claims pc
  where pc.id = p_claim_id
  for update;

  if not found then
    raise exception 'This claim is unavailable to the current reviewer.'
      using errcode = '42501';
  end if;

  select o.*
  into organization_record
  from public.organizations o
  where o.id = claim_record.organization_id
  for update;

  if not found then
    raise exception 'This claim is unavailable to the current reviewer.'
      using errcode = '42501';
  end if;

  if organization_record.organization_type <> 'association'::public.organization_type_enum then
    raise exception 'This claim is unavailable to the current reviewer.'
      using errcode = '42501';
  end if;

  select om.*
  into reviewer_membership
  from public.organization_members om
  where om.organization_id = claim_record.organization_id
    and om.user_id = actor_id
  for update;

  if not found then
    raise exception 'This claim is unavailable to the current reviewer.'
      using errcode = '42501';
  end if;

  if reviewer_membership.role <> 'admin'::public.organization_role_enum
    or claim_record.claimant_user_id = actor_id then
    raise exception 'This claim is unavailable to the current reviewer.'
      using errcode = '42501';
  end if;

  select po.*
  into obligation_record
  from public.payment_obligations po
  where po.id = claim_record.obligation_id
  for update;

  if not found then
    raise exception 'This claim no longer has a valid payment obligation.'
      using errcode = '23514';
  end if;

  select mar.*
  into revision_record
  from public.membership_application_revisions mar
  where mar.id = obligation_record.application_revision_id
  for update;

  if not found then
    raise exception 'This claim no longer has a valid application revision.'
      using errcode = '23514';
  end if;

  select ma.*
  into application_record
  from public.membership_applications ma
  where ma.id = revision_record.application_id
  for update;

  if not found then
    raise exception 'This claim no longer has a valid application.'
      using errcode = '23514';
  end if;

  select om.*
  into applicant_membership
  from public.organization_members om
  where om.organization_id = obligation_record.organization_id
    and om.user_id = obligation_record.user_id
  for update;

  select s.*
  into subscription_record
  from public.subscriptions s
  where s.organization_id = obligation_record.organization_id
    and s.user_id = obligation_record.user_id
  for update;

  if claim_record.status = 'rejected'::public.payment_claim_status_enum then
    if claim_record.decision_reason is distinct from normalized_reason then
      raise exception 'This claim was already rejected with a different reason. Refresh before deciding.'
        using errcode = '40001';
    end if;

    select pcae.*
    into audit_record
    from public.payment_claim_audit_events pcae
    where pcae.claim_id = claim_record.id
      and pcae.next_state = 'payment_available'
    order by pcae.created_at asc, pcae.id asc
    limit 1;

    if not found then
      raise exception 'The rejected claim is missing its audit event.'
        using errcode = '23514';
    end if;

    return query
    select
      claim_record.id,
      obligation_record.id,
      claim_record.status,
      obligation_record.status,
      claim_record.decision_reason,
      audit_record.id,
      false;
    return;
  end if;

  if claim_record.status = 'approved'::public.payment_claim_status_enum then
    raise exception 'This claim was already approved. Refresh before deciding.'
      using errcode = '40001';
  end if;

  if claim_record.status <> 'under_review'::public.payment_claim_status_enum then
    raise exception 'This claim is no longer awaiting review. Refresh before deciding.'
      using errcode = '40001';
  end if;

  if obligation_record.purpose <> 'initial_admission'::public.payment_obligation_purpose_enum
    or obligation_record.status <> 'available'::public.payment_obligation_status_enum
    or obligation_record.payment_method <> 'manual_pix'
    or nullif(btrim(obligation_record.pix_copy_paste), '') is null
    or obligation_record.organization_id <> claim_record.organization_id
    or obligation_record.user_id <> claim_record.claimant_user_id
    or obligation_record.plan_type <> revision_record.plan_type
    or obligation_record.amount <> revision_record.plan_amount
    or obligation_record.currency <> revision_record.currency
    or obligation_record.application_revision_id <> revision_record.id
    or revision_record.organization_id <> claim_record.organization_id
    or revision_record.user_id <> claim_record.claimant_user_id
    or application_record.organization_id <> claim_record.organization_id
    or application_record.user_id <> claim_record.claimant_user_id
    or application_record.status <> 'submitted'::public.membership_application_status_enum then
    raise exception 'This claim no longer matches an actionable initial application.'
      using errcode = '40001';
  end if;

  -- A rejected claim leaves the obligation and all admission effects untouched.
  perform set_config('app.payment_claim_decision_command', 'on', true);

  update public.payment_claims pc
  set
    status = 'rejected'::public.payment_claim_status_enum,
    decided_at = decision_timestamp,
    decision_reason = normalized_reason
  where pc.id = claim_record.id;

  perform set_config('app.payment_claim_decision_command', 'off', true);

  insert into public.payment_claim_audit_events (
    organization_id,
    obligation_id,
    claim_id,
    actor_user_id,
    previous_state,
    next_state,
    reason,
    created_at
  )
  values (
    obligation_record.organization_id,
    obligation_record.id,
    claim_record.id,
    actor_id,
    'under_review',
    'payment_available',
    normalized_reason,
    decision_timestamp
  )
  returning * into audit_record;

  return query
  select
    claim_record.id,
    obligation_record.id,
    'rejected'::public.payment_claim_status_enum,
    obligation_record.status,
    normalized_reason,
    audit_record.id,
    true;
end;
$$;

comment on function public.reject_initial_claim(uuid, text) is
  'Atomically rejects only the current initial claim, records a normalized reason, keeps the obligation available, and appends one audit event.';

revoke all on function public.reject_initial_claim(uuid, text) from public;
revoke all on function public.reject_initial_claim(uuid, text) from anon;
grant execute on function public.reject_initial_claim(uuid, text) to authenticated;
