CREATE OR REPLACE FUNCTION private.dispatch_notification_push()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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

REVOKE ALL ON FUNCTION "private"."dispatch_notification_push"() FROM PUBLIC;
