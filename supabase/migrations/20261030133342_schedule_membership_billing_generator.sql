-- ---------------------------------------------------------------------------
-- Schedule the recurring obligation generator.
--
-- The association cutover installed the scheduler contract "paused", meant to
-- be activated at deployment, and 20260826180000 then unscheduled the old
-- jobs because they POSTed to an Edge Function that no longer exists. Nothing
-- ever scheduled the replacement, so no recurring obligation was materialized
-- after admission: a member admitted on 2026-07-20 owed September and October
-- but the Ledger read "up to date" and only projected November's charge.
--
-- The generator is plain SQL, so pg_cron calls it directly: no Edge Function,
-- no Vault secret, no network hop. It is idempotent per schedule and period
-- (payment_obligations_schedule_period_key), creates every period whose
-- availability date has arrived since admission, and leaves earlier periods
-- owed -- so the first run is also the catch-up. It inserts no notification.
--
-- Hourly rather than daily: availability is a local date in each schedule's
-- timezone, and an hourly run bounds the lag after local midnight to an hour
-- whatever the timezone. Minute 17 keeps it off the top-of-hour crowd.
--
-- cron.schedule() upserts by job name, so re-running this file is safe.
-- ---------------------------------------------------------------------------

select cron.schedule(
  'membership-billing-generate-obligations',
  '17 * * * *',
  $$select count(*) from public.generate_membership_billing_obligations()$$
);
