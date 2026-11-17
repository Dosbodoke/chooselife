-- Authenticate the notifications webhook with a dedicated secret API key.
--
-- The push-notification Edge Function now rejects callers that do not present
-- one of the project's sb_secret_ keys (GHSA-cx5h-mg45-2544). The webhook
-- reads a key named notifications_webhook from Vault entry
-- 'notifications_webhook_key' and sends it on the apikey header. A key used
-- only here can be rotated without touching any other backend component, and
-- it replaces the legacy service_role JWT, which Supabase retires at the end
-- of 2026.
--
-- Deploy the push-notification function before this migration: it still
-- accepts the legacy bearer token, so pushes keep flowing in between.
-- Create 'notifications_webhook_key' in Vault first, or pushes stop quietly.

SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.dispatch_notification_push()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  project_url_value text;
  webhook_key_value text;
begin
  select
    max(s.decrypted_secret) filter (where s.name = 'project_url'),
    max(s.decrypted_secret) filter (where s.name = 'notifications_webhook_key')
  into project_url_value, webhook_key_value
  from vault.decrypted_secrets s
  where s.name in ('project_url', 'notifications_webhook_key');

  -- A local database has no push delivery credentials. Keep its notifications
  -- usable without making external requests. Hosted deployment checks require
  -- both settings before enabling reminders for testing.
  if nullif(btrim(project_url_value), '') is null
    or nullif(btrim(webhook_key_value), '') is null then
    return new;
  end if;

  perform net.http_post(
    url := rtrim(project_url_value, '/') || '/functions/v1/push-notification',
    body := jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', to_jsonb(new),
      'old_record', null
    ),
    -- notifications_webhook_key is an sb_secret_ key used only by this
    -- webhook. Secret keys go on the apikey header; as a bearer token the
    -- platform would try to parse them as a JWT.
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', webhook_key_value
    ),
    timeout_milliseconds := 10000
  );

  return new;
end;
$function$;

-- Some hosted projects deliver pushes through a Dashboard webhook
-- (supabase_functions.http_request), which stores its bearer token in plain
-- text in the trigger arguments. Replace it with the Vault-backed trigger.
do $migration$
declare
  dashboard_trigger record;
begin
  for dashboard_trigger in
    select t.tgname
    from pg_trigger t
    where t.tgrelid = 'public.notifications'::regclass
      and not t.tgisinternal
      and t.tgfoid = to_regprocedure('supabase_functions.http_request()')
  loop
    execute format(
      'drop trigger %I on public.notifications',
      dashboard_trigger.tgname
    );
  end loop;

  if not exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'public.notifications'::regclass
      and t.tgname = 'notifications_dispatch_push'
  ) then
    create trigger notifications_dispatch_push
      after insert on public.notifications
      for each row execute function private.dispatch_notification_push();
  end if;
end;
$migration$;

-- Nothing reads this entry any more. On stage it held the anon key.
delete from vault.secrets where name = 'service_role_key';
