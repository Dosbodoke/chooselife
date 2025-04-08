-- Create `images`, `avatars` and `promo` buckets accepting only `jpeg`, `png` and `webp` images
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'images') THEN
        INSERT INTO storage.buckets (id, name, public, allowed_mime_types) VALUES (gen_random_uuid(), 'images', true, ARRAY['image/jpeg, image/png, image/webp']);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'avatars') THEN
        INSERT INTO storage.buckets (id, name, public, allowed_mime_types) VALUES (gen_random_uuid(), 'avatars', true, ARRAY['image/jpeg, image/png, image/webp']);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'promo') THEN
        INSERT INTO storage.buckets (id, name, public, allowed_mime_types) VALUES (gen_random_uuid(), 'promo', true, ARRAY['image/jpeg, image/png, image/webp']);
    END IF;
END $$;
