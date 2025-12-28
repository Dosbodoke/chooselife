-- Migration: Add webbing lifetime tracking support
-- Adds strength_class and recommended_lifetime_days to webbing_model
-- Creates function to calculate usage days from rig history

-- Create strength class enum
DO $$ BEGIN
    CREATE TYPE public.strength_class_enum AS ENUM ('A+', 'A', 'B', 'C');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add columns to webbing_model
ALTER TABLE public.webbing_model 
ADD COLUMN IF NOT EXISTS strength_class public.strength_class_enum,
ADD COLUMN IF NOT EXISTS recommended_lifetime_days INTEGER;

-- Update existing models with default values based on material
-- ISA Guidelines: Nylon degrades faster than Polyester
UPDATE public.webbing_model
SET 
  strength_class = 'B',
  recommended_lifetime_days = CASE 
    WHEN material = 'nylon' THEN 360
    WHEN material = 'polyester' THEN 540
    WHEN material = 'dyneema' THEN 720
    ELSE 360
  END
WHERE strength_class IS NULL;

-- Function to calculate webbing usage days from rig history
-- Returns total usage days and rig count
CREATE OR REPLACE FUNCTION get_webbing_usage_days(webbing_id_param BIGINT)
RETURNS TABLE (usage_days INTEGER, rig_count INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(
      GREATEST(1, EXTRACT(DAY FROM (
        COALESCE(rs.unrigged_at, NOW()) - rs.rig_date
      ))::INTEGER + 1)
    ), 0)::INTEGER as usage_days,
    COUNT(rsw.id)::INTEGER as rig_count
  FROM rig_setup_webbing rsw
  JOIN rig_setup rs ON rs.id = rsw.setup_id
  WHERE rsw.webbing_id = webbing_id_param
    AND (rs.is_rigged = true OR rs.unrigged_at IS NOT NULL);
END;
$$ LANGUAGE plpgsql;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION get_webbing_usage_days(BIGINT) TO anon, authenticated, service_role;
