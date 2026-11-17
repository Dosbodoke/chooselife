begin;

select * from no_plan();

-- Every row inserted into public.notifications fires the push-notification
-- Edge Function, and a row with no user_id is a broadcast to every device.
-- Clients therefore must not write the table at all: notifications are created
-- by security-definer functions and by server code holding the service role.
--
-- Clients may read broadcasts, which every device receives anyway, and the
-- notifications addressed to them, never someone else's.

set local role postgres;

-- pg_net dispatches after COMMIT and this test rolls back, but keep the rows
-- below from even queueing a request.
delete from vault.secrets where name in ('project_url', 'notifications_webhook_key');

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
  jsonb_build_object('full_name', persona.display_name),
  timezone('utc'::text, now()),
  timezone('utc'::text, now())
from (
  values
    ('86000000-0000-4000-8000-000000000101'::uuid, 'notified-recipient@example.com', 'Notified Recipient'),
    ('86000000-0000-4000-8000-000000000102'::uuid, 'notified-stranger@example.com', 'Notified Stranger')
) as persona(id, email, display_name);

insert into public.profiles (id, name, username)
select persona.id, persona.display_name, persona.handle
from (
  values
    ('86000000-0000-4000-8000-000000000101'::uuid, 'Notified Recipient', '@notified_recipient'),
    ('86000000-0000-4000-8000-000000000102'::uuid, 'Notified Stranger', '@notified_stranger')
) as persona(id, display_name, handle)
on conflict (id) do update
set name = excluded.name,
    username = excluded.username;

create temporary table access_notifications on commit drop as
with inserted as (
  insert into public.notifications (user_id, title, body)
  values
    (null, '{"pt":"Para todos","en":"For everyone"}', null),
    ('86000000-0000-4000-8000-000000000101', '{"pt":"Só para você","en":"Just for you"}', null)
  returning id, user_id
)
select id, user_id from inserted;
grant select on access_notifications to anon, authenticated;

-- Anonymous callers.
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$insert into public.notifications (user_id, title, body)
    values (null, '{"pt":"Falso","en":"Fake"}', null)$$,
  '42501',
  'permission denied for table notifications',
  'anonymous callers cannot broadcast a push'
);

select throws_ok(
  $$insert into public.notifications (user_id, title, body)
    values ('86000000-0000-4000-8000-000000000101', '{"pt":"Falso","en":"Fake"}', null)$$,
  '42501',
  'permission denied for table notifications',
  'anonymous callers cannot push to one person'
);

select results_eq(
  $$select n.id from public.notifications n
    where n.id in (select id from access_notifications) order by n.id$$,
  $$select id from access_notifications where user_id is null order by id$$,
  'anonymous callers read broadcasts only'
);

-- A signed-in stranger.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000102', true);

select throws_ok(
  $$insert into public.notifications (user_id, title, body)
    values (null, '{"pt":"Falso","en":"Fake"}', null)$$,
  '42501',
  'permission denied for table notifications',
  'signed-in clients cannot broadcast a push'
);

select throws_ok(
  $$update public.notifications set title = '{"pt":"Falso","en":"Fake"}'$$,
  '42501',
  'permission denied for table notifications',
  'signed-in clients cannot rewrite notifications'
);

select throws_ok(
  $$delete from public.notifications$$,
  '42501',
  'permission denied for table notifications',
  'signed-in clients cannot delete notifications'
);

select results_eq(
  $$select n.id from public.notifications n
    where n.id in (select id from access_notifications) order by n.id$$,
  $$select id from access_notifications where user_id is null order by id$$,
  'a signed-in stranger cannot read someone else''s notification'
);

-- The recipient.
select set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000101', true);

select results_eq(
  $$select n.id from public.notifications n
    where n.id in (select id from access_notifications) order by n.id$$,
  $$select id from access_notifications order by id$$,
  'the recipient reads broadcasts and their own notification'
);

select * from finish();

rollback;
