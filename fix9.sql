-- fix9.sql: RLS Policies for Beat Management (Update/Delete)
-- Allow producers to update their own beats (for visibility toggle)
DROP POLICY IF EXISTS "Producers can update own beats" ON public.beats;
CREATE POLICY "Producers can update own beats" ON public.beats
FOR UPDATE USING (auth.uid() = producer_id);

-- Allow producers to delete their own beats
DROP POLICY IF EXISTS "Producers can delete own beats" ON public.beats;
CREATE POLICY "Producers can delete own beats" ON public.beats
FOR DELETE USING (auth.uid() = producer_id);

-- Make sure RLS is enabled on beats
ALTER TABLE public.beats ENABLE ROW LEVEL SECURITY;

-- RELATED TABLES: Allow producers to delete related records of their beats
-- Comments on own beats
DROP POLICY IF EXISTS "Beat owners can delete comments" ON public.comments;
CREATE POLICY "Beat owners can delete comments" ON public.comments
FOR DELETE USING (
    beat_id IN (SELECT id FROM beats WHERE producer_id = auth.uid())
);

-- Favorites on own beats  
DROP POLICY IF EXISTS "Beat owners can delete favorites" ON public.favorites;
CREATE POLICY "Beat owners can delete favorites" ON public.favorites
FOR DELETE USING (
    beat_id IN (SELECT id FROM beats WHERE producer_id = auth.uid())
);

-- Cart items for own beats
DROP POLICY IF EXISTS "Beat owners can delete cart items" ON public.cart_items;
CREATE POLICY "Beat owners can delete cart items" ON public.cart_items
FOR DELETE USING (
    beat_id IN (SELECT id FROM beats WHERE producer_id = auth.uid())
);

-- View logs for own beats (if table exists)
DROP POLICY IF EXISTS "Beat owners can delete view logs" ON public.view_logs;
CREATE POLICY "Beat owners can delete view logs" ON public.view_logs
FOR DELETE USING (
    beat_id IN (SELECT id FROM beats WHERE producer_id = auth.uid())
);

-- STORAGE POLICIES: Allow users to delete their own files
-- beat-files bucket (audio)
DROP POLICY IF EXISTS "Users can delete own audio files" ON storage.objects;
CREATE POLICY "Users can delete own audio files" ON storage.objects
FOR DELETE USING (
    bucket_id = 'beat-files' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- cover-arts bucket (images)
DROP POLICY IF EXISTS "Users can delete own cover files" ON storage.objects;
CREATE POLICY "Users can delete own cover files" ON storage.objects
FOR DELETE USING (
    bucket_id = 'cover-arts' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- SOLD OUT CHECK: Allow anyone to see if a beat has an exclusive license sold
-- This enables the "SOLD OUT" badge to show for all users
DROP POLICY IF EXISTS "Anyone can check exclusive purchases" ON public.purchases;
CREATE POLICY "Anyone can check exclusive purchases" ON public.purchases
FOR SELECT USING (license_type = 'Exclusive');
