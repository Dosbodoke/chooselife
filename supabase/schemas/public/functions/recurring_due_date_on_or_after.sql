CREATE OR REPLACE FUNCTION public.recurring_due_date_on_or_after (
  p_admission_date date,
  p_cadence        public.contribution_cadence_enum,
  p_due_day        integer,
  p_from_date      date
)
  RETURNS date
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
declare
  due_date_value date;
  lower_bound date;
begin
  if p_admission_date is null
    or p_cadence is null
    or p_due_day is null
    or p_from_date is null then
    raise exception 'Recurring date inputs are required.' using errcode = '22023';
  end if;

  if p_due_day < 1 or p_due_day > 31 then
    raise exception 'Recurring due day must be between 1 and 31.'
      using errcode = '22023';
  end if;

  lower_bound := greatest(p_admission_date, p_from_date);
  due_date_value := public.first_recurring_due_date(
    p_admission_date,
    p_cadence,
    p_due_day
  );

  while due_date_value < lower_bound loop
    due_date_value := public.next_recurring_due_date(
      due_date_value,
      p_cadence,
      p_due_day
    );
  end loop;

  return due_date_value;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."recurring_due_date_on_or_after"(date, public.contribution_cadence_enum, integer, date) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."recurring_due_date_on_or_after"(date, public.contribution_cadence_enum, integer, date) TO "postgres";

REVOKE ALL ON FUNCTION "public"."recurring_due_date_on_or_after"(date, public.contribution_cadence_enum, integer, date) FROM PUBLIC, "anon", "authenticated", "service_role";
