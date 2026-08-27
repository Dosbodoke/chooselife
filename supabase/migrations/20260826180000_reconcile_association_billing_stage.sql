-- Reconcile an already-migrated association billing schema.
--
-- WHY THIS FILE EXISTS
--
-- Staging applied the first version of 20260823144005 before the model was
-- settled, so its migration history already records that version and it will
-- never see the rewritten baseline. Localhost and production, which have not
-- applied it, get the rewritten baseline and arrive at the final model in one
-- step.
--
-- This migration is the second path to the same place. Everything below is
-- written to be safe in BOTH directions:
--
--   * after the rewritten baseline (localhost, production) it is a near no-op,
--     because every object it would create already exists in final form;
--   * after staging's original cutover it performs the whole delta.
--
-- That is why every statement is guarded -- IF EXISTS, IF NOT EXISTS, CREATE
-- OR REPLACE, or a catalog lookup. `ADD CONSTRAINT IF NOT EXISTS` does not
-- exist in Postgres, so constraints are guarded by catalog-checking DO blocks
-- instead of pretending otherwise.
--
-- Review this as operational code, not as schema DDL. The guards are what make
-- staging safe.

-- ---------------------------------------------------------------------------
-- 1. The application lifecycle enum.
--
-- Staging still has the two-value type. Adding values with ALTER TYPE would
-- forbid using them later in this same transaction (SQLSTATE 55P04), and the
-- data fixups below must write `admitted`, so the type is replaced instead.
--
-- Two policies, and two functions that name the type in a signature, depend on
-- it and are cleared first. The functions are recreated further down from the
-- same definitions the baseline installs.
-- ---------------------------------------------------------------------------

do $migration$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'membership_application_status_enum'
      and e.enumlabel = 'refused'
  ) then
    drop policy if exists "Membership application owners can insert drafts"
      on public.membership_applications;
    drop policy if exists "Membership application owners can update drafts"
      on public.membership_applications;
    drop function if exists public.submit_membership_application(uuid);
    drop function if exists public.get_billing_workspace_people(uuid);

    create type public.membership_application_status_enum_next as enum (
      'draft',
      'submitted',
      'admitted',
      'refused'
    );

    alter table public.membership_applications
      alter column status drop default;
    alter table public.membership_applications
      alter column status type public.membership_application_status_enum_next
      using status::text::public.membership_application_status_enum_next;

    drop type public.membership_application_status_enum;
    alter type public.membership_application_status_enum_next
      rename to membership_application_status_enum;

    alter table public.membership_applications
      alter column status set default 'draft'::public.membership_application_status_enum;

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
  end if;
end;
$migration$;

-- ---------------------------------------------------------------------------
-- 2. Data fixups, while the legacy tables are still here to read.
--
-- Staging ran the ORIGINAL conversion, which had two defects the rewritten
-- baseline corrects. Fixing them has to happen before payments and
-- subscriptions are dropped below.
-- ---------------------------------------------------------------------------

do $migration$
begin
  if to_regclass('public.payments') is null then
    return;
  end if;

  -- (a) A member admitted through Stripe or Abacate Pay was left holding an
  -- `available` admission obligation, because the original conversion only
  -- accepted provider-less payments as settlement evidence. Staging would show
  -- a paid-up founding member as owing their admission fee.
  update public.payment_obligations po
  set
    status = 'settled'::public.payment_obligation_status_enum,
    settled_at = evidence.settled_at
  from (
    select
      po_inner.id as obligation_id,
      max(coalesce(p.paid_at, p.settlement_applied_at, p.created_at)) as settled_at
    from public.payment_obligations po_inner
    join public.payments p
      on p.organization_id = po_inner.organization_id
      and p.user_id = po_inner.user_id
      and p.status = 'succeeded'::public.payment_status_enum
    where po_inner.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
      and po_inner.status = 'available'::public.payment_obligation_status_enum
    group by po_inner.id
  ) evidence
  where po.id = evidence.obligation_id;

  -- (b) A submitted application whose applicant had no subscription row got no
  -- revision at all, which left them permanently undecidable. Snapshot them
  -- now, defaulting the plan to monthly exactly as the baseline does.
  insert into public.membership_application_revisions (
    application_id, organization_id, user_id, revision_number, draft_version,
    plan_type, terms_version, accepted_terms_at, submitted_at,
    full_name, birth_date, nationality, marital_status, profession, birthplace,
    cpf, id_document_number, id_document_issuer, postal_code, address_line,
    city, state, email, phone, blood_type, has_allergies, allergies,
    has_dietary_restrictions, dietary_restrictions, highline_experience,
    has_rescue_course, first_aid_course, emergency_contact_name,
    emergency_contact_relationship, emergency_contact_phone,
    plan_amount, currency, pix_copy_paste
  )
  select
    ma.id, ma.organization_id, ma.user_id, 1, ma.draft_version,
    'monthly'::public.subscription_plan_type_enum,
    o.membership_terms_version,
    coalesce(ma.accepted_terms_at, ma.submitted_at, timezone('utc'::text, now())),
    coalesce(ma.submitted_at, timezone('utc'::text, now())),
    ma.full_name, ma.birth_date, ma.nationality, ma.marital_status,
    ma.profession, ma.birthplace, ma.cpf, ma.id_document_number,
    ma.id_document_issuer, ma.postal_code, ma.address_line, ma.city, ma.state,
    ma.email, ma.phone, ma.blood_type, ma.has_allergies, ma.allergies,
    ma.has_dietary_restrictions, ma.dietary_restrictions,
    ma.highline_experience, ma.has_rescue_course, ma.first_aid_course,
    ma.emergency_contact_name, ma.emergency_contact_relationship,
    ma.emergency_contact_phone,
    o.monthly_price_amount, o.billing_currency, o.monthly_pix_copy_paste
  from public.membership_applications ma
  join public.organizations o on o.id = ma.organization_id
  where ma.status = 'submitted'::public.membership_application_status_enum
    and o.organization_type = 'association'::public.organization_type_enum
    and o.monthly_price_amount > 0
    and nullif(btrim(o.monthly_pix_copy_paste), '') is not null
    and not exists (
      select 1
      from public.membership_application_revisions existing
      where existing.application_id = ma.id
    )
  on conflict (application_id, draft_version) do nothing;
end;
$migration$;

-- A settled admission obligation is proof the association admitted this
-- person, so the application leaves the `submitted` queue.
update public.membership_applications ma
set status = 'admitted'::public.membership_application_status_enum
where ma.status = 'submitted'::public.membership_application_status_enum
  and exists (
    select 1
    from public.membership_application_revisions mar
    join public.payment_obligations po
      on po.application_revision_id = mar.id
      and po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
      and po.status = 'settled'::public.payment_obligation_status_enum
    where mar.application_id = ma.id
  );

-- ---------------------------------------------------------------------------
-- 3. Retire the reminder subsystem.
--
-- Reminder policy was never settled, and shipping the delivery pipeline before
-- it is decided means maintaining a queue nobody drains. It comes back as its
-- own change when there is a policy to implement.
-- ---------------------------------------------------------------------------

drop function if exists public.claim_contribution_reminder_batches(integer, integer);
drop function if exists public.claim_contribution_reminder_receipts(integer, integer);
drop function if exists public.enqueue_contribution_reminder_events();
drop function if exists public.enqueue_contribution_reminder_events_at(timestamp with time zone);
drop function if exists public.prepare_contribution_reminder_batch(uuid, uuid, integer);
drop function if exists public.record_contribution_reminder_receipts(jsonb);
drop function if exists public.record_contribution_reminder_send_failure(uuid, uuid, text);
drop function if exists public.record_contribution_reminder_tickets(uuid, uuid, jsonb);
drop function if exists public.refresh_contribution_reminder_batch(uuid);
drop function if exists public.contribution_reminder_backoff(integer);
drop function if exists public.contribution_reminder_delivery_at(date, text, time without time zone);
drop function if exists public.contribution_reminder_stage_for_date(date, date, date);

drop table if exists public.contribution_reminder_batch_events;
drop table if exists public.contribution_reminder_delivery_attempts;
drop table if exists public.contribution_reminder_batches;
drop table if exists public.contribution_reminder_events;

drop type if exists public.contribution_reminder_attempt_status_enum;
drop type if exists public.contribution_reminder_batch_status_enum;
drop type if exists public.contribution_reminder_event_status_enum;
drop type if exists public.contribution_reminder_stage_enum;

alter table public.organizations
  drop column if exists contribution_reminder_local_time;

-- The original cutover installed the scheduler contract in a paused state.
-- Unschedule whatever survived, without assuming pg_cron is installed.
--
-- 'daily-renewal-check' is named explicitly rather than matched by a wildcard.
-- 20251113121601_schedule-payment.sql scheduled it to POST daily to
-- /functions/v1/generate-renewal-payments, and that function no longer exists,
-- so the job would keep hitting a dead endpoint once for every day this
-- database stays up. A wildcard like '%renewal%' works today but would
-- silently swallow an unrelated future job, so the name is spelled out.
--
-- Jobs are unscheduled by iterating over rows that actually exist:
-- cron.unschedule() raises when handed a name it cannot find.
do $migration$
declare
  job_record record;
begin
  if to_regclass('cron.job') is null then
    return;
  end if;

  for job_record in
    execute $sql$
      select jobname
      from cron.job
      where jobname like '%contribution%'
         or jobname = 'daily-renewal-check'
    $sql$
  loop
    execute format('select cron.unschedule(%L)', job_record.jobname);
  end loop;
end;
$migration$;

-- ---------------------------------------------------------------------------
-- 4. Retire the in-place plan change and the legacy settlement path.
--
-- There are no in-place plan changes: a member who wants another plan closes
-- the membership and opens a new one, so the new plan is snapshotted at a new
-- admission instead of being spliced into an existing schedule.
--
-- Admission is an atomic command, so it opens the contribution schedule
-- itself. The membership row trigger that used to do it as a side effect could
-- not report which schedule it had created, and derived the plan from a
-- subscription that no longer exists.
-- ---------------------------------------------------------------------------

drop function if exists public.schedule_contribution_plan_change(
  uuid, date, public.subscription_plan_type_enum);

drop trigger if exists organization_members_sync_contribution_schedule
  on public.organization_members;
drop function if exists public.sync_contribution_schedule_on_membership();

do $migration$
begin
  if to_regclass('public.subscriptions') is not null then
    drop trigger if exists subscriptions_sync_contribution_schedule
      on public.subscriptions;
  end if;
end;
$migration$;
drop function if exists public.sync_contribution_schedule_on_subscription();

drop function if exists public.ensure_contribution_schedule(uuid, uuid, date);
drop function if exists public.reconcile_legacy_payment_obligations(boolean);

-- ---------------------------------------------------------------------------
-- 5. Direct membership mutation is closed.
--
-- These two policies let any signed-in client write organization_members
-- straight from the app, bypassing admission review entirely. The
-- authenticated SELECT policy is deliberately untouched, so membership display
-- does not change.
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can join an organization."
  on public.organization_members;
drop policy if exists "Members can leave an organization."
  on public.organization_members;

revoke insert, update, delete, truncate, references, trigger
  on table public.organization_members from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Immutability guards, relaxed for the person links only.
--
-- Every formal record is protected by a trigger that rejects UPDATE, and those
-- triggers are what make the evidence trustworthy. Two updates now have to get
-- through them, and neither changes what anybody attested to or decided:
--
--   * filling in association_person_id on rows that predate the column, which
--     the section below does;
--   * a deleted Choose Life account arriving as ON DELETE SET NULL.
--
-- is_person_link_maintenance admits exactly those two shapes. Everything else
-- is still rejected. These come first because the backfill below is precisely
-- the update the original guards refuse.
--
-- None of these bodies declare %rowtype, so they can be installed before the
-- tables they reference exist.
-- ---------------------------------------------------------------------------

-- is_person_link_maintenance
CREATE OR REPLACE FUNCTION public.is_person_link_maintenance(p_old jsonb, p_new jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(
    bool_and(
      case changed.key
        -- A deleted Choose Life account arrives here as ON DELETE SET NULL.
        when 'user_id' then jsonb_typeof(p_new -> 'user_id') = 'null'
        when 'actor_user_id' then jsonb_typeof(p_new -> 'actor_user_id') = 'null'
        when 'claimant_user_id' then jsonb_typeof(p_new -> 'claimant_user_id') = 'null'
        -- The subject link is filled in once, on rows that predate the column.
        -- It can be populated but never repointed.
        when 'association_person_id' then
          jsonb_typeof(p_old -> 'association_person_id') = 'null'
          and jsonb_typeof(p_new -> 'association_person_id') <> 'null'
        else false
      end
    ),
    false
  )
  from (
    select o.key
    from jsonb_each(p_old) o
    where o.value is distinct from (p_new -> o.key)
  ) changed;
$function$;

-- resolve_association_person
CREATE OR REPLACE FUNCTION public.resolve_association_person(p_organization_id uuid, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  resolved uuid;
begin
  if p_organization_id is null or p_user_id is null then
    return null;
  end if;

  select ap.id
  into resolved
  from public.association_people ap
  where ap.organization_id = p_organization_id
    and ap.account_user_id = p_user_id;

  if resolved is not null then
    return resolved;
  end if;

  insert into public.association_people (organization_id, account_user_id)
  values (p_organization_id, p_user_id)
  on conflict (organization_id, account_user_id)
    where account_user_id is not null
    do nothing
  returning id into resolved;

  if resolved is null then
    select ap.id
    into resolved
    from public.association_people ap
    where ap.organization_id = p_organization_id
      and ap.account_user_id = p_user_id;
  end if;

  return resolved;
end;
$function$;

-- set_association_person_from_subject
--
-- association_person_id is the durable subject key: NOT NULL, the basis of the
-- partial unique index that enforces one open application per person, and the
-- join key for every person-keyed read and for records retained after account
-- deletion. It must NEVER be client-supplied, so this function overwrites
-- whatever arrived on the row unconditionally. It deliberately has no
-- "already set, leave it alone" early return.
--
-- Do not "simplify" that back. membership_applications is the one
-- subject-keyed table `authenticated` may INSERT into, and its RLS policy
-- constrains only user_id and status, so an early return here made a
-- client-supplied value authoritative. That let any authenticated user bind
-- their draft to another person's formal association identity, occupying that
-- person's single open-application slot and attaching immutable revisions to
-- someone else's subject.
--
-- The policy cannot close the gap on its own. WITH CHECK is evaluated AFTER
-- this BEFORE INSERT trigger on this repo's Postgres image, measured rather
-- than assumed, so an `association_person_id is null` predicate there would
-- reject every legitimate insert instead of only the malicious ones.
CREATE OR REPLACE FUNCTION public.set_association_person_from_subject()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  subject uuid;
begin
  subject := nullif(to_jsonb(new) ->> tg_argv[0], '')::uuid;
  new.association_person_id := public.resolve_association_person(
    new.organization_id,
    subject
  );

  return new;
end;
$function$;

-- set_association_person_from_obligation
CREATE OR REPLACE FUNCTION public.set_association_person_from_obligation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.association_person_id is not null then
    return new;
  end if;

  select po.association_person_id
  into new.association_person_id
  from public.payment_obligations po
  where po.id = new.obligation_id;

  return new;
end;
$function$;

-- reject_membership_departure_mutation
CREATE OR REPLACE FUNCTION public.reject_membership_departure_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'UPDATE'
    and public.is_person_link_maintenance(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;

  raise exception 'Membership periods are append-only.' using errcode = '55000';
end;
$function$;

-- reject_membership_application_revision_mutation
CREATE OR REPLACE FUNCTION public.reject_membership_application_revision_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'UPDATE'
    and public.is_person_link_maintenance(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;

  raise exception 'Submitted application revisions are immutable.'
    using errcode = '55000';
end;
$function$;

-- reject_payment_claim_audit_mutation
CREATE OR REPLACE FUNCTION public.reject_payment_claim_audit_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'UPDATE'
    and public.is_person_link_maintenance(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;

  raise exception 'Payment claim audit events are immutable.'
    using errcode = '55000';
end;
$function$;

-- reject_payment_claim_evidence_mutation
CREATE OR REPLACE FUNCTION public.reject_payment_claim_evidence_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Payment claim evidence is immutable.'
      using errcode = '55000';
  end if;

  if public.is_person_link_maintenance(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;

  if old.id is distinct from new.id
    or old.obligation_id is distinct from new.obligation_id
    or old.organization_id is distinct from new.organization_id
    or old.association_person_id is distinct from new.association_person_id
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
$function$;

-- reject_payment_obligation_context_mutation
CREATE OR REPLACE FUNCTION public.reject_payment_obligation_context_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if public.is_person_link_maintenance(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;

  if old.organization_id is distinct from new.organization_id
    or old.association_person_id is distinct from new.association_person_id
    or old.user_id is distinct from new.user_id
    or old.application_revision_id is distinct from new.application_revision_id
    or old.purpose is distinct from new.purpose
    or old.plan_type is distinct from new.plan_type
    or old.amount is distinct from new.amount
    or old.currency is distinct from new.currency
    or old.payment_method is distinct from new.payment_method
    or old.pix_copy_paste is distinct from new.pix_copy_paste
    or old.available_at is distinct from new.available_at
    or old.schedule_id is distinct from new.schedule_id
    or old.schedule_term_id is distinct from new.schedule_term_id
    or old.period_key is distinct from new.period_key
    or old.period_start is distinct from new.period_start
    or old.period_end is distinct from new.period_end
    or old.available_on is distinct from new.available_on
    or old.due_on is distinct from new.due_on
    or old.billing_timezone is distinct from new.billing_timezone
    or old.billing_due_day is distinct from new.billing_due_day
    or old.billing_lead_days is distinct from new.billing_lead_days
    or old.organization_name_snapshot is distinct from new.organization_name_snapshot
    or old.organization_slug_snapshot is distinct from new.organization_slug_snapshot then
    raise exception 'Payment obligation billing context is immutable.'
      using errcode = '55000';
  end if;

  return new;
end;
$function$;

-- reject_contribution_schedule_anchor_mutation
CREATE OR REPLACE FUNCTION public.reject_contribution_schedule_anchor_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if public.is_person_link_maintenance(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;

  if old.admission_date is distinct from new.admission_date then
    raise exception 'A contribution schedule admission anchor is immutable.'
      using errcode = '55000';
  end if;

  if old.association_person_id is distinct from new.association_person_id then
    raise exception 'A contribution schedule subject is immutable.'
      using errcode = '55000';
  end if;

  if old.cadence is distinct from new.cadence
    or old.due_day is distinct from new.due_day
    or old.lead_days is distinct from new.lead_days
    or old.billing_timezone is distinct from new.billing_timezone
    or old.currency is distinct from new.currency then
    raise exception 'Contribution schedule policy is immutable; append an effective-dated term.'
      using errcode = '55000';
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 7. Membership periods.
--
-- The closed periods live in an append-only side table rather than as a status
-- column on organization_members, because every authorization check in this
-- schema already reads "row exists" as "is an active member".
-- ---------------------------------------------------------------------------

create table if not exists public.organization_membership_departures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid references public.profiles(id) on delete set null,
  departed_role public.organization_role_enum not null,
  joined_at timestamp with time zone not null,
  departed_at timestamp with time zone not null default timezone('utc'::text, now()),
  actor_user_id uuid references public.profiles(id) on delete set null,
  reason text
);

comment on table public.organization_membership_departures is
  'Append-only journal of membership periods that ended. A person with a departure row and no current organization_members row reads as an inactive member.';
comment on column public.organization_membership_departures.actor_user_id is
  'The association admin who ended the membership. Null for a system closure, such as the one account deletion performs.';

alter table public.organization_membership_departures enable row level security;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organization_membership_departures_period_check'
  ) then
    alter table public.organization_membership_departures
      add constraint organization_membership_departures_period_check
      check (departed_at >= joined_at);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'organization_membership_departures_reason_check'
  ) then
    alter table public.organization_membership_departures
      add constraint organization_membership_departures_reason_check
      check (reason is null or char_length(reason) <= 500);
  end if;
end;
$migration$;

create index if not exists organization_membership_departures_org_user_idx
  on public.organization_membership_departures (organization_id, user_id, departed_at desc);
create index if not exists organization_membership_departures_actor_idx
  on public.organization_membership_departures (actor_user_id, departed_at desc)
  where actor_user_id is not null;


revoke all on public.organization_membership_departures from public, anon;
revoke delete, insert, references, trigger, truncate, update
  on public.organization_membership_departures from authenticated;
grant select on public.organization_membership_departures to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Formal association identity, decoupled from the Choose Life account.
--
-- Every formal record used to hang off profiles(id) NOT NULL, so deleting an
-- account was simply refused (SQLSTATE 23503) while the association is obliged
-- to keep exactly what was submitted and decided. association_people is that
-- indirection and carries no personal data: the application revision already
-- IS the retained form.
-- ---------------------------------------------------------------------------

create table if not exists public.association_people (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  anonymized_at timestamp with time zone
);

comment on table public.association_people is
  'One formal association subject. Holds no personal data: the submitted application revision is the retained form. Survives deletion of the linked Choose Life account with account_user_id null, after which only association admins can read the linked formal records.';
comment on column public.association_people.account_user_id is
  'The linked Choose Life account while one exists. Null once the account has been deleted.';
comment on column public.association_people.anonymized_at is
  'When the linked account was prepared for deletion. Null while the account exists.';

alter table public.association_people enable row level security;

create unique index if not exists association_people_account_idx
  on public.association_people (organization_id, account_user_id)
  where account_user_id is not null;
create index if not exists association_people_organization_idx
  on public.association_people (organization_id, created_at desc);

drop policy if exists "People can read their own association subject"
  on public.association_people;
create policy "People can read their own association subject"
  on public.association_people
  for select to authenticated
  using (account_user_id = (select auth.uid()));

drop policy if exists "Association admins can read association subjects"
  on public.association_people;
create policy "Association admins can read association subjects"
  on public.association_people
  for select to authenticated
  using (exists (
    select 1
    from public.organization_members om
    where om.organization_id = association_people.organization_id
      and om.user_id = (select auth.uid())
      and om.role = 'admin'::public.organization_role_enum
  ));

revoke all on table public.association_people from public, anon, authenticated;
grant select on table public.association_people to authenticated;

alter table public.membership_applications
  add column if not exists association_person_id uuid;
alter table public.membership_application_revisions
  add column if not exists association_person_id uuid;
alter table public.organization_membership_departures
  add column if not exists association_person_id uuid;
alter table public.contribution_schedules
  add column if not exists association_person_id uuid;
alter table public.payment_obligations
  add column if not exists association_person_id uuid;
alter table public.payment_claims
  add column if not exists association_person_id uuid;
alter table public.payment_claim_audit_events
  add column if not exists association_person_id uuid;

insert into public.association_people (organization_id, account_user_id)
select distinct subject.organization_id, subject.user_id
from (
  select organization_id, user_id from public.membership_applications
  union
  select organization_id, user_id from public.membership_application_revisions
  union
  select organization_id, user_id from public.organization_membership_departures
  union
  select organization_id, user_id from public.contribution_schedules
  union
  select organization_id, user_id from public.payment_obligations
  union
  select organization_id, claimant_user_id from public.payment_claims
) subject
where subject.organization_id is not null
  and subject.user_id is not null
on conflict do nothing;

update public.membership_applications t
set association_person_id = ap.id
from public.association_people ap
where t.association_person_id is null
  and ap.organization_id = t.organization_id
  and ap.account_user_id = t.user_id;

update public.membership_application_revisions t
set association_person_id = ap.id
from public.association_people ap
where t.association_person_id is null
  and ap.organization_id = t.organization_id
  and ap.account_user_id = t.user_id;

update public.organization_membership_departures t
set association_person_id = ap.id
from public.association_people ap
where t.association_person_id is null
  and ap.organization_id = t.organization_id
  and ap.account_user_id = t.user_id;

update public.contribution_schedules t
set association_person_id = ap.id
from public.association_people ap
where t.association_person_id is null
  and ap.organization_id = t.organization_id
  and ap.account_user_id = t.user_id;

update public.payment_obligations t
set association_person_id = ap.id
from public.association_people ap
where t.association_person_id is null
  and ap.organization_id = t.organization_id
  and ap.account_user_id = t.user_id;

update public.payment_claims t
set association_person_id = ap.id
from public.association_people ap
where t.association_person_id is null
  and ap.organization_id = t.organization_id
  and ap.account_user_id = t.claimant_user_id;

update public.payment_claim_audit_events t
set association_person_id = po.association_person_id
from public.payment_obligations po
where t.association_person_id is null
  and po.id = t.obligation_id;

do $migration$
declare
  offenders text;
begin
  select string_agg(unresolved.detail, ', ' order by unresolved.detail)
  into offenders
  from (
    select format('membership_applications %s', id) as detail
      from public.membership_applications where association_person_id is null
    union all
    select format('membership_application_revisions %s', id)
      from public.membership_application_revisions where association_person_id is null
    union all
    select format('organization_membership_departures %s', id)
      from public.organization_membership_departures where association_person_id is null
    union all
    select format('contribution_schedules %s', id)
      from public.contribution_schedules where association_person_id is null
    union all
    select format('payment_obligations %s', id)
      from public.payment_obligations where association_person_id is null
    union all
    select format('payment_claims %s', id)
      from public.payment_claims where association_person_id is null
    union all
    select format('payment_claim_audit_events %s', id)
      from public.payment_claim_audit_events where association_person_id is null
  ) unresolved;

  if offenders is not null then
    raise exception
      'Stage reconciliation stopped: these formal records could not be linked to an association subject: %',
      offenders;
  end if;
end;
$migration$;

-- Make the subject total, relax the account references, and re-point the
-- foreign keys. ON DELETE CASCADE on contribution_schedules would have deleted
-- the retained schedule and with it the anchor every historical obligation is
-- read against, so the whole set moves together.
do $migration$
declare
  spec record;
begin
  for spec in
    select *
    from (
      values
        ('membership_applications', 'user_id',
         'membership_applications_user_id_fkey',
         'membership_applications_association_person_id_fkey'),
        ('membership_application_revisions', 'user_id',
         'membership_application_revisions_user_id_fkey',
         'membership_application_revisions_association_person_id_fkey'),
        ('organization_membership_departures', 'user_id',
         'organization_membership_departures_user_id_fkey',
         'organization_membership_departures_association_person_id_fkey'),
        ('contribution_schedules', 'user_id',
         'contribution_schedules_user_id_fkey',
         'contribution_schedules_association_person_id_fkey'),
        ('payment_obligations', 'user_id',
         'payment_obligations_user_id_fkey',
         'payment_obligations_association_person_id_fkey'),
        ('payment_claims', 'claimant_user_id',
         'payment_claims_claimant_user_id_fkey',
         'payment_claims_association_person_id_fkey'),
        ('payment_claim_audit_events', 'actor_user_id',
         'payment_claim_audit_events_actor_user_id_fkey',
         'payment_claim_audit_events_association_person_id_fkey')
    ) as t(table_name, account_column, account_fk, person_fk)
  loop
    execute format(
      'alter table public.%I alter column association_person_id set not null',
      spec.table_name
    );

    if not exists (
      select 1 from pg_constraint where conname = spec.person_fk
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (association_person_id) references public.association_people(id)',
        spec.table_name, spec.person_fk
      );
    end if;

    execute format(
      'alter table public.%I alter column %I drop not null',
      spec.table_name, spec.account_column
    );

    execute format('alter table public.%I drop constraint if exists %I',
      spec.table_name, spec.account_fk);
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.profiles(id) on delete set null',
      spec.table_name, spec.account_fk, spec.account_column
    );
  end loop;

  -- The departures actor reference is separate: it is the acting admin, not
  -- the subject, and it is already nullable.
  alter table public.organization_membership_departures
    drop constraint if exists organization_membership_departures_actor_user_id_fkey;
  alter table public.organization_membership_departures
    add constraint organization_membership_departures_actor_user_id_fkey
    foreign key (actor_user_id) references public.profiles(id) on delete set null;
end;
$migration$;

create index if not exists membership_applications_association_person_idx
  on public.membership_applications (association_person_id);
create index if not exists membership_application_revisions_association_person_idx
  on public.membership_application_revisions (association_person_id);
create index if not exists organization_membership_departures_association_person_idx
  on public.organization_membership_departures (association_person_id, departed_at desc);
create index if not exists contribution_schedules_association_person_idx
  on public.contribution_schedules (association_person_id);
create index if not exists payment_obligations_association_person_idx
  on public.payment_obligations (association_person_id);
create index if not exists payment_claims_association_person_idx
  on public.payment_claims (association_person_id);
create index if not exists payment_claim_audit_events_association_person_idx
  on public.payment_claim_audit_events (association_person_id);








-- ---------------------------------------------------------------------------
-- 8b. Identity constraints move onto the subject.
--
-- A partial unique index over the now-nullable user_id is vacuous once
-- accounts start being deleted, because NULLs are all distinct: two deleted
-- subjects in the same association would both satisfy it.
-- ---------------------------------------------------------------------------

alter table public.contribution_schedules
  drop constraint if exists contribution_schedules_organization_id_user_id_key;
drop index if exists public.contribution_schedules_one_active_per_member_idx;
create unique index if not exists contribution_schedules_one_active_per_person_idx
  on public.contribution_schedules (organization_id, association_person_id)
  where active;

alter table public.membership_applications
  drop constraint if exists membership_applications_organization_id_user_id_key;
drop index if exists public.membership_applications_one_open_per_person_idx;
create unique index membership_applications_one_open_per_person_idx
  on public.membership_applications (organization_id, association_person_id)
  where status in (
    'draft'::public.membership_application_status_enum,
    'submitted'::public.membership_application_status_enum
  );

drop index if exists public.membership_applications_person_history_idx;
create index membership_applications_person_history_idx
  on public.membership_applications (organization_id, association_person_id, created_at desc);

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organization_membership_departures_period_key'
  ) then
    alter table public.organization_membership_departures
      add constraint organization_membership_departures_period_key
      unique (organization_id, association_person_id, joined_at);
  end if;
end;
$migration$;

-- ---------------------------------------------------------------------------
-- 9. The command and reader surface.
--
-- These definitions are byte-identical to the ones the rewritten baseline
-- installs, so both paths converge on exactly the same function bodies. They
-- come after the tables because they declare %rowtype over them. The four
-- whose RETURNS clause changed are dropped first: CREATE OR REPLACE cannot
-- change a function's result type.
-- ---------------------------------------------------------------------------

-- ensure_contribution_schedule
CREATE OR REPLACE FUNCTION public.ensure_contribution_schedule(p_organization_id uuid, p_user_id uuid, p_plan_type subscription_plan_type_enum, p_admission_date date DEFAULT NULL::date)
 RETURNS TABLE(schedule_id uuid, assignment_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  organization_record public.organizations%rowtype;
  schedule_record public.contribution_schedules%rowtype;
  assignment_record public.contribution_plan_assignments%rowtype;
  admission_date_value date;
  cadence_value public.contribution_cadence_enum;
  amount_value integer;
  pix_value text;
begin
  if p_plan_type is null then
    raise exception 'A contribution plan is required.' using errcode = '22023';
  end if;

  select o.*
  into organization_record
  from public.organizations o
  where o.id = p_organization_id
    and o.organization_type = 'association'::public.organization_type_enum
  for update;

  if not found then
    return;
  end if;

  if not public.is_valid_billing_timezone(organization_record.billing_timezone)
    or organization_record.billing_due_day not between 1 and 31
    or organization_record.billing_lead_days not between 0 and 31
    or organization_record.billing_currency !~ '^[A-Z]{3}$' then
    raise exception 'The association billing policy is invalid.' using errcode = '23514';
  end if;

  cadence_value := case
    when p_plan_type = 'annual'::public.subscription_plan_type_enum
      then 'annual'::public.contribution_cadence_enum
    else 'monthly'::public.contribution_cadence_enum
  end;
  amount_value := case p_plan_type
    when 'annual'::public.subscription_plan_type_enum
      then organization_record.annual_price_amount
    else organization_record.monthly_price_amount
  end;
  pix_value := case p_plan_type
    when 'annual'::public.subscription_plan_type_enum
      then organization_record.annual_pix_copy_paste
    else organization_record.monthly_pix_copy_paste
  end;

  if amount_value is null or amount_value <= 0
    or nullif(btrim(pix_value), '') is null then
    raise exception 'The association contribution price or PIX configuration is incomplete.'
      using errcode = '23514';
  end if;

  -- A retried admission must find the schedule it already opened. A REJOIN must
  -- not: the pre-departure schedule is deactivated and stays that way, so the
  -- new membership is anchored on the new admission date instead of silently
  -- inheriting the old anchor and backfilling the absence.
  select cs.*
  into schedule_record
  from public.contribution_schedules cs
  where cs.organization_id = p_organization_id
    and cs.user_id = p_user_id
    and cs.active
  for update;

  if not found then
    admission_date_value := coalesce(
      p_admission_date,
      (
        select timezone(organization_record.billing_timezone, om.joined_at)::date
        from public.organization_members om
        where om.organization_id = p_organization_id
          and om.user_id = p_user_id
      ),
      timezone(organization_record.billing_timezone, clock_timestamp())::date
    );

    insert into public.contribution_schedules (
      organization_id,
      user_id,
      cadence,
      admission_date,
      due_day,
      lead_days,
      billing_timezone,
      currency,
      active
    )
    values (
      p_organization_id,
      p_user_id,
      cadence_value,
      admission_date_value,
      organization_record.billing_due_day,
      organization_record.billing_lead_days,
      organization_record.billing_timezone,
      organization_record.billing_currency,
      true
    )
    returning * into schedule_record;
  end if;

  select cpa.*
  into assignment_record
  from public.contribution_plan_assignments cpa
  where cpa.schedule_id = schedule_record.id
    and cpa.effective_period_start = schedule_record.admission_date
  for update;

  if not found then
    insert into public.contribution_plan_assignments (
      schedule_id,
      effective_period_start,
      plan_type,
      amount,
      currency,
      due_day,
      lead_days,
      billing_timezone,
      pix_copy_paste
    )
    values (
      schedule_record.id,
      schedule_record.admission_date,
      p_plan_type,
      amount_value,
      organization_record.billing_currency,
      schedule_record.due_day,
      schedule_record.lead_days,
      schedule_record.billing_timezone,
      pix_value
    )
    returning * into assignment_record;
  end if;

  return query select schedule_record.id, assignment_record.id;
end;
$function$;

-- approve_initial_claim
drop function if exists public.approve_initial_claim(uuid);
CREATE OR REPLACE FUNCTION public.approve_initial_claim(p_claim_id uuid)
 RETURNS TABLE(claim_id uuid, obligation_id uuid, claim_status payment_claim_status_enum, obligation_status payment_obligation_status_enum, membership_user_id uuid, schedule_id uuid, assignment_id uuid, audit_event_id uuid, decision_applied_now boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := auth.uid();
  claim_record public.payment_claims%rowtype;
  organization_record public.organizations%rowtype;
  reviewer_membership public.organization_members%rowtype;
  obligation_record public.payment_obligations%rowtype;
  revision_record public.membership_application_revisions%rowtype;
  application_record public.membership_applications%rowtype;
  applicant_membership public.organization_members%rowtype;
  audit_record public.payment_claim_audit_events%rowtype;
  schedule_id_value uuid;
  assignment_id_value uuid;
  audit_found boolean;
  decision_timestamp timestamp with time zone := timezone('utc'::text, clock_timestamp());
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

  -- Lock the applicant membership in the same order for approve and reject so
  -- concurrent decisions stay deterministic.
  select om.*
  into applicant_membership
  from public.organization_members om
  where om.organization_id = obligation_record.organization_id
    and om.user_id = obligation_record.user_id
  for update;

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

    select cs.id, cpa.id
    into schedule_id_value, assignment_id_value
    from public.contribution_schedules cs
    left join public.contribution_plan_assignments cpa
      on cpa.schedule_id = cs.id
      and cpa.effective_period_start = cs.admission_date
    where cs.organization_id = obligation_record.organization_id
      and cs.user_id = obligation_record.user_id
      and cs.active;

    if applicant_membership.user_id is null
      or schedule_id_value is null
      or application_record.status <> 'admitted'::public.membership_application_status_enum then
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
      schedule_id_value,
      assignment_id_value,
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

  -- Only the newest submitted revision of this application is actionable. A
  -- correction supersedes its predecessor rather than deleting it.
  if exists (
    select 1
    from public.membership_application_revisions newer
    where newer.application_id = application_record.id
      and (
        newer.revision_number > revision_record.revision_number
        or (
          newer.revision_number = revision_record.revision_number
          and newer.id > revision_record.id
        )
      )
  ) then
    raise exception 'A newer submission supersedes this claim. Refresh before deciding.'
      using errcode = '40001';
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

  -- Admission opens the contribution schedule and snapshots the plan the
  -- applicant actually attested to. A rejoin gets a brand new anchor.
  select ensured.schedule_id, ensured.assignment_id
  into schedule_id_value, assignment_id_value
  from public.ensure_contribution_schedule(
    obligation_record.organization_id,
    obligation_record.user_id,
    revision_record.plan_type,
    timezone(organization_record.billing_timezone, decision_timestamp)::date
  ) ensured;

  if schedule_id_value is null then
    raise exception 'The association contribution schedule could not be opened.'
      using errcode = '23514';
  end if;

  update public.membership_applications ma
  set status = 'admitted'::public.membership_application_status_enum
  where ma.id = application_record.id;

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
    schedule_id_value,
    assignment_id_value,
    audit_record.id,
    true;
end;
$function$;

-- reject_initial_claim
drop function if exists public.reject_initial_claim(uuid, text);
CREATE OR REPLACE FUNCTION public.reject_initial_claim(p_claim_id uuid, p_reason text)
 RETURNS TABLE(claim_id uuid, obligation_id uuid, application_id uuid, application_status membership_application_status_enum, claim_status payment_claim_status_enum, obligation_status payment_obligation_status_enum, decision_reason text, audit_event_id uuid, decision_applied_now boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := auth.uid();
  claim_record public.payment_claims%rowtype;
  organization_record public.organizations%rowtype;
  reviewer_membership public.organization_members%rowtype;
  obligation_record public.payment_obligations%rowtype;
  revision_record public.membership_application_revisions%rowtype;
  application_record public.membership_applications%rowtype;
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

    -- Refusal is one atomic outcome, so a replay must find all three parts.
    if application_record.status <> 'refused'::public.membership_application_status_enum
      or obligation_record.status <> 'void'::public.payment_obligation_status_enum then
      raise exception 'The refused application is missing its refusal effects.'
        using errcode = '23514';
    end if;

    return query
    select
      claim_record.id,
      obligation_record.id,
      application_record.id,
      application_record.status,
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

  -- One refusal action refuses the application, rejects the claim, and voids
  -- the obligation. Nothing is deleted: the revision, the payer identity, the
  -- claim and the audit trail all stay readable as the evidence of what was
  -- decided. A correction is a new application, not an edit of this one.
  update public.membership_applications ma
  set status = 'refused'::public.membership_application_status_enum
  where ma.id = application_record.id;

  update public.payment_obligations po
  set status = 'void'::public.payment_obligation_status_enum
  where po.id = obligation_record.id;

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
    application_record.id,
    'refused'::public.membership_application_status_enum,
    'rejected'::public.payment_claim_status_enum,
    'void'::public.payment_obligation_status_enum,
    normalized_reason,
    audit_record.id,
    true;
end;
$function$;

-- generate_membership_billing_obligations_at
drop function if exists public.generate_membership_billing_obligations_at(timestamp with time zone);
CREATE OR REPLACE FUNCTION public.generate_membership_billing_obligations_at(p_as_of timestamp with time zone)
 RETURNS TABLE(schedule_id uuid, period_key text, obligation_id uuid, result text, failure_reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  evaluated_at timestamp with time zone := coalesce(p_as_of, clock_timestamp());
  schedule_record record;
  assignment_record record;
  term_count integer;
  local_date_value date;
  due_date_value date;
  next_due_date_value date;
  period_key_value text;
  period_start_value date;
  period_end_value date;
  available_on_value date;
  created_obligation public.payment_obligations%rowtype;
  existing_obligation public.payment_obligations%rowtype;
  cadence_value public.contribution_cadence_enum;
begin
  if evaluated_at is null then
    raise exception 'The generation clock is required.' using errcode = '22023';
  end if;

  for schedule_record in
    select
      cs.*,
      o.name as organization_name,
      o.slug as organization_slug
    from public.contribution_schedules cs
    join public.organizations o on o.id = cs.organization_id
    join public.organization_members om
      on om.organization_id = cs.organization_id
      and om.user_id = cs.user_id
    where cs.active
      and o.organization_type = 'association'::public.organization_type_enum
      and om.role in (
        'admin'::public.organization_role_enum,
        'member'::public.organization_role_enum
      )
    order by cs.organization_id, cs.user_id
  loop
    begin
      if not public.is_valid_billing_timezone(schedule_record.billing_timezone)
        or schedule_record.due_day not between 1 and 31
        or schedule_record.lead_days not between 0 and 31
        or schedule_record.currency !~ '^[A-Z]{3}$' then
        schedule_id := schedule_record.id;
        period_key := null;
        obligation_id := null;
        result := 'failed';
        failure_reason := 'The contribution schedule billing policy is invalid.';
        return next;
        continue;
      end if;

      local_date_value := timezone(
        schedule_record.billing_timezone,
        evaluated_at
      )::date;
      term_count := 0;

      for assignment_record in
        select
          cpa.*,
          lead(cpa.effective_period_start) over (
            order by cpa.effective_period_start, cpa.id
          ) as next_effective_period_start
        from public.contribution_plan_assignments cpa
        where cpa.schedule_id = schedule_record.id
        order by cpa.effective_period_start, cpa.id
      loop
        term_count := term_count + 1;
        cadence_value := case
          when assignment_record.plan_type = 'annual'::public.subscription_plan_type_enum
            then 'annual'::public.contribution_cadence_enum
          else 'monthly'::public.contribution_cadence_enum
        end;

        if assignment_record.due_day is null
          or assignment_record.due_day not between 1 and 31
          or assignment_record.lead_days is null
          or assignment_record.lead_days not between 0 and 31
          or not public.is_valid_billing_timezone(assignment_record.billing_timezone)
          or assignment_record.currency !~ '^[A-Z]{3}$'
          or assignment_record.amount is null
          or assignment_record.amount <= 0 then
          schedule_id := schedule_record.id;
          period_key := null;
          obligation_id := null;
          result := 'failed';
          failure_reason := 'The recurring billing term is invalid or has no positive price.';
          return next;
          continue;
        end if;

        due_date_value := public.recurring_due_date_on_or_after(
          schedule_record.admission_date,
          cadence_value,
          assignment_record.due_day,
          greatest(
            schedule_record.admission_date,
            assignment_record.effective_period_start
          )
        );

        while due_date_value - assignment_record.lead_days <= local_date_value loop
          if assignment_record.next_effective_period_start is not null
            and due_date_value >= assignment_record.next_effective_period_start then
            exit;
          end if;

          next_due_date_value := public.next_recurring_due_date(
            due_date_value,
            cadence_value,
            assignment_record.due_day
          );
          period_start_value := due_date_value;
          period_end_value := next_due_date_value - 1;
          available_on_value := due_date_value - assignment_record.lead_days;
          period_key_value := public.recurring_period_key(
            cadence_value,
            due_date_value
          );

          if nullif(btrim(assignment_record.pix_copy_paste), '') is null then
            schedule_id := schedule_record.id;
            period_key := period_key_value;
            obligation_id := null;
            result := 'failed';
            failure_reason := 'No PIX snapshot exists for the recurring period.';
            return next;
            due_date_value := next_due_date_value;
            continue;
          end if;

          created_obligation := null;
          existing_obligation := null;

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
            schedule_id,
            schedule_term_id,
            period_key,
            period_start,
            period_end,
            available_on,
            due_on,
            billing_timezone,
            billing_due_day,
            billing_lead_days,
            organization_name_snapshot,
            organization_slug_snapshot
          )
          values (
            schedule_record.organization_id,
            schedule_record.user_id,
            null,
            'recurring'::public.payment_obligation_purpose_enum,
            'available'::public.payment_obligation_status_enum,
            assignment_record.plan_type,
            assignment_record.amount,
            assignment_record.currency,
            'manual_pix',
            assignment_record.pix_copy_paste,
            available_on_value::timestamp at time zone assignment_record.billing_timezone,
            schedule_record.id,
            assignment_record.id,
            period_key_value,
            period_start_value,
            period_end_value,
            available_on_value,
            due_date_value,
            assignment_record.billing_timezone,
            assignment_record.due_day,
            assignment_record.lead_days,
            schedule_record.organization_name,
            schedule_record.organization_slug
          )
          on conflict on constraint payment_obligations_schedule_period_key
          do nothing
          returning * into created_obligation;

          if created_obligation.id is null then
            select po.*
            into existing_obligation
            from public.payment_obligations po
            where po.schedule_id = schedule_record.id
              and po.period_key = period_key_value
              and po.purpose = 'recurring'::public.payment_obligation_purpose_enum;
          else
            existing_obligation := created_obligation;
          end if;

          schedule_id := schedule_record.id;
          period_key := period_key_value;
          obligation_id := existing_obligation.id;
          result := case
            when created_obligation.id is null then 'already_exists'
            else 'created'
          end;
          failure_reason := null;
          return next;

          due_date_value := next_due_date_value;
        end loop;
      end loop;

      if term_count = 0 then
        schedule_id := schedule_record.id;
        period_key := null;
        obligation_id := null;
        result := 'failed';
        failure_reason := 'No effective-dated billing term exists for the schedule.';
        return next;
      end if;
    exception
      when others then
        schedule_id := schedule_record.id;
        period_key := null;
        obligation_id := null;
        result := 'failed';
        failure_reason := sqlerrm;
        return next;
    end;
  end loop;
end;
$function$;

-- get_billing_workspace_members
CREATE OR REPLACE FUNCTION public.get_billing_workspace_members(p_organization_id uuid)
 RETURNS TABLE(member_user_id uuid, member_name text, member_handle text, member_profile_picture text, member_role organization_role_enum, joined_at timestamp with time zone, financial_standing text, overdue_count bigint, oldest_attention_due_on date, plan_type subscription_plan_type_enum, last_verified_contribution_at timestamp with time zone, next_due_on date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    om.user_id,
    member_profile.name,
    member_profile.username,
    member_profile.profile_picture,
    om.role,
    om.joined_at,
    case
      when coalesce(financial.overdue_count, 0) > 0 then 'overdue'
      when coalesce(financial.payment_available_count, 0) > 0 then 'payment_available'
      when coalesce(financial.under_review_count, 0) > 0 then 'under_review'
      else 'up_to_date'
    end,
    coalesce(financial.overdue_count, 0),
    financial.oldest_attention_due_on,
    current_term.plan_type,
    financial.last_verified_contribution_at,
    financial.next_due_on
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  join public.profiles member_profile on member_profile.id = om.user_id
  left join lateral (
    select cpa.plan_type
    from public.contribution_plan_assignments cpa
    join public.contribution_schedules cs on cs.id = cpa.schedule_id
    where cs.organization_id = om.organization_id
      and cs.user_id = om.user_id
      and cs.active
      and cpa.effective_period_start <= timezone(o.billing_timezone, clock_timestamp())::date
    order by cpa.effective_period_start desc, cpa.id desc
    limit 1
  ) current_term on true
  left join lateral (
    select
      count(*) filter (
        where po.purpose = 'recurring'::public.payment_obligation_purpose_enum
          and po.status not in (
            'settled'::public.payment_obligation_status_enum,
            'void'::public.payment_obligation_status_enum
          )
          and po.due_on < timezone(
            coalesce(po.billing_timezone, o.billing_timezone),
            clock_timestamp()
          )::date
      ) as overdue_count,
      count(*) filter (
        where po.status not in (
            'settled'::public.payment_obligation_status_enum,
            'void'::public.payment_obligation_status_enum
          )
          and not exists (
            select 1
            from public.payment_claims pc
            where pc.obligation_id = po.id
              and pc.status = 'under_review'::public.payment_claim_status_enum
          )
          and (
            (
              po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
              and po.available_at <= clock_timestamp()
            )
            or (
              po.purpose = 'recurring'::public.payment_obligation_purpose_enum
              and po.available_on <= timezone(
                coalesce(po.billing_timezone, o.billing_timezone),
                clock_timestamp()
              )::date
            )
          )
      ) as payment_available_count,
      count(*) filter (
        where po.status not in (
          'settled'::public.payment_obligation_status_enum,
          'void'::public.payment_obligation_status_enum
        )
        and exists (
          select 1
          from public.payment_claims pc
          where pc.obligation_id = po.id
            and pc.status = 'under_review'::public.payment_claim_status_enum
        )
      ) as under_review_count,
      min(
        case
          when po.status not in (
            'settled'::public.payment_obligation_status_enum,
            'void'::public.payment_obligation_status_enum
          )
          and (
            po.due_on < timezone(
              coalesce(po.billing_timezone, o.billing_timezone),
              clock_timestamp()
            )::date
            or po.available_at <= clock_timestamp()
            or po.available_on <= timezone(
              coalesce(po.billing_timezone, o.billing_timezone),
              clock_timestamp()
            )::date
            or exists (
              select 1
              from public.payment_claims pc
              where pc.obligation_id = po.id
                and pc.status = 'under_review'::public.payment_claim_status_enum
            )
          ) then po.due_on
        end
      ) as oldest_attention_due_on,
      max(
        case
          when po.status = 'settled'::public.payment_obligation_status_enum
            then po.settled_at
        end
      ) as last_verified_contribution_at,
      min(
        case
          when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
            and po.status not in (
              'settled'::public.payment_obligation_status_enum,
              'void'::public.payment_obligation_status_enum
            )
            and po.due_on >= timezone(
              coalesce(po.billing_timezone, o.billing_timezone),
              clock_timestamp()
            )::date
            then po.due_on
        end
      ) as next_due_on
    from public.payment_obligations po
    where po.organization_id = om.organization_id
      and po.user_id = om.user_id
  ) financial on true
  where p_organization_id is not null
    and om.organization_id = p_organization_id
    and o.organization_type = 'association'::public.organization_type_enum
    and om.role in (
      'admin'::public.organization_role_enum,
      'member'::public.organization_role_enum
    )
    and exists (
      select 1
      from public.organization_members reviewer_membership
      where reviewer_membership.organization_id = om.organization_id
        and reviewer_membership.user_id = (select auth.uid())
        and reviewer_membership.role = 'admin'::public.organization_role_enum
    )
  order by member_profile.name, member_profile.username, om.user_id;
$function$;

-- get_billing_workspace_people
drop function if exists public.get_billing_workspace_people(uuid);
CREATE OR REPLACE FUNCTION public.get_billing_workspace_people(p_organization_id uuid)
 RETURNS TABLE(member_user_id uuid, member_name text, member_handle text, member_profile_picture text, member_role organization_role_enum, lifecycle_status text, application_status membership_application_status_enum, joined_at timestamp with time zone, plan_type subscription_plan_type_enum, last_verified_contribution_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_organization_id is null then
    raise exception 'Organization is required.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organizations o
    where o.id = p_organization_id
      and o.organization_type = 'association'::public.organization_type_enum
  ) then
    raise exception 'Association was not found.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = (select auth.uid())
      and om.role = 'admin'::public.organization_role_enum
  ) then
    raise exception 'You are not authorized to view this association.'
      using errcode = '42501';
  end if;

  return query
  with eligible_people as (
    select
      om.user_id,
      om.role,
      'active'::text as lifecycle_status,
      null::public.membership_application_status_enum as application_status,
      om.joined_at
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.role in (
        'admin'::public.organization_role_enum,
        'member'::public.organization_role_enum
      )

    union all

    select
      ma.user_id,
      null::public.organization_role_enum,
      'pending'::text,
      ma.status,
      ma.created_at
    from public.membership_applications ma
    where ma.organization_id = p_organization_id
      and ma.status = 'submitted'::public.membership_application_status_enum
      and not exists (
        select 1
        from public.organization_members active_member
        where active_member.organization_id = ma.organization_id
          and active_member.user_id = ma.user_id
          and active_member.role in (
            'admin'::public.organization_role_enum,
            'member'::public.organization_role_enum
          )
      )

    union all

    select
      departure.user_id,
      departure.departed_role,
      'inactive'::text,
      null::public.membership_application_status_enum,
      departure.joined_at
    from public.organization_membership_departures departure
    where departure.organization_id = p_organization_id
      and not exists (
        select 1
        from public.organization_members active_member
        where active_member.organization_id = departure.organization_id
          and active_member.user_id = departure.user_id
          and active_member.role in (
            'admin'::public.organization_role_enum,
            'member'::public.organization_role_enum
          )
      )
  ),
  people as (
    select distinct on (eligible.user_id)
      eligible.user_id,
      eligible.role,
      eligible.lifecycle_status,
      eligible.application_status,
      eligible.joined_at
    from eligible_people eligible
    order by
      eligible.user_id,
      -- Somebody who left and re-applied reads as pending, not as an
      -- ex-member, and somebody who rejoined reads as active. One row per
      -- person, whatever their history.
      case eligible.lifecycle_status
        when 'active' then 0
        when 'pending' then 1
        else 2
      end,
      eligible.joined_at desc
  )
  select
    people.user_id,
    profile.name::text,
    profile.username::text,
    profile.profile_picture,
    people.role,
    people.lifecycle_status,
    coalesce(people.application_status, latest_application.status),
    people.joined_at,
    coalesce(current_term.plan_type, latest_revision.plan_type),
    contribution_history.last_verified_contribution_at
  from people
  join public.profiles profile on profile.id = people.user_id
  left join lateral (
    select ma.status
    from public.membership_applications ma
    where ma.organization_id = p_organization_id
      and ma.user_id = people.user_id
    order by ma.updated_at desc, ma.id desc
    limit 1
  ) latest_application on true
  left join lateral (
    select assignment.plan_type
    from public.contribution_schedules schedule
    join public.contribution_plan_assignments assignment
      on assignment.schedule_id = schedule.id
    join public.organizations organization_record
      on organization_record.id = schedule.organization_id
    where schedule.organization_id = p_organization_id
      and schedule.user_id = people.user_id
      and schedule.active
      and assignment.effective_period_start <= timezone(
        organization_record.billing_timezone,
        clock_timestamp()
      )::date
    order by assignment.effective_period_start desc, assignment.id desc
    limit 1
  ) current_term on true
  left join lateral (
    select revision.plan_type
    from public.membership_applications application_record
    join public.membership_application_revisions revision
      on revision.application_id = application_record.id
    where application_record.organization_id = p_organization_id
      and application_record.user_id = people.user_id
    order by revision.submitted_at desc, revision.id desc
    limit 1
  ) latest_revision on true
  left join lateral (
    select max(obligation.settled_at) as last_verified_contribution_at
    from public.payment_obligations obligation
    where obligation.organization_id = p_organization_id
      and obligation.user_id = people.user_id
      and obligation.status = 'settled'::public.payment_obligation_status_enum
  ) contribution_history on true
  order by profile.name, profile.username, people.user_id;
end;
$function$;

-- get_association_member_detail
CREATE OR REPLACE FUNCTION public.get_association_member_detail(p_organization_id uuid, p_user_id uuid)
 RETURNS TABLE(member_user_id uuid, member_name text, member_handle text, member_profile_picture text, member_role organization_role_enum, lifecycle_status text, joined_at timestamp with time zone, departed_at timestamp with time zone, departure_reason text, application_id uuid, application_revision_id uuid, revision_number integer, submitted_at timestamp with time zone, plan_type subscription_plan_type_enum, terms_version text, accepted_terms_at timestamp with time zone, full_name text, birth_date date, nationality text, marital_status marital_status_enum, profession text, birthplace text, cpf text, id_document_number text, id_document_issuer text, postal_code text, address_line text, city text, state text, email text, phone text, blood_type blood_type_enum, has_allergies boolean, allergies text, has_dietary_restrictions boolean, dietary_restrictions text, highline_experience highline_experience_enum, has_rescue_course boolean, first_aid_course first_aid_course_enum, emergency_contact_name text, emergency_contact_relationship text, emergency_contact_phone text, next_charge_period_key text, next_charge_due_on date, next_charge_amount integer, next_charge_currency text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_organization_id is null or p_user_id is null then
    raise exception 'Organization and person are required.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organizations o
    where o.id = p_organization_id
      and o.organization_type = 'association'::public.organization_type_enum
  ) then
    raise exception 'Association was not found.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = (select auth.uid())
      and om.role = 'admin'::public.organization_role_enum
  ) then
    raise exception 'You are not authorized to view this association.'
      using errcode = '42501';
  end if;

  return query
  select
    profile.id,
    profile.name::text,
    profile.username::text,
    profile.profile_picture,
    membership.role,
    case
      when membership.user_id is not null then 'active'
      when submitted_application.id is not null then 'pending'
      when departure.id is not null then 'inactive'
      else 'unknown'
    end::text,
    -- "Member since" reads from whichever record actually starts the current
    -- relationship: the live membership, the membership that ended, or -- for
    -- somebody still waiting -- the day they applied.
    coalesce(
      membership.joined_at,
      departure.joined_at,
      submitted_application.created_at
    ),
    -- A rejoined active member must not be presented with their old departure
    -- as their current state, so the closed period is only reported when
    -- there is no live membership.
    case when membership.user_id is null then departure.departed_at end,
    case when membership.user_id is null then departure.reason end,
    revision.application_id,
    revision.id,
    revision.revision_number,
    revision.submitted_at,
    revision.plan_type,
    revision.terms_version,
    revision.accepted_terms_at,
    revision.full_name,
    revision.birth_date,
    revision.nationality,
    revision.marital_status,
    revision.profession,
    revision.birthplace,
    revision.cpf,
    revision.id_document_number,
    revision.id_document_issuer,
    revision.postal_code,
    revision.address_line,
    revision.city,
    revision.state,
    revision.email,
    revision.phone,
    revision.blood_type,
    revision.has_allergies,
    revision.allergies,
    revision.has_dietary_restrictions,
    revision.dietary_restrictions,
    revision.highline_experience,
    revision.has_rescue_course,
    revision.first_aid_course,
    revision.emergency_contact_name,
    revision.emergency_contact_relationship,
    revision.emergency_contact_phone,
    next_charge.period_key,
    next_charge.due_on,
    next_charge.amount,
    next_charge.currency
  from public.profiles profile
  left join public.organization_members membership
    on membership.organization_id = p_organization_id
    and membership.user_id = profile.id
    and membership.role in (
      'admin'::public.organization_role_enum,
      'member'::public.organization_role_enum
    )
  left join lateral (
    select ma.id, ma.created_at
    from public.membership_applications ma
    where ma.organization_id = p_organization_id
      and ma.user_id = profile.id
      and ma.status = 'submitted'::public.membership_application_status_enum
    order by ma.created_at desc, ma.id desc
    limit 1
  ) submitted_application on true
  left join lateral (
    select d.id, d.joined_at, d.departed_at, d.reason
    from public.organization_membership_departures d
    where d.organization_id = p_organization_id
      and d.user_id = profile.id
    order by d.departed_at desc, d.id desc
  limit 1
  ) departure on true
  -- The newest SUBMITTED snapshot. Never the live application row: an
  -- applicant can keep editing a draft, and the revision is the immutable
  -- record of what they actually attested to.
  left join lateral (
    select rev.*
    from public.membership_application_revisions rev
    where rev.organization_id = p_organization_id
      and rev.user_id = profile.id
    order by rev.submitted_at desc, rev.revision_number desc, rev.id desc
    limit 1
  ) revision on true
  -- The next charge the member will owe, derived rather than stored: the
  -- obligation generator runs on a schedule, so for most of a billing cycle
  -- the upcoming period has no row yet -- and "when is my next payment due" is
  -- exactly what an admin gets asked on the phone.
  --
  -- Anchored on the newest existing obligation so the derived period can never
  -- collide with a real one. A departure deactivates the schedule, so an
  -- ex-member correctly has no next charge.
  left join lateral (
    select
      public.recurring_period_key(schedule.cadence, upcoming.due_on) as period_key,
      upcoming.due_on,
      term.amount,
      term.currency
    from public.contribution_schedules schedule
    left join lateral (
      select po.due_on
      from public.payment_obligations po
      where po.organization_id = p_organization_id
        and po.user_id = profile.id
        and po.purpose = 'recurring'::public.payment_obligation_purpose_enum
      order by po.due_on desc, po.id desc
      limit 1
    ) last_obligation on true
    cross join lateral (
      select case
        when last_obligation.due_on is not null then
          public.next_recurring_due_date(
            last_obligation.due_on,
            schedule.cadence,
            schedule.due_day
          )
        else
          public.recurring_due_date_on_or_after(
            schedule.admission_date,
            schedule.cadence,
            schedule.due_day,
            timezone(schedule.billing_timezone, clock_timestamp())::date
          )
      end as due_on
    ) upcoming
    -- The term EFFECTIVE for the upcoming period, not merely the latest one on
    -- file. Ordering by effective_period_start alone would quote a future
    -- price for a charge that falls before that price takes effect.
    left join lateral (
      select a.amount, a.currency
      from public.contribution_plan_assignments a
      where a.schedule_id = schedule.id
        and a.effective_period_start <= upcoming.due_on
      order by a.effective_period_start desc, a.id desc
      limit 1
    ) term on true
    where schedule.organization_id = p_organization_id
      and schedule.user_id = profile.id
      and schedule.active
    limit 1
  ) next_charge on true
  where profile.id = p_user_id;
end;
$function$;

-- end_association_membership
CREATE OR REPLACE FUNCTION public.end_association_membership(p_organization_id uuid, p_user_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text)
 RETURNS TABLE(departure_id uuid, organization_id uuid, user_id uuid, departed_role organization_role_enum, departed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := (select auth.uid());
  target_id uuid := coalesce(p_user_id, (select auth.uid()));
  membership public.organization_members%rowtype;
  inserted public.organization_membership_departures%rowtype;
  normalized_reason text;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_organization_id is null then
    raise exception 'Organization is required.' using errcode = '22023';
  end if;

  normalized_reason := nullif(
    btrim(regexp_replace(coalesce(p_reason, ''), '\s+', ' ', 'g')),
    ''
  );

  if normalized_reason is not null and char_length(normalized_reason) > 500 then
    raise exception 'The reason is too long.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organizations o
    where o.id = p_organization_id
      and o.organization_type = 'association'::public.organization_type_enum
  ) then
    raise exception 'Association was not found.' using errcode = 'P0002';
  end if;

  -- Ending a membership is an admin action, whoever the member is. A member
  -- cannot end their own membership from the app.
  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = actor_id
      and om.role = 'admin'::public.organization_role_enum
  ) then
    raise exception 'You are not authorized to end this membership.'
      using errcode = '42501';
  end if;

  select * into membership
  from public.organization_members om
  where om.organization_id = p_organization_id
    and om.user_id = target_id
  for update;

  if not found then
    raise exception 'This person is not a current member of the association.'
      using errcode = 'P0002';
  end if;

  insert into public.organization_membership_departures (
    organization_id,
    user_id,
    departed_role,
    joined_at,
    actor_user_id,
    reason
  )
  values (
    p_organization_id,
    target_id,
    membership.role,
    membership.joined_at,
    actor_id,
    normalized_reason
  )
  returning * into inserted;

  delete from public.organization_members om
  where om.organization_id = p_organization_id
    and om.user_id = target_id;

  -- Stops generate_membership_billing_obligations from minting new periods.
  -- The schedule is kept, deactivated, so its obligations stay readable and so
  -- a rejoin opens a fresh schedule instead of reviving this anchor.
  update public.contribution_schedules cs
  set active = false
  where cs.organization_id = p_organization_id
    and cs.user_id = target_id
    and cs.active;

  return query
  select
    inserted.id,
    inserted.organization_id,
    inserted.user_id,
    inserted.departed_role,
    inserted.departed_at;
end;
$function$;

-- prepare_association_account_deletion
CREATE OR REPLACE FUNCTION public.prepare_association_account_deletion(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  person_record public.association_people%rowtype;
  membership public.organization_members%rowtype;
begin
  if p_user_id is null then
    raise exception 'A person is required.' using errcode = '22023';
  end if;

  for person_record in
    select ap.*
    from public.association_people ap
    where ap.account_user_id = p_user_id
    order by ap.id
    for update
  loop
    select om.*
    into membership
    from public.organization_members om
    where om.organization_id = person_record.organization_id
      and om.user_id = p_user_id
    for update;

    if found then
      insert into public.organization_membership_departures (
        organization_id,
        association_person_id,
        user_id,
        departed_role,
        joined_at,
        actor_user_id,
        reason
      )
      values (
        person_record.organization_id,
        person_record.id,
        p_user_id,
        membership.role,
        membership.joined_at,
        null,
        'Account deleted.'
      )
      on conflict (organization_id, association_person_id, joined_at) do nothing;

      delete from public.organization_members om
      where om.organization_id = person_record.organization_id
        and om.user_id = p_user_id;
    end if;

    update public.contribution_schedules cs
    set active = false
    where cs.association_person_id = person_record.id
      and cs.active;

    update public.association_people ap
    set
      account_user_id = null,
      anonymized_at = timezone('utc'::text, clock_timestamp())
    where ap.id = person_record.id;
  end loop;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 10. Trigger wiring.
--
-- These come after the function section because a trigger cannot reference a
-- function that does not exist yet, and the function bodies in turn declare
-- %rowtype variables over the tables created above -- which is why the tables
-- come first and the wiring last.
-- ---------------------------------------------------------------------------

drop trigger if exists organization_membership_departures_append_only
  on public.organization_membership_departures;
create trigger organization_membership_departures_append_only
before update or delete on public.organization_membership_departures
for each row execute function public.reject_membership_departure_mutation();
drop trigger if exists membership_applications_set_association_person
  on public.membership_applications;
create trigger membership_applications_set_association_person
before insert on public.membership_applications
for each row execute function public.set_association_person_from_subject('user_id');
drop trigger if exists membership_application_revisions_set_association_person
  on public.membership_application_revisions;
create trigger membership_application_revisions_set_association_person
before insert on public.membership_application_revisions
for each row execute function public.set_association_person_from_subject('user_id');
drop trigger if exists organization_membership_departures_set_association_person
  on public.organization_membership_departures;
create trigger organization_membership_departures_set_association_person
before insert on public.organization_membership_departures
for each row execute function public.set_association_person_from_subject('user_id');
drop trigger if exists contribution_schedules_set_association_person
  on public.contribution_schedules;
create trigger contribution_schedules_set_association_person
before insert on public.contribution_schedules
for each row execute function public.set_association_person_from_subject('user_id');
drop trigger if exists payment_obligations_set_association_person
  on public.payment_obligations;
create trigger payment_obligations_set_association_person
before insert on public.payment_obligations
for each row execute function public.set_association_person_from_subject('user_id');
drop trigger if exists payment_claims_set_association_person
  on public.payment_claims;
create trigger payment_claims_set_association_person
before insert on public.payment_claims
for each row execute function public.set_association_person_from_subject('claimant_user_id');
drop trigger if exists payment_claim_audit_events_set_association_person
  on public.payment_claim_audit_events;
create trigger payment_claim_audit_events_set_association_person
before insert on public.payment_claim_audit_events
for each row execute function public.set_association_person_from_obligation();

-- ---------------------------------------------------------------------------
-- 10b. Owner reads resolve through the subject.
--
-- While the account exists these select exactly the rows `user_id =
-- auth.uid()` did. Once it is deleted, account_user_id is null and the
-- predicate goes empty, leaving association admins as the only readers.
-- ---------------------------------------------------------------------------

-- Owner-only here made the retention rule unreachable: once the account is
-- gone the owner predicate is empty, and get_association_member_detail is
-- anchored on profiles, so the row the association must keep had no reader.
drop policy if exists "Application owners can read their submitted revisions"
  on public.membership_application_revisions;
drop policy if exists "Owners and association admins can read submitted revisions"
  on public.membership_application_revisions;
create policy "Owners and association admins can read submitted revisions"
  on public.membership_application_revisions
  for select to authenticated
  using (
    exists (
      select 1
      from public.association_people ap
      where ap.id = membership_application_revisions.association_person_id
        and ap.account_user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id = membership_application_revisions.organization_id
        and om.user_id = (select auth.uid())
        and om.role = 'admin'::public.organization_role_enum
    )
  );

drop policy if exists "Association admins can read payment obligations"
  on public.payment_obligations;
drop policy if exists "Obligation owners can read their obligations"
  on public.payment_obligations;
drop policy if exists "Owners and association admins can read payment obligations"
  on public.payment_obligations;
create policy "Owners and association admins can read payment obligations"
  on public.payment_obligations
  for select to authenticated
  using (
    exists (
      select 1
      from public.association_people ap
      where ap.id = payment_obligations.association_person_id
        and ap.account_user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.organization_members om
      join public.organizations o on o.id = om.organization_id
      where om.organization_id = payment_obligations.organization_id
        and om.user_id = (select auth.uid())
        and om.role = 'admin'::public.organization_role_enum
        and o.organization_type = 'association'::public.organization_type_enum
    )
  );

drop policy if exists "Claimants can read their own payment claims"
  on public.payment_claims;
drop policy if exists "Organization admins can read payment claims"
  on public.payment_claims;
drop policy if exists "Claimants and organization admins can read payment claims"
  on public.payment_claims;
create policy "Claimants and organization admins can read payment claims"
  on public.payment_claims
  for select to authenticated
  using (
    exists (
      select 1
      from public.association_people ap
      where ap.id = payment_claims.association_person_id
        and ap.account_user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id = payment_claims.organization_id
        and om.user_id = (select auth.uid())
        and om.role = 'admin'::public.organization_role_enum
    )
  );

drop policy if exists "Organization admins can read payment claim audit events"
  on public.payment_claim_audit_events;
drop policy if exists "Claimants can read their own payment claim audit events"
  on public.payment_claim_audit_events;
drop policy if exists "Claimants and admins can read claim audit"
  on public.payment_claim_audit_events;
create policy "Claimants and admins can read claim audit"
  on public.payment_claim_audit_events
  for select to authenticated
  using (
    exists (
      select 1
      from public.association_people ap
      where ap.id = payment_claim_audit_events.association_person_id
        and ap.account_user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id = payment_claim_audit_events.organization_id
        and om.user_id = (select auth.uid())
        and om.role = 'admin'::public.organization_role_enum
    )
  );

drop policy if exists "Members and association admins can read schedules"
  on public.contribution_schedules;
create policy "Members and association admins can read schedules"
  on public.contribution_schedules
  for select to authenticated
  using (
    exists (
      select 1
      from public.association_people ap
      where ap.id = contribution_schedules.association_person_id
        and ap.account_user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id = contribution_schedules.organization_id
        and om.user_id = (select auth.uid())
        and om.role = 'admin'::public.organization_role_enum
    )
  );

drop policy if exists "Members and association admins can read plan snapshots"
  on public.contribution_plan_assignments;
create policy "Members and association admins can read plan snapshots"
  on public.contribution_plan_assignments
  for select to authenticated
  using (exists (
    select 1
    from public.contribution_schedules cs
    where cs.id = contribution_plan_assignments.schedule_id
      and (
        exists (
          select 1
          from public.association_people ap
          where ap.id = cs.association_person_id
            and ap.account_user_id = (select auth.uid())
        )
        or exists (
          select 1
          from public.organization_members om
          where om.organization_id = cs.organization_id
            and om.user_id = (select auth.uid())
            and om.role = 'admin'::public.organization_role_enum
        )
      )
  ));

drop policy if exists "Departed members can read their own departures"
  on public.organization_membership_departures;
drop policy if exists "Association admins can read departures"
  on public.organization_membership_departures;
drop policy if exists "Former members and admins can read membership periods"
  on public.organization_membership_departures;
create policy "Former members and admins can read membership periods"
  on public.organization_membership_departures
  for select to authenticated
  using (
    exists (
      select 1
      from public.association_people ap
      where ap.id = organization_membership_departures.association_person_id
        and ap.account_user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id = organization_membership_departures.organization_id
        and om.user_id = (select auth.uid())
        and om.role = 'admin'::public.organization_role_enum
    )
  );

-- Functions created or replaced above carry no comments: they are generated
-- from their live definitions, and pg_get_functiondef does not include
-- COMMENT ON. Restoring them keeps both paths byte-identical.
comment on function public.approve_initial_claim(uuid) is
  'Atomically verifies an actionable initial claim, settles its obligation, admits the applicant, opens the contribution schedule with its admission plan snapshot, marks the application admitted, and appends one audit event.';
comment on function public.reject_initial_claim(uuid, text) is
  'The unified refusal command. Atomically refuses the application, rejects the current claim, voids that obligation, records one required normalized reason, and appends one audit event. No revision, payer identity, claim or audit row is ever deleted; a correction is submitted as a new application.';
comment on function public.get_billing_workspace_people(uuid) is
  'Returns the organization-scoped people ledger: active members, pending applicants, and inactive ex-members, one row per person. Unsubmitted drafts are excluded.';
comment on function public.resolve_association_person(uuid, uuid) is
  'Returns the formal association subject for one account in one organization, creating it on first use.';
comment on function public.prepare_association_account_deletion(uuid) is
  'Prepares one Choose Life account for deletion: journals any still-active association membership as a closure, removes the membership authorization, deactivates the contribution schedules, and severs the account link so only association admins retain access. Deletes no formal record. Service role only.';
comment on function public.is_person_link_maintenance(jsonb, jsonb) is
  'True when an update changes nothing except the links between a formal record and its people: an account reference set to null (the shape a deleted Choose Life account produces through ON DELETE SET NULL), or the subject reference populated for the first time. Neither alters what a person attested to or what an admin decided, so the immutability guards allow exactly these and nothing else.';
comment on function public.get_association_member_detail(uuid, uuid) is
  'Admin-only person-addressed detail for the ledger drawer: current relationship dates plus the newest submitted application snapshot. A closed membership period is reported only when there is no live membership, so a rejoined member is never shown as departed.';
comment on function public.ensure_contribution_schedule(uuid, uuid, public.subscription_plan_type_enum, date) is
  'Opens (or idempotently returns) the active contribution schedule and its admission-effective plan snapshot for one association member. A deactivated pre-departure schedule is never revived, so a rejoin is anchored on its own admission date.';
comment on function public.end_association_membership(uuid, uuid, text) is
  'Ends one current association membership, journalling it as an immutable membership period and deactivating the contribution schedule. Callable only by an association admin, who may end their own membership. Existing obligations stay owed.';

-- ---------------------------------------------------------------------------
-- 11. Privileges on the reviewed command surface.
-- ---------------------------------------------------------------------------

revoke all on function public.is_person_link_maintenance(jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.resolve_association_person(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.set_association_person_from_subject()
  from public, anon, authenticated, service_role;
revoke all on function public.set_association_person_from_obligation()
  from public, anon, authenticated, service_role;
revoke all on function public.reject_membership_departure_mutation()
  from public, anon, authenticated, service_role;
revoke all on function public.reject_membership_application_revision_mutation()
  from public, anon, authenticated, service_role;
revoke all on function public.reject_payment_claim_audit_mutation()
  from public, anon, authenticated, service_role;
revoke all on function public.reject_payment_claim_evidence_mutation()
  from public, anon, authenticated, service_role;
revoke all on function public.reject_payment_obligation_context_mutation()
  from public, anon, authenticated, service_role;
revoke all on function public.reject_contribution_schedule_anchor_mutation()
  from public, anon, authenticated, service_role;
revoke all on function public.ensure_contribution_schedule(
  uuid, uuid, public.subscription_plan_type_enum, date)
  from public, anon, authenticated, service_role;
revoke all on function public.generate_membership_billing_obligations_at(
  timestamp with time zone)
  from public, anon, authenticated, service_role;

revoke all on function public.approve_initial_claim(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.reject_initial_claim(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.get_billing_workspace_members(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_billing_workspace_people(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_association_member_detail(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.end_association_membership(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.prepare_association_account_deletion(uuid)
  from public, anon, authenticated, service_role;

grant execute on function
  public.approve_initial_claim(uuid),
  public.reject_initial_claim(uuid, text),
  public.get_billing_workspace_members(uuid),
  public.get_billing_workspace_people(uuid),
  public.get_association_member_detail(uuid, uuid),
  public.end_association_membership(uuid, uuid, text)
to authenticated;

grant execute on function
  public.prepare_association_account_deletion(uuid)
to service_role;

-- ---------------------------------------------------------------------------
-- 12. Retire the legacy provider model.
--
-- Manual PIX obligations and claims are the only payment model now. Future
-- gateways attach transactions to an obligation instead of reviving a parallel
-- one.
--
-- Every row and provider identifier in payments and subscriptions is deleted,
-- including rows belonging to organizations that are not associations. That is
-- intentional and is not a blocker.
--
-- One thing is deliberately NOT reconstructed: a canceled subscription
-- belonging to somebody no longer in organization_members is a membership that
-- ended before periods were journalled. subscriptions carries no created_at
-- and no departure date, so a membership period would have to be invented. The
-- payment evidence survives in their revision and admission obligation; the
-- unreconstructable dates are discarded rather than fabricated.
-- ---------------------------------------------------------------------------

alter table public.payment_obligations
  drop constraint if exists payment_obligations_legacy_payment_id_fkey;
alter table public.payment_obligations
  drop constraint if exists payment_obligations_legacy_payment_id_key;
alter table public.payment_obligations
  drop column if exists legacy_payment_id;

do $migration$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'payments'
  ) then
    alter publication supabase_realtime drop table public.payments;
  end if;
end;
$migration$;

do $migration$
begin
  if to_regclass('public.payments') is not null then
    drop trigger if exists payments_apply_succeeded_effects on public.payments;
  end if;
end;
$migration$;

drop function if exists public.apply_succeeded_payment_effects();
drop function if exists public.apply_payment_settlement_effects(uuid);
drop function if exists public.mark_payment_succeeded_manually(uuid, timestamp with time zone);
drop function if exists public.mark_manual_payment_paid_by_user(uuid);
drop function if exists public.get_manual_payment_instructions(uuid);

drop table if exists public.payments;
drop table if exists public.subscriptions;

drop type if exists public.payment_status_enum;
drop type if exists public.subscription_status_enum;

-- ---------------------------------------------------------------------------
-- 13. Preconditions.
--
-- These are the checks that make running this against staging safe. They come
-- last because they assert the END state, and they raise rather than leave a
-- half-converted ledger behind: the migration runs in one transaction, so a
-- failure here rolls back everything above.
-- ---------------------------------------------------------------------------

do $migration$
declare
  offenders text;
begin
  select string_agg(
    format('(organization %s, user %s)', om.organization_id, om.user_id),
    ', '
    order by om.organization_id, om.user_id
  )
  into offenders
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  where o.organization_type = 'association'::public.organization_type_enum
    and om.role in (
      'admin'::public.organization_role_enum,
      'member'::public.organization_role_enum
    )
    and (
      select count(*)
      from public.contribution_schedules cs
      where cs.organization_id = om.organization_id
        and cs.user_id = om.user_id
        and cs.active
    ) <> 1;

  if offenders is not null then
    raise exception
      'Stage reconciliation stopped: these active association members do not have exactly one active contribution schedule: %',
      offenders;
  end if;

  select string_agg(format('(schedule %s)', cs.id), ', ' order by cs.id)
  into offenders
  from public.contribution_schedules cs
  where cs.active
    and not exists (
      select 1
      from public.contribution_plan_assignments cpa
      where cpa.schedule_id = cs.id
        and cpa.effective_period_start <= cs.admission_date
    );

  if offenders is not null then
    raise exception
      'Stage reconciliation stopped: these active contribution schedules have no effective plan term: %',
      offenders;
  end if;

  select string_agg(format('(revision %s)', mar.id), ', ' order by mar.id)
  into offenders
  from public.membership_application_revisions mar
  where not exists (
    select 1
    from public.payment_obligations po
    where po.application_revision_id = mar.id
      and po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
  );

  if offenders is not null then
    raise exception
      'Stage reconciliation stopped: these submitted revisions have no initial admission obligation, so they could never be decided: %',
      offenders;
  end if;
end;
$migration$;
