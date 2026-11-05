CREATE OR REPLACE FUNCTION public.snapshot_payment_obligation_context()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  organization_record public.organizations%rowtype;
  term_record public.contribution_plan_assignments%rowtype;
begin
  select o.*
  into organization_record
  from public.organizations o
  where o.id = new.organization_id;

  if not found then
    raise exception 'Payment obligation organization was not found.'
      using errcode = '23503';
  end if;

  if new.schedule_term_id is not null then
    select cpa.*
    into term_record
    from public.contribution_plan_assignments cpa
    where cpa.id = new.schedule_term_id;

    if not found then
      raise exception 'Payment obligation billing term was not found.'
        using errcode = '23503';
    end if;

    new.billing_timezone := coalesce(new.billing_timezone, term_record.billing_timezone);
    new.billing_due_day := coalesce(new.billing_due_day, term_record.due_day);
    new.billing_lead_days := coalesce(new.billing_lead_days, term_record.lead_days);
  end if;

  new.billing_timezone := coalesce(new.billing_timezone, organization_record.billing_timezone);
  new.billing_due_day := coalesce(new.billing_due_day, organization_record.billing_due_day);
  new.billing_lead_days := coalesce(new.billing_lead_days, organization_record.billing_lead_days);
  new.organization_name_snapshot := coalesce(
    new.organization_name_snapshot,
    organization_record.name
  );
  new.organization_slug_snapshot := coalesce(
    new.organization_slug_snapshot,
    organization_record.slug
  );

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."snapshot_payment_obligation_context"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."snapshot_payment_obligation_context"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."snapshot_payment_obligation_context"() FROM PUBLIC, "anon", "authenticated", "service_role";
