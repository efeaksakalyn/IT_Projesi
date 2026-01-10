
DROP POLICY IF EXISTS "Enable upload for all" ON storage.objects;
DROP POLICY IF EXISTS "Public Storage Access" ON storage.objects;
DROP POLICY IF EXISTS "Enable upload for all users" ON storage.objects;


DROP TABLE IF EXISTS 
    public.purchases, 
    public.cart_items, 
    public.view_logs, 
    public.messages, 
    public.conversation_participants, 
    public.conversations, 
    public.follows, 
    public.comments, 
    public.favorites, 
    public.beats, 
    public.profiles 
CASCADE;

