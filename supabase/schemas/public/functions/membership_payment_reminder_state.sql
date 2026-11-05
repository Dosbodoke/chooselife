CREATE OR REPLACE FUNCTION public.membership_payment_reminder_state (
  p_organization_id uuid,
  p_user_id         uuid
)
  RETURNS TABLE (
    recipient_name     text,
    recipient_handle   text,
    recipient_language public.language,
    is_eligible_person boolean,
    device_count       integer,
    open_count         integer,
    overdue_count      integer,
    oldest_due_on      date,
    last_sent_at       timestamp with time zone,
    next_available_at  timestamp with time zone,
    title              jsonb,
    body               jsonb,
    blocked_reason     text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with organization as (
    select
      o.id,
      o.slug,
      left(btrim(o.name), 80) as display_name,
      o.billing_timezone
    from public.organizations o
    where o.id = p_organization_id
  ),
  open_obligations as (
    select
      po.due_on,
      po.due_on < timezone(
        coalesce(po.billing_timezone, organization.billing_timezone),
        clock_timestamp()
      )::date as is_overdue
    from public.payment_obligations po
    cross join organization
    where po.organization_id = p_organization_id
      and po.user_id = p_user_id
      and po.status = 'available'::public.payment_obligation_status_enum
      -- A claim under review is the person having already paid; nagging them
      -- about it would be wrong.
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
            coalesce(po.billing_timezone, organization.billing_timezone),
            clock_timestamp()
          )::date
        )
      )
  ),
  summary as (
    select
      count(*)::integer as open_count,
      (count(*) filter (where is_overdue))::integer as overdue_count,
      min(due_on) as oldest_due_on
    from open_obligations
  ),
  person as (
    select
      profile.name::text as recipient_name,
      profile.username::text as recipient_handle,
      -- The Edge Function localizes per device; the preview shows the newest
      -- device's language, falling back to the same Portuguese it does.
      coalesce(
        (
          select pt.language
          from public.push_tokens pt
          where pt.profile_id = profile.id
            and pt.language is not null
          order by pt.created_at desc nulls last, pt.id desc
          limit 1
        ),
        'pt'::public.language
      ) as recipient_language,
      (
        exists (
          select 1
          from public.organization_members om
          where om.organization_id = p_organization_id
            and om.user_id = profile.id
            and om.role in (
              'admin'::public.organization_role_enum,
              'member'::public.organization_role_enum
            )
        )
        or exists (
          select 1
          from public.membership_applications ma
          where ma.organization_id = p_organization_id
            and ma.user_id = profile.id
            and ma.status = 'submitted'::public.membership_application_status_enum
        )
      ) as is_eligible_person,
      (
        select count(*)::integer
        from public.push_tokens pt
        where pt.profile_id = profile.id
      ) as device_count,
      (
        select max(reminder.created_at)
        from public.membership_payment_reminders reminder
        where reminder.organization_id = p_organization_id
          and reminder.recipient_user_id = profile.id
      ) as last_sent_at
    from public.profiles profile
    where profile.id = p_user_id
  )
  select
    person.recipient_name,
    person.recipient_handle,
    person.recipient_language,
    person.is_eligible_person,
    person.device_count,
    summary.open_count,
    summary.overdue_count,
    summary.oldest_due_on,
    person.last_sent_at,
    person.last_sent_at + interval '20 hours',
    jsonb_build_object(
      'pt', 'Lembrete de contribuição',
      'en', 'Contribution reminder'
    ),
    case
      when summary.overdue_count > 0 then jsonb_build_object(
        'pt', format(
          'Sua contribuição para %s está em atraso. Abra o Chooselife para pagar via PIX.',
          organization.display_name
        ),
        'en', format(
          'Your %s contribution is overdue. Open Chooselife to pay with PIX.',
          organization.display_name
        )
      )
      else jsonb_build_object(
        'pt', format(
          'Sua contribuição para %s já está disponível. Abra o Chooselife para pagar via PIX.',
          organization.display_name
        ),
        'en', format(
          'Your %s contribution is ready to pay. Open Chooselife to pay with PIX.',
          organization.display_name
        )
      )
    end,
    case
      when not person.is_eligible_person then 'not_member'
      when summary.open_count = 0 then 'nothing_due'
      when person.device_count = 0 then 'no_devices'
      when person.last_sent_at + interval '20 hours' > clock_timestamp()
        then 'cooldown'
      else null
    end
  from person
  cross join organization
  cross join summary;
$function$;

COMMENT ON FUNCTION "public"."membership_payment_reminder_state"(uuid, uuid) IS 'Internal. Evaluates who a payment reminder would reach, what it would say and why it may be blocked. Callers must authorize first.';

REVOKE ALL ON FUNCTION "public"."membership_payment_reminder_state"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."membership_payment_reminder_state"(uuid, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."membership_payment_reminder_state"(uuid, uuid) FROM PUBLIC, "anon", "authenticated", "service_role";
