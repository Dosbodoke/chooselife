-- Personal photos use the existing user-scoped R2 webbings bucket.
-- The existing owner-only UPDATE policy covers changes to this column.
ALTER TABLE public.webbing ADD COLUMN image_path text;
COMMENT ON COLUMN public.webbing.image_path IS
  'Personal photo key in the R2 webbings bucket, including the owner UUID prefix.';
