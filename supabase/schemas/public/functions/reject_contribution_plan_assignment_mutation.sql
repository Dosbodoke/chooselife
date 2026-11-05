CREATE OR REPLACE FUNCTION public.reject_contribution_plan_assignment_mutation()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if old.schedule_id is distinct from new.schedule_id
    or old.effective_period_start is distinct from new.effective_period_start
    or old.plan_type is distinct from new.plan_type
    or old.amount is distinct from new.amount
    or old.currency is distinct from new.currency
    or old.due_day is distinct from new.due_day
    or old.lead_days is distinct from new.lead_days
    or old.billing_timezone is distinct from new.billing_timezone
    or old.pix_copy_paste is distinct from new.pix_copy_paste then
    raise exception 'An effective-dated contribution term is immutable; append a new term.'
      using errcode = '55000';
  end if;

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."reject_contribution_plan_assignment_mutation"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."reject_contribution_plan_assignment_mutation"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."reject_contribution_plan_assignment_mutation"() FROM PUBLIC, "anon", "authenticated", "service_role";
