CREATE OR REPLACE FUNCTION public.approve_initial_claim (
  p_claim_id uuid
)
  RETURNS TABLE (
    claim_id             uuid,
    obligation_id        uuid,
    claim_status         public.payment_claim_status_enum,
    obligation_status    public.payment_obligation_status_enum,
    membership_user_id   uuid,
    schedule_id          uuid,
    assignment_id        uuid,
    audit_event_id       uuid,
    decision_applied_now boolean
  )
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

GRANT EXECUTE ON FUNCTION "public"."approve_initial_claim"(uuid) TO "authenticated";

COMMENT ON FUNCTION "public"."approve_initial_claim"(uuid) IS 'Atomically verifies an actionable initial claim, settles its obligation, admits the applicant, opens the contribution schedule with its admission plan snapshot, marks the application admitted, and appends one audit event.';

REVOKE ALL ON FUNCTION "public"."approve_initial_claim"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."approve_initial_claim"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."approve_initial_claim"(uuid) FROM PUBLIC, "anon", "service_role";
