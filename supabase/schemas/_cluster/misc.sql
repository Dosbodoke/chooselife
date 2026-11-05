SELECT cron.schedule_in_database('festival-companion-notifications-every-minute', '* * * * *', '
  SELECT public.enqueue_festival_companion_notifications();
  ', 'postgres', NULL, true);

SELECT cron.schedule_in_database('festival-schedule-open-notifications-every-30-minutes', '*/30 * * * *', '
  SELECT public.enqueue_festival_schedule_open_notifications();
  ', 'postgres', NULL, true);

SELECT cron.schedule_in_database('festival-schedule-reconcile-every-minute', '* * * * *', '
  SELECT public.reconcile_festival_schedule();
  ', 'postgres', NULL, true);

SELECT
  cron.schedule_in_database('membership-billing-generate-obligations', '17 * * * *', 'select count(*) from public.generate_membership_billing_obligations()', 'postgres', NULL,
  true);
