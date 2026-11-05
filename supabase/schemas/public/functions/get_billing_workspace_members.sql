CREATE OR REPLACE FUNCTION public.get_billing_workspace_members (
  p_organization_id uuid
)
  RETURNS TABLE (
    member_user_id                uuid,
    member_name                   text,
    member_handle                 text,
    member_profile_picture        text,
    member_role                   public.organization_role_enum,
    joined_at                     timestamp with time zone,
    financial_standing            text,
    overdue_count                 bigint,
    oldest_attention_due_on       date,
    plan_type                     public.subscription_plan_type_enum,
    last_verified_contribution_at timestamp with time zone,
    next_due_on                   date
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    om.user_id,
    member_profile.name,
    member_profile.username,
    member_profile.profile_picture,
    om.role,
    om.joined_at,
    case
      when coalesce(financial.overdue_count, 0) > 0 then 'overdue'
      when coalesce(financial.payment_available_count, 0) > 0 then 'payment_available'
      when coalesce(financial.under_review_count, 0) > 0 then 'under_review'
      else 'up_to_date'
    end,
    coalesce(financial.overdue_count, 0),
    financial.oldest_attention_due_on,
    current_term.plan_type,
    financial.last_verified_contribution_at,
    financial.next_due_on
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  join public.profiles member_profile on member_profile.id = om.user_id
  left join lateral (
    select cpa.plan_type
    from public.contribution_plan_assignments cpa
    join public.contribution_schedules cs on cs.id = cpa.schedule_id
    where cs.organization_id = om.organization_id
      and cs.user_id = om.user_id
      and cs.active
      and cpa.effective_period_start <= timezone(o.billing_timezone, clock_timestamp())::date
    order by cpa.effective_period_start desc, cpa.id desc
    limit 1
  ) current_term on true
  left join lateral (
    select
      count(*) filter (
        where po.purpose = 'recurring'::public.payment_obligation_purpose_enum
          and po.status not in (
            'settled'::public.payment_obligation_status_enum,
            'void'::public.payment_obligation_status_enum
          )
          and po.due_on < timezone(
            coalesce(po.billing_timezone, o.billing_timezone),
            clock_timestamp()
          )::date
      ) as overdue_count,
      count(*) filter (
        where po.status not in (
            'settled'::public.payment_obligation_status_enum,
            'void'::public.payment_obligation_status_enum
          )
          and not exists (
            select 1
            from public.payment_claims pc
            where pc.obligation_id = po.id
              and pc.status = 'under_review'::public.payment_claim_status_enum
          )
          and (
            (
              po.purpose = 'initial_admission'::public.payment_obligation_purpose_enum
              and po.available_at <= clock_timestamp()
            )
            or (
              po.purpose = 'recurring'::public.payment_obligation_purpose_enum
              and po.available_on <= timezone(
                coalesce(po.billing_timezone, o.billing_timezone),
                clock_timestamp()
              )::date
            )
          )
      ) as payment_available_count,
      count(*) filter (
        where po.status not in (
          'settled'::public.payment_obligation_status_enum,
          'void'::public.payment_obligation_status_enum
        )
        and exists (
          select 1
          from public.payment_claims pc
          where pc.obligation_id = po.id
            and pc.status = 'under_review'::public.payment_claim_status_enum
        )
      ) as under_review_count,
      min(
        case
          when po.status not in (
            'settled'::public.payment_obligation_status_enum,
            'void'::public.payment_obligation_status_enum
          )
          and (
            po.due_on < timezone(
              coalesce(po.billing_timezone, o.billing_timezone),
              clock_timestamp()
            )::date
            or po.available_at <= clock_timestamp()
            or po.available_on <= timezone(
              coalesce(po.billing_timezone, o.billing_timezone),
              clock_timestamp()
            )::date
            or exists (
              select 1
              from public.payment_claims pc
              where pc.obligation_id = po.id
                and pc.status = 'under_review'::public.payment_claim_status_enum
            )
          ) then po.due_on
        end
      ) as oldest_attention_due_on,
      max(
        case
          when po.status = 'settled'::public.payment_obligation_status_enum
            then po.settled_at
        end
      ) as last_verified_contribution_at,
      min(
        case
          when po.purpose = 'recurring'::public.payment_obligation_purpose_enum
            and po.status not in (
              'settled'::public.payment_obligation_status_enum,
              'void'::public.payment_obligation_status_enum
            )
            and po.due_on >= timezone(
              coalesce(po.billing_timezone, o.billing_timezone),
              clock_timestamp()
            )::date
            then po.due_on
        end
      ) as next_due_on
    from public.payment_obligations po
    where po.organization_id = om.organization_id
      and po.user_id = om.user_id
  ) financial on true
  where p_organization_id is not null
    and om.organization_id = p_organization_id
    and o.organization_type = 'association'::public.organization_type_enum
    and om.role in (
      'admin'::public.organization_role_enum,
      'member'::public.organization_role_enum
    )
    and exists (
      select 1
      from public.organization_members reviewer_membership
      where reviewer_membership.organization_id = om.organization_id
        and reviewer_membership.user_id = (select auth.uid())
        and reviewer_membership.role = 'admin'::public.organization_role_enum
    )
  order by member_profile.name, member_profile.username, om.user_id;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_billing_workspace_members"(uuid) TO "authenticated";

COMMENT ON FUNCTION "public"."get_billing_workspace_members"(uuid) IS 'Returns the active association roster with server-derived financial standing and obligation attention.';

REVOKE ALL ON FUNCTION "public"."get_billing_workspace_members"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_billing_workspace_members"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."get_billing_workspace_members"(uuid) FROM PUBLIC, "anon", "service_role";
