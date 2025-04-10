DO $$
BEGIN
    ALTER TABLE public.webbing_model
    ADD COLUMN image_url text;
END $$;
