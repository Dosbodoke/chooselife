SELECT cron.unschedule('festival-schedule-reminder-notifications-every-minute')
WHERE EXISTS (
  SELECT 1
  FROM cron.job
  WHERE jobname = 'festival-schedule-reminder-notifications-every-minute'
);

DROP FUNCTION IF EXISTS public.enqueue_festival_schedule_reminder_notifications();
