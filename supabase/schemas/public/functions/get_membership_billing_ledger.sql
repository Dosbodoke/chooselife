CREATE OR REPLACE FUNCTION public.get_membership_billing_ledger (
  p_organization_id uuid,
  p_history_cursor  text    DEFAULT NULL::text,
  p_history_limit   integer DEFAULT 24
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor_id uuid := (select auth.uid());
  organization_record public.organizations%rowtype;
  application_record public.membership_applications%rowtype;
  schedule_record public.contribution_schedules%rowtype;
  evaluated_at_value timestamp with time zone := clock_timestamp();
  local_date_value date;
  legal_state text;
  financial_state text := 'up_to_date';
  application_correction_reason text;
  plan_type_value public.subscription_plan_type_enum;
  attention_obligation jsonb;
  next_obligation jsonb;
  history jsonb;
  history_count integer;
  history_limit_value integer := greatest(1, least(coalesce(p_history_limit, 24), 50));
  history_has_more boolean := false;
  history_next_cursor text;
  cursor_due_on date;
  cursor_obligation_id uuid;
  member_exists boolean := false;
  application_found boolean := false;
  next_assignment record;
  candidate_due_date date;
  candidate_next_due_date date;
  candidate_available_on date;
  candidate_period_start date;
  candidate_period_end date;
  candidate_plan_type public.subscription_plan_type_enum;
  candidate_amount integer;
  candidate_currency text;
  candidate_found boolean := false;
  candidate_effective_start date;
  selected_candidate_due_date date;
begin
  if actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_organization_id is null then
    raise exception 'Organization is required.' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_history_cursor, '')), '') is not null then
    begin
      cursor_due_on := split_part(p_history_cursor, '|', 1)::date;
      cursor_obligation_id := split_part(p_history_cursor, '|', 2)::uuid;
    exception
      when others then
        raise exception 'The Ledger history cursor is invalid.' using errcode = '22023';
    end;
  end if;

  select o.*
  into organization_record
  from public.organizations o
  where o.id = p_organization_id
    and o.organization_type = 'association'::public.organization_type_enum;

  if not found then
    raise exception 'Association was not found.' using errcode = '40400';
  end if;

  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = actor_id
  )
  into member_exists;

  select ma.*
  into application_record
  from public.membership_applications ma
  where ma.organization_id = p_organization_id
    and ma.user_id = actor_id
  order by ma.updated_at desc, ma.id desc
  limit 1;
  application_found := found;

  if not member_exists and not application_found then
    raise exception 'Membership Ledger was not found.' using errcode = '42501';
  end if;

  legal_state := case when member_exists then 'active' else 'applicant' end;
  local_date_value := timezone(
    organization_record.billing_timezone,
    evaluated_at_value
  )::date;

  select cs.*
  into schedule_record
  from public.contribution_schedules cs
  where cs.organization_id = p_organization_id
    and cs.user_id = actor_id
    and cs.active
  order by cs.id
  limit 1;

  if found then
    select case
      when cpa.plan_type = 'annual'::public.subscription_plan_type_enum
        then 'annual'::public.subscription_plan_type_enum
      else 'monthly'::public.subscription_plan_type_enum
    end
    into plan_type_value
    from public.contribution_plan_assignments cpa
    where cpa.schedule_id = schedule_record.id
      and cpa.effective_period_start <= local_date_value
    order by cpa.effective_period_start desc, cpa.id desc
    limit 1;
  end if;

  if plan_type_value is null and application_found then
    select mar.plan_type
    into plan_type_value
    from public.membership_application_revisions mar
    where mar.application_id = application_record.id
    order by mar.revision_number desc, mar.id desc
    limit 1;
  end if;

  select pc.decision_reason
  into application_correction_reason
  from public.payment_claims pc
  join public.payment_obligations po on po.id = pc.obligation_id
  where pc.claimant_user_id = actor_id
    and pc.organization_id = p_organization_id
    and po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
    and pc.status = 'rejected'::public.payment_claim_status_enum
  order by pc.decided_at desc nulls last, pc.created_at desc, pc.id desc
  limit 1;

  if exists (
    select 1
    from public.payment_obligations po
    where po.organization_id = p_organization_id
      and po.user_id = actor_id
      and po.status not in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      and po.purpose = 'recurring'::public.payment_obligation_purpose_enum
      and po.due_on < timezone(
        coalesce(po.billing_timezone, organization_record.billing_timezone),
        evaluated_at_value
      )::date
  ) then
    financial_state := 'overdue';
  elsif exists (
    select 1
    from public.payment_obligations po
    where po.organization_id = p_organization_id
      and po.user_id = actor_id
      and po.status not in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      and (
        (
          po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
          and po.available_at <= evaluated_at_value
        )
        or (
          po.purpose = 'recurring'::public.payment_obligation_purpose_enum
          and po.available_on <= timezone(
            coalesce(po.billing_timezone, organization_record.billing_timezone),
            evaluated_at_value
          )::date
        )
      )
      and not exists (
        select 1
        from public.payment_claims pc
        where pc.obligation_id = po.id
          and pc.status = 'under_review'::public.payment_claim_status_enum
      )
  ) then
    financial_state := 'payment_available';
  elsif exists (
    select 1
    from public.payment_obligations po
    join public.payment_claims pc on pc.obligation_id = po.id
    where po.organization_id = p_organization_id
      and po.user_id = actor_id
      and po.status not in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      and pc.status = 'under_review'::public.payment_claim_status_enum
  ) then
    financial_state := 'under_review';
  end if;

  select jsonb_build_object(
    'obligation_id', po.id,
    'purpose', po.purpose,
    'status', state.effective_status,
    'period_key', po.period_key,
    'period_start', po.period_start,
    'period_end', po.period_end,
    'available_on', po.available_on,
    'due_on', po.due_on,
    'amount', po.amount,
    'currency', po.currency,
    'action', case state.effective_status
      when 'under_review' then jsonb_build_object('type', 'open_claim')
      when 'available' then jsonb_build_object('type', 'open_obligation')
      when 'overdue' then jsonb_build_object('type', 'open_obligation')
      else null
    end,
    'claims', coalesce((
      select jsonb_agg(jsonb_build_object(
        'claim_id', pc.id,
        'status', pc.status,
        'payer', pc.payer_type,
        'payer_name', pc.payer_name,
        'created_at', pc.created_at,
        'decided_at', pc.decided_at,
        'decision_reason', pc.decision_reason
      ) order by pc.created_at asc, pc.id asc)
      from public.payment_claims pc
      where pc.obligation_id = po.id
    ), '[]'::jsonb)
  )
  into attention_obligation
  from public.payment_obligations po
  cross join lateral (
    select case
      when po.status = 'settled'::public.payment_obligation_status_enum then 'settled'
      when po.status = 'void'::public.payment_obligation_status_enum then 'void'
      when exists (
        select 1
        from public.payment_claims pc
        where pc.obligation_id = po.id
          and pc.status = 'under_review'::public.payment_claim_status_enum
      ) then 'under_review'
      when po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
        and po.available_at <= evaluated_at_value then 'available'
      when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.due_on < timezone(
          coalesce(po.billing_timezone, organization_record.billing_timezone),
          evaluated_at_value
        )::date then 'overdue'
      when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
        and po.available_on <= timezone(
        coalesce(po.billing_timezone, organization_record.billing_timezone),
        evaluated_at_value
      )::date then 'available'
      else 'scheduled'
    end as effective_status
  ) state
  where po.organization_id = p_organization_id
    and po.user_id = actor_id
    and state.effective_status in ('available', 'under_review', 'overdue')
  order by
    case state.effective_status
      when 'overdue' then 0
      when 'available' then 1
      when 'under_review' then 2
      else 3
    end,
    po.due_on asc,
    po.created_at asc,
    po.id asc
  limit 1;

  if member_exists and schedule_record.id is not null then
    select jsonb_build_object(
      'obligation_id', po.id,
      'purpose', po.purpose,
      'status', state.effective_status,
      'period_key', po.period_key,
      'period_start', po.period_start,
      'period_end', po.period_end,
      'available_on', po.available_on,
      'due_on', po.due_on,
      'amount', po.amount,
      'currency', po.currency,
      'action', case state.effective_status
        when 'under_review' then jsonb_build_object('type', 'open_claim')
        when 'available' then jsonb_build_object('type', 'open_obligation')
        when 'overdue' then jsonb_build_object('type', 'open_obligation')
        else null
      end
    )
    into next_obligation
    from public.payment_obligations po
    cross join lateral (
      select case
        when exists (
          select 1
          from public.payment_claims pc
          where pc.obligation_id = po.id
            and pc.status = 'under_review'::public.payment_claim_status_enum
        ) then 'under_review'
        when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
          and po.available_on <= timezone(
          coalesce(po.billing_timezone, schedule_record.billing_timezone),
          evaluated_at_value
        )::date then 'available'
        else 'scheduled'
      end as effective_status
    ) state
    where po.schedule_id = schedule_record.id
      and po.status not in (
        'settled'::public.payment_obligation_status_enum,
        'void'::public.payment_obligation_status_enum
      )
      and po.due_on > timezone(
        coalesce(po.billing_timezone, schedule_record.billing_timezone),
        evaluated_at_value
      )::date
    order by po.due_on asc, po.created_at asc, po.id asc
    limit 1;

    if next_obligation is null then
      for next_assignment in
        select
          cpa.*,
          lead(cpa.effective_period_start) over (
            order by cpa.effective_period_start, cpa.id
          ) as next_effective_period_start
        from public.contribution_plan_assignments cpa
        where cpa.schedule_id = schedule_record.id
        order by cpa.effective_period_start, cpa.id
      loop
        candidate_plan_type := next_assignment.plan_type;
        candidate_effective_start := greatest(
          schedule_record.admission_date,
          next_assignment.effective_period_start
        );
        candidate_due_date := public.recurring_due_date_on_or_after(
          schedule_record.admission_date,
          case candidate_plan_type
            when 'annual'::public.subscription_plan_type_enum
              then 'annual'::public.contribution_cadence_enum
            else 'monthly'::public.contribution_cadence_enum
          end,
          coalesce(next_assignment.due_day, schedule_record.due_day),
          greatest(
            candidate_effective_start,
            timezone(
              coalesce(next_assignment.billing_timezone, schedule_record.billing_timezone),
              evaluated_at_value
            )::date + 1
          )
        );

        if next_assignment.next_effective_period_start is not null
          and candidate_due_date >= next_assignment.next_effective_period_start then
          continue;
        end if;

        if not candidate_found or candidate_due_date < selected_candidate_due_date then
          candidate_found := true;
          selected_candidate_due_date := candidate_due_date;
          candidate_next_due_date := public.next_recurring_due_date(
            candidate_due_date,
            case candidate_plan_type
              when 'annual'::public.subscription_plan_type_enum
                then 'annual'::public.contribution_cadence_enum
              else 'monthly'::public.contribution_cadence_enum
            end,
            coalesce(next_assignment.due_day, schedule_record.due_day)
          );
          candidate_available_on := candidate_due_date
            - coalesce(next_assignment.lead_days, schedule_record.lead_days);
          candidate_period_start := candidate_due_date;
          candidate_period_end := candidate_next_due_date - 1;
          candidate_amount := next_assignment.amount;
          candidate_currency := next_assignment.currency;
          next_obligation := jsonb_build_object(
            'obligation_id', null,
            'purpose', 'recurring',
            'status', 'scheduled',
            'period_key', public.recurring_period_key(
              case candidate_plan_type
                when 'annual'::public.subscription_plan_type_enum
                  then 'annual'::public.contribution_cadence_enum
                else 'monthly'::public.contribution_cadence_enum
              end,
              candidate_due_date
            ),
            'period_start', candidate_period_start,
            'period_end', candidate_period_end,
            'available_on', candidate_available_on,
            'due_on', candidate_due_date,
            'amount', candidate_amount,
            'currency', candidate_currency,
            'action', null
          );
        end if;
      end loop;
    end if;
  end if;

  select coalesce(jsonb_agg(row_data order by due_on desc, obligation_id desc), '[]'::jsonb),
    count(*)::integer
  into history, history_count
  from (
    select
      jsonb_build_object(
        'obligation_id', po.id,
        'purpose', po.purpose,
        'status', state.effective_status,
        'period_key', po.period_key,
        'period_start', po.period_start,
        'period_end', po.period_end,
        'available_on', po.available_on,
        'due_on', po.due_on,
        'amount', po.amount,
        'currency', po.currency,
        'settled_at', po.settled_at,
        'claims', coalesce((
          select jsonb_agg(jsonb_build_object(
            'claim_id', pc.id,
            'status', pc.status,
            'payer', pc.payer_type,
            'payer_name', pc.payer_name,
            'created_at', pc.created_at,
            'decided_at', pc.decided_at,
            'decision_reason', pc.decision_reason
          ) order by pc.created_at asc, pc.id asc)
          from public.payment_claims pc
          where pc.obligation_id = po.id
        ), '[]'::jsonb)
      ) as row_data,
      po.due_on,
      po.created_at,
      po.id as obligation_id
    from public.payment_obligations po
    cross join lateral (
      select case
        when po.status = 'settled'::public.payment_obligation_status_enum then 'settled'
        when po.status = 'void'::public.payment_obligation_status_enum then 'void'
        when exists (
          select 1
          from public.payment_claims pc
          where pc.obligation_id = po.id
            and pc.status = 'under_review'::public.payment_claim_status_enum
        ) then 'under_review'
        when po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
          and po.available_at <= evaluated_at_value then 'available'
        when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
          and po.due_on < timezone(
            coalesce(po.billing_timezone, organization_record.billing_timezone),
            evaluated_at_value
          )::date then 'overdue'
        when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
          and po.available_on <= timezone(
          coalesce(po.billing_timezone, organization_record.billing_timezone),
          evaluated_at_value
        )::date then 'available'
        else 'scheduled'
      end as effective_status
    ) state
    where po.organization_id = p_organization_id
      and po.user_id = actor_id
      and (
        cursor_due_on is null
        or (po.due_on, po.id) < (cursor_due_on, cursor_obligation_id)
      )
    order by po.due_on desc, po.id desc
    limit history_limit_value + 1
  ) history_rows;

  if history_count > history_limit_value then
    history_has_more := true;
    select jsonb_agg(value order by ordinal)
    into history
    from jsonb_array_elements(history) with ordinality as items(value, ordinal)
    where ordinal <= history_limit_value;

    select to_char(po.due_on, 'YYYY-MM-DD') || '|' || po.id::text
    into history_next_cursor
    from public.payment_obligations po
    where po.organization_id = p_organization_id
      and po.user_id = actor_id
      and (
        cursor_due_on is null
        or (po.due_on, po.id) < (cursor_due_on, cursor_obligation_id)
      )
    order by po.due_on desc, po.id desc
    offset history_limit_value
    limit 1;
  end if;

  return jsonb_build_object(
    'organization_id', organization_record.id,
    'organization_slug', organization_record.slug,
    'organization_name', organization_record.name,
    'legal_membership_state', legal_state,
    'application_status', case when application_found then application_record.status else null end,
    'application_correction_reason', application_correction_reason,
    'financial_standing', financial_state,
    'evaluated_at', evaluated_at_value,
    'plan_type', plan_type_value,
    'attention_obligation', attention_obligation,
    'next_contribution', next_obligation,
    'history', coalesce(history, '[]'::jsonb),
    'history_limit', history_limit_value,
    'history_has_more', history_has_more,
    'history_next_cursor', history_next_cursor
  );
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_membership_billing_ledger"(uuid, text, integer) TO "authenticated";

COMMENT ON FUNCTION "public"."get_membership_billing_ledger"(uuid, text, integer) IS 'Returns the signed-in person''s private Ledger using effective-dated terms and obligation timezone snapshots.';

REVOKE ALL ON FUNCTION "public"."get_membership_billing_ledger"(uuid, text, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_membership_billing_ledger"(uuid, text, integer) TO "postgres";

REVOKE ALL ON FUNCTION "public"."get_membership_billing_ledger"(uuid, text, integer) FROM PUBLIC, "anon", "service_role";
