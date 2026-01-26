-- Create app_config table for storing application configuration
-- Used for minimum app version requirements, feature flags, etc.

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE app_config IS 'Application configuration key-value store for app settings like minimum version requirements';

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_app_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER app_config_updated_at
  BEFORE UPDATE ON app_config
  FOR EACH ROW
  EXECUTE FUNCTION update_app_config_updated_at();

-- Insert initial minimum version config
-- Set to current app version (1.3.14) - update this to force updates when needed
INSERT INTO app_config (key, value) VALUES
  ('min_app_version', '{"ios": "1.3.14", "android": "1.3.14"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read app config (needed for version check before auth)
CREATE POLICY "Allow public read access to app_config"
  ON app_config
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only service role can modify app config
-- Admins should use Supabase dashboard or service role to update
