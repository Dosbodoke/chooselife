-- Set the runtime cooldown, then run this script against the target database.
-- Keep this at zero until clients with the visible countdown have been released.
DO $$
DECLARE
  target_seconds CONSTANT INTEGER := 0;
BEGIN
  IF target_seconds < 0 THEN
    RAISE EXCEPTION 'Festival schedule booking cooldown must not be negative';
  END IF;

  INSERT INTO public.app_config (key, value)
  VALUES ('festival_schedule_booking_cooldown_seconds', to_jsonb(target_seconds))
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value;
END;
$$;

SELECT
  key,
  value,
  updated_at
FROM public.app_config
WHERE key = 'festival_schedule_booking_cooldown_seconds';
