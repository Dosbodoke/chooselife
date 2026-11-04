CREATE OR REPLACE FUNCTION public.approve_recurring_payment_claim (
  p_claim_id uuid
)
  RETURNS TABLE (
    claim_id             uuid,
    obligation_id        uuid,
    claim_status         public.payment_claim_status_enum,
    obligation_status    public.payment_obligation_status_enum,
    audit_event_id       uuid,
    decision_applied_now boolean
  )
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

GRANT EXECUTE ON FUNCTION "public"."approve_recurring_payment_claim"(uuid) TO "authenticated";

COMMENT ON FUNCTION "public"."approve_recurring_payment_claim"(uuid) IS 'Atomically verifies a recurring contribution claim and settles only that obligation.';

REVOKE ALL ON FUNCTION "public"."approve_recurring_payment_claim"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."approve_recurring_payment_claim"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."approve_recurring_payment_claim"(uuid) FROM PUBLIC, "anon", "service_role";
