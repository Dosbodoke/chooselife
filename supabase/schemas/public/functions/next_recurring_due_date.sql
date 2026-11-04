CREATE OR REPLACE FUNCTION public.next_recurring_due_date (
  p_due_date date,
  p_cadence  public.contribution_cadence_enum,
  p_due_day  integer
)
  RETURNS date
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  select case
    when p_cadence = 'annual'::public.contribution_cadence_enum then
      public.clamped_billing_date(
        extract(year from p_due_date)::integer + 1,
        extract(month from p_due_date)::integer,
        p_due_day
      )
    else public.clamped_billing_date(
      extract(year from (p_due_date + interval '1 month'))::integer,
      extract(month from (p_due_date + interval '1 month'))::integer,
      p_due_day
    )
  end;
$function$;

REVOKE ALL ON FUNCTION "public"."next_recurring_due_date"(date, public.contribution_cadence_enum, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."next_recurring_due_date"(date, public.contribution_cadence_enum, integer) TO "postgres";

REVOKE ALL ON FUNCTION "public"."next_recurring_due_date"(date, public.contribution_cadence_enum, integer) FROM PUBLIC, "anon", "authenticated", "service_role";
