do $$
begin
  create type public.organization_type_enum as enum ('group', 'association');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.payment_obligation_purpose_enum as enum (
    'initial_admission'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.payment_obligation_status_enum as enum (
    'available',
    'settled',
    'void'
  );
exception
  when duplicate_object then null;
end;
$$;

alter table public.organizations
  add column if not exists organization_type public.organization_type_enum
    not null default 'association'::public.organization_type_enum,
  add column if not exists billing_currency text not null default 'BRL',
  add column if not exists membership_terms_version text not null default 'estatuto-v1';

update public.organizations
set organization_type = 'association'::public.organization_type_enum
where organization_type is null;

update public.organizations
set billing_currency = upper(btrim(billing_currency))
where billing_currency is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_billing_currency_format_check'
  ) then
    alter table public.organizations
      add constraint organizations_billing_currency_format_check
      check (billing_currency ~ '^[A-Z]{3}$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_membership_terms_version_check'
  ) then
    alter table public.organizations
      add constraint organizations_membership_terms_version_check
      check (nullif(btrim(membership_terms_version), '') is not null);
  end if;
end;
$$;

comment on column public.organizations.organization_type is
  'Immutable organization classification. Formal membership applications are allowed only for associations.';
comment on column public.organizations.billing_currency is
  'ISO 4217 currency used for new association obligations.';
comment on column public.organizations.membership_terms_version is
  'Exact terms version accepted by new association applicants.';

alter table public.membership_applications
  add column if not exists draft_version bigint not null default 1,
  add column if not exists has_allergies boolean not null default false,
  add column if not exists has_dietary_restrictions boolean not null default false;

update public.membership_applications
set has_allergies = true
where nullif(btrim(allergies), '') is not null;

update public.membership_applications
set has_dietary_restrictions = true
where nullif(btrim(dietary_restrictions), '') is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'membership_applications_draft_version_check'
  ) then
    alter table public.membership_applications
      add constraint membership_applications_draft_version_check
      check (draft_version > 0);
  end if;
end;
$$;

create or replace function public.set_membership_applications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, clock_timestamp());

  if tg_op = 'UPDATE' then
    -- Submitting a draft is a state transition, not a new editable draft
    -- version. This lets a lost response retry the same command safely.
    if old.status = 'draft'::public.membership_application_status_enum
      and new.status = 'submitted'::public.membership_application_status_enum then
      new.draft_version = old.draft_version;
    else
      new.draft_version = old.draft_version + 1;
    end if;
  end if;

  return new;
end;
$$;

create table public.membership_application_revisions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.membership_applications(id),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references public.profiles(id),
  revision_number integer not null,
  draft_version bigint not null,
  plan_type public.subscription_plan_type_enum not null,
  terms_version text not null,
  accepted_terms_at timestamp with time zone not null,
  submitted_at timestamp with time zone not null,
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
  has_allergies boolean not null,
  allergies text,
  has_dietary_restrictions boolean not null,
  dietary_restrictions text,
  highline_experience public.highline_experience_enum,
  has_rescue_course boolean,
  first_aid_course public.first_aid_course_enum,
  emergency_contact_name text,
  emergency_contact_relationship text,
  emergency_contact_phone text,
  plan_amount integer not null check (plan_amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  pix_copy_paste text not null check (nullif(btrim(pix_copy_paste), '') is not null),
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (application_id, revision_number),
  unique (application_id, draft_version),
  check (nullif(btrim(terms_version), '') is not null),
  check (draft_version > 0)
);

comment on table public.membership_application_revisions is
  'Immutable, revisionable snapshots of submitted association applications. Never use live profile data for admission review.';
comment on column public.membership_application_revisions.plan_amount is
  'Server-snapshotted price in the smallest currency unit at submission time.';
comment on column public.membership_application_revisions.pix_copy_paste is
  'Server-snapshotted static manual-PIX payload for the selected association plan.';

create or replace function public.reject_membership_application_revision_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Submitted application revisions are immutable.'
    using errcode = '55000';
end;
$$;

create trigger membership_application_revisions_immutable
before update or delete on public.membership_application_revisions
for each row
execute function public.reject_membership_application_revision_mutation();

alter table public.membership_application_revisions enable row level security;

create policy "Application owners can read their submitted revisions"
  on public.membership_application_revisions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.membership_application_revisions from public;
revoke all on table public.membership_application_revisions from anon;
revoke all on table public.membership_application_revisions from authenticated;
grant select on table public.membership_application_revisions to authenticated;

create table public.payment_obligations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references public.profiles(id),
  application_revision_id uuid not null references public.membership_application_revisions(id),
  purpose public.payment_obligation_purpose_enum not null default 'initial_admission',
  status public.payment_obligation_status_enum not null default 'available',
  plan_type public.subscription_plan_type_enum not null,
  amount integer not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  payment_method text not null default 'manual_pix' check (payment_method = 'manual_pix'),
  pix_copy_paste text not null check (nullif(btrim(pix_copy_paste), '') is not null),
  available_at timestamp with time zone not null,
  settled_at timestamp with time zone,
  legacy_payment_id uuid unique references public.payments(id) on delete set null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (application_revision_id, purpose)
);

comment on table public.payment_obligations is
  'Server-authoritative, independently payable billing obligations. Claims and admission decisions are separate workflows.';
comment on column public.payment_obligations.legacy_payment_id is
  'Optional migration link to an existing legacy payment; new submissions never create a legacy payment row.';

create index payment_obligations_user_organization_idx
  on public.payment_obligations (user_id, organization_id, status);

alter table public.payment_obligations enable row level security;

create policy "Obligation owners can read their obligations"
  on public.payment_obligations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.payment_obligations from public;
revoke all on table public.payment_obligations from anon;
revoke all on table public.payment_obligations from authenticated;
grant select on table public.payment_obligations to authenticated;

-- Preserve submitted legacy applications where the old subscription already
-- records the selected plan. This creates no membership and no new legacy
-- payment; existing pending/succeeded manual payments are linked below.
insert into public.membership_application_revisions (
  application_id,
  organization_id,
  user_id,
  revision_number,
  draft_version,
  plan_type,
  terms_version,
  accepted_terms_at,
  submitted_at,
  full_name,
  birth_date,
  nationality,
  marital_status,
  profession,
  birthplace,
  cpf,
  id_document_number,
  id_document_issuer,
  postal_code,
  address_line,
  city,
  state,
  email,
  phone,
  blood_type,
  has_allergies,
  allergies,
  has_dietary_restrictions,
  dietary_restrictions,
  highline_experience,
  has_rescue_course,
  first_aid_course,
  emergency_contact_name,
  emergency_contact_relationship,
  emergency_contact_phone,
  plan_amount,
  currency,
  pix_copy_paste
)
select
  ma.id,
  ma.organization_id,
  ma.user_id,
  1,
  ma.draft_version,
  s.plan_type,
  o.membership_terms_version,
  coalesce(ma.accepted_terms_at, ma.submitted_at, timezone('utc'::text, now())),
  coalesce(ma.submitted_at, timezone('utc'::text, now())),
  ma.full_name,
  ma.birth_date,
  ma.nationality,
  ma.marital_status,
  ma.profession,
  ma.birthplace,
  ma.cpf,
  ma.id_document_number,
  ma.id_document_issuer,
  ma.postal_code,
  ma.address_line,
  ma.city,
  ma.state,
  ma.email,
  ma.phone,
  ma.blood_type,
  ma.has_allergies,
  ma.allergies,
  ma.has_dietary_restrictions,
  ma.dietary_restrictions,
  ma.highline_experience,
  ma.has_rescue_course,
  ma.first_aid_course,
  ma.emergency_contact_name,
  ma.emergency_contact_relationship,
  ma.emergency_contact_phone,
  case s.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_price_amount
    else o.monthly_price_amount
  end,
  o.billing_currency,
  case s.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_pix_copy_paste
    else o.monthly_pix_copy_paste
  end
from public.membership_applications ma
join public.organizations o on o.id = ma.organization_id
join public.subscriptions s
  on s.organization_id = ma.organization_id
  and s.user_id = ma.user_id
where ma.status = 'submitted'::public.membership_application_status_enum
  and o.organization_type = 'association'::public.organization_type_enum
  and case s.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_price_amount
    else o.monthly_price_amount
  end > 0
  and nullif(btrim(case s.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_pix_copy_paste
    else o.monthly_pix_copy_paste
  end), '') is not null
on conflict (application_id, draft_version) do nothing;

insert into public.payment_obligations (
  organization_id,
  user_id,
  application_revision_id,
  purpose,
  status,
  plan_type,
  amount,
  currency,
  payment_method,
  pix_copy_paste,
  available_at,
  settled_at,
  legacy_payment_id
)
select
  mar.organization_id,
  mar.user_id,
  mar.id,
  'initial_admission'::public.payment_obligation_purpose_enum,
  case
    when legacy_payment.status = 'succeeded'::public.payment_status_enum
      then 'settled'::public.payment_obligation_status_enum
    else 'available'::public.payment_obligation_status_enum
  end,
  mar.plan_type,
  coalesce(legacy_payment.amount, mar.plan_amount),
  mar.currency,
  'manual_pix',
  mar.pix_copy_paste,
  coalesce(legacy_payment.created_at, mar.submitted_at),
  case
    when legacy_payment.status = 'succeeded'::public.payment_status_enum
      then legacy_payment.paid_at
    else null
  end,
  legacy_payment.id
from public.membership_application_revisions mar
left join public.subscriptions s
  on s.organization_id = mar.organization_id
  and s.user_id = mar.user_id
  and s.plan_type = mar.plan_type
left join lateral (
  select p.id, p.amount, p.status, p.created_at, p.paid_at
  from public.payments p
  where p.organization_id = mar.organization_id
    and p.user_id = mar.user_id
    and p.subscription_id = s.id
    and p.payment_provider is null
    and p.provider_payment_id is null
  order by
    case when p.status = 'succeeded'::public.payment_status_enum then 0 else 1 end,
    p.created_at asc
  limit 1
) legacy_payment on true
where mar.plan_amount > 0
  and nullif(btrim(mar.pix_copy_paste), '') is not null
on conflict (application_revision_id, purpose) do nothing;

create or replace function public.submit_association_application(
  p_application_id uuid,
  p_organization_id uuid,
  p_plan_type public.subscription_plan_type_enum,
  p_terms_version text,
  p_draft_version bigint
)
returns table (
  application_revision_id uuid,
  obligation_id uuid,
  organization_id uuid,
  plan_type public.subscription_plan_type_enum,
  amount integer,
  currency text,
  payment_method text,
  obligation_status public.payment_obligation_status_enum,
  available_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  draft_record public.membership_applications%rowtype;
  organization_record public.organizations%rowtype;
  revision_record public.membership_application_revisions%rowtype;
  obligation_record public.payment_obligations%rowtype;
  revision_number integer;
  plan_amount integer;
  pix_payload text;
  submission_timestamp timestamp with time zone;
  terms_accepted_timestamp timestamp with time zone;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_application_id is null
    or p_organization_id is null
    or p_plan_type is null
    or p_terms_version is null
    or p_draft_version is null
    or p_draft_version <= 0 then
    raise exception 'The application submission request is incomplete.'
      using errcode = '22023';
  end if;

  select ma.*
  into draft_record
  from public.membership_applications ma
  where ma.id = p_application_id
  for update;

  if not found then
    raise exception 'Application draft not found.' using errcode = 'P0002';
  end if;

  if draft_record.user_id <> actor_id then
    raise exception 'Application draft is not owned by the current user.'
      using errcode = '42501';
  end if;

  if draft_record.organization_id <> p_organization_id then
    raise exception 'Application draft belongs to a different organization.'
      using errcode = '42501';
  end if;

  -- The revision lookup comes before current billing validation so a retry
  -- returns the original authoritative snapshot even after configuration
  -- changes. The draft row lock serializes identical and concurrent retries.
  select mar.*
  into revision_record
  from public.membership_application_revisions mar
  where mar.application_id = p_application_id
    and mar.draft_version = p_draft_version
  for update;

  if found then
    if revision_record.plan_type <> p_plan_type
      or revision_record.terms_version <> p_terms_version then
      raise exception 'The application was already submitted with different terms or plan.'
        using errcode = '40001';
    end if;

    select po.*
    into obligation_record
    from public.payment_obligations po
    where po.application_revision_id = revision_record.id
      and po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
    for update;

    if not found then
      insert into public.payment_obligations (
        organization_id,
        user_id,
        application_revision_id,
        purpose,
        status,
        plan_type,
        amount,
        currency,
        payment_method,
        pix_copy_paste,
        available_at
      )
      values (
        revision_record.organization_id,
        revision_record.user_id,
        revision_record.id,
        'initial_admission'::public.payment_obligation_purpose_enum,
        'available'::public.payment_obligation_status_enum,
        revision_record.plan_type,
        revision_record.plan_amount,
        revision_record.currency,
        'manual_pix',
        revision_record.pix_copy_paste,
        revision_record.submitted_at
      )
      returning * into obligation_record;
    end if;

    return query
    select
      revision_record.id,
      obligation_record.id,
      obligation_record.organization_id,
      obligation_record.plan_type,
      obligation_record.amount,
      obligation_record.currency,
      obligation_record.payment_method,
      obligation_record.status,
      obligation_record.available_at;
    return;
  end if;

  select o.*
  into organization_record
  from public.organizations o
  where o.id = p_organization_id
  for update;

  if not found then
    raise exception 'Association not found.' using errcode = 'P0002';
  end if;

  if organization_record.organization_type <> 'association'::public.organization_type_enum then
    raise exception 'Applications can only be submitted to associations.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.organization_members om
    where om.organization_id = organization_record.id
      and om.user_id = actor_id
  ) then
    raise exception 'The current person is already associated with this organization.'
      using errcode = '23505';
  end if;

  if p_terms_version <> organization_record.membership_terms_version then
    raise exception 'The association terms have changed. Review and accept the current terms.'
      using errcode = '40001';
  end if;

  if draft_record.draft_version <> p_draft_version then
    raise exception 'The application draft changed. Refresh and try again.'
      using errcode = '40001';
  end if;

  if draft_record.status <> 'draft'::public.membership_application_status_enum
    and draft_record.status <> 'submitted'::public.membership_application_status_enum then
    raise exception 'The application draft is not submittable.' using errcode = '23514';
  end if;

  if nullif(btrim(draft_record.full_name), '') is null
    or draft_record.birth_date is null
    or nullif(btrim(draft_record.nationality), '') is null
    or draft_record.marital_status is null
    or nullif(btrim(draft_record.profession), '') is null
    or nullif(btrim(draft_record.birthplace), '') is null
    or nullif(btrim(draft_record.cpf), '') is null
    or btrim(draft_record.cpf) !~ '^[0-9]{11}$'
    or nullif(btrim(draft_record.id_document_number), '') is null
    or nullif(btrim(draft_record.id_document_issuer), '') is null
    or nullif(btrim(draft_record.postal_code), '') is null
    or btrim(draft_record.postal_code) !~ '^[0-9]{8}$'
    or nullif(btrim(draft_record.address_line), '') is null
    or nullif(btrim(draft_record.city), '') is null
    or nullif(btrim(draft_record.state), '') is null
    or nullif(btrim(draft_record.email), '') is null
    or btrim(draft_record.email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or nullif(btrim(draft_record.phone), '') is null
    or btrim(draft_record.phone) !~ '^[0-9]{10,11}$'
    or draft_record.accepted_terms_at is null
    or draft_record.has_allergies is null
    or (draft_record.has_allergies
      and nullif(btrim(draft_record.allergies), '') is null)
    or draft_record.has_dietary_restrictions is null
    or (draft_record.has_dietary_restrictions
      and nullif(btrim(draft_record.dietary_restrictions), '') is null)
    or draft_record.highline_experience is null
    or draft_record.has_rescue_course is null
    or draft_record.first_aid_course is null
    or nullif(btrim(draft_record.emergency_contact_name), '') is null
    or nullif(btrim(draft_record.emergency_contact_relationship), '') is null
    or nullif(btrim(draft_record.emergency_contact_phone), '') is null
    or btrim(draft_record.emergency_contact_phone) !~ '^[0-9]{10,11}$' then
    raise exception 'Complete all required application fields before submitting.'
      using errcode = '23514';
  end if;

  plan_amount = case p_plan_type
    when 'annual'::public.subscription_plan_type_enum then organization_record.annual_price_amount
    else organization_record.monthly_price_amount
  end;

  pix_payload = case p_plan_type
    when 'annual'::public.subscription_plan_type_enum then organization_record.annual_pix_copy_paste
    else organization_record.monthly_pix_copy_paste
  end;

  if plan_amount is null or plan_amount <= 0
    or nullif(btrim(organization_record.billing_currency), '') is null
    or organization_record.billing_currency !~ '^[A-Z]{3}$'
    or nullif(btrim(pix_payload), '') is null then
    raise exception 'The association payment configuration is incomplete.'
      using errcode = '23514';
  end if;

  terms_accepted_timestamp = timezone('utc'::text, clock_timestamp());
  submission_timestamp = timezone('utc'::text, clock_timestamp());

  select coalesce(max(mar.revision_number), 0) + 1
  into revision_number
  from public.membership_application_revisions mar
  where mar.application_id = p_application_id;

  insert into public.membership_application_revisions (
    application_id,
    organization_id,
    user_id,
    revision_number,
    draft_version,
    plan_type,
    terms_version,
    accepted_terms_at,
    submitted_at,
    full_name,
    birth_date,
    nationality,
    marital_status,
    profession,
    birthplace,
    cpf,
    id_document_number,
    id_document_issuer,
    postal_code,
    address_line,
    city,
    state,
    email,
    phone,
    blood_type,
    has_allergies,
    allergies,
    has_dietary_restrictions,
    dietary_restrictions,
    highline_experience,
    has_rescue_course,
    first_aid_course,
    emergency_contact_name,
    emergency_contact_relationship,
    emergency_contact_phone,
    plan_amount,
    currency,
    pix_copy_paste
  )
  values (
    p_application_id,
    p_organization_id,
    actor_id,
    revision_number,
    p_draft_version,
    p_plan_type,
    p_terms_version,
    terms_accepted_timestamp,
    submission_timestamp,
    draft_record.full_name,
    draft_record.birth_date,
    draft_record.nationality,
    draft_record.marital_status,
    draft_record.profession,
    draft_record.birthplace,
    draft_record.cpf,
    draft_record.id_document_number,
    draft_record.id_document_issuer,
    draft_record.postal_code,
    draft_record.address_line,
    draft_record.city,
    draft_record.state,
    draft_record.email,
    draft_record.phone,
    draft_record.blood_type,
    draft_record.has_allergies,
    draft_record.allergies,
    draft_record.has_dietary_restrictions,
    draft_record.dietary_restrictions,
    draft_record.highline_experience,
    draft_record.has_rescue_course,
    draft_record.first_aid_course,
    draft_record.emergency_contact_name,
    draft_record.emergency_contact_relationship,
    draft_record.emergency_contact_phone,
    plan_amount,
    organization_record.billing_currency,
    pix_payload
  )
  returning * into revision_record;

  insert into public.payment_obligations (
    organization_id,
    user_id,
    application_revision_id,
    purpose,
    status,
    plan_type,
    amount,
    currency,
    payment_method,
    pix_copy_paste,
    available_at
  )
  values (
    p_organization_id,
    actor_id,
    revision_record.id,
    'initial_admission'::public.payment_obligation_purpose_enum,
    'available'::public.payment_obligation_status_enum,
    p_plan_type,
    plan_amount,
    organization_record.billing_currency,
    'manual_pix',
    pix_payload,
    submission_timestamp
  )
  returning * into obligation_record;

  if draft_record.status = 'draft'::public.membership_application_status_enum then
    update public.membership_applications ma
    set
      status = 'submitted'::public.membership_application_status_enum,
      submitted_at = submission_timestamp
    where ma.id = p_application_id;
  end if;

  return query
  select
    revision_record.id,
    obligation_record.id,
    obligation_record.organization_id,
    obligation_record.plan_type,
    obligation_record.amount,
    obligation_record.currency,
    obligation_record.payment_method,
    obligation_record.status,
    obligation_record.available_at;
end;
$$;

comment on function public.submit_association_application(
  uuid,
  uuid,
  public.subscription_plan_type_enum,
  text,
  bigint
) is
  'Atomically snapshots an authenticated association application and creates exactly one initial manual-PIX obligation. Returns no personal application fields.';

revoke all on function public.reject_membership_application_revision_mutation() from public;
revoke all on function public.reject_membership_application_revision_mutation() from anon;
revoke all on function public.reject_membership_application_revision_mutation() from authenticated;

revoke all on function public.submit_membership_application(uuid) from public;
revoke all on function public.submit_membership_application(uuid) from anon;
revoke all on function public.submit_membership_application(uuid) from authenticated;

revoke all on function public.submit_association_application(
  uuid,
  uuid,
  public.subscription_plan_type_enum,
  text,
  bigint
) from public;
revoke all on function public.submit_association_application(
  uuid,
  uuid,
  public.subscription_plan_type_enum,
  text,
  bigint
) from anon;
grant execute on function public.submit_association_application(
  uuid,
  uuid,
  public.subscription_plan_type_enum,
  text,
  bigint
) to authenticated;

create or replace function public.get_payment_obligation_instructions(
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
  available_at timestamp with time zone
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
    po.available_at
  from public.payment_obligations po
  where po.id = p_obligation_id
    and po.user_id = auth.uid();
$$;

comment on function public.get_payment_obligation_instructions(uuid) is
  'Returns authoritative PIX instructions and billing facts for an obligation owned by the signed-in user.';

revoke all on function public.get_payment_obligation_instructions(uuid) from public;
revoke all on function public.get_payment_obligation_instructions(uuid) from anon;
grant execute on function public.get_payment_obligation_instructions(uuid) to authenticated;
