CREATE OR REPLACE FUNCTION public.reject_contribution_schedule_anchor_mutation()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if public.is_person_link_maintenance(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;

  if old.admission_date is distinct from new.admission_date then
    raise exception 'A contribution schedule admission anchor is immutable.'
      using errcode = '55000';
  end if;

  if old.association_person_id is distinct from new.association_person_id then
    raise exception 'A contribution schedule subject is immutable.'
      using errcode = '55000';
  end if;

  if old.cadence is distinct from new.cadence
    or old.due_day is distinct from new.due_day
    or old.lead_days is distinct from new.lead_days
    or old.billing_timezone is distinct from new.billing_timezone
    or old.currency is distinct from new.currency then
    raise exception 'Contribution schedule policy is immutable; append an effective-dated term.'
      using errcode = '55000';
  end if;

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."reject_contribution_schedule_anchor_mutation"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."reject_contribution_schedule_anchor_mutation"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."reject_contribution_schedule_anchor_mutation"() FROM PUBLIC, "anon", "authenticated", "service_role";
