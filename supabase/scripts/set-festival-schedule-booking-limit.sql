-- Set the runtime limit, then run this script against the target database.
-- Existing clients may enforce a lower limit until they receive an app update.
DO $$
DECLARE
  target_limit CONSTANT INTEGER := 2;
BEGIN
  IF target_limit < 1 THEN
    RAISE EXCEPTION 'Festival schedule booking limit must be greater than zero';
  END IF;

  INSERT INTO public.app_config (key, value)
  VALUES ('festival_schedule_booking_limit', to_jsonb(target_limit))
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value;
END;
$$;

SELECT
  key,
  value,
  updated_at
FROM public.app_config
WHERE key = 'festival_schedule_booking_limit';
