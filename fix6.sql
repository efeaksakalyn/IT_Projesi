-- Konuşma (Conversation) oluşturma yetkisi
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can start conversations" ON public.conversations;
CREATE POLICY "Users can start conversations" ON public.conversations FOR INSERT 
WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- Mesaj gönderme yetkisi
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT 
WITH CHECK (auth.uid() = sender_id);