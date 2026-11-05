CREATE OR REPLACE FUNCTION public.clamped_billing_date (
  p_year  integer,
  p_month integer,
  p_day   integer
)
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

REVOKE ALL ON FUNCTION "public"."clamped_billing_date"(integer, integer, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."clamped_billing_date"(integer, integer, integer) TO "postgres";

REVOKE ALL ON FUNCTION "public"."clamped_billing_date"(integer, integer, integer) FROM PUBLIC, "anon", "authenticated", "service_role";
