CREATE OR REPLACE FUNCTION public.ensure_contribution_schedule (
  p_organization_id uuid,
  p_user_id         uuid,
  p_plan_type       public.subscription_plan_type_enum,
  p_admission_date  date                               DEFAULT NULL::date
)
  RETURNS TABLE (
    schedule_id   uuid,
    assignment_id uuid
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  organization_record public.organizations%rowtype;
  schedule_record public.contribution_schedules%rowtype;
  assignment_record public.contribution_plan_assignments%rowtype;
  admission_date_value date;
  cadence_value public.contribution_cadence_enum;
  amount_value integer;
  pix_value text;
begin
  if p_plan_type is null then
    raise exception 'A contribution plan is required.' using errcode = '22023';
  end if;

  select o.*
  into organization_record
  from public.organizations o
  where o.id = p_organization_id
    and o.organization_type = 'association'::public.organization_type_enum
  for update;

  if not found then
    return;
  end if;

  if not public.is_valid_billing_timezone(organization_record.billing_timezone)
    or organization_record.billing_due_day not between 1 and 31
    or organization_record.billing_lead_days not between 0 and 31
    or organization_record.billing_currency !~ '^[A-Z]{3}$' then
    raise exception 'The association billing policy is invalid.' using errcode = '23514';
  end if;

  cadence_value := case
    when p_plan_type = 'annual'::public.subscription_plan_type_enum
      then 'annual'::public.contribution_cadence_enum
    else 'monthly'::public.contribution_cadence_enum
  end;
  amount_value := case p_plan_type
    when 'annual'::public.subscription_plan_type_enum
      then organization_record.annual_price_amount
    else organization_record.monthly_price_amount
  end;
  pix_value := case p_plan_type
    when 'annual'::public.subscription_plan_type_enum
      then organization_record.annual_pix_copy_paste
    else organization_record.monthly_pix_copy_paste
  end;

  if amount_value is null or amount_value <= 0
    or nullif(btrim(pix_value), '') is null then
    raise exception 'The association contribution price or PIX configuration is incomplete.'
      using errcode = '23514';
  end if;

  -- A retried admission must find the schedule it already opened. A REJOIN must
  -- not: the pre-departure schedule is deactivated and stays that way, so the
  -- new membership is anchored on the new admission date instead of silently
  -- inheriting the old anchor and backfilling the absence.
  select cs.*
  into schedule_record
  from public.contribution_schedules cs
  where cs.organization_id = p_organization_id
    and cs.user_id = p_user_id
    and cs.active
  for update;

  if not found then
    admission_date_value := coalesce(
      p_admission_date,
      (
        select timezone(organization_record.billing_timezone, om.joined_at)::date
        from public.organization_members om
        where om.organization_id = p_organization_id
          and om.user_id = p_user_id
      ),
      timezone(organization_record.billing_timezone, clock_timestamp())::date
    );

    insert into public.contribution_schedules (
      organization_id,
      user_id,
      cadence,
      admission_date,
      due_day,
      lead_days,
      billing_timezone,
      currency,
      active
    )
    values (
      p_organization_id,
      p_user_id,
      cadence_value,
      admission_date_value,
      organization_record.billing_due_day,
      organization_record.billing_lead_days,
      organization_record.billing_timezone,
      organization_record.billing_currency,
      true
    )
    returning * into schedule_record;
  end if;

  select cpa.*
  into assignment_record
  from public.contribution_plan_assignments cpa
  where cpa.schedule_id = schedule_record.id
    and cpa.effective_period_start = schedule_record.admission_date
  for update;

  if not found then
    insert into public.contribution_plan_assignments (
      schedule_id,
      effective_period_start,
      plan_type,
      amount,
      currency,
      due_day,
      lead_days,
      billing_timezone,
      pix_copy_paste
    )
    values (
      schedule_record.id,
      schedule_record.admission_date,
      p_plan_type,
      amount_value,
      organization_record.billing_currency,
      schedule_record.due_day,
      schedule_record.lead_days,
      schedule_record.billing_timezone,
      pix_value
    )
    returning * into assignment_record;
  end if;

  return query select schedule_record.id, assignment_record.id;
end;
$function$;

COMMENT ON FUNCTION "public"."ensure_contribution_schedule"(uuid, uuid, public.subscription_plan_type_enum, date) IS 'Opens (or idempotently returns) the active contribution schedule and its admission-effective plan snapshot for one association member. A deactivated pre-departure schedule is never revived, so a rejoin is anchored on its own admission date.';

REVOKE ALL ON FUNCTION "public"."ensure_contribution_schedule"(uuid, uuid, public.subscription_plan_type_enum, date) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."ensure_contribution_schedule"(uuid, uuid, public.subscription_plan_type_enum, date) TO "postgres";

REVOKE ALL ON FUNCTION "public"."ensure_contribution_schedule"(uuid, uuid, public.subscription_plan_type_enum, date) FROM PUBLIC, "anon", "authenticated", "service_role";
