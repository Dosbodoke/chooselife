CREATE TABLE IF NOT EXISTS public.trails (
    id bigint primary key generated always as identity,
    name text NOT NULL,
    color text NOT NULL,
    coordinates double precision[][] NOT NULL
);

ALTER TABLE public.trails ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read trails
CREATE POLICY "Allow everyone to read trails"
ON public.trails
FOR SELECT
TO authenticated, anon
USING (true);

-- Allow everyone to create trails
CREATE POLICY "Allow everyone to create trails"
ON public.trails
FOR INSERT
TO authenticated, anon
WITH CHECK (true);
