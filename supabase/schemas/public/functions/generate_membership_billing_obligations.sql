CREATE OR REPLACE FUNCTION public.generate_membership_billing_obligations()
  RETURNS TABLE (
    schedule_id    uuid,
    period_key     text,
    obligation_id  uuid,
    result         text,
    failure_reason text
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select *
  from public.generate_membership_billing_obligations_at(clock_timestamp());
$function$;

GRANT EXECUTE ON FUNCTION "public"."generate_membership_billing_obligations"() TO "service_role";

COMMENT ON FUNCTION "public"."generate_membership_billing_obligations"() IS 'Trusted scheduler command. Derives the database clock and materializes every available recurring period exactly once.';

REVOKE ALL ON FUNCTION "public"."generate_membership_billing_obligations"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."generate_membership_billing_obligations"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."generate_membership_billing_obligations"() FROM PUBLIC, "anon", "authenticated";
