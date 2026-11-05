CREATE OR REPLACE FUNCTION public.claim_recurring_payment (
  p_obligation_id     uuid,
  p_paid_by_applicant boolean,
  p_payer_name        text    DEFAULT NULL::text
)
  RETURNS TABLE (
    claim_id         uuid,
    obligation_id    uuid,
    payer_type       public.payment_claim_payer_type_enum,
    payer_name       text,
    claim_status     public.payment_claim_status_enum,
    claim_created_at timestamp with time zone,
    audit_event_id   uuid
  )
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

GRANT EXECUTE ON FUNCTION "public"."claim_recurring_payment"(uuid, boolean, text) TO "authenticated";

COMMENT ON FUNCTION "public"."claim_recurring_payment"(uuid, boolean, text) IS 'Records a recurring payment claim only on or after the obligation''s snapshotted local availability date.';

REVOKE ALL ON FUNCTION "public"."claim_recurring_payment"(uuid, boolean, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."claim_recurring_payment"(uuid, boolean, text) TO "postgres";

REVOKE ALL ON FUNCTION "public"."claim_recurring_payment"(uuid, boolean, text) FROM PUBLIC, "anon", "service_role";
