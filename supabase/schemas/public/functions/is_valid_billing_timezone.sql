CREATE OR REPLACE FUNCTION public.is_valid_billing_timezone (
  p_timezone text
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = p_timezone
  );
$function$;

REVOKE ALL ON FUNCTION "public"."is_valid_billing_timezone"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_valid_billing_timezone"(text) TO "postgres";

REVOKE ALL ON FUNCTION "public"."is_valid_billing_timezone"(text) FROM PUBLIC, "anon", "authenticated", "service_role";
