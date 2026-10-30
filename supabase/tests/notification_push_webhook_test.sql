begin;

select * from plan(7);

-- pg_net dispatches after COMMIT. This entire test rolls back, so no request
-- reaches an Edge Function or a device, even with Vault configured below.
delete from vault.secrets where name in ('project_url', 'service_role_key');

create temporary table webhook_queue_baseline as
select coalesce(max(id), 0) as request_id from net.http_request_queue;

insert into public.notifications (title, body)
values ('{"pt":"Teste local","en":"Local test"}', null);

select is(
  (select count(*)::integer from net.http_request_queue
   where id > (select request_id from webhook_queue_baseline)),
  0,
  'notifications without delivery configuration make no external request'
);

select ok(
  not has_function_privilege('anon', 'private.dispatch_notification_push()', 'execute'),
  'anonymous clients cannot execute the privileged dispatcher'
);

select ok(
  not has_function_privilege('authenticated', 'private.dispatch_notification_push()', 'execute'),
  'signed-in clients cannot execute the privileged dispatcher directly'
);

select is(
  (select count(*)::integer from pg_trigger
   where tgrelid = 'public.notifications'::regclass
     and not tgisinternal
     and (tgtype & 4) = 4
     and tgfoid in (
       to_regprocedure('supabase_functions.http_request()'),
       'private.dispatch_notification_push()'::regprocedure
     )),
  1,
  'one notification insert has one push delivery hook'
);

select vault.create_secret('https://stage.example.invalid', 'project_url');
select vault.create_secret('local-test-token', 'service_role_key');

create temporary table webhook_notification as
with inserted as (
  insert into public.notifications (title, body)
  values ('{"pt":"Teste local","en":"Local test"}', null)
  returning id
)
select id from inserted;

create temporary table queued_webhook as
select url, headers, convert_from(body, 'UTF8')::jsonb as payload
from net.http_request_queue
where id > (select request_id from webhook_queue_baseline);

select is(
  (select count(*)::integer from queued_webhook),
  1,
  'one notification enqueues exactly one webhook request'
);

select results_eq(
  $$select url, headers->>'Authorization' from queued_webhook$$,
  $$values ('https://stage.example.invalid/functions/v1/push-notification', 'Bearer local-test-token')$$,
  'the webhook uses the environment Vault URL and credential'
);

select results_eq(
  $$select payload->>'type', payload->>'schema', payload->>'table',
           (payload->'record'->>'id')::bigint,
           payload->'old_record' = 'null'::jsonb from queued_webhook$$,
  $$select 'INSERT'::text, 'public'::text, 'notifications'::text, id, true
    from webhook_notification$$,
  'the Edge Function receives the expected database webhook payload'
);

select * from finish();
rollback;
