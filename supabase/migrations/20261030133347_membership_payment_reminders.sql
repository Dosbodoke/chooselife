-- ---------------------------------------------------------------------------
-- Payment reminders an association admin sends to one person.
--
-- Delivery reuses the existing path: a row in public.notifications fires the
-- database webhook that calls the push-notification Edge Function. These
-- commands only enqueue that row, never call the function, so a reminder is
-- sent exactly once and the browser holds no service credentials.
--
-- The command is deliberately narrow:
--   * only an admin of the association may send,
--   * the recipient is always one profile -- never NULL, which the Edge
--     Function reads as a broadcast to every device,
--   * the recipient must be an active member or a pending applicant of that
--     association with a payment that is actually open right now,
--   * the wording is fixed server-side and kept generic. notifications is
--     readable by every client (20250530044803), so no amount or count goes
--     into it,
--   * one reminder per person per association every 20 hours, serialized by
--     an advisory lock so two admins clicking at once still send one.
--
-- membership_payment_reminders is the audit trail and the cooldown source. It
-- is not notifications itself, because anyone can insert into notifications
-- and so could forge or block a cooldown there.
-- ---------------------------------------------------------------------------

create table public.membership_payment_reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations (id) on delete cascade,
  recipient_user_id uuid not null
    references public.profiles (id) on delete cascade,
  sent_by_user_id uuid
    references public.profiles (id) on delete set null,
  notification_id bigint
    references public.notifications (id) on delete set null,
  device_count integer not null check (device_count >= 0),
  created_at timestamp with time zone not null default clock_timestamp()
);

comment on table public.membership_payment_reminders is
  'Audit trail of admin-sent payment reminders. Source of the per-person cooldown. Written only by send_membership_payment_reminder.';

create index membership_payment_reminders_recipient_idx
  on public.membership_payment_reminders (
    recipient_user_id,
    organization_id,
    created_at desc
  );

create index membership_payment_reminders_organization_idx
  on public.membership_payment_reminders (organization_id);

create index membership_payment_reminders_sent_by_idx
  on public.membership_payment_reminders (sent_by_user_id)
  where sent_by_user_id is not null;

create index membership_payment_reminders_notification_idx
  on public.membership_payment_reminders (notification_id)
  where notification_id is not null;

alter table public.membership_payment_reminders enable row level security;

revoke all on table public.membership_payment_reminders
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Shared evaluation. Not granted to any client role: the two commands below
-- authorize the caller first and then read this.
-- ---------------------------------------------------------------------------

create function public.membership_payment_reminder_state(
  p_organization_id uuid,
  p_user_id uuid
)
returns table (
  recipient_name text,
  recipient_handle text,
  recipient_language public.language,
  is_eligible_person boolean,
  device_count integer,
  open_count integer,
  overdue_count integer,
  oldest_due_on date,
  last_sent_at timestamp with time zone,
  next_available_at timestamp with time zone,
  title jsonb,
  body jsonb,
  blocked_reason text
)
language sql
stable
security definer
set search_path to ''
as $function$
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

comment on function public.membership_payment_reminder_state(uuid, uuid) is
  'Internal. Evaluates who a payment reminder would reach, what it would say and why it may be blocked. Callers must authorize first.';

revoke all on function public.membership_payment_reminder_state(uuid, uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Authorization shared by preview and send.
-- ---------------------------------------------------------------------------

create function public.assert_membership_payment_reminder_admin(
  p_organization_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if p_organization_id is null or p_user_id is null then
    raise exception 'Organization and person are required.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organizations o
    where o.id = p_organization_id
      and o.organization_type = 'association'::public.organization_type_enum
  ) then
    raise exception 'Association was not found.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = (select auth.uid())
      and om.role = 'admin'::public.organization_role_enum
  ) then
    raise exception 'You are not authorized to remind people of this association.'
      using errcode = '42501';
  end if;
end;
$function$;

revoke all on function public.assert_membership_payment_reminder_admin(uuid, uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Preview: exactly what send would do, without doing it.
-- ---------------------------------------------------------------------------

create function public.get_membership_payment_reminder_preview(
  p_organization_id uuid,
  p_user_id uuid
)
returns table (
  recipient_user_id uuid,
  recipient_name text,
  recipient_handle text,
  recipient_language public.language,
  device_count integer,
  open_count integer,
  overdue_count integer,
  oldest_due_on date,
  last_sent_at timestamp with time zone,
  next_available_at timestamp with time zone,
  title jsonb,
  body jsonb,
  blocked_reason text
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  perform public.assert_membership_payment_reminder_admin(
    p_organization_id,
    p_user_id
  );

  return query
  select
    p_user_id,
    state.recipient_name,
    state.recipient_handle,
    state.recipient_language,
    state.device_count,
    state.open_count,
    state.overdue_count,
    state.oldest_due_on,
    state.last_sent_at,
    state.next_available_at,
    state.title,
    state.body,
    state.blocked_reason
  from public.membership_payment_reminder_state(
    p_organization_id,
    p_user_id
  ) state;
end;
$function$;

comment on function public.get_membership_payment_reminder_preview(uuid, uuid) is
  'Association admins only. Shows the recipient, device count, localized wording and any reason a payment reminder cannot be sent now. Sends nothing.';

revoke all on function public.get_membership_payment_reminder_preview(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_membership_payment_reminder_preview(uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Send: enqueue one targeted notification and record it.
-- ---------------------------------------------------------------------------

create function public.send_membership_payment_reminder(
  p_organization_id uuid,
  p_user_id uuid
)
returns table (
  reminder_id uuid,
  notification_id bigint,
  sent_at timestamp with time zone,
  device_count integer
)
language plpgsql
volatile
security definer
-- Not empty like its siblings: the notifications CHECK constraints call
-- validate_locale_keys(), which names the `language` type unqualified. Every
-- reference below is still schema-qualified.
set search_path to public, pg_temp
as $function$
declare
  state_record record;
  organization_slug text;
  created_notification_id bigint;
  created_reminder public.membership_payment_reminders%rowtype;
begin
  perform public.assert_membership_payment_reminder_admin(
    p_organization_id,
    p_user_id
  );

  -- One sender at a time per person, so the cooldown read below cannot race.
  perform pg_advisory_xact_lock(
    hashtextextended(
      'membership_payment_reminder:' || p_organization_id::text || ':' || p_user_id::text,
      0
    )
  );

  select *
  into state_record
  from public.membership_payment_reminder_state(p_organization_id, p_user_id);

  if not found or state_record.blocked_reason = 'not_member' then
    raise exception 'This person is not a member or applicant of the association.'
      using errcode = '22023', hint = 'not_member';
  end if;

  if state_record.blocked_reason = 'nothing_due' then
    raise exception 'This person has no open payment to be reminded about.'
      using errcode = '22023', hint = 'nothing_due';
  end if;

  if state_record.blocked_reason = 'no_devices' then
    raise exception 'This person has no device registered for push notifications.'
      using errcode = '22023', hint = 'no_devices';
  end if;

  if state_record.blocked_reason = 'cooldown' then
    raise exception 'A reminder was already sent to this person recently.'
      using errcode = '22023', hint = 'cooldown';
  end if;

  select o.slug
  into organization_slug
  from public.organizations o
  where o.id = p_organization_id;

  insert into public.notifications (user_id, title, body, data)
  values (
    p_user_id,
    state_record.title,
    state_record.body,
    jsonb_build_object(
      'type', 'membership_payment_reminder',
      'organization_slug', coalesce(organization_slug, ''),
      'url', '/organizations/' || organization_slug
    )
  )
  returning id into created_notification_id;

  insert into public.membership_payment_reminders (
    organization_id,
    recipient_user_id,
    sent_by_user_id,
    notification_id,
    device_count
  )
  values (
    p_organization_id,
    p_user_id,
    (select auth.uid()),
    created_notification_id,
    state_record.device_count
  )
  returning * into created_reminder;

  reminder_id := created_reminder.id;
  notification_id := created_notification_id;
  sent_at := created_reminder.created_at;
  device_count := created_reminder.device_count;
  return next;
end;
$function$;

comment on function public.send_membership_payment_reminder(uuid, uuid) is
  'Association admins only. Enqueues one localized push reminder for one member or applicant with an open payment; the notifications webhook delivers it. Refuses broadcasts, people with nothing due or no device, and repeats within 20 hours.';

revoke all on function public.send_membership_payment_reminder(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.send_membership_payment_reminder(uuid, uuid)
  to authenticated;
