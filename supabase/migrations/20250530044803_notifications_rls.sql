CREATE POLICY "Anyone can read notifications" 
ON public.notifications 
FOR SELECT 
TO authenticated, anon 
USING (true);

CREATE POLICY "Anyone can insert notifications" 
ON public.notifications 
FOR INSERT 
TO authenticated, anon 
WITH CHECK (true);
