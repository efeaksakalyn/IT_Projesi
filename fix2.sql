
DROP POLICY IF EXISTS "Users can insert own purchases" ON public.purchases;
CREATE POLICY "Users can insert own purchases" ON public.purchases 
FOR INSERT WITH CHECK (auth.uid() = user_id);


ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

DROP POLICY IF EXISTS "Auth remove favorite" ON public.favorites;
CREATE POLICY "Auth remove favorite" ON public.favorites FOR DELETE USING (auth.uid() = user_id);