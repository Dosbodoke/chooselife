BEGIN;

-- Create or replace the function to validate locale keys
CREATE OR REPLACE FUNCTION validate_locale_keys(json_data jsonb)
RETURNS boolean AS $$
DECLARE
    locale_key text;
BEGIN
    FOR locale_key IN SELECT jsonb_object_keys(json_data)
    LOOP
        IF NOT (locale_key::language IN (SELECT unnest(enum_range(NULL::language)))) THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Update existing title and body to be wrapped in a JSON object under the "pt" key
UPDATE public.notifications
SET title = jsonb_build_object('pt', title),
    body = jsonb_build_object('pt', body);

-- Alter the columns to ensure they are of type jsonb
ALTER TABLE public.notifications
    ALTER COLUMN title SET DATA TYPE jsonb USING title::jsonb;

ALTER TABLE public.notifications
    ALTER COLUMN body SET DATA TYPE jsonb USING body::jsonb;

-- Add constraints to validate the JSON structure
ALTER TABLE public.notifications
    ADD CONSTRAINT check_title_keys CHECK (validate_locale_keys(title));

ALTER TABLE public.notifications
    ADD CONSTRAINT check_body_keys CHECK (validate_locale_keys(body));

COMMIT;
