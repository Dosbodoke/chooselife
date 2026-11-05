CREATE OR REPLACE FUNCTION public.generate_membership_billing_obligations_at (
  p_as_of timestamp with time zone
)
  RETURNS TABLE (
    schedule_id    uuid,
    period_key     text,
    obligation_id  uuid,
    result         text,
    failure_reason text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  evaluated_at timestamp with time zone := coalesce(p_as_of, clock_timestamp());
  schedule_record record;
  assignment_record record;
  term_count integer;
  local_date_value date;
  due_date_value date;
  next_due_date_value date;
  period_key_value text;
  period_start_value date;
  period_end_value date;
  available_on_value date;
  created_obligation public.payment_obligations%rowtype;
  existing_obligation public.payment_obligations%rowtype;
  cadence_value public.contribution_cadence_enum;
begin
  if evaluated_at is null then
    raise exception 'The generation clock is required.' using errcode = '22023';
  end if;

  for schedule_record in
    select
      cs.*,
      o.name as organization_name,
      o.slug as organization_slug
    from public.contribution_schedules cs
    join public.organizations o on o.id = cs.organization_id
    join public.organization_members om
      on om.organization_id = cs.organization_id
      and om.user_id = cs.user_id
    where cs.active
      and o.organization_type = 'association'::public.organization_type_enum
      and om.role in (
        'admin'::public.organization_role_enum,
        'member'::public.organization_role_enum
      )
    order by cs.organization_id, cs.user_id
  loop
    begin
      if not public.is_valid_billing_timezone(schedule_record.billing_timezone)
        or schedule_record.due_day not between 1 and 31
        or schedule_record.lead_days not between 0 and 31
        or schedule_record.currency !~ '^[A-Z]{3}$' then
        schedule_id := schedule_record.id;
        period_key := null;
        obligation_id := null;
        result := 'failed';
        failure_reason := 'The contribution schedule billing policy is invalid.';
        return next;
        continue;
      end if;

      local_date_value := timezone(
        schedule_record.billing_timezone,
        evaluated_at
      )::date;
      term_count := 0;

      for assignment_record in
        select
          cpa.*,
          lead(cpa.effective_period_start) over (
            order by cpa.effective_period_start, cpa.id
          ) as next_effective_period_start
        from public.contribution_plan_assignments cpa
        where cpa.schedule_id = schedule_record.id
        order by cpa.effective_period_start, cpa.id
      loop
        term_count := term_count + 1;
        cadence_value := case
          when assignment_record.plan_type = 'annual'::public.subscription_plan_type_enum
            then 'annual'::public.contribution_cadence_enum
          else 'monthly'::public.contribution_cadence_enum
        end;

        if assignment_record.due_day is null
          or assignment_record.due_day not between 1 and 31
          or assignment_record.lead_days is null
          or assignment_record.lead_days not between 0 and 31
          or not public.is_valid_billing_timezone(assignment_record.billing_timezone)
          or assignment_record.currency !~ '^[A-Z]{3}$'
          or assignment_record.amount is null
          or assignment_record.amount <= 0 then
          schedule_id := schedule_record.id;
          period_key := null;
          obligation_id := null;
          result := 'failed';
          failure_reason := 'The recurring billing term is invalid or has no positive price.';
          return next;
          continue;
        end if;

        due_date_value := public.recurring_due_date_on_or_after(
          schedule_record.admission_date,
          cadence_value,
          assignment_record.due_day,
          greatest(
            schedule_record.admission_date,
            assignment_record.effective_period_start
          )
        );

        while due_date_value - assignment_record.lead_days <= local_date_value loop
          if assignment_record.next_effective_period_start is not null
            and due_date_value >= assignment_record.next_effective_period_start then
            exit;
          end if;

          next_due_date_value := public.next_recurring_due_date(
            due_date_value,
            cadence_value,
            assignment_record.due_day
          );
          period_start_value := due_date_value;
          period_end_value := next_due_date_value - 1;
          available_on_value := due_date_value - assignment_record.lead_days;
          period_key_value := public.recurring_period_key(
            cadence_value,
            due_date_value
          );

          if nullif(btrim(assignment_record.pix_copy_paste), '') is null then
            schedule_id := schedule_record.id;
            period_key := period_key_value;
            obligation_id := null;
            result := 'failed';
            failure_reason := 'No PIX snapshot exists for the recurring period.';
            return next;
            due_date_value := next_due_date_value;
            continue;
          end if;

          created_obligation := null;
          existing_obligation := null;

          insert into public.payment_obligations (
            organization_id,
            user_id,
            application_revision_id,
            purpose,
            status,
            plan_type,
            amount,
            currency,
            payment_method,
            pix_copy_paste,
            available_at,
            schedule_id,
            schedule_term_id,
            period_key,
            period_start,
            period_end,
            available_on,
            due_on,
            billing_timezone,
            billing_due_day,
            billing_lead_days,
            organization_name_snapshot,
            organization_slug_snapshot
          )
          values (
            schedule_record.organization_id,
            schedule_record.user_id,
            null,
            'recurring'::public.payment_obligation_purpose_enum,
            'available'::public.payment_obligation_status_enum,
            assignment_record.plan_type,
            assignment_record.amount,
            assignment_record.currency,
            'manual_pix',
            assignment_record.pix_copy_paste,
            available_on_value::timestamp at time zone assignment_record.billing_timezone,
            schedule_record.id,
            assignment_record.id,
            period_key_value,
            period_start_value,
            period_end_value,
            available_on_value,
            due_date_value,
            assignment_record.billing_timezone,
            assignment_record.due_day,
            assignment_record.lead_days,
            schedule_record.organization_name,
            schedule_record.organization_slug
          )
          on conflict on constraint payment_obligations_schedule_period_key
          do nothing
          returning * into created_obligation;

          if created_obligation.id is null then
            select po.*
            into existing_obligation
            from public.payment_obligations po
            where po.schedule_id = schedule_record.id
              and po.period_key = period_key_value
              and po.purpose = 'recurring'::public.payment_obligation_purpose_enum;
          else
            existing_obligation := created_obligation;
          end if;

          schedule_id := schedule_record.id;
          period_key := period_key_value;
          obligation_id := existing_obligation.id;
          result := case
            when created_obligation.id is null then 'already_exists'
            else 'created'
          end;
          failure_reason := null;
          return next;

          due_date_value := next_due_date_value;
        end loop;
      end loop;

      if term_count = 0 then
        schedule_id := schedule_record.id;
        period_key := null;
        obligation_id := null;
        result := 'failed';
        failure_reason := 'No effective-dated billing term exists for the schedule.';
        return next;
      end if;
    exception
      when others then
        schedule_id := schedule_record.id;
        period_key := null;
        obligation_id := null;
        result := 'failed';
        failure_reason := sqlerrm;
        return next;
    end;
  end loop;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."generate_membership_billing_obligations_at"(timestamp WITH time zone) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."generate_membership_billing_obligations_at"(timestamp WITH time zone) TO "postgres";

REVOKE ALL ON FUNCTION "public"."generate_membership_billing_obligations_at"(timestamp WITH time zone) FROM PUBLIC, "anon", "authenticated", "service_role";
