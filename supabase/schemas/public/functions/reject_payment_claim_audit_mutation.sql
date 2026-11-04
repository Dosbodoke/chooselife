CREATE OR REPLACE FUNCTION public.reject_payment_claim_audit_mutation()
  RETURNS TRIGGER
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

REVOKE ALL ON FUNCTION "public"."reject_payment_claim_audit_mutation"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."reject_payment_claim_audit_mutation"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."reject_payment_claim_audit_mutation"() FROM PUBLIC, "anon", "authenticated", "service_role";
