CREATE OR REPLACE FUNCTION public.reject_payment_obligation_context_mutation()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if public.is_person_link_maintenance(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;

  if old.organization_id is distinct from new.organization_id
    or old.association_person_id is distinct from new.association_person_id
    or old.user_id is distinct from new.user_id
    or old.application_revision_id is distinct from new.application_revision_id
    or old.purpose is distinct from new.purpose
    or old.plan_type is distinct from new.plan_type
    or old.amount is distinct from new.amount
    or old.currency is distinct from new.currency
    or old.payment_method is distinct from new.payment_method
    or old.pix_copy_paste is distinct from new.pix_copy_paste
    or old.available_at is distinct from new.available_at
    or old.schedule_id is distinct from new.schedule_id
    or old.schedule_term_id is distinct from new.schedule_term_id
    or old.period_key is distinct from new.period_key
    or old.period_start is distinct from new.period_start
    or old.period_end is distinct from new.period_end
    or old.available_on is distinct from new.available_on
    or old.due_on is distinct from new.due_on
    or old.billing_timezone is distinct from new.billing_timezone
    or old.billing_due_day is distinct from new.billing_due_day
    or old.billing_lead_days is distinct from new.billing_lead_days
    or old.organization_name_snapshot is distinct from new.organization_name_snapshot
    or old.organization_slug_snapshot is distinct from new.organization_slug_snapshot then
    raise exception 'Payment obligation billing context is immutable.'
      using errcode = '55000';
  end if;

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."reject_payment_obligation_context_mutation"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."reject_payment_obligation_context_mutation"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."reject_payment_obligation_context_mutation"() FROM PUBLIC, "anon", "authenticated", "service_role";
