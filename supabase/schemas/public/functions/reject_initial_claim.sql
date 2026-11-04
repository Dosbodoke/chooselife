CREATE OR REPLACE FUNCTION public.reject_initial_claim (
  p_claim_id uuid,
  p_reason   text
)
  RETURNS TABLE (
    claim_id             uuid,
    obligation_id        uuid,
    application_id       uuid,
    application_status   public.membership_application_status_enum,
    claim_status         public.payment_claim_status_enum,
    obligation_status    public.payment_obligation_status_enum,
    decision_reason      text,
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

GRANT EXECUTE ON FUNCTION "public"."reject_initial_claim"(uuid, text) TO "authenticated";

COMMENT ON FUNCTION "public"."reject_initial_claim"(uuid, text) IS 'The unified refusal command. Atomically refuses the application, rejects the current claim, voids that obligation, records one required normalized reason, and appends one audit event. No revision, payer identity, claim or audit row is ever deleted; a correction is submitted as a new application.';

REVOKE ALL ON FUNCTION "public"."reject_initial_claim"(uuid, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."reject_initial_claim"(uuid, text) TO "postgres";

REVOKE ALL ON FUNCTION "public"."reject_initial_claim"(uuid, text) FROM PUBLIC, "anon", "service_role";
