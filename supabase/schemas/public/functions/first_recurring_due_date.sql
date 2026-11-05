CREATE OR REPLACE FUNCTION public.first_recurring_due_date (
  p_admission_date date,
  p_cadence        public.contribution_cadence_enum,
  p_due_day        integer
)
  RETURNS date
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
declare
  candidate_month date;
  candidate_due date;
  minimum_due date;
begin
  if p_cadence = 'annual'::public.contribution_cadence_enum then
    return public.clamped_billing_date(
      extract(year from p_admission_date)::integer + 1,
      extract(month from p_admission_date)::integer,
      p_due_day
    );
  end if;

  minimum_due := (p_admission_date + interval '1 month')::date;
  candidate_month := date_trunc('month', minimum_due)::date;
  candidate_due := public.clamped_billing_date(
    extract(year from candidate_month)::integer,
    extract(month from candidate_month)::integer,
    p_due_day
  );

  if candidate_due < minimum_due then
    candidate_month := (candidate_month + interval '1 month')::date;
    candidate_due := public.clamped_billing_date(
      extract(year from candidate_month)::integer,
      extract(month from candidate_month)::integer,
      p_due_day
    );
  end if;

  return candidate_due;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."first_recurring_due_date"(date, public.contribution_cadence_enum, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."first_recurring_due_date"(date, public.contribution_cadence_enum, integer) TO "postgres";

REVOKE ALL ON FUNCTION "public"."first_recurring_due_date"(date, public.contribution_cadence_enum, integer) FROM PUBLIC, "anon", "authenticated", "service_role";
