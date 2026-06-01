REVOKE INSERT, UPDATE, DELETE, TRUNCATE
ON TABLE public.app_config
FROM anon, authenticated;
