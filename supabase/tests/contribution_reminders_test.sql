begin;

select * from no_plan();

select is(
  public.contribution_reminder_stage_for_date(
    '2026-08-16'::date,
    '2026-08-23'::date,
    '2026-08-16'::date
  ),
  'available'::public.contribution_reminder_stage_enum,
  'the available stage starts on the snapshotted available date'
);

select is(
  public.contribution_reminder_stage_for_date(
    '2026-08-16'::date,
    '2026-08-23'::date,
    '2026-08-30'::date
  ),
  'overdue'::public.contribution_reminder_stage_enum,
  'the overdue stage starts seven calendar days after due_on'
);

select is(
  public.contribution_reminder_delivery_at(
    '2026-08-23'::date,
    'America/Sao_Paulo',
    '09:00:00'::time
  ),
  '2026-08-23 12:00:00+00'::timestamp with time zone,
  'delivery uses the obligation timezone and organization-local time'
);

select is(
  public.contribution_reminder_backoff(1),
  '00:01:00'::interval,
  'the first retry waits one minute'
);

select is(
  public.contribution_reminder_backoff(10),
  '01:00:00'::interval,
  'retry backoff is capped at one hour'
);

insert into public.organizations (
  id,
  name,
  slug,
  organization_type,
  billing_currency,
  billing_timezone,
  billing_due_day,
  billing_lead_days,
  contribution_reminder_local_time,
  monthly_price_amount,
  monthly_pix_copy_paste
)
values (
  '83000000-0000-4000-8000-000000000001'::uuid,
  'Reminder Association',
  'reminder-association',
  'association'::public.organization_type_enum,
  'BRL',
  'America/Sao_Paulo',
  23,
  7,
  '09:00:00'::time,
  12500,
  '000201reminder-test-pix'
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
values
  (
    '83000000-0000-4000-8000-000000000101'::uuid,
    'authenticated',
    'authenticated',
    'reminder-member@example.com',
    timezone('utc'::text, now()),
    '{"full_name":"Reminder Member"}'::jsonb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  ),
  (
    '83000000-0000-4000-8000-000000000102'::uuid,
    'authenticated',
    'authenticated',
    'reminder-no-device@example.com',
    timezone('utc'::text, now()),
    '{"full_name":"Reminder No Device"}'::jsonb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  ),
  (
    '83000000-0000-4000-8000-000000000103'::uuid,
    'authenticated',
    'authenticated',
    'reminder-review@example.com',
    timezone('utc'::text, now()),
    '{"full_name":"Reminder Review"}'::jsonb,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  );

insert into public.profiles (id, name, username)
values
  (
    '83000000-0000-4000-8000-000000000101'::uuid,
    'Reminder Member',
    '@reminder_member'
  ),
  (
    '83000000-0000-4000-8000-000000000102'::uuid,
    'Reminder No Device',
    '@reminder_no_device'
  ),
  (
    '83000000-0000-4000-8000-000000000103'::uuid,
    'Reminder Review',
    '@reminder_review'
  )
on conflict (id) do update
set name = excluded.name,
    username = excluded.username;

insert into public.organization_members (organization_id, user_id, role)
values
  (
    '83000000-0000-4000-8000-000000000001'::uuid,
    '83000000-0000-4000-8000-000000000101'::uuid,
    'member'::public.organization_role_enum
  ),
  (
    '83000000-0000-4000-8000-000000000001'::uuid,
    '83000000-0000-4000-8000-000000000102'::uuid,
    'member'::public.organization_role_enum
  ),
  (
    '83000000-0000-4000-8000-000000000001'::uuid,
    '83000000-0000-4000-8000-000000000103'::uuid,
    'member'::public.organization_role_enum
  );

insert into public.subscriptions (
  organization_id,
  user_id,
  plan_type,
  status,
  current_period_end
)
values
  (
    '83000000-0000-4000-8000-000000000001'::uuid,
    '83000000-0000-4000-8000-000000000101'::uuid,
    'monthly'::public.subscription_plan_type_enum,
    'active'::public.subscription_status_enum,
    '2026-09-30 12:00:00+00'::timestamp with time zone
  ),
  (
    '83000000-0000-4000-8000-000000000001'::uuid,
    '83000000-0000-4000-8000-000000000102'::uuid,
    'monthly'::public.subscription_plan_type_enum,
    'active'::public.subscription_status_enum,
    '2026-09-30 12:00:00+00'::timestamp with time zone
  ),
  (
    '83000000-0000-4000-8000-000000000001'::uuid,
    '83000000-0000-4000-8000-000000000103'::uuid,
    'monthly'::public.subscription_plan_type_enum,
    'active'::public.subscription_status_enum,
    '2026-09-30 12:00:00+00'::timestamp with time zone
  );

insert into public.payment_obligations (
  id,
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
values
  (
    '83000000-0000-4000-8000-000000000301'::uuid,
    '83000000-0000-4000-8000-000000000001'::uuid,
    '83000000-0000-4000-8000-000000000101'::uuid,
    null,
    'recurring'::public.payment_obligation_purpose_enum,
    'available'::public.payment_obligation_status_enum,
    'monthly'::public.subscription_plan_type_enum,
    12500,
    'BRL',
    'manual_pix',
    '000201reminder-301',
    '2026-08-16 12:00:00+00'::timestamp with time zone,
    (select id from public.contribution_schedules
     where organization_id = '83000000-0000-4000-8000-000000000001'::uuid
       and user_id = '83000000-0000-4000-8000-000000000101'::uuid),
    '2026-08-301',
    '2026-08-16'::date,
    '2026-09-15'::date,
    '2026-08-16'::date,
    '2026-08-23'::date,
    'America/Sao_Paulo',
    23,
    7,
    'Reminder Association',
    'reminder-association'
  ),
  (
    '83000000-0000-4000-8000-000000000302'::uuid,
    '83000000-0000-4000-8000-000000000001'::uuid,
    '83000000-0000-4000-8000-000000000101'::uuid,
    null,
    'recurring'::public.payment_obligation_purpose_enum,
    'available'::public.payment_obligation_status_enum,
    'monthly'::public.subscription_plan_type_enum,
    12500,
    'BRL',
    'manual_pix',
    '000201reminder-302',
    '2026-08-16 12:00:00+00'::timestamp with time zone,
    (select id from public.contribution_schedules
     where organization_id = '83000000-0000-4000-8000-000000000001'::uuid
       and user_id = '83000000-0000-4000-8000-000000000101'::uuid),
    '2026-08-302',
    '2026-08-16'::date,
    '2026-09-15'::date,
    '2026-08-16'::date,
    '2026-08-23'::date,
    'America/Sao_Paulo',
    23,
    7,
    'Reminder Association',
    'reminder-association'
  ),
  (
    '83000000-0000-4000-8000-000000000303'::uuid,
    '83000000-0000-4000-8000-000000000001'::uuid,
    '83000000-0000-4000-8000-000000000102'::uuid,
    null,
    'recurring'::public.payment_obligation_purpose_enum,
    'available'::public.payment_obligation_status_enum,
    'monthly'::public.subscription_plan_type_enum,
    12500,
    'BRL',
    'manual_pix',
    '000201reminder-303',
    '2026-08-16 12:00:00+00'::timestamp with time zone,
    (select id from public.contribution_schedules
     where organization_id = '83000000-0000-4000-8000-000000000001'::uuid
       and user_id = '83000000-0000-4000-8000-000000000102'::uuid),
    '2026-08-303',
    '2026-08-16'::date,
    '2026-09-15'::date,
    '2026-08-16'::date,
    '2026-08-23'::date,
    'America/Sao_Paulo',
    23,
    7,
    'Reminder Association',
    'reminder-association'
  ),
  (
    '83000000-0000-4000-8000-000000000304'::uuid,
    '83000000-0000-4000-8000-000000000001'::uuid,
    '83000000-0000-4000-8000-000000000103'::uuid,
    null,
    'recurring'::public.payment_obligation_purpose_enum,
    'available'::public.payment_obligation_status_enum,
    'monthly'::public.subscription_plan_type_enum,
    12500,
    'BRL',
    'manual_pix',
    '000201reminder-304',
    '2026-08-16 12:00:00+00'::timestamp with time zone,
    (select id from public.contribution_schedules
     where organization_id = '83000000-0000-4000-8000-000000000001'::uuid
       and user_id = '83000000-0000-4000-8000-000000000103'::uuid),
    '2026-08-304',
    '2026-08-16'::date,
    '2026-09-15'::date,
    '2026-08-16'::date,
    '2026-08-23'::date,
    'America/Sao_Paulo',
    23,
    7,
    'Reminder Association',
    'reminder-association'
  );

select is(
  (select created_count
   from public.enqueue_contribution_reminder_events_at(
     '2026-08-16 12:00:00+00'::timestamp with time zone
   )),
  4,
  'the first scheduler pass creates one logical event per current obligation'
);

select is(
  (select count(*)::integer from public.contribution_reminder_events),
  4,
  'the outbox stores four logical events after the first pass'
);

insert into public.payment_claims (
  id,
  obligation_id,
  organization_id,
  claimant_user_id,
  payer_type,
  status
)
values (
  '83000000-0000-4000-8000-000000000401'::uuid,
  '83000000-0000-4000-8000-000000000304'::uuid,
  '83000000-0000-4000-8000-000000000001'::uuid,
  '83000000-0000-4000-8000-000000000103'::uuid,
  'applicant'::public.payment_claim_payer_type_enum,
  'under_review'::public.payment_claim_status_enum
);

insert into public.push_tokens (token, profile_id, language)
values (
  'ExponentPushToken[830-member-device]',
  '83000000-0000-4000-8000-000000000101'::uuid,
  'en'::public.language
);

select is(
  (select created_count
   from public.enqueue_contribution_reminder_events_at(
     '2026-08-16 12:00:00+00'::timestamp with time zone
   )),
  0,
  'repeating the scheduler pass is idempotent'
);

select is(
  (select created_count
   from public.enqueue_contribution_reminder_events_at(
     '2026-08-23 12:00:00+00'::timestamp with time zone
   )),
  3,
  'the due pass creates only the latest useful stage and skips the under-review obligation'
);

select is(
  (select status::text
   from public.contribution_reminder_events
   where obligation_id = '83000000-0000-4000-8000-000000000301'::uuid
     and stage = 'available'::public.contribution_reminder_stage_enum),
  'suppressed',
  'a superseded available event is suppressed'
);

select is(
  (select status::text
   from public.contribution_reminder_events
   where obligation_id = '83000000-0000-4000-8000-000000000301'::uuid
     and stage = 'due'::public.contribution_reminder_stage_enum),
  'pending',
  'the due event remains pending until delivery completes'
);

select is(
  (select status::text
   from public.contribution_reminder_events
   where obligation_id = '83000000-0000-4000-8000-000000000304'::uuid
     and stage = 'available'::public.contribution_reminder_stage_enum),
  'suppressed',
  'a claim entering review suppresses its pending reminder'
);

select is(
  (select suppression_reason
   from public.contribution_reminder_events
   where obligation_id = '83000000-0000-4000-8000-000000000304'::uuid
     and stage = 'available'::public.contribution_reminder_stage_enum),
  'claim_under_review',
  'the suppression reason records the trusted claim state'
);

create temporary table reminder_batch_claims on commit drop as
select *
from public.claim_contribution_reminder_batches(20, 180);

select is(
  (select count(*)::integer from reminder_batch_claims),
  2,
  'only batches with a current pending event are claimable'
);

select is(
  (select count(*)::integer
   from public.claim_contribution_reminder_batches(20, 180)),
  0,
  'a second dispatcher cannot claim batches while the first lease is active'
);

create temporary table reminder_prepared on commit drop as
select
  batch.recipient_user_id,
  batch.delivery_window_on,
  claim.batch_id,
  claim.lease_token,
  prepared.delivery_attempts
from reminder_batch_claims claim
join public.contribution_reminder_batches batch
  on batch.id = claim.batch_id
cross join lateral public.prepare_contribution_reminder_batch(
  claim.batch_id,
  claim.lease_token,
  180
) prepared
where batch.delivery_window_on = '2026-08-23'::date;

select is(
  (select count(*)::integer from reminder_prepared),
  1,
  'the dispatcher prepares the device-backed batch and closes the no-device batch'
);

select is(
  (select status::text
   from public.contribution_reminder_batches
   where organization_id = '83000000-0000-4000-8000-000000000001'::uuid
     and recipient_user_id = '83000000-0000-4000-8000-000000000102'::uuid
     and delivery_window_on = '2026-08-23'::date),
  'no_device',
  'a member without a device reaches an explicit no-device outcome'
);

select is(
  (select status::text
   from public.contribution_reminder_events
   where obligation_id = '83000000-0000-4000-8000-000000000303'::uuid
     and stage = 'due'::public.contribution_reminder_stage_enum),
  'no_device',
  'the logical event records the no-device outcome without sending repeatedly'
);

create temporary table reminder_ticket_inputs on commit drop as
select
  prepared.batch_id,
  prepared.lease_token,
  (attempt ->> 'attempt_id')::uuid as attempt_id
from reminder_prepared prepared
cross join lateral jsonb_array_elements(prepared.delivery_attempts) attempt;

select is(
  (select public.record_contribution_reminder_tickets(
    ticket.batch_id,
    ticket.lease_token,
    jsonb_build_array(
      jsonb_build_object(
        'attempt_id', ticket.attempt_id,
        'status', 'ok',
        'expo_ticket_id', 'ticket-830-member',
        'error_code', null
      )
    )
  )
  from reminder_ticket_inputs ticket),
  1,
  'the dispatcher persists one Expo ticket for the physical batch'
);

select is(
  (select count(*)::integer
   from public.contribution_reminder_delivery_attempts
   where batch_id = (select batch_id from reminder_prepared)),
  1,
  'two logical events coalesce into one device delivery attempt'
);

update public.contribution_reminder_delivery_attempts
set status = 'leased'::public.contribution_reminder_attempt_status_enum,
    lease_token = gen_random_uuid(),
    lease_expires_at = clock_timestamp() - interval '1 second'
where batch_id = (select batch_id from reminder_prepared);

create temporary table reminder_receipt_claims on commit drop as
select *
from public.claim_contribution_reminder_receipts(20, 180);

select is(
  (select count(*)::integer from reminder_receipt_claims),
  1,
  'the receipt worker reclaims an expired receipt lease'
);

select is(
  (select public.record_contribution_reminder_receipts(
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'attempt_id', receipt.attempt_id,
            'lease_token', receipt.lease_token,
            'status', 'ok',
            'error_code', null
          )
        )
        from reminder_receipt_claims receipt
      ),
      '[]'::jsonb
    )
  )),
  1,
  'a successful Expo receipt completes the physical attempt'
);

select is(
  (select status::text
   from public.contribution_reminder_batches
   where id = (select batch_id from reminder_prepared)),
  'delivered',
  'the batch becomes delivered after receipt reconciliation'
);

select is(
  (select count(*)::integer
   from public.contribution_reminder_events
   where organization_id = '83000000-0000-4000-8000-000000000001'::uuid
     and recipient_user_id = '83000000-0000-4000-8000-000000000101'::uuid
     and status = 'delivered'::public.contribution_reminder_event_status_enum),
  2,
  'all coalesced logical events become delivered together'
);

insert into public.payment_obligations (
  id,
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
select
  '83000000-0000-4000-8000-000000000305'::uuid,
  po.organization_id,
  po.user_id,
  null,
  'recurring'::public.payment_obligation_purpose_enum,
  'available'::public.payment_obligation_status_enum,
  po.plan_type,
  po.amount,
  po.currency,
  po.payment_method,
  '000201reminder-305',
  '2026-08-24 12:00:00+00'::timestamp with time zone,
  po.schedule_id,
  '2026-08-305',
  '2026-08-24'::date,
  '2026-09-23'::date,
  '2026-08-24'::date,
  '2026-08-31'::date,
  po.billing_timezone,
  po.billing_due_day,
  po.billing_lead_days,
  po.organization_name_snapshot,
  po.organization_slug_snapshot
from public.payment_obligations po
where po.id = '83000000-0000-4000-8000-000000000301'::uuid;

select is(
  (select created_count
   from public.enqueue_contribution_reminder_events_at(
     '2026-08-24 12:00:00+00'::timestamp with time zone
   )),
  1,
  'a newly materialized obligation can still be enqueued at its current stage'
);

update public.payment_obligations
set status = 'settled'::public.payment_obligation_status_enum,
    settled_at = '2026-08-24 13:30:00+00'::timestamp with time zone
where id = '83000000-0000-4000-8000-000000000305'::uuid;

select is(
  (select suppressed_count
   from public.enqueue_contribution_reminder_events_at(
     '2026-08-24 13:30:00+00'::timestamp with time zone
   )),
  1,
  'settlement immediately suppresses a pending reminder event'
);

update public.payment_claims
set status = 'rejected'::public.payment_claim_status_enum,
    decided_at = '2026-08-23 14:00:00+00'::timestamp with time zone,
    decision_reason = 'The claim could not be verified.'
where id = '83000000-0000-4000-8000-000000000401'::uuid;

update public.payment_obligations
set status = 'settled'::public.payment_obligation_status_enum
where id in (
  '83000000-0000-4000-8000-000000000301'::uuid,
  '83000000-0000-4000-8000-000000000302'::uuid,
  '83000000-0000-4000-8000-000000000303'::uuid
);

select is(
  (select created_count
   from public.enqueue_contribution_reminder_events_at(
     '2026-08-30 12:00:00+00'::timestamp with time zone
   )),
  1,
  'a rejected claim permits the next future stage'
);

select is(
  (select count(*)::integer
   from public.contribution_reminder_events
   where obligation_id = '83000000-0000-4000-8000-000000000304'::uuid
     and stage = 'available'::public.contribution_reminder_stage_enum),
  1,
  'the original available event is retained as suppressed history'
);

select is(
  (select count(*)::integer
   from public.contribution_reminder_events
   where obligation_id = '83000000-0000-4000-8000-000000000304'::uuid
     and stage = 'due'::public.contribution_reminder_stage_enum),
  0,
  'a rejected claim does not replay an earlier due stage'
);

select is(
  (select status::text
   from public.contribution_reminder_events
   where obligation_id = '83000000-0000-4000-8000-000000000304'::uuid
     and stage = 'overdue'::public.contribution_reminder_stage_enum),
  'pending',
  'a rejected claim can create the current overdue stage'
);

insert into public.push_tokens (token, profile_id, language)
values (
  'ExponentPushToken[830-review-device]',
  '83000000-0000-4000-8000-000000000103'::uuid,
  'pt'::public.language
);

create temporary table reminder_overdue_claims on commit drop as
select *
from public.claim_contribution_reminder_batches(20, 180);

create temporary table reminder_overdue_prepared on commit drop as
select
  claim.batch_id,
  claim.lease_token,
  prepared.delivery_attempts
from reminder_overdue_claims claim
cross join lateral public.prepare_contribution_reminder_batch(
  claim.batch_id,
  claim.lease_token,
  180
) prepared;

select is(
  (select count(*)::integer from reminder_overdue_prepared),
  1,
  'the next stage can be prepared after a rejected claim'
);

create temporary table reminder_overdue_ticket_inputs on commit drop as
select
  prepared.batch_id,
  prepared.lease_token,
  (attempt ->> 'attempt_id')::uuid as attempt_id
from reminder_overdue_prepared prepared
cross join lateral jsonb_array_elements(prepared.delivery_attempts) attempt;

select is(
  (select public.record_contribution_reminder_tickets(
    ticket.batch_id,
    ticket.lease_token,
    jsonb_build_array(
      jsonb_build_object(
        'attempt_id', ticket.attempt_id,
        'status', 'error',
        'expo_ticket_id', null,
        'error_code', 'DeviceNotRegistered'
      )
    )
  )
  from reminder_overdue_ticket_inputs ticket),
  1,
  'a permanent Expo device error is persisted as a terminal attempt'
);

select is(
  (select count(*)::integer
   from public.push_tokens
   where token = 'ExponentPushToken[830-review-device]'),
  0,
  'DeviceNotRegistered retires the token from future delivery'
);

select is(
  (select status::text
   from public.contribution_reminder_events
   where obligation_id = '83000000-0000-4000-8000-000000000304'::uuid
     and stage = 'overdue'::public.contribution_reminder_stage_enum),
  'exhausted',
  'a permanent device error exhausts the logical event without retrying'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '83000000-0000-4000-8000-000000000101',
  true
);

select throws_ok(
  $$select count(*) from public.contribution_reminder_events$$,
  '42501',
  'permission denied for table contribution_reminder_events',
  'clients cannot read the private reminder outbox'
);

select throws_ok(
  $$select count(*) from public.push_tokens$$,
  '42501',
  'permission denied for table push_tokens',
  'clients cannot read device ownership rows directly'
);

select is(
  public.register_push_token(
    'ExponentPushToken[830-account-switch]',
    'pt'::public.language
  ),
  'registered',
  'authenticated clients register tokens through the command boundary'
);

select set_config(
  'request.jwt.claim.sub',
  '83000000-0000-4000-8000-000000000102',
  true
);

select is(
  public.register_push_token(
    'ExponentPushToken[830-account-switch]',
    'en'::public.language
  ),
  'registered',
  'account switching transfers token ownership through the command boundary'
);

set local role postgres;

select is(
  (select profile_id
   from public.push_tokens
   where token = 'ExponentPushToken[830-account-switch]'),
  '83000000-0000-4000-8000-000000000102'::uuid,
  'the token has one current authenticated owner'
);

set local role authenticated;
select is(
  public.unregister_push_token('ExponentPushToken[830-account-switch]'),
  true,
  'authenticated logout unregisters the active token'
);

select * from finish();
rollback;
