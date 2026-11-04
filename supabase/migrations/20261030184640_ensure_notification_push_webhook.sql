-- Some hosted environments have the Edge Function but no notifications webhook.
-- Keep existing dashboard webhooks, and install one only where it is missing.
-- Resolve credentials from Vault at dispatch time instead of embedding them in
-- trigger arguments or migrations. Local environments may omit Vault settings.

create schema if not exists private;

create or replace function private.dispatch_notification_push()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  project_url_value text;
  service_key_value text;
begin
  select
    max(s.decrypted_secret) filter (where s.name = 'project_url'),
    max(s.decrypted_secret) filter (where s.name = 'service_role_key')
  into project_url_value, service_key_value
  from vault.decrypted_secrets s
  where s.name in ('project_url', 'service_role_key');

  -- A local database has no push delivery credentials. Keep its notifications
  -- usable without making external requests. Hosted deployment checks require
  -- both settings before enabling reminders for testing.
  if nullif(btrim(project_url_value), '') is null
    or nullif(btrim(service_key_value), '') is null then
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
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key_value
    ),
    timeout_milliseconds := 10000
  );

  return new;
end;
$function$;

revoke all on function private.dispatch_notification_push()
  from public, anon, authenticated, service_role;

do $migration$
begin
  if not exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'public.notifications'::regclass
      and not t.tgisinternal
      and (t.tgtype & 4) = 4
      and (
        t.tgfoid = to_regprocedure('supabase_functions.http_request()')
        or t.tgfoid = 'private.dispatch_notification_push()'::regprocedure
      )
  ) then
    create trigger notifications_dispatch_push
      after insert on public.notifications
      for each row execute function private.dispatch_notification_push();
  end if;
end;
$migration$;
