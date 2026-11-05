CREATE OR REPLACE FUNCTION public.recurring_period_key (
  p_cadence  public.contribution_cadence_enum,
  p_due_date date
)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  select p_cadence::text || ':' || to_char(p_due_date, 'YYYY-MM-DD');
$function$;

REVOKE ALL ON FUNCTION "public"."recurring_period_key"(public.contribution_cadence_enum, date) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."recurring_period_key"(public.contribution_cadence_enum, date) TO "postgres";

REVOKE ALL ON FUNCTION "public"."recurring_period_key"(public.contribution_cadence_enum, date) FROM PUBLIC, "anon", "authenticated", "service_role";
