# Generate Renewal Payments Function

This Edge Function is responsible for generating renewal payments for active subscriptions.

## Logic

1.  It queries for `active` subscriptions where the `current_period_end` is within the next 7 days.
2.  For each subscription, it checks if a `pending` renewal payment already exists.
3.  If no pending payment exists, it fetches the correct price from the `organizations` table based on the subscription's `plan_type` (monthly or annual).
4.  It then creates a new `payments` record with a `status` of `pending`.

## Deployment

Deploy the function using the Supabase CLI:

```bash
supabase functions deploy generate-renewal-payments --project-ref <your-project-ref>
```

## Scheduling

This function is designed to be run on a schedule (e.g., daily) using `pg_cron`.

After deploying the function, create a new SQL migration in your `supabase/migrations` folder to set up the cron job.

The migration should contain the following SQL:

```sql
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
-- You must run the following commands manually in the Supabase SQL Editor once.
-- Replace the placeholder values with your actual project reference and service role key.
-- Do NOT commit your secrets to this migration file.

/*
-- Run this in your Supabase SQL Editor:
select vault.create_secret('https://<your-project-ref>.supabase.co', 'project_url', 'URL for the Supabase project');
select vault.create_secret('<your-service-role-key>', 'service_role_key', 'Supabase service role key');
*/

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
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
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
delete from vault.secrets where name = 'service_role_key';
*/
```
