CREATE TABLE public.push_tokens (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    token text NOT NULL UNIQUE,
    profile_id uuid NULL,
    language public.language NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT push_tokens_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Enable RLS on the push_tokens table and create policies
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all users to read push tokens" ON public.push_tokens
FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Allow all users to insert push tokens" ON public.push_tokens
FOR INSERT
TO authenticated, anon
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update their own push tokens" ON public.push_tokens
FOR UPDATE
TO authenticated
USING ((select auth.uid()) = profile_id)
WITH CHECK ((select auth.uid()) = profile_id);

-- Migrate current existing tokens
INSERT INTO public.push_tokens (token, profile_id)
SELECT expo_push_token, id FROM public.profiles WHERE expo_push_token IS NOT NULL;
