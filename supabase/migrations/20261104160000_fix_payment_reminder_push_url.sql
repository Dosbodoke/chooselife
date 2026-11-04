-- Point the payment reminder push at a screen the app has.
--
-- 20261030133347 sent `url` = '/organizations/<slug>', but the app has no
-- screen at that path (only '[slug]/member' and '[slug]/onboarding'), so
-- tapping the push opened the not-found screen. '/organizations' redirects to
-- the Organizations tab, which shows the member's contributions, in every
-- released build since the subscription flow shipped. `organization_slug`
-- stays in the payload so a later build can route to one association.
--
-- Only the payload changes. create or replace keeps the grants and comment.

create or replace function public.send_membership_payment_reminder(
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
      'url', '/organizations'
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
