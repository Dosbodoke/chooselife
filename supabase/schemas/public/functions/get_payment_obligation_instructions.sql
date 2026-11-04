CREATE OR REPLACE FUNCTION public.get_payment_obligation_instructions (
  p_obligation_id uuid
)
  RETURNS TABLE (
    obligation_id         uuid,
    organization_id       uuid,
    purpose               public.payment_obligation_purpose_enum,
    status                text,
    plan_type             public.subscription_plan_type_enum,
    amount                integer,
    currency              text,
    payment_method        text,
    pix_copy_paste        text,
    available_at          timestamp with time zone,
    available_on          date,
    due_on                date,
    period_key            text,
    claim_id              uuid,
    claim_status          public.payment_claim_status_enum,
    payer_type            public.payment_claim_payer_type_enum,
    payer_name            text,
    claim_created_at      timestamp with time zone,
    claim_decision_reason text
  )
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

GRANT EXECUTE ON FUNCTION "public"."get_payment_obligation_instructions"(uuid) TO "authenticated";

COMMENT ON FUNCTION "public"."get_payment_obligation_instructions"(uuid) IS 'Returns authoritative PIX instructions and evaluates availability using the obligation timezone snapshot.';

REVOKE ALL ON FUNCTION "public"."get_payment_obligation_instructions"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_payment_obligation_instructions"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."get_payment_obligation_instructions"(uuid) FROM PUBLIC, "anon", "service_role";
