SET check_function_bodies = false;
DROP POLICY "Allow all users to insert push tokens" ON public.push_tokens;
DROP POLICY "Allow all users to read push tokens" ON public.push_tokens;
DROP POLICY "Allow authenticated users to update their own push tokens" ON public.push_tokens;

-- The membership application lifecycle grows from two states to the four the
-- association actually decides between: draft, submitted, admitted, refused.
--
-- The type is REPLACED rather than extended with `ALTER TYPE ... ADD VALUE`.
-- Postgres refuses to use a newly added enum value inside the transaction that
-- added it (SQLSTATE 55P04), and this migration must both add the states and
-- write them while converting existing applications. The swap has no such
-- restriction. Two policies and one retired command depend on the old type and
-- are handled first; a column type cannot be altered while a policy references
-- it (SQLSTATE 0A000).
DROP FUNCTION IF EXISTS public.submit_membership_application(uuid);
DROP POLICY "Membership application owners can insert drafts" ON public.membership_applications;
DROP POLICY "Membership application owners can update drafts" ON public.membership_applications;

CREATE TYPE public.membership_application_status_enum_next AS ENUM (
  'draft',
  'submitted',
  'admitted',
  'refused'
);

ALTER TABLE public.membership_applications
  ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.membership_applications
  ALTER COLUMN status TYPE public.membership_application_status_enum_next
  USING status::text::public.membership_application_status_enum_next;

DROP TYPE public.membership_application_status_enum;
ALTER TYPE public.membership_application_status_enum_next
  RENAME TO membership_application_status_enum;

ALTER TABLE public.membership_applications
  ALTER COLUMN status SET DEFAULT 'draft'::public.membership_application_status_enum;

CREATE POLICY "Membership application owners can insert drafts"
  ON public.membership_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    and status = 'draft'::public.membership_application_status_enum
  );

CREATE POLICY "Membership application owners can update drafts"
  ON public.membership_applications
  FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    and status = 'draft'::public.membership_application_status_enum
  )
  WITH CHECK (
    (select auth.uid()) = user_id
    and status = 'draft'::public.membership_application_status_enum
  );
CREATE TYPE public.contribution_cadence_enum AS ENUM ('monthly', 'annual');
CREATE TYPE public.organization_type_enum AS ENUM ('group', 'association');
CREATE TYPE public.payment_claim_payer_type_enum AS ENUM ('applicant', 'other');
CREATE TYPE public.payment_claim_status_enum AS ENUM ('under_review', 'approved', 'rejected');
CREATE TYPE public.payment_obligation_purpose_enum AS ENUM ('initial_admission', 'recurring');
CREATE TYPE public.payment_obligation_status_enum AS ENUM ('available', 'settled', 'void');
CREATE FUNCTION public.approve_initial_claim(p_claim_id uuid)
 RETURNS TABLE(claim_id uuid, obligation_id uuid, claim_status public.payment_claim_status_enum, obligation_status public.payment_obligation_status_enum, membership_user_id uuid, schedule_id uuid, assignment_id uuid, audit_event_id uuid, decision_applied_now boolean)
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
COMMENT ON FUNCTION public.approve_initial_claim(uuid) IS 'Atomically verifies an actionable initial claim, settles its obligation, admits the applicant, opens the contribution schedule with its admission plan snapshot, marks the application admitted, and appends one audit event.';
REVOKE ALL ON FUNCTION public.approve_initial_claim(uuid) FROM anon;
CREATE FUNCTION public.approve_recurring_payment_claim(p_claim_id uuid)
 RETURNS TABLE(claim_id uuid, obligation_id uuid, claim_status public.payment_claim_status_enum, obligation_status public.payment_obligation_status_enum, audit_event_id uuid, decision_applied_now boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := (select auth.uid());
  claim_record public.payment_claims%rowtype;
  obligation_record public.payment_obligations%rowtype;
  audit_record public.payment_claim_audit_events%rowtype;
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
    raise exception 'This claim is unavailable to the current reviewer.' using errcode = '42501';
  end if;

  if claim_record.claimant_user_id = actor_id
    or not exists (
      select 1
      from public.organization_members om
      join public.organizations o on o.id = om.organization_id
      where om.organization_id = claim_record.organization_id
        and om.user_id = actor_id
        and om.role = 'admin'::public.organization_role_enum
        and o.organization_type = 'association'::public.organization_type_enum
    ) then
    raise exception 'Association admin access is required.' using errcode = '42501';
  end if;

  select po.*
  into obligation_record
  from public.payment_obligations po
  where po.id = claim_record.obligation_id
  for update;

  if not found
    or obligation_record.purpose <> 'recurring'::public.payment_obligation_purpose_enum then
    raise exception 'This claim is not a recurring contribution claim.' using errcode = '40001';
  end if;

  if claim_record.status = 'approved'::public.payment_claim_status_enum then
    select pcae.*
    into audit_record
    from public.payment_claim_audit_events pcae
    where pcae.claim_id = claim_record.id
      and pcae.next_state = 'payment_settled'
    order by pcae.created_at asc, pcae.id asc
    limit 1;

    return query
    select
      claim_record.id,
      obligation_record.id,
      claim_record.status,
      obligation_record.status,
      audit_record.id,
      false;
    return;
  end if;

  if claim_record.status <> 'under_review'::public.payment_claim_status_enum
    or obligation_record.status <> 'available'::public.payment_obligation_status_enum then
    raise exception 'This claim is no longer actionable. Refresh before deciding.'
      using errcode = '40001';
  end if;

  perform set_config('app.payment_claim_decision_command', 'on', true);

  update public.payment_claims pc
  set
    status = 'approved'::public.payment_claim_status_enum,
    decided_at = timezone('utc'::text, clock_timestamp()),
    decision_reason = null
  where pc.id = claim_record.id;

  update public.payment_obligations po
  set
    status = 'settled'::public.payment_obligation_status_enum,
    settled_at = timezone('utc'::text, clock_timestamp())
  where po.id = obligation_record.id;

  perform set_config('app.payment_claim_decision_command', 'off', true);

  insert into public.payment_claim_audit_events (
    organization_id,
    obligation_id,
    claim_id,
    actor_user_id,
    previous_state,
    next_state,
    reason
  )
  values (
    claim_record.organization_id,
    claim_record.obligation_id,
    claim_record.id,
    actor_id,
    'under_review',
    'payment_settled',
    null
  )
  returning * into audit_record;

  return query
  select
    claim_record.id,
    obligation_record.id,
    'approved'::public.payment_claim_status_enum,
    'settled'::public.payment_obligation_status_enum,
    audit_record.id,
    true;
end;
$function$;
COMMENT ON FUNCTION public.approve_recurring_payment_claim(uuid) IS 'Atomically verifies a recurring contribution claim and settles only that obligation.';
REVOKE ALL ON FUNCTION public.approve_recurring_payment_claim(uuid) FROM anon;
CREATE FUNCTION public.claim_initial_payment(p_obligation_id uuid, p_paid_by_applicant boolean, p_payer_name text DEFAULT NULL::text)
 RETURNS TABLE(claim_id uuid, obligation_id uuid, payer_type public.payment_claim_payer_type_enum, payer_name text, claim_status public.payment_claim_status_enum, claim_created_at timestamp with time zone, audit_event_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
COMMENT ON FUNCTION public.claim_initial_payment(uuid,boolean,text) IS 'Atomically records one authenticated applicant claim for an available initial manual-PIX obligation without settling it or creating membership.';
REVOKE ALL ON FUNCTION public.claim_initial_payment(uuid, boolean, text) FROM anon;
CREATE FUNCTION public.claim_recurring_payment(p_obligation_id uuid, p_paid_by_applicant boolean, p_payer_name text DEFAULT NULL::text)
 RETURNS TABLE(claim_id uuid, obligation_id uuid, payer_type public.payment_claim_payer_type_enum, payer_name text, claim_status public.payment_claim_status_enum, claim_created_at timestamp with time zone, audit_event_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := (select auth.uid());
  organization_record public.organizations%rowtype;
  obligation_record public.payment_obligations%rowtype;
  existing_claim public.payment_claims%rowtype;
  audit_record public.payment_claim_audit_events%rowtype;
  inserted_claim public.payment_claims%rowtype;
  normalized_payer_name text;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  normalized_payer_name := nullif(
    btrim(regexp_replace(coalesce(p_payer_name, ''), '\\s+', ' ', 'g')),
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

  if normalized_payer_name is not null and char_length(normalized_payer_name) > 120 then
    raise exception 'Payer name must be 120 characters or fewer.' using errcode = '22023';
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

  select o.*
  into organization_record
  from public.organizations o
  where o.id = obligation_record.organization_id
    and o.organization_type = 'association'::public.organization_type_enum;

  if not found then
    raise exception 'Payment obligation is unavailable.' using errcode = '42501';
  end if;

  if obligation_record.purpose <> 'recurring'::public.payment_obligation_purpose_enum
    or obligation_record.status <> 'available'::public.payment_obligation_status_enum
    or obligation_record.available_on > timezone(
      coalesce(obligation_record.billing_timezone, organization_record.billing_timezone),
      clock_timestamp()
    )::date
    or obligation_record.payment_method <> 'manual_pix'
    or nullif(btrim(obligation_record.pix_copy_paste), '') is null
    or not exists (
      select 1
      from public.organization_members om
      where om.organization_id = obligation_record.organization_id
        and om.user_id = actor_id
        and om.role in (
          'admin'::public.organization_role_enum,
          'member'::public.organization_role_enum
        )
    ) then
    raise exception 'This recurring contribution cannot be claimed.' using errcode = '23514';
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
    or existing_claim.payer_name is distinct from (
      case
        when p_paid_by_applicant then null
        else normalized_payer_name
      end
    ) then
      raise exception 'A payment claim is already under review with different payer details.'
        using errcode = '40001';
    end if;

    select pcae.*
    into audit_record
    from public.payment_claim_audit_events pcae
    where pcae.claim_id = existing_claim.id
      and pcae.next_state = 'under_review'
    order by pcae.created_at asc, pcae.id asc
    limit 1;

    return query
    select
      existing_claim.id,
      existing_claim.obligation_id,
      existing_claim.payer_type,
      existing_claim.payer_name,
      existing_claim.status,
      existing_claim.created_at,
      audit_record.id;
    return;
  end if;

  if exists (
    select 1
    from public.payment_claims pc
    where pc.obligation_id = obligation_record.id
      and pc.status = 'approved'::public.payment_claim_status_enum
  ) then
    raise exception 'This payment obligation has already been approved.' using errcode = '23514';
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
  returning * into audit_record;

  return query
  select
    inserted_claim.id,
    inserted_claim.obligation_id,
    inserted_claim.payer_type,
    inserted_claim.payer_name,
    inserted_claim.status,
    inserted_claim.created_at,
    audit_record.id;
end;
$function$;
COMMENT ON FUNCTION public.claim_recurring_payment(uuid,boolean,text) IS 'Records a recurring payment claim only on or after the obligation''s snapshotted local availability date.';
REVOKE ALL ON FUNCTION public.claim_recurring_payment(uuid, boolean, text) FROM anon;
CREATE FUNCTION public.clamped_billing_date(p_year integer, p_month integer, p_day integer)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select (
    make_date(p_year, p_month, 1)
      + (
        least(
          p_day,
          extract(day from (
            date_trunc('month', make_date(p_year, p_month, 1))
              + interval '1 month - 1 day'
          ))::integer
        ) - 1
      ) * interval '1 day'
  )::date;
$function$;
REVOKE ALL ON FUNCTION public.clamped_billing_date(integer, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.clamped_billing_date(integer, integer, integer) FROM authenticated;
CREATE FUNCTION public.ensure_contribution_schedule(p_organization_id uuid, p_user_id uuid, p_plan_type public.subscription_plan_type_enum, p_admission_date date DEFAULT NULL::date)
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
COMMENT ON FUNCTION public.ensure_contribution_schedule(uuid, uuid, public.subscription_plan_type_enum, date) IS 'Opens (or idempotently returns) the active contribution schedule and its admission-effective plan snapshot for one association member. A deactivated pre-departure schedule is never revived, so a rejoin is anchored on its own admission date.';
REVOKE ALL ON FUNCTION public.ensure_contribution_schedule(uuid, uuid, public.subscription_plan_type_enum, date) FROM anon;
REVOKE ALL ON FUNCTION public.ensure_contribution_schedule(uuid, uuid, public.subscription_plan_type_enum, date) FROM authenticated;
CREATE FUNCTION public.first_recurring_due_date(p_admission_date date, p_cadence public.contribution_cadence_enum, p_due_day integer)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  candidate_month date;
  candidate_due date;
  minimum_due date;
begin
  if p_cadence = 'annual'::public.contribution_cadence_enum then
    return public.clamped_billing_date(
      extract(year from p_admission_date)::integer + 1,
      extract(month from p_admission_date)::integer,
      p_due_day
    );
  end if;

  minimum_due := (p_admission_date + interval '1 month')::date;
  candidate_month := date_trunc('month', minimum_due)::date;
  candidate_due := public.clamped_billing_date(
    extract(year from candidate_month)::integer,
    extract(month from candidate_month)::integer,
    p_due_day
  );

  if candidate_due < minimum_due then
    candidate_month := (candidate_month + interval '1 month')::date;
    candidate_due := public.clamped_billing_date(
      extract(year from candidate_month)::integer,
      extract(month from candidate_month)::integer,
      p_due_day
    );
  end if;

  return candidate_due;
end;
$function$;
REVOKE ALL ON FUNCTION public.first_recurring_due_date(date, public.contribution_cadence_enum, integer) FROM anon;
REVOKE ALL ON FUNCTION public.first_recurring_due_date(date, public.contribution_cadence_enum, integer) FROM authenticated;
CREATE FUNCTION public.generate_membership_billing_obligations_at(p_as_of timestamp with time zone)
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
REVOKE ALL ON FUNCTION public.generate_membership_billing_obligations_at(timestamp with time zone) FROM anon;
REVOKE ALL ON FUNCTION public.generate_membership_billing_obligations_at(timestamp with time zone) FROM authenticated;
REVOKE ALL ON FUNCTION public.generate_membership_billing_obligations_at(timestamp with time zone) FROM service_role;
CREATE FUNCTION public.generate_membership_billing_obligations()
 RETURNS TABLE(schedule_id uuid, period_key text, obligation_id uuid, result text, failure_reason text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select *
  from public.generate_membership_billing_obligations_at(clock_timestamp());
$function$;
COMMENT ON FUNCTION public.generate_membership_billing_obligations() IS 'Trusted scheduler command. Derives the database clock and materializes every available recurring period exactly once.';
REVOKE ALL ON FUNCTION public.generate_membership_billing_obligations() FROM anon;
REVOKE ALL ON FUNCTION public.generate_membership_billing_obligations() FROM authenticated;
CREATE FUNCTION public.get_billing_workspace_claim_detail(p_claim_id uuid)
 RETURNS TABLE(claim_id uuid, obligation_id uuid, organization_id uuid, organization_name text, organization_slug text, purpose public.payment_obligation_purpose_enum, member_user_id uuid, member_name text, member_handle text, member_profile_picture text, claim_status public.payment_claim_status_enum, payer_type public.payment_claim_payer_type_enum, payer_name text, claim_created_at timestamp with time zone, claim_decided_at timestamp with time zone, claim_decision_reason text, plan_type public.subscription_plan_type_enum, amount integer, currency text, period_key text, period_start date, period_end date, available_on date, due_on date, attempt_count bigint, claim_history jsonb, audit_history jsonb, approve_command text, reject_command text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    pc.id,
    po.id,
    pc.organization_id,
    o.name,
    o.slug,
    po.purpose,
    pc.claimant_user_id,
    member_profile.name,
    member_profile.username,
    member_profile.profile_picture,
    pc.status,
    pc.payer_type,
    pc.payer_name,
    pc.created_at,
    pc.decided_at,
    pc.decision_reason,
    po.plan_type,
    po.amount,
    po.currency,
    po.period_key,
    po.period_start,
    po.period_end,
    po.available_on,
    po.due_on,
    (
      select count(*)
      from public.payment_claims attempts
      where attempts.obligation_id = po.id
    ),
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
            'actor_name', actor_profile.name,
            'actor_handle', actor_profile.username,
            'previous_state', audit.previous_state,
            'next_state', audit.next_state,
            'reason', audit.reason,
            'created_at', audit.created_at
          )
          order by audit.created_at asc, audit.id asc
        )
        from public.payment_claim_audit_events audit
        left join public.profiles actor_profile on actor_profile.id = audit.actor_user_id
        where audit.obligation_id = po.id
      ),
      '[]'::jsonb
    ),
    case
      when pc.status = 'under_review'::public.payment_claim_status_enum
        and po.status = 'available'::public.payment_obligation_status_enum
        then case po.purpose
          when 'initial_admission'::public.payment_obligation_purpose_enum
            then 'approve_initial_claim'
          else 'approve_recurring_payment_claim'
        end
      else null
    end,
    case
      when pc.status = 'under_review'::public.payment_claim_status_enum
        and po.status = 'available'::public.payment_obligation_status_enum
        then case po.purpose
          when 'initial_admission'::public.payment_obligation_purpose_enum
            then 'reject_initial_claim'
          else 'reject_recurring_payment_claim'
        end
      else null
    end
  from public.payment_claims pc
  join public.payment_obligations po on po.id = pc.obligation_id
  join public.organizations o on o.id = pc.organization_id
  join public.profiles member_profile on member_profile.id = pc.claimant_user_id
  left join public.membership_application_revisions mar
    on mar.id = po.application_revision_id
  left join public.membership_applications ma
    on ma.id = mar.application_id
  where pc.id = p_claim_id
    and pc.organization_id = po.organization_id
    and o.organization_type = 'association'::public.organization_type_enum
    and pc.claimant_user_id <> (select auth.uid())
    and exists (
      select 1
      from public.organization_members reviewer_membership
      where reviewer_membership.organization_id = pc.organization_id
        and reviewer_membership.user_id = (select auth.uid())
        and reviewer_membership.role = 'admin'::public.organization_role_enum
    )
    and (
      po.purpose = 'recurring'::public.payment_obligation_purpose_enum
      or (
        po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
        and po.application_revision_id = mar.id
        and mar.organization_id = pc.organization_id
        and mar.user_id = pc.claimant_user_id
        and ma.organization_id = pc.organization_id
        and ma.user_id = pc.claimant_user_id
        and ma.status = 'submitted'::public.membership_application_status_enum
      )
    );
$function$;
COMMENT ON FUNCTION public.get_billing_workspace_claim_detail(uuid) IS 'Returns authorized common claim detail and immutable chronology for either payment purpose without application-private fields.';
REVOKE ALL ON FUNCTION public.get_billing_workspace_claim_detail(uuid) FROM anon;
CREATE FUNCTION public.get_billing_workspace_members(p_organization_id uuid)
 RETURNS TABLE(member_user_id uuid, member_name text, member_handle text, member_profile_picture text, member_role public.organization_role_enum, joined_at timestamp with time zone, financial_standing text, overdue_count bigint, oldest_attention_due_on date, plan_type public.subscription_plan_type_enum, last_verified_contribution_at timestamp with time zone, next_due_on date)
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
COMMENT ON FUNCTION public.get_billing_workspace_members(uuid) IS 'Returns the active association roster with server-derived financial standing and obligation attention.';
REVOKE ALL ON FUNCTION public.get_billing_workspace_members(uuid) FROM anon;
CREATE FUNCTION public.get_billing_workspace_organizations()
 RETURNS TABLE(organization_id uuid, organization_name text, organization_slug text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    o.id,
    o.name,
    o.slug
  from public.organizations o
  where o.organization_type = 'association'::public.organization_type_enum
    and exists (
      select 1
      from public.organization_members om
      where om.organization_id = o.id
        and om.user_id = (select auth.uid())
        and om.role = 'admin'::public.organization_role_enum
    )
  order by o.name, o.id;
$function$;
COMMENT ON FUNCTION public.get_billing_workspace_organizations() IS 'Returns the associations where the signed-in person may open the billing workspace.';
REVOKE ALL ON FUNCTION public.get_billing_workspace_organizations() FROM anon;
CREATE FUNCTION public.get_billing_workspace_payments(p_organization_id uuid)
 RETURNS TABLE(obligation_id uuid, organization_id uuid, purpose public.payment_obligation_purpose_enum, member_user_id uuid, member_name text, member_handle text, plan_type public.subscription_plan_type_enum, amount integer, currency text, period_key text, period_start date, period_end date, available_on date, due_on date, obligation_status public.payment_obligation_status_enum, effective_payment_state text, settled_at timestamp with time zone, latest_claim_id uuid, latest_claim_status public.payment_claim_status_enum, latest_claim_created_at timestamp with time zone, latest_claim_decided_at timestamp with time zone, latest_claim_decision_reason text, last_decision_actor_user_id uuid, last_decision_actor_name text, last_decision_at timestamp with time zone, claim_history jsonb, audit_history jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    po.id,
    po.organization_id,
    po.purpose,
    po.user_id,
    member_profile.name,
    member_profile.username,
    po.plan_type,
    po.amount,
    po.currency,
    po.period_key,
    po.period_start,
    po.period_end,
    po.available_on,
    po.due_on,
    po.status,
    case
      when po.status = 'settled'::public.payment_obligation_status_enum then 'settled'
      when po.status = 'void'::public.payment_obligation_status_enum then 'void'
      when exists (
        select 1
        from public.payment_claims under_review
        where under_review.obligation_id = po.id
          and under_review.status = 'under_review'::public.payment_claim_status_enum
      ) then 'under_review'
      when po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
        and po.available_at <= clock_timestamp() then 'available'
      when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.due_on < timezone(
          coalesce(po.billing_timezone, o.billing_timezone),
          clock_timestamp()
        )::date then 'overdue'
      when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.available_on <= timezone(
          coalesce(po.billing_timezone, o.billing_timezone),
          clock_timestamp()
        )::date then 'available'
      else 'scheduled'
    end,
    po.settled_at,
    latest_claim.id,
    latest_claim.status,
    latest_claim.created_at,
    latest_claim.decided_at,
    latest_claim.decision_reason,
    last_decision.actor_user_id,
    last_decision.actor_name,
    last_decision.created_at,
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
            'actor_name', actor_profile.name,
            'actor_handle', actor_profile.username,
            'previous_state', audit.previous_state,
            'next_state', audit.next_state,
            'reason', audit.reason,
            'created_at', audit.created_at
          )
          order by audit.created_at asc, audit.id asc
        )
        from public.payment_claim_audit_events audit
        left join public.profiles actor_profile on actor_profile.id = audit.actor_user_id
        where audit.obligation_id = po.id
      ),
      '[]'::jsonb
    )
  from public.payment_obligations po
  join public.organizations o on o.id = po.organization_id
  join public.profiles member_profile on member_profile.id = po.user_id
  left join lateral (
    select pc.*
    from public.payment_claims pc
    where pc.obligation_id = po.id
    order by pc.created_at desc, pc.id desc
    limit 1
  ) latest_claim on true
  left join lateral (
    select
      audit.actor_user_id,
      actor_profile.name as actor_name,
      audit.created_at
    from public.payment_claim_audit_events audit
    left join public.profiles actor_profile on actor_profile.id = audit.actor_user_id
    where audit.obligation_id = po.id
      and audit.next_state in ('payment_available', 'payment_settled')
    order by audit.created_at desc, audit.id desc
    limit 1
  ) last_decision on true
  where p_organization_id is not null
    and po.organization_id = p_organization_id
    and o.organization_type = 'association'::public.organization_type_enum
    and exists (
      select 1
      from public.organization_members reviewer_membership
      where reviewer_membership.organization_id = po.organization_id
        and reviewer_membership.user_id = (select auth.uid())
        and reviewer_membership.role = 'admin'::public.organization_role_enum
    )
  order by po.due_on desc, po.created_at desc, po.id desc;
$function$;
COMMENT ON FUNCTION public.get_billing_workspace_payments(uuid) IS 'Returns private organization-scoped obligation history with immutable claim decisions and server-derived actors.';
REVOKE ALL ON FUNCTION public.get_billing_workspace_payments(uuid) FROM anon;
CREATE FUNCTION public.get_billing_workspace_queue(p_organization_id uuid)
 RETURNS TABLE(claim_id uuid, obligation_id uuid, organization_id uuid, purpose public.payment_obligation_purpose_enum, member_user_id uuid, member_name text, member_handle text, member_profile_picture text, payer_type public.payment_claim_payer_type_enum, payer_name text, plan_type public.subscription_plan_type_enum, amount integer, currency text, period_key text, period_start date, period_end date, available_on date, due_on date, claim_created_at timestamp with time zone, claim_decided_at timestamp with time zone, claim_decision_reason text, claim_status public.payment_claim_status_enum, attempt_count bigint, approve_command text, reject_command text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    pc.id,
    po.id,
    pc.organization_id,
    po.purpose,
    pc.claimant_user_id,
    member_profile.name,
    member_profile.username,
    member_profile.profile_picture,
    pc.payer_type,
    pc.payer_name,
    po.plan_type,
    po.amount,
    po.currency,
    po.period_key,
    po.period_start,
    po.period_end,
    po.available_on,
    po.due_on,
    pc.created_at,
    pc.decided_at,
    pc.decision_reason,
    pc.status,
    (
      select count(*)
      from public.payment_claims attempts
      where attempts.obligation_id = po.id
    ),
    case
      when pc.status = 'under_review'::public.payment_claim_status_enum
        and po.status = 'available'::public.payment_obligation_status_enum
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
        then case po.purpose
          when 'initial_admission'::public.payment_obligation_purpose_enum
            then 'approve_initial_claim'
          else 'approve_recurring_payment_claim'
        end
      else null
    end,
    case
      when pc.status = 'under_review'::public.payment_claim_status_enum
        and po.status = 'available'::public.payment_obligation_status_enum
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
        then case po.purpose
          when 'initial_admission'::public.payment_obligation_purpose_enum
            then 'reject_initial_claim'
          else 'reject_recurring_payment_claim'
        end
      else null
    end
  from public.payment_claims pc
  join public.payment_obligations po on po.id = pc.obligation_id
  join public.organizations o on o.id = pc.organization_id
  join public.profiles member_profile on member_profile.id = pc.claimant_user_id
  left join public.membership_application_revisions mar
    on mar.id = po.application_revision_id
  left join public.membership_applications ma
    on ma.id = mar.application_id
  where p_organization_id is not null
    and pc.organization_id = p_organization_id
    and po.organization_id = pc.organization_id
    and o.organization_type = 'association'::public.organization_type_enum
    and pc.claimant_user_id <> (select auth.uid())
    and exists (
      select 1
      from public.organization_members reviewer_membership
      where reviewer_membership.organization_id = pc.organization_id
        and reviewer_membership.user_id = (select auth.uid())
        and reviewer_membership.role = 'admin'::public.organization_role_enum
    )
    and (
      (
        po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
        and po.application_revision_id = mar.id
        and mar.organization_id = pc.organization_id
        and mar.user_id = pc.claimant_user_id
        and ma.organization_id = pc.organization_id
        and ma.user_id = pc.claimant_user_id
        and ma.status = 'submitted'::public.membership_application_status_enum
      )
      or (
        po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.schedule_id is not null
        and po.application_revision_id is null
        and po.user_id = pc.claimant_user_id
      )
    )
  order by pc.created_at asc, pc.id asc;
$function$;
COMMENT ON FUNCTION public.get_billing_workspace_queue(uuid) IS 'Returns organization-scoped claim history with safe member summaries and purpose-specific decision commands.';
REVOKE ALL ON FUNCTION public.get_billing_workspace_queue(uuid) FROM anon;
CREATE FUNCTION public.get_initial_payment_claim_detail(p_claim_id uuid)
 RETURNS TABLE(claim_id uuid, obligation_id uuid, application_id uuid, application_revision_id uuid, revision_number integer, draft_version bigint, organization_id uuid, organization_name text, organization_slug text, claimant_user_id uuid, applicant_name text, applicant_handle text, applicant_profile_picture text, claim_status public.payment_claim_status_enum, payer_type public.payment_claim_payer_type_enum, payer_name text, claim_created_at timestamp with time zone, decided_at timestamp with time zone, decision_reason text, attempt_count bigint, plan_type public.subscription_plan_type_enum, amount integer, currency text, terms_version text, accepted_terms_at timestamp with time zone, submitted_at timestamp with time zone, full_name text, birth_date date, nationality text, marital_status public.marital_status_enum, profession text, birthplace text, cpf text, id_document_number text, id_document_issuer text, postal_code text, address_line text, city text, state text, email text, phone text, blood_type public.blood_type_enum, has_allergies boolean, allergies text, has_dietary_restrictions boolean, dietary_restrictions text, highline_experience public.highline_experience_enum, has_rescue_course boolean, first_aid_course public.first_aid_course_enum, emergency_contact_name text, emergency_contact_relationship text, emergency_contact_phone text, claim_history jsonb, audit_history jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
COMMENT ON FUNCTION public.get_initial_payment_claim_detail(uuid) IS 'Returns the exact immutable submitted application revision and authorized claim history for an association admin.';
REVOKE ALL ON FUNCTION public.get_initial_payment_claim_detail(uuid) FROM anon;
CREATE FUNCTION public.get_initial_payment_claim_queue()
 RETURNS TABLE(claim_id uuid, obligation_id uuid, application_revision_id uuid, organization_id uuid, organization_name text, claimant_user_id uuid, applicant_name text, applicant_handle text, applicant_profile_picture text, payer_type public.payment_claim_payer_type_enum, payer_name text, plan_type public.subscription_plan_type_enum, amount integer, currency text, claim_created_at timestamp with time zone, attempt_count bigint, claim_status public.payment_claim_status_enum)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
COMMENT ON FUNCTION public.get_initial_payment_claim_queue() IS 'Returns a privacy-preserving queue of current initial claims for associations where the caller is an admin.';
REVOKE ALL ON FUNCTION public.get_initial_payment_claim_queue() FROM anon;
CREATE FUNCTION public.get_membership_billing_ledger(p_organization_id uuid, p_history_cursor text DEFAULT NULL::text, p_history_limit integer DEFAULT 24)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := (select auth.uid());
  organization_record public.organizations%rowtype;
  application_record public.membership_applications%rowtype;
  schedule_record public.contribution_schedules%rowtype;
  evaluated_at_value timestamp with time zone := clock_timestamp();
  local_date_value date;
  legal_state text;
  financial_state text := 'up_to_date';
  application_correction_reason text;
  plan_type_value public.subscription_plan_type_enum;
  attention_obligation jsonb;
  next_obligation jsonb;
  history jsonb;
  history_count integer;
  history_limit_value integer := greatest(1, least(coalesce(p_history_limit, 24), 50));
  history_has_more boolean := false;
  history_next_cursor text;
  cursor_due_on date;
  cursor_obligation_id uuid;
  member_exists boolean := false;
  application_found boolean := false;
  next_assignment record;
  candidate_due_date date;
  candidate_next_due_date date;
  candidate_available_on date;
  candidate_period_start date;
  candidate_period_end date;
  candidate_plan_type public.subscription_plan_type_enum;
  candidate_amount integer;
  candidate_currency text;
  candidate_found boolean := false;
  candidate_effective_start date;
  selected_candidate_due_date date;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_organization_id is null then
    raise exception 'Organization is required.' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_history_cursor, '')), '') is not null then
    begin
      cursor_due_on := split_part(p_history_cursor, '|', 1)::date;
      cursor_obligation_id := split_part(p_history_cursor, '|', 2)::uuid;
    exception
      when others then
        raise exception 'The Ledger history cursor is invalid.' using errcode = '22023';
    end;
  end if;

  select o.*
  into organization_record
  from public.organizations o
  where o.id = p_organization_id
    and o.organization_type = 'association'::public.organization_type_enum;

  if not found then
    raise exception 'Association was not found.' using errcode = '40400';
  end if;

  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = actor_id
  )
  into member_exists;

  select ma.*
  into application_record
  from public.membership_applications ma
  where ma.organization_id = p_organization_id
    and ma.user_id = actor_id
  order by ma.updated_at desc, ma.id desc
  limit 1;
  application_found := found;

  if not member_exists and not application_found then
    raise exception 'Membership Ledger was not found.' using errcode = '42501';
  end if;

  legal_state := case when member_exists then 'active' else 'applicant' end;
  local_date_value := timezone(
    organization_record.billing_timezone,
    evaluated_at_value
  )::date;

  select cs.*
  into schedule_record
  from public.contribution_schedules cs
  where cs.organization_id = p_organization_id
    and cs.user_id = actor_id
    and cs.active
  order by cs.id
  limit 1;

  if found then
    select case
      when cpa.plan_type = 'annual'::public.subscription_plan_type_enum
        then 'annual'::public.subscription_plan_type_enum
      else 'monthly'::public.subscription_plan_type_enum
    end
    into plan_type_value
    from public.contribution_plan_assignments cpa
    where cpa.schedule_id = schedule_record.id
      and cpa.effective_period_start <= local_date_value
    order by cpa.effective_period_start desc, cpa.id desc
    limit 1;
  end if;

  if plan_type_value is null and application_found then
    select mar.plan_type
    into plan_type_value
    from public.membership_application_revisions mar
    where mar.application_id = application_record.id
    order by mar.revision_number desc, mar.id desc
    limit 1;
  end if;

  select pc.decision_reason
  into application_correction_reason
  from public.payment_claims pc
  join public.payment_obligations po on po.id = pc.obligation_id
  where pc.claimant_user_id = actor_id
    and pc.organization_id = p_organization_id
    and po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
    and pc.status = 'rejected'::public.payment_claim_status_enum
  order by pc.decided_at desc nulls last, pc.created_at desc, pc.id desc
  limit 1;

  if exists (
    select 1
    from public.payment_obligations po
    where po.organization_id = p_organization_id
      and po.user_id = actor_id
      and po.status not in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      and po.purpose = 'recurring'::public.payment_obligation_purpose_enum
      and po.due_on < timezone(
        coalesce(po.billing_timezone, organization_record.billing_timezone),
        evaluated_at_value
      )::date
  ) then
    financial_state := 'overdue';
  elsif exists (
    select 1
    from public.payment_obligations po
    where po.organization_id = p_organization_id
      and po.user_id = actor_id
      and po.status not in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      and (
        (
          po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
          and po.available_at <= evaluated_at_value
        )
        or (
          po.purpose = 'recurring'::public.payment_obligation_purpose_enum
          and po.available_on <= timezone(
            coalesce(po.billing_timezone, organization_record.billing_timezone),
            evaluated_at_value
          )::date
        )
      )
      and not exists (
        select 1
        from public.payment_claims pc
        where pc.obligation_id = po.id
          and pc.status = 'under_review'::public.payment_claim_status_enum
      )
  ) then
    financial_state := 'payment_available';
  elsif exists (
    select 1
    from public.payment_obligations po
    join public.payment_claims pc on pc.obligation_id = po.id
    where po.organization_id = p_organization_id
      and po.user_id = actor_id
      and po.status not in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      and pc.status = 'under_review'::public.payment_claim_status_enum
  ) then
    financial_state := 'under_review';
  end if;

  select jsonb_build_object(
    'obligation_id', po.id,
    'purpose', po.purpose,
    'status', state.effective_status,
    'period_key', po.period_key,
    'period_start', po.period_start,
    'period_end', po.period_end,
    'available_on', po.available_on,
    'due_on', po.due_on,
    'amount', po.amount,
    'currency', po.currency,
    'action', case state.effective_status
      when 'under_review' then jsonb_build_object('type', 'open_claim')
      when 'available' then jsonb_build_object('type', 'open_obligation')
      when 'overdue' then jsonb_build_object('type', 'open_obligation')
      else null
    end,
    'claims', coalesce((
      select jsonb_agg(jsonb_build_object(
        'claim_id', pc.id,
        'status', pc.status,
        'payer', pc.payer_type,
        'payer_name', pc.payer_name,
        'created_at', pc.created_at,
        'decided_at', pc.decided_at,
        'decision_reason', pc.decision_reason
      ) order by pc.created_at asc, pc.id asc)
      from public.payment_claims pc
      where pc.obligation_id = po.id
    ), '[]'::jsonb)
  )
  into attention_obligation
  from public.payment_obligations po
  cross join lateral (
    select case
      when po.status = 'settled'::public.payment_obligation_status_enum then 'settled'
      when po.status = 'void'::public.payment_obligation_status_enum then 'void'
      when exists (
        select 1
        from public.payment_claims pc
        where pc.obligation_id = po.id
          and pc.status = 'under_review'::public.payment_claim_status_enum
      ) then 'under_review'
      when po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
        and po.available_at <= evaluated_at_value then 'available'
      when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.due_on < timezone(
          coalesce(po.billing_timezone, organization_record.billing_timezone),
          evaluated_at_value
        )::date then 'overdue'
      when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.available_on <= timezone(
        coalesce(po.billing_timezone, organization_record.billing_timezone),
        evaluated_at_value
      )::date then 'available'
      else 'scheduled'
    end as effective_status
  ) state
  where po.organization_id = p_organization_id
    and po.user_id = actor_id
    and state.effective_status in ('available', 'under_review', 'overdue')
  order by
    case state.effective_status
      when 'overdue' then 0
      when 'available' then 1
      when 'under_review' then 2
      else 3
    end,
    po.due_on asc,
    po.created_at asc,
    po.id asc
  limit 1;

  if member_exists and schedule_record.id is not null then
    select jsonb_build_object(
      'obligation_id', po.id,
      'purpose', po.purpose,
      'status', state.effective_status,
      'period_key', po.period_key,
      'period_start', po.period_start,
      'period_end', po.period_end,
      'available_on', po.available_on,
      'due_on', po.due_on,
      'amount', po.amount,
      'currency', po.currency,
      'action', case state.effective_status
        when 'under_review' then jsonb_build_object('type', 'open_claim')
        when 'available' then jsonb_build_object('type', 'open_obligation')
        when 'overdue' then jsonb_build_object('type', 'open_obligation')
        else null
      end
    )
    into next_obligation
    from public.payment_obligations po
    cross join lateral (
      select case
        when exists (
          select 1
          from public.payment_claims pc
          where pc.obligation_id = po.id
            and pc.status = 'under_review'::public.payment_claim_status_enum
        ) then 'under_review'
        when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
          and po.available_on <= timezone(
          coalesce(po.billing_timezone, schedule_record.billing_timezone),
          evaluated_at_value
        )::date then 'available'
        else 'scheduled'
      end as effective_status
    ) state
    where po.schedule_id = schedule_record.id
      and po.status not in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      and po.due_on > timezone(
        coalesce(po.billing_timezone, schedule_record.billing_timezone),
        evaluated_at_value
      )::date
    order by po.due_on asc, po.created_at asc, po.id asc
    limit 1;

    if next_obligation is null then
      for next_assignment in
        select
          cpa.*,
          lead(cpa.effective_period_start) over (
            order by cpa.effective_period_start, cpa.id
          ) as next_effective_period_start
        from public.contribution_plan_assignments cpa
        where cpa.schedule_id = schedule_record.id
        order by cpa.effective_period_start, cpa.id
      loop
        candidate_plan_type := next_assignment.plan_type;
        candidate_effective_start := greatest(
          schedule_record.admission_date,
          next_assignment.effective_period_start
        );
        candidate_due_date := public.recurring_due_date_on_or_after(
          schedule_record.admission_date,
          case candidate_plan_type
            when 'annual'::public.subscription_plan_type_enum
              then 'annual'::public.contribution_cadence_enum
            else 'monthly'::public.contribution_cadence_enum
          end,
          coalesce(next_assignment.due_day, schedule_record.due_day),
          greatest(
            candidate_effective_start,
            timezone(
              coalesce(next_assignment.billing_timezone, schedule_record.billing_timezone),
              evaluated_at_value
            )::date + 1
          )
        );

        if next_assignment.next_effective_period_start is not null
          and candidate_due_date >= next_assignment.next_effective_period_start then
          continue;
        end if;

        if not candidate_found or candidate_due_date < selected_candidate_due_date then
          candidate_found := true;
          selected_candidate_due_date := candidate_due_date;
          candidate_next_due_date := public.next_recurring_due_date(
            candidate_due_date,
            case candidate_plan_type
              when 'annual'::public.subscription_plan_type_enum
                then 'annual'::public.contribution_cadence_enum
              else 'monthly'::public.contribution_cadence_enum
            end,
            coalesce(next_assignment.due_day, schedule_record.due_day)
          );
          candidate_available_on := candidate_due_date
            - coalesce(next_assignment.lead_days, schedule_record.lead_days);
          candidate_period_start := candidate_due_date;
          candidate_period_end := candidate_next_due_date - 1;
          candidate_amount := next_assignment.amount;
          candidate_currency := next_assignment.currency;
          next_obligation := jsonb_build_object(
            'obligation_id', null,
            'purpose', 'recurring',
            'status', 'scheduled',
            'period_key', public.recurring_period_key(
              case candidate_plan_type
                when 'annual'::public.subscription_plan_type_enum
                  then 'annual'::public.contribution_cadence_enum
                else 'monthly'::public.contribution_cadence_enum
              end,
              candidate_due_date
            ),
            'period_start', candidate_period_start,
            'period_end', candidate_period_end,
            'available_on', candidate_available_on,
            'due_on', candidate_due_date,
            'amount', candidate_amount,
            'currency', candidate_currency,
            'action', null
          );
        end if;
      end loop;
    end if;
  end if;

  select coalesce(jsonb_agg(row_data order by due_on desc, obligation_id desc), '[]'::jsonb),
    count(*)::integer
  into history, history_count
  from (
    select
      jsonb_build_object(
        'obligation_id', po.id,
        'purpose', po.purpose,
        'status', state.effective_status,
        'period_key', po.period_key,
        'period_start', po.period_start,
        'period_end', po.period_end,
        'available_on', po.available_on,
        'due_on', po.due_on,
        'amount', po.amount,
        'currency', po.currency,
        'settled_at', po.settled_at,
        'claims', coalesce((
          select jsonb_agg(jsonb_build_object(
            'claim_id', pc.id,
            'status', pc.status,
            'payer', pc.payer_type,
            'payer_name', pc.payer_name,
            'created_at', pc.created_at,
            'decided_at', pc.decided_at,
            'decision_reason', pc.decision_reason
          ) order by pc.created_at asc, pc.id asc)
          from public.payment_claims pc
          where pc.obligation_id = po.id
        ), '[]'::jsonb)
      ) as row_data,
      po.due_on,
      po.created_at,
      po.id as obligation_id
    from public.payment_obligations po
    cross join lateral (
      select case
        when po.status = 'settled'::public.payment_obligation_status_enum then 'settled'
        when po.status = 'void'::public.payment_obligation_status_enum then 'void'
        when exists (
          select 1
          from public.payment_claims pc
          where pc.obligation_id = po.id
            and pc.status = 'under_review'::public.payment_claim_status_enum
        ) then 'under_review'
        when po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
          and po.available_at <= evaluated_at_value then 'available'
        when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
          and po.due_on < timezone(
            coalesce(po.billing_timezone, organization_record.billing_timezone),
            evaluated_at_value
          )::date then 'overdue'
        when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
          and po.available_on <= timezone(
          coalesce(po.billing_timezone, organization_record.billing_timezone),
          evaluated_at_value
        )::date then 'available'
        else 'scheduled'
      end as effective_status
    ) state
    where po.organization_id = p_organization_id
      and po.user_id = actor_id
      and (
        cursor_due_on is null
        or (po.due_on, po.id) < (cursor_due_on, cursor_obligation_id)
      )
    order by po.due_on desc, po.id desc
    limit history_limit_value + 1
  ) history_rows;

  if history_count > history_limit_value then
    history_has_more := true;
    select jsonb_agg(value order by ordinal)
    into history
    from jsonb_array_elements(history) with ordinality as items(value, ordinal)
    where ordinal <= history_limit_value;

    select to_char(po.due_on, 'YYYY-MM-DD') || '|' || po.id::text
    into history_next_cursor
    from public.payment_obligations po
    where po.organization_id = p_organization_id
      and po.user_id = actor_id
      and (
        cursor_due_on is null
        or (po.due_on, po.id) < (cursor_due_on, cursor_obligation_id)
      )
    order by po.due_on desc, po.id desc
    offset history_limit_value
    limit 1;
  end if;

  return jsonb_build_object(
    'organization_id', organization_record.id,
    'organization_slug', organization_record.slug,
    'organization_name', organization_record.name,
    'legal_membership_state', legal_state,
    'application_status', case when application_found then application_record.status else null end,
    'application_correction_reason', application_correction_reason,
    'financial_standing', financial_state,
    'evaluated_at', evaluated_at_value,
    'plan_type', plan_type_value,
    'attention_obligation', attention_obligation,
    'next_contribution', next_obligation,
    'history', coalesce(history, '[]'::jsonb),
    'history_limit', history_limit_value,
    'history_has_more', history_has_more,
    'history_next_cursor', history_next_cursor
  );
end;
$function$;
COMMENT ON FUNCTION public.get_membership_billing_ledger(uuid,text,integer) IS 'Returns the signed-in person''s private Ledger using effective-dated terms and obligation timezone snapshots.';
REVOKE ALL ON FUNCTION public.get_membership_billing_ledger(uuid, text, integer) FROM anon;
CREATE FUNCTION public.get_payment_obligation_instructions(p_obligation_id uuid)
 RETURNS TABLE(obligation_id uuid, organization_id uuid, purpose public.payment_obligation_purpose_enum, status text, plan_type public.subscription_plan_type_enum, amount integer, currency text, payment_method text, pix_copy_paste text, available_at timestamp with time zone, available_on date, due_on date, period_key text, claim_id uuid, claim_status public.payment_claim_status_enum, payer_type public.payment_claim_payer_type_enum, payer_name text, claim_created_at timestamp with time zone, claim_decision_reason text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    po.id,
    po.organization_id,
    po.purpose,
    case
      when po.status = 'settled'::public.payment_obligation_status_enum then 'settled'
      when po.status = 'void'::public.payment_obligation_status_enum then 'void'
      when claim.status = 'under_review'::public.payment_claim_status_enum then 'under_review'
      when po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
        and po.available_at <= clock_timestamp() then 'available'
      when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.due_on < timezone(
          coalesce(po.billing_timezone, o.billing_timezone),
          clock_timestamp()
        )::date then 'overdue'
      when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.available_on <= timezone(
        coalesce(po.billing_timezone, o.billing_timezone),
        clock_timestamp()
      )::date then 'available'
      else 'scheduled'
    end,
    po.plan_type,
    po.amount,
    po.currency,
    po.payment_method,
    po.pix_copy_paste,
    po.available_at,
    po.available_on,
    po.due_on,
    po.period_key,
    claim.id,
    claim.status,
    claim.payer_type,
    claim.payer_name,
    claim.created_at,
    claim.decision_reason
  from public.payment_obligations po
  join public.organizations o on o.id = po.organization_id
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
      and pc.claimant_user_id = (select auth.uid())
    order by pc.created_at desc, pc.id desc
    limit 1
  ) claim on true
  where po.id = p_obligation_id
    and po.user_id = (select auth.uid());
$function$;
COMMENT ON FUNCTION public.get_payment_obligation_instructions(uuid) IS 'Returns authoritative PIX instructions and evaluates availability using the obligation timezone snapshot.';
REVOKE ALL ON FUNCTION public.get_payment_obligation_instructions(uuid) FROM anon;
CREATE FUNCTION public.is_valid_billing_timezone(p_timezone text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = p_timezone
  );
$function$;
REVOKE ALL ON FUNCTION public.is_valid_billing_timezone(text) FROM anon;
REVOKE ALL ON FUNCTION public.is_valid_billing_timezone(text) FROM authenticated;
CREATE FUNCTION public.next_recurring_due_date(p_due_date date, p_cadence public.contribution_cadence_enum, p_due_day integer)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_cadence = 'annual'::public.contribution_cadence_enum then
      public.clamped_billing_date(
        extract(year from p_due_date)::integer + 1,
        extract(month from p_due_date)::integer,
        p_due_day
      )
    else public.clamped_billing_date(
      extract(year from (p_due_date + interval '1 month'))::integer,
      extract(month from (p_due_date + interval '1 month'))::integer,
      p_due_day
    )
  end;
$function$;
REVOKE ALL ON FUNCTION public.next_recurring_due_date(date, public.contribution_cadence_enum, integer) FROM anon;
REVOKE ALL ON FUNCTION public.next_recurring_due_date(date, public.contribution_cadence_enum, integer) FROM authenticated;
CREATE FUNCTION public.recurring_due_date_on_or_after(p_admission_date date, p_cadence public.contribution_cadence_enum, p_due_day integer, p_from_date date)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  due_date_value date;
  lower_bound date;
begin
  if p_admission_date is null
    or p_cadence is null
    or p_due_day is null
    or p_from_date is null then
    raise exception 'Recurring date inputs are required.' using errcode = '22023';
  end if;

  if p_due_day < 1 or p_due_day > 31 then
    raise exception 'Recurring due day must be between 1 and 31.'
      using errcode = '22023';
  end if;

  lower_bound := greatest(p_admission_date, p_from_date);
  due_date_value := public.first_recurring_due_date(
    p_admission_date,
    p_cadence,
    p_due_day
  );

  while due_date_value < lower_bound loop
    due_date_value := public.next_recurring_due_date(
      due_date_value,
      p_cadence,
      p_due_day
    );
  end loop;

  return due_date_value;
end;
$function$;
REVOKE ALL ON FUNCTION public.recurring_due_date_on_or_after(date, public.contribution_cadence_enum, integer, date) FROM anon;
REVOKE ALL ON FUNCTION public.recurring_due_date_on_or_after(date, public.contribution_cadence_enum, integer, date) FROM authenticated;
CREATE FUNCTION public.recurring_period_key(p_cadence public.contribution_cadence_enum, p_due_date date)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select p_cadence::text || ':' || to_char(p_due_date, 'YYYY-MM-DD');
$function$;
REVOKE ALL ON FUNCTION public.recurring_period_key(public.contribution_cadence_enum, date) FROM anon;
REVOKE ALL ON FUNCTION public.recurring_period_key(public.contribution_cadence_enum, date) FROM authenticated;
CREATE FUNCTION public.register_push_token(p_token text, p_language public.language DEFAULT NULL::public.language)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := (select auth.uid());
  normalized_token text := nullif(btrim(p_token), '');
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if normalized_token is null or char_length(normalized_token) > 512 then
    raise exception 'A valid push token is required.' using errcode = '22023';
  end if;

  insert into public.push_tokens (token, profile_id, language, created_at)
  values (normalized_token, actor_id, p_language, clock_timestamp())
  on conflict (token) do update
  set
    profile_id = excluded.profile_id,
    language = excluded.language,
    created_at = clock_timestamp();

  return 'registered';
end;
$function$;
COMMENT ON FUNCTION public.register_push_token(text,public.language) IS 'Associates one device token with the currently authenticated profile, replacing a previous owner for account switching.';
REVOKE ALL ON FUNCTION public.register_push_token(text, public.language) FROM anon;
CREATE FUNCTION public.reject_contribution_plan_assignment_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.schedule_id is distinct from new.schedule_id
    or old.effective_period_start is distinct from new.effective_period_start
    or old.plan_type is distinct from new.plan_type
    or old.amount is distinct from new.amount
    or old.currency is distinct from new.currency
    or old.due_day is distinct from new.due_day
    or old.lead_days is distinct from new.lead_days
    or old.billing_timezone is distinct from new.billing_timezone
    or old.pix_copy_paste is distinct from new.pix_copy_paste then
    raise exception 'An effective-dated contribution term is immutable; append a new term.'
      using errcode = '55000';
  end if;

  return new;
end;
$function$;
REVOKE ALL ON FUNCTION public.reject_contribution_plan_assignment_mutation() FROM anon;
REVOKE ALL ON FUNCTION public.reject_contribution_plan_assignment_mutation() FROM authenticated;
CREATE FUNCTION public.reject_contribution_schedule_anchor_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.admission_date is distinct from new.admission_date then
    raise exception 'A contribution schedule admission anchor is immutable.'
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
REVOKE ALL ON FUNCTION public.reject_contribution_schedule_anchor_mutation() FROM anon;
REVOKE ALL ON FUNCTION public.reject_contribution_schedule_anchor_mutation() FROM authenticated;
CREATE FUNCTION public.reject_initial_claim(p_claim_id uuid, p_reason text)
 RETURNS TABLE(claim_id uuid, obligation_id uuid, application_id uuid, application_status public.membership_application_status_enum, claim_status public.payment_claim_status_enum, obligation_status public.payment_obligation_status_enum, decision_reason text, audit_event_id uuid, decision_applied_now boolean)
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
COMMENT ON FUNCTION public.reject_initial_claim(uuid,text) IS 'The unified refusal command. Atomically refuses the application, rejects the current claim, voids that obligation, records one required normalized reason, and appends one audit event. No revision, payer identity, claim or audit row is ever deleted; a correction is submitted as a new application.';
REVOKE ALL ON FUNCTION public.reject_initial_claim(uuid, text) FROM anon;
CREATE FUNCTION public.reject_membership_application_revision_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  raise exception 'Submitted application revisions are immutable.'
    using errcode = '55000';
end;
$function$;
REVOKE ALL ON FUNCTION public.reject_membership_application_revision_mutation() FROM anon;
REVOKE ALL ON FUNCTION public.reject_membership_application_revision_mutation() FROM authenticated;
CREATE FUNCTION public.reject_payment_claim_audit_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  raise exception 'Payment claim audit events are immutable.'
    using errcode = '55000';
end;
$function$;
REVOKE ALL ON FUNCTION public.reject_payment_claim_audit_mutation() FROM anon;
REVOKE ALL ON FUNCTION public.reject_payment_claim_audit_mutation() FROM authenticated;
CREATE FUNCTION public.reject_payment_claim_evidence_mutation()
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
$function$;
REVOKE ALL ON FUNCTION public.reject_payment_claim_evidence_mutation() FROM anon;
REVOKE ALL ON FUNCTION public.reject_payment_claim_evidence_mutation() FROM authenticated;
CREATE FUNCTION public.reject_payment_obligation_context_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.organization_id is distinct from new.organization_id
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
REVOKE ALL ON FUNCTION public.reject_payment_obligation_context_mutation() FROM anon;
REVOKE ALL ON FUNCTION public.reject_payment_obligation_context_mutation() FROM authenticated;
CREATE FUNCTION public.reject_recurring_payment_claim(p_claim_id uuid, p_reason text)
 RETURNS TABLE(claim_id uuid, obligation_id uuid, claim_status public.payment_claim_status_enum, obligation_status public.payment_obligation_status_enum, decision_reason text, audit_event_id uuid, decision_applied_now boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := (select auth.uid());
  claim_record public.payment_claims%rowtype;
  obligation_record public.payment_obligations%rowtype;
  audit_record public.payment_claim_audit_events%rowtype;
  normalized_reason text := nullif(
    btrim(regexp_replace(coalesce(p_reason, ''), '\s+', ' ', 'g')),
    ''
  );
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

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
    raise exception 'This claim is unavailable to the current reviewer.' using errcode = '42501';
  end if;

  if claim_record.claimant_user_id = actor_id
    or not exists (
      select 1
      from public.organization_members om
      join public.organizations o on o.id = om.organization_id
      where om.organization_id = claim_record.organization_id
        and om.user_id = actor_id
        and om.role = 'admin'::public.organization_role_enum
        and o.organization_type = 'association'::public.organization_type_enum
    ) then
    raise exception 'Association admin access is required.' using errcode = '42501';
  end if;

  select po.*
  into obligation_record
  from public.payment_obligations po
  where po.id = claim_record.obligation_id
  for update;

  if not found
    or obligation_record.purpose <> 'recurring'::public.payment_obligation_purpose_enum then
    raise exception 'This claim is not a recurring contribution claim.' using errcode = '40001';
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

  if claim_record.status <> 'under_review'::public.payment_claim_status_enum
    or obligation_record.status <> 'available'::public.payment_obligation_status_enum then
    raise exception 'This claim is no longer actionable. Refresh before deciding.'
      using errcode = '40001';
  end if;

  perform set_config('app.payment_claim_decision_command', 'on', true);

  update public.payment_claims pc
  set
    status = 'rejected'::public.payment_claim_status_enum,
    decided_at = timezone('utc'::text, clock_timestamp()),
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
    reason
  )
  values (
    claim_record.organization_id,
    claim_record.obligation_id,
    claim_record.id,
    actor_id,
    'under_review',
    'payment_available',
    normalized_reason
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
$function$;
COMMENT ON FUNCTION public.reject_recurring_payment_claim(uuid,text) IS 'Rejects one recurring contribution claim, preserves its evidence, and leaves the obligation available for another claim.';
REVOKE ALL ON FUNCTION public.reject_recurring_payment_claim(uuid, text) FROM anon;
CREATE OR REPLACE FUNCTION public.set_membership_applications_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$;
CREATE FUNCTION public.snapshot_payment_obligation_context()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  organization_record public.organizations%rowtype;
  term_record public.contribution_plan_assignments%rowtype;
begin
  select o.*
  into organization_record
  from public.organizations o
  where o.id = new.organization_id;

  if not found then
    raise exception 'Payment obligation organization was not found.'
      using errcode = '23503';
  end if;

  if new.schedule_term_id is not null then
    select cpa.*
    into term_record
    from public.contribution_plan_assignments cpa
    where cpa.id = new.schedule_term_id;

    if not found then
      raise exception 'Payment obligation billing term was not found.'
        using errcode = '23503';
    end if;

    new.billing_timezone := coalesce(new.billing_timezone, term_record.billing_timezone);
    new.billing_due_day := coalesce(new.billing_due_day, term_record.due_day);
    new.billing_lead_days := coalesce(new.billing_lead_days, term_record.lead_days);
  end if;

  new.billing_timezone := coalesce(new.billing_timezone, organization_record.billing_timezone);
  new.billing_due_day := coalesce(new.billing_due_day, organization_record.billing_due_day);
  new.billing_lead_days := coalesce(new.billing_lead_days, organization_record.billing_lead_days);
  new.organization_name_snapshot := coalesce(
    new.organization_name_snapshot,
    organization_record.name
  );
  new.organization_slug_snapshot := coalesce(
    new.organization_slug_snapshot,
    organization_record.slug
  );

  return new;
end;
$function$;
REVOKE ALL ON FUNCTION public.snapshot_payment_obligation_context() FROM anon;
REVOKE ALL ON FUNCTION public.snapshot_payment_obligation_context() FROM authenticated;
CREATE FUNCTION public.submit_association_application(p_application_id uuid, p_organization_id uuid, p_plan_type public.subscription_plan_type_enum, p_terms_version text, p_draft_version bigint)
 RETURNS TABLE(application_revision_id uuid, obligation_id uuid, organization_id uuid, plan_type public.subscription_plan_type_enum, amount integer, currency text, payment_method text, obligation_status public.payment_obligation_status_enum, available_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
COMMENT ON FUNCTION public.submit_association_application(uuid,uuid,public.subscription_plan_type_enum,text,bigint) IS 'Atomically snapshots an authenticated association application and creates exactly one initial manual-PIX obligation. Returns no personal application fields.';
REVOKE ALL ON FUNCTION public.submit_association_application(uuid, uuid, public.subscription_plan_type_enum, text, bigint) FROM anon;
CREATE FUNCTION public.unregister_push_token(p_token text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := (select auth.uid());
  removed_id bigint;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  delete from public.push_tokens
  where token = nullif(btrim(p_token), '')
    and profile_id = actor_id
  returning id into removed_id;

  return removed_id is not null;
end;
$function$;
COMMENT ON FUNCTION public.unregister_push_token(text) IS 'Removes one device token only when it is owned by the currently authenticated profile.';
REVOKE ALL ON FUNCTION public.unregister_push_token(text) FROM anon;
CREATE FUNCTION public.validate_billing_policy_timezone()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_valid_billing_timezone(new.billing_timezone) then
    raise exception 'Billing timezone must be a valid IANA timezone name.'
      using errcode = '22023';
  end if;

  return new;
end;
$function$;
REVOKE ALL ON FUNCTION public.validate_billing_policy_timezone() FROM anon;
REVOKE ALL ON FUNCTION public.validate_billing_policy_timezone() FROM authenticated;
CREATE TABLE public.contribution_plan_assignments (id uuid DEFAULT gen_random_uuid() NOT NULL, schedule_id uuid NOT NULL, effective_period_start date NOT NULL, plan_type public.subscription_plan_type_enum NOT NULL, amount integer NOT NULL, currency text NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL, due_day smallint, lead_days smallint, billing_timezone text, pix_copy_paste text);
ALTER TABLE public.contribution_plan_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_plan_assignments ADD CONSTRAINT contribution_plan_assignments_amount_check CHECK (amount > 0);
ALTER TABLE public.contribution_plan_assignments ADD CONSTRAINT contribution_plan_assignments_currency_check CHECK (currency ~ '^[A-Z]{3}$'::text);
ALTER TABLE public.contribution_plan_assignments ADD CONSTRAINT contribution_plan_assignments_due_day_check CHECK (due_day IS NULL OR due_day >= 1 AND due_day <= 31);
ALTER TABLE public.contribution_plan_assignments ADD CONSTRAINT contribution_plan_assignments_lead_days_check CHECK (lead_days IS NULL OR lead_days >= 0 AND lead_days <= 31);
ALTER TABLE public.contribution_plan_assignments ADD CONSTRAINT contribution_plan_assignments_pix_check CHECK (pix_copy_paste IS NULL OR NULLIF(btrim(pix_copy_paste), ''::text) IS NOT NULL);
ALTER TABLE public.contribution_plan_assignments ADD CONSTRAINT contribution_plan_assignments_pkey PRIMARY KEY (id);
ALTER TABLE public.contribution_plan_assignments ADD CONSTRAINT contribution_plan_assignments_schedule_id_effective_period__key UNIQUE (schedule_id, effective_period_start);
ALTER TABLE public.contribution_plan_assignments ADD CONSTRAINT contribution_plan_assignments_timezone_check CHECK (billing_timezone IS NULL OR NULLIF(btrim(billing_timezone), ''::text) IS NOT NULL);
REVOKE ALL ON public.contribution_plan_assignments FROM anon;
REVOKE DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.contribution_plan_assignments FROM authenticated;
CREATE INDEX contribution_plan_assignments_schedule_period_idx ON public.contribution_plan_assignments (schedule_id, effective_period_start, id);
CREATE INDEX contribution_plan_assignments_schedule_effective_idx ON public.contribution_plan_assignments (schedule_id, effective_period_start DESC);
CREATE TRIGGER contribution_plan_assignments_immutable BEFORE UPDATE ON public.contribution_plan_assignments FOR EACH ROW EXECUTE FUNCTION public.reject_contribution_plan_assignment_mutation();
CREATE TRIGGER contribution_plan_assignments_validate_timezone BEFORE INSERT OR UPDATE OF billing_timezone ON public.contribution_plan_assignments FOR EACH ROW WHEN (new.billing_timezone IS NOT NULL) EXECUTE FUNCTION public.validate_billing_policy_timezone();
CREATE TABLE public.contribution_schedules (id uuid DEFAULT gen_random_uuid() NOT NULL, organization_id uuid NOT NULL, user_id uuid NOT NULL, cadence public.contribution_cadence_enum NOT NULL, admission_date date NOT NULL, due_day smallint NOT NULL, lead_days smallint NOT NULL, billing_timezone text NOT NULL, currency text NOT NULL, active boolean DEFAULT true NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL);
ALTER TABLE public.contribution_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_schedules ADD CONSTRAINT contribution_schedules_currency_check CHECK (currency ~ '^[A-Z]{3}$'::text);
ALTER TABLE public.contribution_schedules ADD CONSTRAINT contribution_schedules_due_day_check CHECK (due_day >= 1 AND due_day <= 31);
ALTER TABLE public.contribution_schedules ADD CONSTRAINT contribution_schedules_lead_days_check CHECK (lead_days >= 0 AND lead_days <= 31);
ALTER TABLE public.contribution_schedules ADD CONSTRAINT contribution_schedules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX contribution_schedules_one_active_per_member_idx ON public.contribution_schedules (organization_id, user_id) WHERE active;
ALTER TABLE public.contribution_schedules ADD CONSTRAINT contribution_schedules_pkey PRIMARY KEY (id);
ALTER TABLE public.contribution_plan_assignments ADD CONSTRAINT contribution_plan_assignments_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.contribution_schedules(id) ON DELETE CASCADE;
ALTER TABLE public.contribution_schedules ADD CONSTRAINT contribution_schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
REVOKE ALL ON public.contribution_schedules FROM anon;
REVOKE DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.contribution_schedules FROM authenticated;
CREATE INDEX contribution_schedules_org_user_idx ON public.contribution_schedules (organization_id, user_id) WHERE active;
CREATE TRIGGER contribution_schedules_immutable_anchor BEFORE UPDATE ON public.contribution_schedules FOR EACH ROW EXECUTE FUNCTION public.reject_contribution_schedule_anchor_mutation();
CREATE TRIGGER contribution_schedules_validate_timezone BEFORE INSERT OR UPDATE OF billing_timezone ON public.contribution_schedules FOR EACH ROW EXECUTE FUNCTION public.validate_billing_policy_timezone();
CREATE TABLE public.membership_application_revisions (id uuid DEFAULT gen_random_uuid() NOT NULL, application_id uuid NOT NULL, organization_id uuid NOT NULL, user_id uuid NOT NULL, revision_number integer NOT NULL, draft_version bigint NOT NULL, plan_type public.subscription_plan_type_enum NOT NULL, terms_version text NOT NULL, accepted_terms_at timestamp with time zone NOT NULL, submitted_at timestamp with time zone NOT NULL, full_name text, birth_date date, nationality text, marital_status public.marital_status_enum, profession text, birthplace text, cpf text, id_document_number text, id_document_issuer text, postal_code text, address_line text, city text, state text, email text, phone text, blood_type public.blood_type_enum, has_allergies boolean NOT NULL, allergies text, has_dietary_restrictions boolean NOT NULL, dietary_restrictions text, highline_experience public.highline_experience_enum, has_rescue_course boolean, first_aid_course public.first_aid_course_enum, emergency_contact_name text, emergency_contact_relationship text, emergency_contact_phone text, plan_amount integer NOT NULL, currency text NOT NULL, pix_copy_paste text NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL);
COMMENT ON TABLE public.membership_application_revisions IS 'Immutable, revisionable snapshots of submitted association applications. Never use live profile data for admission review.';
COMMENT ON COLUMN public.membership_application_revisions.plan_amount IS 'Server-snapshotted price in the smallest currency unit at submission time.';
COMMENT ON COLUMN public.membership_application_revisions.pix_copy_paste IS 'Server-snapshotted static manual-PIX payload for the selected association plan.';
ALTER TABLE public.membership_application_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisi_application_id_revision_numbe_key UNIQUE (application_id, revision_number);
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisio_application_id_draft_version_key UNIQUE (application_id, draft_version);
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisions_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.membership_applications(id);
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisions_currency_check CHECK (currency ~ '^[A-Z]{3}$'::text);
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisions_draft_version_check CHECK (draft_version > 0);
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisions_pix_copy_paste_check CHECK (NULLIF(btrim(pix_copy_paste), ''::text) IS NOT NULL);
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisions_pkey PRIMARY KEY (id);
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisions_plan_amount_check CHECK (plan_amount > 0);
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisions_terms_version_check CHECK (NULLIF(btrim(terms_version), ''::text) IS NOT NULL);
ALTER TABLE public.membership_application_revisions ADD CONSTRAINT membership_application_revisions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
REVOKE ALL ON public.membership_application_revisions FROM anon;
REVOKE DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.membership_application_revisions FROM authenticated;
CREATE TRIGGER membership_application_revisions_immutable BEFORE DELETE OR UPDATE ON public.membership_application_revisions FOR EACH ROW EXECUTE FUNCTION public.reject_membership_application_revision_mutation();
CREATE POLICY "Application owners can read their submitted revisions" ON public.membership_application_revisions FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
ALTER TABLE public.membership_applications ADD COLUMN draft_version bigint DEFAULT 1 NOT NULL;
ALTER TABLE public.membership_applications ADD CONSTRAINT membership_applications_draft_version_check CHECK (draft_version > 0);
ALTER TABLE public.membership_applications ADD COLUMN has_allergies boolean DEFAULT false NOT NULL;
ALTER TABLE public.membership_applications ADD COLUMN has_dietary_restrictions boolean DEFAULT false NOT NULL;
CREATE INDEX organization_members_billing_workspace_idx ON public.organization_members (organization_id, role, user_id);
ALTER TABLE public.organizations ADD COLUMN organization_type public.organization_type_enum DEFAULT 'association'::public.organization_type_enum NOT NULL;
CREATE POLICY "Members and association admins can read plan snapshots" ON public.contribution_plan_assignments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.contribution_schedules cs
  WHERE ((cs.id = contribution_plan_assignments.schedule_id) AND ((cs.user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM (public.organization_members om
             JOIN public.organizations o ON ((o.id = om.organization_id)))
          WHERE ((om.organization_id = cs.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role = 'admin'::public.organization_role_enum) AND (o.organization_type = 'association'::public.organization_type_enum)))))))));
CREATE POLICY "Members and association admins can read schedules" ON public.contribution_schedules FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM (public.organization_members om
     JOIN public.organizations o ON ((o.id = om.organization_id)))
  WHERE ((om.organization_id = contribution_schedules.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role = 'admin'::public.organization_role_enum) AND (o.organization_type = 'association'::public.organization_type_enum))))));
COMMENT ON COLUMN public.organizations.organization_type IS 'Immutable organization classification. Formal membership applications are allowed only for associations.';
ALTER TABLE public.organizations ADD COLUMN billing_currency text DEFAULT 'BRL'::text NOT NULL;
COMMENT ON COLUMN public.organizations.billing_currency IS 'ISO 4217 currency used for new association obligations.';
ALTER TABLE public.organizations ADD CONSTRAINT organizations_billing_currency_format_check CHECK (billing_currency ~ '^[A-Z]{3}$'::text);
ALTER TABLE public.organizations ADD COLUMN membership_terms_version text DEFAULT 'estatuto-v1'::text NOT NULL;
COMMENT ON COLUMN public.organizations.membership_terms_version IS 'Exact terms version accepted by new association applicants.';
ALTER TABLE public.organizations ADD CONSTRAINT organizations_membership_terms_version_check CHECK (NULLIF(btrim(membership_terms_version), ''::text) IS NOT NULL);
ALTER TABLE public.organizations ADD COLUMN billing_timezone text DEFAULT 'America/Sao_Paulo'::text NOT NULL;
COMMENT ON COLUMN public.organizations.billing_timezone IS 'IANA timezone used when evaluating contribution calendar dates.';
ALTER TABLE public.organizations ADD CONSTRAINT organizations_billing_timezone_check CHECK (NULLIF(btrim(billing_timezone), ''::text) IS NOT NULL);
ALTER TABLE public.organizations ADD COLUMN billing_due_day smallint DEFAULT 10 NOT NULL;
COMMENT ON COLUMN public.organizations.billing_due_day IS 'Calendar day used for recurring contributions; initially 10 for SL.A.C.';
ALTER TABLE public.organizations ADD CONSTRAINT organizations_billing_due_day_check CHECK (billing_due_day >= 1 AND billing_due_day <= 31);
ALTER TABLE public.organizations ADD COLUMN billing_lead_days smallint DEFAULT 7 NOT NULL;
COMMENT ON COLUMN public.organizations.billing_lead_days IS 'Number of calendar days before due_on when a recurring obligation becomes available.';
ALTER TABLE public.organizations ADD CONSTRAINT organizations_billing_lead_days_check CHECK (billing_lead_days >= 0 AND billing_lead_days <= 31);
CREATE TRIGGER organizations_validate_billing_policy_timezone BEFORE INSERT OR UPDATE OF billing_timezone ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.validate_billing_policy_timezone();
CREATE TABLE public.payment_claim_audit_events (id uuid DEFAULT gen_random_uuid() NOT NULL, organization_id uuid NOT NULL, obligation_id uuid NOT NULL, claim_id uuid NOT NULL, actor_user_id uuid NOT NULL, previous_state text NOT NULL, next_state text NOT NULL, reason text, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL);
COMMENT ON TABLE public.payment_claim_audit_events IS 'Append-only claim transition evidence containing server-derived actor, obligation, claim, state change, time, and optional reason.';
ALTER TABLE public.payment_claim_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_claim_audit_events ADD CONSTRAINT payment_claim_audit_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.profiles(id);
ALTER TABLE public.payment_claim_audit_events ADD CONSTRAINT payment_claim_audit_events_claim_id_next_state_key UNIQUE (claim_id, next_state);
ALTER TABLE public.payment_claim_audit_events ADD CONSTRAINT payment_claim_audit_events_next_state_check CHECK (next_state = ANY (ARRAY['payment_available'::text, 'under_review'::text, 'payment_settled'::text]));
ALTER TABLE public.payment_claim_audit_events ADD CONSTRAINT payment_claim_audit_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.payment_claim_audit_events ADD CONSTRAINT payment_claim_audit_events_pkey PRIMARY KEY (id);
ALTER TABLE public.payment_claim_audit_events ADD CONSTRAINT payment_claim_audit_events_previous_state_check CHECK (previous_state = ANY (ARRAY['payment_available'::text, 'under_review'::text, 'payment_settled'::text]));
ALTER TABLE public.payment_claim_audit_events ADD CONSTRAINT payment_claim_audit_events_reason_check CHECK (reason IS NULL OR char_length(reason) <= 500);
ALTER TABLE public.payment_claim_audit_events ADD CONSTRAINT payment_claim_audit_events_transition_check CHECK (previous_state = 'payment_available'::text AND next_state = 'under_review'::text OR previous_state = 'under_review'::text AND (next_state = ANY (ARRAY['payment_available'::text, 'payment_settled'::text])));
REVOKE ALL ON public.payment_claim_audit_events FROM anon;
REVOKE DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.payment_claim_audit_events FROM authenticated;
CREATE INDEX payment_claim_audit_events_obligation_created_at_idx ON public.payment_claim_audit_events (obligation_id, created_at DESC);
CREATE INDEX payment_claim_audit_events_organization_created_at_idx ON public.payment_claim_audit_events (organization_id, created_at DESC);
CREATE INDEX payment_claim_audit_events_actor_created_at_idx ON public.payment_claim_audit_events (actor_user_id, created_at DESC);
CREATE INDEX payment_claim_audit_events_claim_history_idx ON public.payment_claim_audit_events (claim_id, created_at, id);
CREATE TRIGGER payment_claim_audit_events_immutable BEFORE DELETE OR UPDATE ON public.payment_claim_audit_events FOR EACH ROW EXECUTE FUNCTION public.reject_payment_claim_audit_mutation();
CREATE POLICY "Organization admins can read payment claim audit events" ON public.payment_claim_audit_events FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = payment_claim_audit_events.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role = 'admin'::public.organization_role_enum)))));
CREATE TABLE public.payment_claims (id uuid DEFAULT gen_random_uuid() NOT NULL, obligation_id uuid NOT NULL, organization_id uuid NOT NULL, claimant_user_id uuid NOT NULL, payer_type public.payment_claim_payer_type_enum NOT NULL, payer_name text, status public.payment_claim_status_enum DEFAULT 'under_review'::public.payment_claim_status_enum NOT NULL, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL, decided_at timestamp with time zone, decision_reason text);
CREATE POLICY "Claimants can read their own payment claim audit events" ON public.payment_claim_audit_events FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.payment_claims pc
  WHERE ((pc.id = payment_claim_audit_events.claim_id) AND (pc.claimant_user_id = ( SELECT auth.uid() AS uid))))));
COMMENT ON TABLE public.payment_claims IS 'Immutable payment-claim submissions. Claim decisions are server-controlled and never settle the obligation by themselves.';
COMMENT ON COLUMN public.payment_claims.payer_name IS 'Normalized payer name when another person made the deposit. No receipt or banking metadata is stored.';
COMMENT ON COLUMN public.payment_claims.status IS 'Current server-controlled decision state. Submission evidence remains immutable; transitions are appended to payment_claim_audit_events.';
ALTER TABLE public.payment_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_claims ADD CONSTRAINT payment_claims_check CHECK (payer_type = 'applicant'::public.payment_claim_payer_type_enum AND payer_name IS NULL OR payer_type = 'other'::public.payment_claim_payer_type_enum AND NULLIF(btrim(payer_name), ''::text) IS NOT NULL AND char_length(payer_name) <= 120);
ALTER TABLE public.payment_claims ADD CONSTRAINT payment_claims_check1 CHECK (status <> 'under_review'::public.payment_claim_status_enum OR decided_at IS NULL AND decision_reason IS NULL);
ALTER TABLE public.payment_claims ADD CONSTRAINT payment_claims_claimant_user_id_fkey FOREIGN KEY (claimant_user_id) REFERENCES public.profiles(id);
ALTER TABLE public.payment_claims ADD CONSTRAINT payment_claims_decision_reason_check CHECK (decision_reason IS NULL OR char_length(decision_reason) <= 500);
ALTER TABLE public.payment_claims ADD CONSTRAINT payment_claims_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.payment_claims ADD CONSTRAINT payment_claims_pkey PRIMARY KEY (id);
ALTER TABLE public.payment_claim_audit_events ADD CONSTRAINT payment_claim_audit_events_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.payment_claims(id);
ALTER TABLE public.payment_claims ADD CONSTRAINT payment_claims_terminal_decided_at_check CHECK (status = 'under_review'::public.payment_claim_status_enum OR decided_at IS NOT NULL);
REVOKE ALL ON public.payment_claims FROM anon;
REVOKE DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.payment_claims FROM authenticated;
CREATE INDEX payment_claims_current_queue_idx ON public.payment_claims (organization_id, created_at, id) WHERE status = 'under_review'::public.payment_claim_status_enum;
CREATE UNIQUE INDEX payment_claims_one_under_review_per_obligation_idx ON public.payment_claims (obligation_id) WHERE status = 'under_review'::public.payment_claim_status_enum;
CREATE INDEX payment_claims_obligation_claimant_created_at_idx ON public.payment_claims (obligation_id, claimant_user_id, created_at DESC, id DESC);
CREATE INDEX payment_claims_billing_workspace_queue_idx ON public.payment_claims (organization_id, created_at, id, obligation_id) WHERE status = 'under_review'::public.payment_claim_status_enum;
CREATE INDEX payment_claims_obligation_status_idx ON public.payment_claims (obligation_id, status, created_at DESC, id DESC);
CREATE INDEX payment_claims_organization_status_idx ON public.payment_claims (organization_id, status, created_at DESC);
CREATE INDEX payment_claims_claimant_created_at_idx ON public.payment_claims (claimant_user_id, created_at DESC);
CREATE TRIGGER payment_claims_evidence_immutable BEFORE DELETE OR UPDATE ON public.payment_claims FOR EACH ROW EXECUTE FUNCTION public.reject_payment_claim_evidence_mutation();
CREATE POLICY "Claimants can read their own payment claims" ON public.payment_claims FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = claimant_user_id));
CREATE POLICY "Organization admins can read payment claims" ON public.payment_claims FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = payment_claims.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role = 'admin'::public.organization_role_enum)))));
CREATE TABLE public.payment_obligations (id uuid DEFAULT gen_random_uuid() NOT NULL, organization_id uuid NOT NULL, user_id uuid NOT NULL, application_revision_id uuid, purpose public.payment_obligation_purpose_enum DEFAULT 'initial_admission'::public.payment_obligation_purpose_enum NOT NULL, status public.payment_obligation_status_enum DEFAULT 'available'::public.payment_obligation_status_enum NOT NULL, plan_type public.subscription_plan_type_enum NOT NULL, amount integer NOT NULL, currency text NOT NULL, payment_method text DEFAULT 'manual_pix'::text NOT NULL, pix_copy_paste text NOT NULL, available_at timestamp with time zone NOT NULL, settled_at timestamp with time zone, legacy_payment_id uuid, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL, schedule_id uuid, period_key text DEFAULT 'initial'::text NOT NULL, period_start date DEFAULT CURRENT_DATE NOT NULL, period_end date DEFAULT CURRENT_DATE NOT NULL, available_on date DEFAULT CURRENT_DATE NOT NULL, due_on date DEFAULT CURRENT_DATE NOT NULL, schedule_term_id uuid, billing_timezone text, billing_due_day smallint, billing_lead_days smallint, organization_name_snapshot text, organization_slug_snapshot text);
COMMENT ON TABLE public.payment_obligations IS 'Server-authoritative, independently payable billing obligations. Claims and admission decisions are separate workflows.';
COMMENT ON COLUMN public.payment_obligations.legacy_payment_id IS 'Optional migration link to an existing legacy payment; new submissions never create a legacy payment row.';
COMMENT ON COLUMN public.payment_obligations.schedule_term_id IS 'Immutable effective-dated contribution term that produced this obligation.';
COMMENT ON COLUMN public.payment_obligations.billing_timezone IS 'Timezone snapshot used to evaluate this obligation; never read from live policy for history.';
COMMENT ON COLUMN public.payment_obligations.billing_due_day IS 'Due-day policy snapshot used to produce this obligation.';
COMMENT ON COLUMN public.payment_obligations.billing_lead_days IS 'Lead-day policy snapshot used to produce this obligation.';
ALTER TABLE public.payment_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_amount_check CHECK (amount > 0);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_application_revision_id_fkey FOREIGN KEY (application_revision_id) REFERENCES public.membership_application_revisions(id);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_application_revision_id_purpose_key UNIQUE (application_revision_id, purpose);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_currency_check CHECK (currency ~ '^[A-Z]{3}$'::text);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_legacy_payment_id_fkey FOREIGN KEY (legacy_payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_legacy_payment_id_key UNIQUE (legacy_payment_id);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_payment_method_check CHECK (payment_method = 'manual_pix'::text);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_pix_copy_paste_check CHECK (NULLIF(btrim(pix_copy_paste), ''::text) IS NOT NULL);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_pkey PRIMARY KEY (id);
ALTER TABLE public.payment_claim_audit_events ADD CONSTRAINT payment_claim_audit_events_obligation_id_fkey FOREIGN KEY (obligation_id) REFERENCES public.payment_obligations(id);
ALTER TABLE public.payment_claims ADD CONSTRAINT payment_claims_obligation_id_fkey FOREIGN KEY (obligation_id) REFERENCES public.payment_obligations(id);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.contribution_schedules(id);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_schedule_period_key UNIQUE (schedule_id, period_key);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_schedule_term_id_fkey FOREIGN KEY (schedule_term_id) REFERENCES public.contribution_plan_assignments(id);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_scope_check CHECK (purpose = 'initial_admission'::public.payment_obligation_purpose_enum AND application_revision_id IS NOT NULL AND schedule_id IS NULL OR purpose = 'recurring'::public.payment_obligation_purpose_enum AND application_revision_id IS NULL AND schedule_id IS NOT NULL);
ALTER TABLE public.payment_obligations ADD CONSTRAINT payment_obligations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
REVOKE ALL ON public.payment_obligations FROM anon;
REVOKE DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.payment_obligations FROM authenticated;
CREATE INDEX payment_obligations_billing_workspace_idx ON public.payment_obligations (organization_id, purpose, status, due_on, available_on, created_at, id);
CREATE INDEX payment_obligations_recurring_term_idx ON public.payment_obligations (schedule_term_id, due_on, id) WHERE purpose = 'recurring'::public.payment_obligation_purpose_enum;
CREATE INDEX payment_obligations_member_due_idx ON public.payment_obligations (organization_id, user_id, due_on DESC, created_at DESC, id DESC);
CREATE INDEX payment_obligations_initial_queue_idx ON public.payment_obligations (organization_id, status, application_revision_id) WHERE purpose = 'initial_admission'::public.payment_obligation_purpose_enum;
CREATE INDEX payment_obligations_actionable_idx ON public.payment_obligations (organization_id, user_id, available_on, due_on, created_at, id) WHERE status <> ALL (ARRAY['settled'::public.payment_obligation_status_enum, 'void'::public.payment_obligation_status_enum]);
CREATE INDEX payment_obligations_user_organization_idx ON public.payment_obligations (user_id, organization_id, status);
CREATE TRIGGER payment_obligations_immutable_context BEFORE UPDATE ON public.payment_obligations FOR EACH ROW EXECUTE FUNCTION public.reject_payment_obligation_context_mutation();
CREATE TRIGGER payment_obligations_snapshot_context BEFORE INSERT ON public.payment_obligations FOR EACH ROW EXECUTE FUNCTION public.snapshot_payment_obligation_context();
CREATE POLICY "Association admins can read payment obligations" ON public.payment_obligations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.organization_members om
     JOIN public.organizations o ON ((o.id = om.organization_id)))
  WHERE ((om.organization_id = payment_obligations.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role = 'admin'::public.organization_role_enum) AND (o.organization_type = 'association'::public.organization_type_enum)))));
CREATE POLICY "Obligation owners can read their obligations" ON public.payment_obligations FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
REVOKE ALL ON public.push_tokens FROM anon;
REVOKE ALL ON public.push_tokens FROM authenticated;

-- ---------------------------------------------------------------------------
-- Conversion of the pre-cutover data.
--
-- Fresh databases have nothing to convert and skip every statement below.
-- Production has never applied this migration, so this block IS the production
-- cutover: it must carry every existing application, admission payment and
-- active membership into the final model before the legacy provider tables are
-- dropped.
-- ---------------------------------------------------------------------------

-- Normalize legacy drafts before snapshotting submitted applications.
update public.membership_applications
set has_allergies = true
where nullif(btrim(allergies), '') is not null;

update public.membership_applications
set has_dietary_restrictions = true
where nullif(btrim(dietary_restrictions), '') is not null;

-- An admission date must come from verified payment evidence. Abort the
-- cutover instead of silently inventing anchors for existing active members.
-- The offending pairs are named: on production this exception is the only
-- diagnostic anyone gets.
do $$
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
    and not exists (
      select 1
      from public.payments p
      where p.organization_id = om.organization_id
        and p.user_id = om.user_id
        and p.status = 'succeeded'::public.payment_status_enum
    );

  if offenders is not null then
    raise exception
      'Billing cutover stopped: these active association members have no succeeded admission payment: %',
      offenders;
  end if;
end;
$$;

-- Preserve each existing submitted application as one immutable revision.
--
-- The plan is read from the legacy subscription where one exists. It is a LEFT
-- join on purpose: a submitted application with no subscription row is exactly
-- the applicant who is still waiting for a decision, and dropping them here
-- would leave them permanently undecidable with no revision to review.
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
  legacy_plan.plan_type,
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
  case legacy_plan.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_price_amount
    else o.monthly_price_amount
  end,
  o.billing_currency,
  case legacy_plan.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_pix_copy_paste
    else o.monthly_pix_copy_paste
  end
from public.membership_applications ma
join public.organizations o on o.id = ma.organization_id
cross join lateral (
  select coalesce(
    (
      select s.plan_type
      from public.subscriptions s
      where s.organization_id = ma.organization_id
        and s.user_id = ma.user_id
      order by
        case
          when s.status = 'active'::public.subscription_status_enum then 0
          else 1
        end,
        s.id
      limit 1
    ),
    'monthly'::public.subscription_plan_type_enum
  ) as plan_type
) legacy_plan
where ma.status = 'submitted'::public.membership_application_status_enum
  and o.organization_type = 'association'::public.organization_type_enum
  and case legacy_plan.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_price_amount
    else o.monthly_price_amount
  end > 0
  and nullif(btrim(case legacy_plan.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_pix_copy_paste
    else o.monthly_pix_copy_paste
  end), '') is not null
on conflict (application_id, draft_version) do nothing;

-- Convert the historical admission payment into one final-shape obligation.
--
-- Any succeeded payment counts as settlement evidence, including one taken
-- through Stripe or Abacate Pay. Restricting this to provider-less rows would
-- leave a member who paid through a gateway holding an `available` admission
-- obligation -- production would show a paid-up founding member as owing their
-- admission fee -- while the abort guard above already let them through.
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
  legacy_payment_id,
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
      then coalesce(
        legacy_payment.paid_at,
        legacy_payment.settlement_applied_at,
        legacy_payment.created_at
      )
    else null
  end,
  legacy_payment.id,
  'initial:' || mar.id::text,
  timezone(
    o.billing_timezone,
    coalesce(legacy_payment.created_at, mar.submitted_at)
  )::date,
  timezone(
    o.billing_timezone,
    coalesce(legacy_payment.created_at, mar.submitted_at)
  )::date,
  timezone(
    o.billing_timezone,
    coalesce(legacy_payment.created_at, mar.submitted_at)
  )::date,
  timezone(
    o.billing_timezone,
    coalesce(legacy_payment.created_at, mar.submitted_at)
  )::date,
  o.billing_timezone,
  o.billing_due_day,
  o.billing_lead_days,
  o.name,
  o.slug
from public.membership_application_revisions mar
join public.organizations o on o.id = mar.organization_id
left join lateral (
  select
    p.id,
    p.amount,
    p.status,
    p.created_at,
    p.paid_at,
    p.settlement_applied_at
  from public.payments p
  where p.organization_id = mar.organization_id
    and p.user_id = mar.user_id
  order by
    case when p.status = 'succeeded'::public.payment_status_enum then 0 else 1 end,
    p.created_at asc
  limit 1
) legacy_payment on true
where mar.plan_amount > 0
  and nullif(btrim(mar.pix_copy_paste), '') is not null
on conflict (application_revision_id, purpose) do nothing;

-- A settled admission obligation is proof the association admitted this
-- person, so the application leaves the `submitted` queue. Applications with
-- no settled admission stay `submitted` and remain decidable.
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
select
  om.organization_id,
  om.user_id,
  case
    when legacy_plan.plan_type = 'annual'::public.subscription_plan_type_enum
      then 'annual'::public.contribution_cadence_enum
    else 'monthly'::public.contribution_cadence_enum
  end,
  timezone(
    o.billing_timezone,
    admission_payment.admission_at
  )::date,
  o.billing_due_day,
  o.billing_lead_days,
  o.billing_timezone,
  o.billing_currency,
  true
from public.organization_members om
join public.organizations o on o.id = om.organization_id
cross join lateral (
  select coalesce(
    (
      select s.plan_type
      from public.subscriptions s
      where s.organization_id = om.organization_id
        and s.user_id = om.user_id
      order by
        case
          when s.status = 'active'::public.subscription_status_enum then 0
          else 1
        end,
        s.id
      limit 1
    ),
    'monthly'::public.subscription_plan_type_enum
  ) as plan_type
) legacy_plan
join lateral (
  select min(coalesce(p.paid_at, p.settlement_applied_at, p.created_at)) as admission_at
  from public.payments p
  where p.organization_id = om.organization_id
    and p.user_id = om.user_id
    and p.status = 'succeeded'::public.payment_status_enum
) admission_payment on admission_payment.admission_at is not null
where o.organization_type = 'association'::public.organization_type_enum
  and om.role in (
    'admin'::public.organization_role_enum,
    'member'::public.organization_role_enum
  )
on conflict do nothing;

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
select
  cs.id,
  cs.admission_date,
  legacy_plan.plan_type,
  case legacy_plan.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_price_amount
    else o.monthly_price_amount
  end,
  o.billing_currency,
  o.billing_due_day,
  o.billing_lead_days,
  o.billing_timezone,
  case legacy_plan.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_pix_copy_paste
    else o.monthly_pix_copy_paste
  end
from public.contribution_schedules cs
join public.organizations o on o.id = cs.organization_id
cross join lateral (
  select case
    when cs.cadence = 'annual'::public.contribution_cadence_enum
      then 'annual'::public.subscription_plan_type_enum
    else 'monthly'::public.subscription_plan_type_enum
  end as plan_type
) legacy_plan
where cs.active
  and case legacy_plan.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_price_amount
    else o.monthly_price_amount
  end > 0
  and nullif(btrim(case legacy_plan.plan_type
    when 'annual'::public.subscription_plan_type_enum then o.annual_pix_copy_paste
    else o.monthly_pix_copy_paste
  end), '') is not null
on conflict (schedule_id, effective_period_start) do nothing;

-- Every active member must come out of the conversion with exactly one active
-- schedule and one effective term. Anything else means the ledger would show a
-- member the generator can never bill, so stop rather than ship it.
do $$
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
      'Billing cutover stopped: these active association members do not have exactly one active contribution schedule: %',
      offenders;
  end if;

  select string_agg(
    format('(schedule %s)', cs.id),
    ', '
    order by cs.id
  )
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
      'Billing cutover stopped: these active contribution schedules have no effective plan term: %',
      offenders;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retire the legacy provider model.
--
-- Manual PIX obligations and claims are the only payment model now. Future
-- gateways attach transactions to an obligation instead of reviving a parallel
-- one, so nothing here is kept "for later".
--
-- Every row and provider identifier in payments and subscriptions is deleted,
-- including rows belonging to organizations that are not associations. That is
-- intentional and is not a migration blocker.
--
-- One thing is deliberately NOT reconstructed: a canceled subscription
-- belonging to somebody who is no longer in organization_members is a
-- membership that ended before departures were journalled. subscriptions
-- carries no created_at and no departure date, so a membership period would
-- have to be invented to record it. The payment evidence survives -- their
-- application revision and admission obligation are converted above -- but the
-- unreconstructable membership dates are discarded rather than fabricated.
-- ---------------------------------------------------------------------------

-- The obligation's link to its originating payment has served its purpose in
-- the conversion above and cannot outlive the table it points at.
alter table public.payment_obligations
  drop constraint if exists payment_obligations_legacy_payment_id_fkey;
alter table public.payment_obligations
  drop constraint if exists payment_obligations_legacy_payment_id_key;
alter table public.payment_obligations
  drop column if exists legacy_payment_id;

alter publication supabase_realtime drop table public.payments;

drop trigger if exists payments_apply_succeeded_effects on public.payments;

drop function if exists public.apply_succeeded_payment_effects();
drop function if exists public.apply_payment_settlement_effects(uuid);
drop function if exists public.mark_payment_succeeded_manually(uuid, timestamp with time zone);
drop function if exists public.mark_manual_payment_paid_by_user(uuid);
drop function if exists public.get_manual_payment_instructions(uuid);

drop table public.payments;
drop table public.subscriptions;

drop type public.payment_status_enum;
drop type public.subscription_status_enum;

-- Foreign-key and membership lookup indexes missing from the generated delta.
create index membership_application_revisions_user_idx
  on public.membership_application_revisions (user_id);
create index membership_application_revisions_organization_idx
  on public.membership_application_revisions (organization_id);
create index contribution_schedules_active_user_idx
  on public.contribution_schedules (user_id)
  where active;
create index push_tokens_profile_id_idx
  on public.push_tokens (profile_id)
  where profile_id is not null;

alter function public.set_membership_applications_updated_at()
  set search_path = '';
alter function public.reject_membership_application_revision_mutation()
  set search_path = '';
alter function public.reject_payment_claim_audit_mutation()
  set search_path = '';

-- One permissive read policy per table keeps owner/admin access without the
-- extra policy evaluation flagged by the database advisor.
drop policy "Organization admins can read payment claim audit events"
  on public.payment_claim_audit_events;
drop policy "Claimants can read their own payment claim audit events"
  on public.payment_claim_audit_events;
create policy "Claimants and admins can read claim audit"
  on public.payment_claim_audit_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.payment_claims pc
      where pc.id = payment_claim_audit_events.claim_id
        and (
          pc.claimant_user_id = (select auth.uid())
          or exists (
            select 1
            from public.organization_members om
            where om.organization_id = payment_claim_audit_events.organization_id
              and om.user_id = (select auth.uid())
              and om.role = 'admin'::public.organization_role_enum
          )
        )
    )
  );

drop policy "Claimants can read their own payment claims"
  on public.payment_claims;
drop policy "Organization admins can read payment claims"
  on public.payment_claims;
create policy "Claimants and organization admins can read payment claims"
  on public.payment_claims
  for select
  to authenticated
  using (
    claimant_user_id = (select auth.uid())
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id = payment_claims.organization_id
        and om.user_id = (select auth.uid())
        and om.role = 'admin'::public.organization_role_enum
    )
  );

drop policy "Association admins can read payment obligations"
  on public.payment_obligations;
drop policy "Obligation owners can read their obligations"
  on public.payment_obligations;
create policy "Owners and association admins can read payment obligations"
  on public.payment_obligations
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
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

-- Default privileges are intentionally narrowed. Clients read through RLS;
-- mutations and scheduler workflows go through the reviewed RPC surface.
revoke all on table
  public.membership_application_revisions,
  public.payment_obligations,
  public.payment_claims,
  public.payment_claim_audit_events,
  public.contribution_schedules,
  public.contribution_plan_assignments
from public, anon, authenticated;

grant select on table
  public.membership_application_revisions,
  public.payment_obligations,
  public.payment_claims,
  public.payment_claim_audit_events,
  public.contribution_schedules,
  public.contribution_plan_assignments
to authenticated;

revoke all on table public.push_tokens from public, anon, authenticated;
grant select, delete on table public.push_tokens to service_role;

do $$
declare
  function_record record;
begin
  for function_record in
    select
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'approve_initial_claim',
        'approve_recurring_payment_claim',
        'claim_initial_payment',
        'claim_recurring_payment',
        'clamped_billing_date',
        'ensure_contribution_schedule',
        'first_recurring_due_date',
        'generate_membership_billing_obligations_at',
        'generate_membership_billing_obligations',
        'get_billing_workspace_claim_detail',
        'get_billing_workspace_members',
        'get_billing_workspace_organizations',
        'get_billing_workspace_payments',
        'get_billing_workspace_queue',
        'get_initial_payment_claim_detail',
        'get_initial_payment_claim_queue',
        'get_membership_billing_ledger',
        'get_payment_obligation_instructions',
        'is_valid_billing_timezone',
        'next_recurring_due_date',
        'recurring_due_date_on_or_after',
        'recurring_period_key',
        'register_push_token',
        'reject_contribution_plan_assignment_mutation',
        'reject_contribution_schedule_anchor_mutation',
        'reject_initial_claim',
        'reject_membership_application_revision_mutation',
        'reject_payment_claim_audit_mutation',
        'reject_payment_claim_evidence_mutation',
        'reject_payment_obligation_context_mutation',
        'reject_recurring_payment_claim',
        'set_membership_applications_updated_at',
        'snapshot_payment_obligation_context',
        'submit_association_application',
        'unregister_push_token',
        'validate_billing_policy_timezone'
      ])
  loop
    execute format(
      'revoke all on function %I.%I(%s) from public, anon, authenticated, service_role',
      function_record.nspname,
      function_record.proname,
      function_record.identity_arguments
    );
  end loop;
end;
$$;

grant execute on function
  public.approve_initial_claim(uuid),
  public.approve_recurring_payment_claim(uuid),
  public.claim_initial_payment(uuid, boolean, text),
  public.claim_recurring_payment(uuid, boolean, text),
  public.get_billing_workspace_claim_detail(uuid),
  public.get_billing_workspace_members(uuid),
  public.get_billing_workspace_organizations(),
  public.get_billing_workspace_payments(uuid),
  public.get_billing_workspace_queue(uuid),
  public.get_initial_payment_claim_detail(uuid),
  public.get_initial_payment_claim_queue(),
  public.get_membership_billing_ledger(uuid, text, integer),
  public.get_payment_obligation_instructions(uuid),
  public.register_push_token(text, public.language),
  public.reject_initial_claim(uuid, text),
  public.reject_recurring_payment_claim(uuid, text),
  public.submit_association_application(
    uuid,
    uuid,
    public.subscription_plan_type_enum,
    text,
    bigint
  ),
  public.unregister_push_token(text)
to authenticated;

grant execute on function
  public.generate_membership_billing_obligations()
to service_role;

-- Install the staging/production scheduler contract in a paused state.
-- Deployment activates these jobs only after Edge Functions, Vault secrets,
-- generator dry-run output, and reconciliation dry-run output are reviewed.

-- ---------------------------------------------------------------------------
-- Membership periods.
--
-- "Member" used to be a binary: a row in organization_members meant active and
-- its absence meant nothing at all. Somebody who left the association simply
-- disappeared from the admin ledger while their unpaid obligations stayed
-- behind, orphaned.
--
-- The closed periods live in an append-only side table rather than as a status
-- column, because every authorization check in this schema already reads "row
-- exists" as "is an active member". Keeping the row and adding a flag would
-- have made each of those checks silently wrong; deleting the row and
-- journalling the period keeps them correct exactly as written.
-- ---------------------------------------------------------------------------

create table public.organization_membership_departures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references public.profiles(id),
  departed_role public.organization_role_enum not null,
  joined_at timestamp with time zone not null,
  departed_at timestamp with time zone not null default timezone('utc'::text, now()),
  actor_user_id uuid references public.profiles(id),
  reason text,
  constraint organization_membership_departures_period_check
    check (departed_at >= joined_at),
  constraint organization_membership_departures_reason_check
    check (reason is null or char_length(reason) <= 500),
  constraint organization_membership_departures_period_key
    unique (organization_id, user_id, joined_at)
);

comment on table public.organization_membership_departures is
  'Append-only journal of membership periods that ended. A person with a departure row and no current organization_members row reads as an inactive member.';
comment on column public.organization_membership_departures.actor_user_id is
  'The association admin who ended the membership. Null for a system closure, such as the one account deletion performs.';

alter table public.organization_membership_departures enable row level security;

create index organization_membership_departures_org_user_idx
  on public.organization_membership_departures (organization_id, user_id, departed_at desc);
create index organization_membership_departures_actor_idx
  on public.organization_membership_departures (actor_user_id, departed_at desc)
  where actor_user_id is not null;

create function public.reject_membership_departure_mutation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  raise exception 'Membership periods are append-only.' using errcode = '55000';
end;
$function$;

revoke all on function public.reject_membership_departure_mutation()
  from public, anon, authenticated, service_role;

create trigger organization_membership_departures_append_only
before update or delete on public.organization_membership_departures
for each row execute function public.reject_membership_departure_mutation();

create policy "Former members and admins can read membership periods"
  on public.organization_membership_departures
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id = organization_membership_departures.organization_id
        and om.user_id = (select auth.uid())
        and om.role = 'admin'::public.organization_role_enum
    )
  );

revoke all on public.organization_membership_departures from public, anon;
revoke delete, insert, references, trigger, truncate, update
  on public.organization_membership_departures from authenticated;
grant select on public.organization_membership_departures to authenticated;

-- Direct membership mutation is closed.
--
-- These two policies let any signed-in client write organization_members
-- straight from the app, which bypasses admission review entirely: a person
-- could insert themselves as a member without an application, a contribution
-- or a decision, and could remove themselves without a membership period ever
-- being journalled. Admission and departure are reviewed commands now.
--
-- The authenticated SELECT policy is deliberately left exactly as it was, so
-- membership display for signed-in Choose Life users does not change.
drop policy "Authenticated users can join an organization." on public.organization_members;
drop policy "Members can leave an organization." on public.organization_members;

revoke insert, update, delete, truncate, references, trigger
  on table public.organization_members from public, anon, authenticated;

-- Ending a membership.
--
-- The membership row and the contribution schedule are two facts about the
-- same relationship, so they are retired together in one transaction.
-- Obligations already generated are deliberately left alone: an unpaid month
-- does not stop being owed because somebody walked away, and the ledger still
-- has to show it.
--
-- Only an association admin may end a membership -- including their own. There
-- is deliberately no last-admin invariant: an association that ends up with no
-- admin is recovered operationally, not by refusing the write.
create function public.end_association_membership(
  p_organization_id uuid,
  p_user_id uuid default null,
  p_reason text default null
)
returns table (
  departure_id uuid,
  organization_id uuid,
  user_id uuid,
  departed_role public.organization_role_enum,
  departed_at timestamp with time zone
)
language plpgsql
volatile
security definer
set search_path to ''
as $function$
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

comment on function public.end_association_membership(uuid, uuid, text) is
  'Ends one current association membership, journalling it as an immutable membership period and deactivating the contribution schedule. Callable only by an association admin, who may end their own membership. Existing obligations stay owed.';

revoke all on function public.end_association_membership(uuid, uuid, text)
from public, anon, authenticated, service_role;

grant execute on function public.end_association_membership(uuid, uuid, text)
to authenticated;

-- The people ledger reports three states instead of three half-states. Drafts
-- are excluded: a half-filled form is not a person the association has any
-- relationship with yet, and every draft row pushed a real member further down
-- the table.
create function public.get_billing_workspace_people(
  p_organization_id uuid
)
returns table (
  member_user_id uuid,
  member_name text,
  member_handle text,
  member_profile_picture text,
  member_role public.organization_role_enum,
  lifecycle_status text,
  application_status public.membership_application_status_enum,
  joined_at timestamp with time zone,
  plan_type public.subscription_plan_type_enum,
  last_verified_contribution_at timestamp with time zone
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
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

comment on function public.get_billing_workspace_people(uuid) is
  'Returns the organization-scoped people ledger: active members, pending applicants, and inactive ex-members, one row per person. Unsubmitted drafts are excluded.';

revoke all on function public.get_billing_workspace_people(uuid)
from public, anon, authenticated, service_role;

grant execute on function public.get_billing_workspace_people(uuid)
to authenticated;

-- Member detail for the admin ledger drawer.
--
-- The only way to read the form somebody filled in used to be
-- get_initial_payment_claim_detail, which is addressed by CLAIM id. That works
-- for the review queue, but the ledger drawer opens on a PERSON -- and the
-- people who most need looking up (a long-standing member, an ex-member,
-- anyone whose claim was already decided) have no claim to address.
--
-- The revision columns deliberately carry the same names as
-- get_initial_payment_claim_detail so one presentation component renders
-- either result.
create function public.get_association_member_detail(
  p_organization_id uuid,
  p_user_id uuid
)
returns table (
  member_user_id uuid,
  member_name text,
  member_handle text,
  member_profile_picture text,
  member_role public.organization_role_enum,
  lifecycle_status text,
  joined_at timestamp with time zone,
  departed_at timestamp with time zone,
  departure_reason text,
  application_id uuid,
  application_revision_id uuid,
  revision_number integer,
  submitted_at timestamp with time zone,
  plan_type public.subscription_plan_type_enum,
  terms_version text,
  accepted_terms_at timestamp with time zone,
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
  next_charge_period_key text,
  next_charge_due_on date,
  next_charge_amount integer,
  next_charge_currency text
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
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

comment on function public.get_association_member_detail(uuid, uuid) is
  'Admin-only person-addressed detail for the ledger drawer: current relationship dates plus the newest submitted application snapshot. A closed membership period is reported only when there is no live membership, so a rejoined member is never shown as departed.';

revoke all on function public.get_association_member_detail(uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function public.get_association_member_detail(uuid, uuid)
to authenticated;

-- One open application per person per association.
--
-- The total unique (organization_id, user_id) that used to be here made a
-- refusal terminal for the person, not just for the application: with no way
-- to create a second row, a corrected resubmission had to overwrite the
-- evidence of what was originally submitted and decided. Refused and admitted
-- rows now accumulate, and a correction or a rejoin is a new application. The
-- correction chain is discoverable through (organization_id, user_id,
-- created_at), not through revision_number.
alter table public.membership_applications
  drop constraint membership_applications_organization_id_user_id_key;

create unique index membership_applications_one_open_per_person_idx
  on public.membership_applications (organization_id, user_id)
  where status in (
    'draft'::public.membership_application_status_enum,
    'submitted'::public.membership_application_status_enum
  );

create index membership_applications_person_history_idx
  on public.membership_applications (organization_id, user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Immutability versus account deletion.
--
-- Every formal record is protected by a trigger that rejects UPDATE. Those
-- triggers are what make the evidence trustworthy, and they must stay. But the
-- account references on those same records are now ON DELETE SET NULL, so a
-- hard account deletion arrives at each of them as an UPDATE -- and is
-- rejected, which is exactly how deletion was blocked before this migration
-- (SQLSTATE 23503 became SQLSTATE 55000).
--
-- The distinction that resolves it: severing a link to a deleted account is
-- not a change to the record's CONTENT. Nothing a person attested to and
-- nothing an admin decided is altered. So the guards below allow precisely one
-- shape of update -- account reference columns going to null, and nothing else
-- changing -- and continue to reject everything else.
-- ---------------------------------------------------------------------------

create function public.is_person_link_maintenance(p_old jsonb, p_new jsonb)
returns boolean
language sql
immutable
set search_path to ''
as $function$
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

comment on function public.is_person_link_maintenance(jsonb, jsonb) is
  'True when an update changes nothing except the links between a formal record and its people: an account reference set to null (the shape a deleted Choose Life account produces through ON DELETE SET NULL), or the subject reference populated for the first time. Neither alters what a person attested to or what an admin decided, so the immutability guards allow exactly these and nothing else.';

revoke all on function public.is_person_link_maintenance(jsonb, jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.reject_membership_departure_mutation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'UPDATE'
    and public.is_person_link_maintenance(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;

  raise exception 'Membership periods are append-only.' using errcode = '55000';
end;
$function$;

create or replace function public.reject_membership_application_revision_mutation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'UPDATE'
    and public.is_person_link_maintenance(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;

  raise exception 'Submitted application revisions are immutable.'
    using errcode = '55000';
end;
$function$;

create or replace function public.reject_payment_claim_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'UPDATE'
    and public.is_person_link_maintenance(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;

  raise exception 'Payment claim audit events are immutable.'
    using errcode = '55000';
end;
$function$;

create or replace function public.reject_payment_claim_evidence_mutation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
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

create or replace function public.reject_payment_obligation_context_mutation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
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

create or replace function public.reject_contribution_schedule_anchor_mutation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
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

create or replace function public.reject_contribution_plan_assignment_mutation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if old.schedule_id is distinct from new.schedule_id
    or old.effective_period_start is distinct from new.effective_period_start
    or old.plan_type is distinct from new.plan_type
    or old.amount is distinct from new.amount
    or old.currency is distinct from new.currency
    or old.due_day is distinct from new.due_day
    or old.lead_days is distinct from new.lead_days
    or old.billing_timezone is distinct from new.billing_timezone
    or old.pix_copy_paste is distinct from new.pix_copy_paste then
    raise exception 'An effective-dated contribution term is immutable; append a new term.'
      using errcode = '55000';
  end if;

  return new;
end;
$function$;

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
revoke all on function public.reject_contribution_plan_assignment_mutation()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Formal association identity, decoupled from the Choose Life account.
--
-- A Choose Life account and a formal SL.A.C subject are two different things
-- with two different lifetimes. Deleting the account has to remove ordinary
-- profile data, but the association is legally obliged to keep exactly what a
-- person submitted and what was decided about it. Today it cannot: every
-- formal record hangs off profiles(id) with NOT NULL, so a hard account
-- deletion is simply refused (SQLSTATE 23503) -- and the one relaxation that
-- looks obvious, dropping contribution_schedules' ON DELETE CASCADE alone,
-- would silently destroy the billing history instead.
--
-- association_people is that indirection and nothing more. It carries NO
-- personal data: the exact application revision already IS the retained form,
-- and copying name or document numbers in here would create a second, weaker
-- copy of the same PII with none of the revision's immutability.
--
-- An account has at most one formal subject per association, and may hold
-- subjects in several associations. Once the account is gone the subject
-- survives with account_user_id null, which is exactly what makes owner RLS
-- go empty and leaves association admins as the only remaining readers.
-- ---------------------------------------------------------------------------

create table public.association_people (
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

create unique index association_people_account_idx
  on public.association_people (organization_id, account_user_id)
  where account_user_id is not null;
create index association_people_organization_idx
  on public.association_people (organization_id, created_at desc);

create policy "People can read their own association subject"
  on public.association_people
  for select to authenticated
  using (account_user_id = (select auth.uid()));

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

-- Resolving a subject.
--
-- Membership application drafts are written straight from the client under
-- RLS, with no command in between, so the subject cannot be resolved by a
-- caller. A trigger is the only place that holds for every insert path at
-- once, and it can only ever mint a subject for the row's own organization and
-- person, so it grants nothing the inserting client did not already have.
create function public.resolve_association_person(
  p_organization_id uuid,
  p_user_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path to ''
as $function$
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

comment on function public.resolve_association_person(uuid, uuid) is
  'Returns the formal association subject for one account in one organization, creating it on first use.';

revoke all on function public.resolve_association_person(uuid, uuid)
  from public, anon, authenticated, service_role;

-- Reads the subject column named by the trigger argument, so one function
-- serves user_id and claimant_user_id alike.
create function public.set_association_person_from_subject()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  subject uuid;
begin
  if new.association_person_id is not null then
    return new;
  end if;

  subject := nullif(to_jsonb(new) ->> tg_argv[0], '')::uuid;
  new.association_person_id := public.resolve_association_person(
    new.organization_id,
    subject
  );

  return new;
end;
$function$;

revoke all on function public.set_association_person_from_subject()
  from public, anon, authenticated, service_role;

-- An audit event's subject is the person the obligation belongs to, not the
-- admin who acted on it. The acting admin stays in actor_user_id, which is
-- allowed to go null when that admin deletes their own account.
create function public.set_association_person_from_obligation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
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

revoke all on function public.set_association_person_from_obligation()
  from public, anon, authenticated, service_role;

-- Add the subject reference to every formal record, backfill it, then make it
-- total. The column is added nullable first because the backfill has to run
-- before NOT NULL can hold.
alter table public.membership_applications add column association_person_id uuid;
alter table public.membership_application_revisions add column association_person_id uuid;
alter table public.organization_membership_departures add column association_person_id uuid;
alter table public.contribution_schedules add column association_person_id uuid;
alter table public.payment_obligations add column association_person_id uuid;
alter table public.payment_claims add column association_person_id uuid;
alter table public.payment_claim_audit_events add column association_person_id uuid;

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
where ap.organization_id = t.organization_id
  and ap.account_user_id = t.user_id;

update public.membership_application_revisions t
set association_person_id = ap.id
from public.association_people ap
where ap.organization_id = t.organization_id
  and ap.account_user_id = t.user_id;

update public.organization_membership_departures t
set association_person_id = ap.id
from public.association_people ap
where ap.organization_id = t.organization_id
  and ap.account_user_id = t.user_id;

update public.contribution_schedules t
set association_person_id = ap.id
from public.association_people ap
where ap.organization_id = t.organization_id
  and ap.account_user_id = t.user_id;

update public.payment_obligations t
set association_person_id = ap.id
from public.association_people ap
where ap.organization_id = t.organization_id
  and ap.account_user_id = t.user_id;

update public.payment_claims t
set association_person_id = ap.id
from public.association_people ap
where ap.organization_id = t.organization_id
  and ap.account_user_id = t.claimant_user_id;

update public.payment_claim_audit_events t
set association_person_id = po.association_person_id
from public.payment_obligations po
where po.id = t.obligation_id;

do $$
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
      'Billing cutover stopped: these formal records could not be linked to an association subject: %',
      offenders;
  end if;
end;
$$;

alter table public.membership_applications
  alter column association_person_id set not null,
  add constraint membership_applications_association_person_id_fkey
    foreign key (association_person_id) references public.association_people(id),
  alter column user_id drop not null,
  drop constraint membership_applications_user_id_fkey,
  add constraint membership_applications_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.membership_application_revisions
  alter column association_person_id set not null,
  add constraint membership_application_revisions_association_person_id_fkey
    foreign key (association_person_id) references public.association_people(id),
  alter column user_id drop not null,
  drop constraint membership_application_revisions_user_id_fkey,
  add constraint membership_application_revisions_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.organization_membership_departures
  alter column association_person_id set not null,
  add constraint organization_membership_departures_association_person_id_fkey
    foreign key (association_person_id) references public.association_people(id),
  alter column user_id drop not null,
  drop constraint organization_membership_departures_user_id_fkey,
  add constraint organization_membership_departures_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete set null,
  drop constraint organization_membership_departures_actor_user_id_fkey,
  add constraint organization_membership_departures_actor_user_id_fkey
    foreign key (actor_user_id) references public.profiles(id) on delete set null;

-- ON DELETE CASCADE here would have deleted the retained schedule -- and with
-- it the anchor every historical obligation is read against.
alter table public.contribution_schedules
  alter column association_person_id set not null,
  add constraint contribution_schedules_association_person_id_fkey
    foreign key (association_person_id) references public.association_people(id),
  alter column user_id drop not null,
  drop constraint contribution_schedules_user_id_fkey,
  add constraint contribution_schedules_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.payment_obligations
  alter column association_person_id set not null,
  add constraint payment_obligations_association_person_id_fkey
    foreign key (association_person_id) references public.association_people(id),
  alter column user_id drop not null,
  drop constraint payment_obligations_user_id_fkey,
  add constraint payment_obligations_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.payment_claims
  alter column association_person_id set not null,
  add constraint payment_claims_association_person_id_fkey
    foreign key (association_person_id) references public.association_people(id),
  alter column claimant_user_id drop not null,
  drop constraint payment_claims_claimant_user_id_fkey,
  add constraint payment_claims_claimant_user_id_fkey
    foreign key (claimant_user_id) references public.profiles(id) on delete set null;

alter table public.payment_claim_audit_events
  alter column association_person_id set not null,
  add constraint payment_claim_audit_events_association_person_id_fkey
    foreign key (association_person_id) references public.association_people(id),
  alter column actor_user_id drop not null,
  drop constraint payment_claim_audit_events_actor_user_id_fkey,
  add constraint payment_claim_audit_events_actor_user_id_fkey
    foreign key (actor_user_id) references public.profiles(id) on delete set null;

create index membership_applications_association_person_idx
  on public.membership_applications (association_person_id);
create index membership_application_revisions_association_person_idx
  on public.membership_application_revisions (association_person_id);
create index organization_membership_departures_association_person_idx
  on public.organization_membership_departures (association_person_id, departed_at desc);
create index contribution_schedules_association_person_idx
  on public.contribution_schedules (association_person_id);
create index payment_obligations_association_person_idx
  on public.payment_obligations (association_person_id);
create index payment_claims_association_person_idx
  on public.payment_claims (association_person_id);
create index payment_claim_audit_events_association_person_idx
  on public.payment_claim_audit_events (association_person_id);

create trigger membership_applications_set_association_person
before insert on public.membership_applications
for each row execute function public.set_association_person_from_subject('user_id');

create trigger membership_application_revisions_set_association_person
before insert on public.membership_application_revisions
for each row execute function public.set_association_person_from_subject('user_id');

create trigger organization_membership_departures_set_association_person
before insert on public.organization_membership_departures
for each row execute function public.set_association_person_from_subject('user_id');

create trigger contribution_schedules_set_association_person
before insert on public.contribution_schedules
for each row execute function public.set_association_person_from_subject('user_id');

create trigger payment_obligations_set_association_person
before insert on public.payment_obligations
for each row execute function public.set_association_person_from_subject('user_id');

create trigger payment_claims_set_association_person
before insert on public.payment_claims
for each row execute function public.set_association_person_from_subject('claimant_user_id');

create trigger payment_claim_audit_events_set_association_person
before insert on public.payment_claim_audit_events
for each row execute function public.set_association_person_from_obligation();

-- Re-key the identity constraints onto the subject.
--
-- A partial unique index over a nullable user_id is vacuous once accounts
-- start being deleted, because NULLs are all distinct: two deleted subjects in
-- the same association would both satisfy it. association_person_id is NOT
-- NULL and therefore actually constrains.
drop index public.contribution_schedules_one_active_per_member_idx;
create unique index contribution_schedules_one_active_per_person_idx
  on public.contribution_schedules (organization_id, association_person_id)
  where active;

drop index public.membership_applications_one_open_per_person_idx;
create unique index membership_applications_one_open_per_person_idx
  on public.membership_applications (organization_id, association_person_id)
  where status in (
    'draft'::public.membership_application_status_enum,
    'submitted'::public.membership_application_status_enum
  );

drop index public.membership_applications_person_history_idx;
create index membership_applications_person_history_idx
  on public.membership_applications (organization_id, association_person_id, created_at desc);

alter table public.organization_membership_departures
  drop constraint organization_membership_departures_period_key,
  add constraint organization_membership_departures_period_key
    unique (organization_id, association_person_id, joined_at);

-- Owner reads resolve through the subject.
--
-- While the account exists this selects exactly the same rows as the old
-- `user_id = auth.uid()` did. Once it is deleted, account_user_id is null and
-- the predicate goes empty, leaving association admins as the only readers --
-- which is the whole point of the retention rule.
drop policy "Application owners can read their submitted revisions"
  on public.membership_application_revisions;
create policy "Application owners can read their submitted revisions"
  on public.membership_application_revisions
  for select to authenticated
  using (exists (
    select 1
    from public.association_people ap
    where ap.id = membership_application_revisions.association_person_id
      and ap.account_user_id = (select auth.uid())
  ));

drop policy "Owners and association admins can read payment obligations"
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

drop policy "Claimants and organization admins can read payment claims"
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

drop policy "Claimants and admins can read claim audit"
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

drop policy "Members and association admins can read schedules"
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

drop policy "Members and association admins can read plan snapshots"
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

drop policy "Former members and admins can read membership periods"
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

-- Preparing an account for deletion.
--
-- This is the ONE sanctioned exception to "membership only ends through the
-- admin command": somebody deleting their Choose Life account cannot be left
-- holding an active membership nobody can see, and cannot be made to wait for
-- an admin. It closes the relationship and severs the account link, and it
-- deletes nothing formal -- not a revision, not an obligation, not a claim,
-- not a payer assertion, not a decision, not an audit row.
--
-- Service role only. An authenticated client must never reach this.
create function public.prepare_association_account_deletion(p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path to ''
as $function$
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

comment on function public.prepare_association_account_deletion(uuid) is
  'Prepares one Choose Life account for deletion: journals any still-active association membership as a closure, removes the membership authorization, deactivates the contribution schedules, and severs the account link so only association admins retain access. Deletes no formal record. Service role only.';

revoke all on function public.prepare_association_account_deletion(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.prepare_association_account_deletion(uuid)
  to service_role;
