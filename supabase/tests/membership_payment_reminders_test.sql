begin;

select * from no_plan();

-- There is no notifications webhook in the local stack, so every row inserted
-- here stays a row. On a hosted project the same insert is what fires the
-- push-notification Edge Function.

set local role postgres;

insert into public.organizations (
  id,
  name,
  slug,
  organization_type,
  billing_currency,
  billing_timezone,
  billing_due_day,
  billing_lead_days,
  monthly_price_amount,
  annual_price_amount,
  monthly_pix_copy_paste,
  annual_pix_copy_paste
)
values
  (
    '85000000-0000-4000-8000-000000000001'::uuid,
    'Reminder Association',
    'reminder-association',
    'association'::public.organization_type_enum,
    'BRL',
    'America/Sao_Paulo',
    10,
    7,
    2500,
    25000,
    '000201reminder-monthly',
    '000201reminder-annual'
  ),
  (
    '85000000-0000-4000-8000-000000000002'::uuid,
    'Other Association',
    'other-reminder-association',
    'association'::public.organization_type_enum,
    'BRL',
    'America/Sao_Paulo',
    10,
    7,
    2500,
    25000,
    '000201other-monthly',
    '000201other-annual'
  );

insert into auth.users (
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  persona.id,
  'authenticated',
  'authenticated',
  persona.email,
  timezone('utc'::text, now()),
  jsonb_build_object('full_name', persona.name),
  timezone('utc'::text, now()),
  timezone('utc'::text, now())
from (
  values
    ('85000000-0000-4000-8000-000000000101'::uuid, 'reminder-admin@example.com', 'Reminder Admin'),
    ('85000000-0000-4000-8000-000000000102'::uuid, 'reminder-debtor@example.com', 'Reminder Debtor'),
    ('85000000-0000-4000-8000-000000000103'::uuid, 'reminder-paid@example.com', 'Reminder Paid'),
    ('85000000-0000-4000-8000-000000000104'::uuid, 'reminder-nodevice@example.com', 'Reminder No Device'),
    ('85000000-0000-4000-8000-000000000105'::uuid, 'reminder-outsider@example.com', 'Reminder Outsider'),
    ('85000000-0000-4000-8000-000000000106'::uuid, 'reminder-other-admin@example.com', 'Other Admin')
) as persona(id, email, name);

insert into public.profiles (id, name, username)
values
  ('85000000-0000-4000-8000-000000000101'::uuid, 'Reminder Admin', '@reminder_admin'),
  ('85000000-0000-4000-8000-000000000102'::uuid, 'Reminder Debtor', '@reminder_debtor'),
  ('85000000-0000-4000-8000-000000000103'::uuid, 'Reminder Paid', '@reminder_paid'),
  ('85000000-0000-4000-8000-000000000104'::uuid, 'Reminder No Device', '@reminder_nodevice'),
  ('85000000-0000-4000-8000-000000000105'::uuid, 'Reminder Outsider', '@reminder_outsider'),
  ('85000000-0000-4000-8000-000000000106'::uuid, 'Other Admin', '@other_admin')
on conflict (id) do update
set name = excluded.name,
    username = excluded.username;

insert into public.organization_members (organization_id, user_id, role)
values
  ('85000000-0000-4000-8000-000000000001'::uuid, '85000000-0000-4000-8000-000000000101'::uuid, 'admin'),
  ('85000000-0000-4000-8000-000000000001'::uuid, '85000000-0000-4000-8000-000000000102'::uuid, 'member'),
  ('85000000-0000-4000-8000-000000000001'::uuid, '85000000-0000-4000-8000-000000000103'::uuid, 'member'),
  ('85000000-0000-4000-8000-000000000001'::uuid, '85000000-0000-4000-8000-000000000104'::uuid, 'member'),
  ('85000000-0000-4000-8000-000000000002'::uuid, '85000000-0000-4000-8000-000000000106'::uuid, 'admin'),
  ('85000000-0000-4000-8000-000000000002'::uuid, '85000000-0000-4000-8000-000000000105'::uuid, 'member');

-- The debtor and the device-less member were admitted long enough ago to owe
-- past periods; the paid member was admitted today and owes nothing yet. The
-- outsider owes the other association.
select public.ensure_contribution_schedule(
  persona.organization_id,
  persona.user_id,
  'monthly'::public.subscription_plan_type_enum,
  timezone('America/Sao_Paulo', clock_timestamp())::date - persona.days_ago
)
from (
  values
    ('85000000-0000-4000-8000-000000000001'::uuid, '85000000-0000-4000-8000-000000000102'::uuid, 102),
    ('85000000-0000-4000-8000-000000000001'::uuid, '85000000-0000-4000-8000-000000000103'::uuid, 0),
    ('85000000-0000-4000-8000-000000000001'::uuid, '85000000-0000-4000-8000-000000000104'::uuid, 102),
    ('85000000-0000-4000-8000-000000000002'::uuid, '85000000-0000-4000-8000-000000000105'::uuid, 102)
) as persona(organization_id, user_id, days_ago);

select count(*) from public.generate_membership_billing_obligations();

insert into public.push_tokens (token, profile_id, language, platform)
values
  ('ExponentPushToken[reminder-debtor-1]', '85000000-0000-4000-8000-000000000102'::uuid, 'en', 'ios'),
  ('ExponentPushToken[reminder-debtor-2]', '85000000-0000-4000-8000-000000000102'::uuid, 'en', 'android'),
  ('ExponentPushToken[reminder-paid]', '85000000-0000-4000-8000-000000000103'::uuid, 'pt', 'ios'),
  ('ExponentPushToken[reminder-outsider]', '85000000-0000-4000-8000-000000000105'::uuid, 'pt', 'ios');

create temporary table notifications_before on commit drop as
select coalesce(max(id), 0) as last_id from public.notifications;
grant select on notifications_before to authenticated;

-- Client roles cannot reach the audit table or the internal helpers.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '85000000-0000-4000-8000-000000000101',
  true
);

select throws_ok(
  $$select count(*) from public.membership_payment_reminders$$,
  '42501',
  'permission denied for table membership_payment_reminders',
  'clients cannot read the reminder audit trail'
);

select throws_ok(
  $$insert into public.membership_payment_reminders (organization_id, recipient_user_id, device_count)
    values ('85000000-0000-4000-8000-000000000001', '85000000-0000-4000-8000-000000000102', 0)$$,
  '42501',
  'permission denied for table membership_payment_reminders',
  'clients cannot forge or reset a cooldown'
);

select throws_ok(
  $$select * from public.membership_payment_reminder_state(
    '85000000-0000-4000-8000-000000000001', '85000000-0000-4000-8000-000000000102')$$,
  '42501',
  'permission denied for function membership_payment_reminder_state',
  'the unauthorized evaluation helper is not callable by clients'
);

-- Preview, as the association admin.
select is(
  (select blocked_reason
   from public.get_membership_payment_reminder_preview(
     '85000000-0000-4000-8000-000000000001',
     '85000000-0000-4000-8000-000000000102'
   )),
  null,
  'a member with an open payment and a device can be reminded'
);

select results_eq(
  $$select device_count, recipient_language::text, recipient_handle, overdue_count > 0
    from public.get_membership_payment_reminder_preview(
      '85000000-0000-4000-8000-000000000001',
      '85000000-0000-4000-8000-000000000102'
    )$$,
  $$values (2, 'en', '@reminder_debtor', true)$$,
  'the preview names the recipient, their devices, language and overdue state'
);

select is(
  (select body->>'en'
   from public.get_membership_payment_reminder_preview(
     '85000000-0000-4000-8000-000000000001',
     '85000000-0000-4000-8000-000000000102'
   )),
  'Your Reminder Association contribution is overdue. Open Chooselife to pay with PIX.',
  'the wording is fixed server-side and carries no amount'
);

select is(
  (select blocked_reason
   from public.get_membership_payment_reminder_preview(
     '85000000-0000-4000-8000-000000000001',
     '85000000-0000-4000-8000-000000000103'
   )),
  'nothing_due',
  'somebody who owes nothing is not reminded'
);

select is(
  (select blocked_reason
   from public.get_membership_payment_reminder_preview(
     '85000000-0000-4000-8000-000000000001',
     '85000000-0000-4000-8000-000000000104'
   )),
  'no_devices',
  'the preview is honest that a person without a device would get nothing'
);

select is(
  (select blocked_reason
   from public.get_membership_payment_reminder_preview(
     '85000000-0000-4000-8000-000000000001',
     '85000000-0000-4000-8000-000000000105'
   )),
  'not_member',
  'a person from another association is not a valid recipient'
);

-- Refusals send nothing.
select throws_ok(
  $$select * from public.send_membership_payment_reminder(
    '85000000-0000-4000-8000-000000000001', '85000000-0000-4000-8000-000000000104')$$,
  '22023',
  'This person has no device registered for push notifications.',
  'sending to a person without a device is refused'
);

select throws_ok(
  $$select * from public.send_membership_payment_reminder(
    '85000000-0000-4000-8000-000000000001', '85000000-0000-4000-8000-000000000103')$$,
  '22023',
  'This person has no open payment to be reminded about.',
  'sending to a person with nothing due is refused'
);

select throws_ok(
  $$select * from public.send_membership_payment_reminder(
    '85000000-0000-4000-8000-000000000001', '85000000-0000-4000-8000-000000000105')$$,
  '22023',
  'This person is not a member or applicant of the association.',
  'an admin cannot reach somebody outside their association'
);

select throws_ok(
  $$select * from public.send_membership_payment_reminder(
    '85000000-0000-4000-8000-000000000001', null)$$,
  '22023',
  'Organization and person are required.',
  'a reminder can never become a NULL-recipient broadcast'
);

-- A plain member and an admin of another association are both refused.
select set_config(
  'request.jwt.claim.sub',
  '85000000-0000-4000-8000-000000000103',
  true
);

select throws_ok(
  $$select * from public.send_membership_payment_reminder(
    '85000000-0000-4000-8000-000000000001', '85000000-0000-4000-8000-000000000102')$$,
  '42501',
  'You are not authorized to remind people of this association.',
  'a member cannot send reminders'
);

select set_config(
  'request.jwt.claim.sub',
  '85000000-0000-4000-8000-000000000106',
  true
);

select throws_ok(
  $$select * from public.get_membership_payment_reminder_preview(
    '85000000-0000-4000-8000-000000000001', '85000000-0000-4000-8000-000000000102')$$,
  '42501',
  'You are not authorized to remind people of this association.',
  'another association''s admin cannot preview'
);

select is(
  (select count(*)::integer
   from public.notifications n
   where n.id > (select last_id from notifications_before)),
  0,
  'no refused attempt enqueued a notification'
);

-- The real send.
select set_config(
  'request.jwt.claim.sub',
  '85000000-0000-4000-8000-000000000101',
  true
);

select is(
  (select device_count
   from public.send_membership_payment_reminder(
     '85000000-0000-4000-8000-000000000001',
     '85000000-0000-4000-8000-000000000102'
   )),
  2,
  'the admin can send a reminder and learns how many devices it targets'
);

select results_eq(
  $$select n.user_id, n.data->>'type', n.data->>'organization_slug', n.title->>'pt', n.data->>'url'
    from public.notifications n
    where n.id > (select last_id from notifications_before)$$,
  $$values (
    '85000000-0000-4000-8000-000000000102'::uuid,
    'membership_payment_reminder',
    'reminder-association',
    'Lembrete de contribuição',
    '/organizations/reminder-association'
  )$$,
  'exactly one targeted, localized notification is enqueued for the webhook'
);

select throws_ok(
  $$select * from public.send_membership_payment_reminder(
    '85000000-0000-4000-8000-000000000001', '85000000-0000-4000-8000-000000000102')$$,
  '22023',
  'A reminder was already sent to this person recently.',
  'a second reminder inside the cooldown is refused'
);

select is(
  (select blocked_reason
   from public.get_membership_payment_reminder_preview(
     '85000000-0000-4000-8000-000000000001',
     '85000000-0000-4000-8000-000000000102'
   )),
  'cooldown',
  'the preview reports the cooldown'
);

select ok(
  (select next_available_at > clock_timestamp() + interval '19 hours'
   from public.get_membership_payment_reminder_preview(
     '85000000-0000-4000-8000-000000000001',
     '85000000-0000-4000-8000-000000000102'
   )),
  'the preview says when the next reminder is allowed'
);

select is(
  (select count(*)::integer
   from public.notifications n
   where n.id > (select last_id from notifications_before)),
  1,
  'the refused repeat did not enqueue a second notification'
);

set local role postgres;

select results_eq(
  $$select sent_by_user_id, recipient_user_id, device_count, notification_id is not null
    from public.membership_payment_reminders
    where organization_id = '85000000-0000-4000-8000-000000000001'$$,
  $$values (
    '85000000-0000-4000-8000-000000000101'::uuid,
    '85000000-0000-4000-8000-000000000102'::uuid,
    2,
    true
  )$$,
  'the audit trail records who reminded whom'
);

-- The cooldown expires.
update public.membership_payment_reminders
set created_at = clock_timestamp() - interval '21 hours'
where organization_id = '85000000-0000-4000-8000-000000000001';

set local role authenticated;

select is(
  (select blocked_reason
   from public.get_membership_payment_reminder_preview(
     '85000000-0000-4000-8000-000000000001',
     '85000000-0000-4000-8000-000000000102'
   )),
  null,
  'a reminder is allowed again once the cooldown has passed'
);

-- Anonymous callers have no access at all.
set local role anon;

select throws_ok(
  $$select * from public.send_membership_payment_reminder(
    '85000000-0000-4000-8000-000000000001', '85000000-0000-4000-8000-000000000102')$$,
  '42501',
  'permission denied for function send_membership_payment_reminder',
  'anonymous callers cannot send reminders'
);

select * from finish();

rollback;
