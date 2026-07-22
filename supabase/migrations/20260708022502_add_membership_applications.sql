create type public.marital_status_enum as enum (
  'single',
  'married',
  'divorced',
  'widowed',
  'legally_separated',
  'common_law'
);

create type public.blood_type_enum as enum (
  'a_pos',
  'a_neg',
  'b_pos',
  'b_neg',
  'ab_pos',
  'ab_neg',
  'o_pos',
  'o_neg'
);

create type public.highline_experience_enum as enum (
  'beginner',
  'athlete',
  'professional'
);

create type public.first_aid_course_enum as enum (
  'updated',
  'outdated',
  'none'
);

create type public.membership_application_status_enum as enum (
  'draft',
  'submitted'
);

create table public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references public.profiles(id),
  status public.membership_application_status_enum not null default 'draft',
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
  allergies text,
  dietary_restrictions text,
  highline_experience public.highline_experience_enum,
  has_rescue_course boolean,
  first_aid_course public.first_aid_course_enum,
  emergency_contact_name text,
  emergency_contact_relationship text,
  emergency_contact_phone text,
  accepted_terms_at timestamp with time zone,
  submitted_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (organization_id, user_id)
);

comment on table public.membership_applications is 'In-app membership onboarding applications keyed to an organization and signed-in user.';
comment on column public.membership_applications.accepted_terms_at is 'When the user accepted the membership terms before entering onboarding.';
comment on column public.membership_applications.submitted_at is 'When the user completed and submitted the onboarding application.';

create or replace function public.set_membership_applications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create trigger membership_applications_updated_at
before update on public.membership_applications
for each row
execute function public.set_membership_applications_updated_at();

alter table public.membership_applications enable row level security;

create policy "Membership application owners can select"
  on public.membership_applications
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Membership application owners can insert drafts"
  on public.membership_applications
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'draft'::public.membership_application_status_enum
  );

create policy "Membership application owners can update drafts"
  on public.membership_applications
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and status = 'draft'::public.membership_application_status_enum
  )
  with check (
    (select auth.uid()) = user_id
    and status = 'draft'::public.membership_application_status_enum
  );

create or replace function public.submit_membership_application(
  p_application_id uuid
)
returns table (
  id uuid,
  organization_id uuid,
  user_id uuid,
  status public.membership_application_status_enum,
  submitted_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  application_record public.membership_applications%rowtype;
begin
  select *
  into application_record
  from public.membership_applications ma
  where ma.id = p_application_id
  for update;

  if not found then
    raise exception 'Membership application % was not found.', p_application_id
      using errcode = 'P0002';
  end if;

  if application_record.user_id <> auth.uid() then
    raise exception 'Membership application % does not belong to the current user.', p_application_id
      using errcode = '42501';
  end if;

  if application_record.status <> 'draft'::public.membership_application_status_enum then
    raise exception 'Only draft membership applications can be submitted.'
      using errcode = '23514';
  end if;

  if nullif(btrim(application_record.full_name), '') is null
    or application_record.birth_date is null
    or application_record.marital_status is null
    or nullif(btrim(application_record.profession), '') is null
    or nullif(btrim(application_record.cpf), '') is null
    or nullif(btrim(application_record.id_document_issuer), '') is null
    or nullif(btrim(application_record.postal_code), '') is null
    or nullif(btrim(application_record.city), '') is null
    or nullif(btrim(application_record.state), '') is null
    or nullif(btrim(application_record.email), '') is null
    or application_record.highline_experience is null
    or application_record.has_rescue_course is null
    or application_record.first_aid_course is null
    or nullif(btrim(application_record.emergency_contact_name), '') is null
    or nullif(btrim(application_record.emergency_contact_relationship), '') is null
    or nullif(btrim(application_record.emergency_contact_phone), '') is null
    or application_record.accepted_terms_at is null then
    raise exception 'Membership application % is missing required fields.', p_application_id
      using errcode = '23514';
  end if;

  return query
  update public.membership_applications ma
  set
    status = 'submitted'::public.membership_application_status_enum,
    submitted_at = timezone('utc'::text, now())
  where ma.id = p_application_id
  returning
    ma.id,
    ma.organization_id,
    ma.user_id,
    ma.status,
    ma.submitted_at;
end;
$$;

comment on function public.submit_membership_application(uuid) is 'Submits a draft membership application owned by the signed-in user after required-field validation.';

revoke all on table public.membership_applications from public;
revoke all on table public.membership_applications from anon;
grant select, insert, update on table public.membership_applications to authenticated;

revoke all on function public.set_membership_applications_updated_at() from public;
revoke all on function public.set_membership_applications_updated_at() from anon;

revoke all on function public.submit_membership_application(uuid) from public;
revoke all on function public.submit_membership_application(uuid) from anon;
grant execute on function public.submit_membership_application(uuid) to authenticated;
