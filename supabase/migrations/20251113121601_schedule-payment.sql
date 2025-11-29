-- This migration schedules the 'generate-renewal-payments' Edge Function to run daily.
-- It uses Supabase Vault to securely store your project URL and service role key.

-- 1. Enable necessary extensions.
create extension if not exists pg_cron with schema "extensions";
create extension if not exists pg_net with schema "extensions";
create extension if not exists supabase_vault with schema "vault";

-- 2. Grant necessary permissions.
grant usage on schema cron to postgres;
grant all on all tables in schema cron to postgres;
grant usage on schema net to postgres;

-- IMPORTANT: Store your secrets in the Supabase Vault.
-- See README.md for instructions on how to set up these secrets ('project_url' and 'secret_key').

-- 3. Schedule the function to run daily at midnight UTC.
-- This cron job fetches secrets from the vault to securely call the Edge Function.
select
  cron.schedule(
    'daily-renewal-check',
    '0 0 * * *', -- Every day at midnight UTC.
    $$
    select
      net.http_post(
          url:= (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/generate-renewal-payments',
          headers:=jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')
          ),
          body:='{}'::jsonb
      ) as request_id;
    $$
  );

-- NOTE: To unschedule this job if needed, run the following command:
-- select cron.unschedule('daily-renewal-check');

-- NOTE: To delete the secrets if you unschedule the job (run manually in SQL Editor):
/*
delete from vault.secrets where name = 'project_url';
delete from vault.secrets where name = 'secret_key';
*/
