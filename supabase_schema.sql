-- 1. NÜKLEER TEMİZLİK
DROP TABLE IF EXISTS public.follows, public.purchases, public.cart_items, public.view_logs, 
                   public.messages, public.conversation_participants, public.conversations, 
                   public.comments, public.favorites, public.beats, public.profiles CASCADE;
DROP POLICY IF EXISTS "Enable upload for all users" ON storage.objects;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLO YAPILARI (Ana SQL'den alındı)
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  username text UNIQUE, email text, avatar_url text, bio text,
  is_producer boolean DEFAULT false, is_artist boolean DEFAULT false,
  favorite_genre text, website text, twitter text, instagram text,
  created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.beats (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  producer_id uuid REFERENCES public.profiles(id) NOT NULL,
  title text NOT NULL, cover_url text, audio_url text NOT NULL,
  price decimal(10, 2) NOT NULL CHECK (price >= 0),
  currency text DEFAULT 'TL' CHECK (currency IN ('TL', 'USD', 'EUR')),
  bpm int CHECK (bpm >= 0), key text, genre text, tags text[], 
  description text, plays_count int DEFAULT 0, created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.favorites (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  beat_id uuid REFERENCES public.beats(id) NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, beat_id)
);

CREATE TABLE public.follows (
  follower_id uuid REFERENCES public.profiles(id) NOT NULL,
  following_id uuid REFERENCES public.profiles(id) NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE public.comments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  beat_id uuid REFERENCES public.beats(id) NOT NULL,
  content text NOT NULL, created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.conversations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.conversation_participants (
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  joined_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE public.messages (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES public.profiles(id) NOT NULL,
  content text NOT NULL, is_collab_request boolean DEFAULT false,
  read_at timestamp with time zone, created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.view_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id),
  beat_id uuid REFERENCES public.beats(id) NOT NULL,
  ip_address text, viewed_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.cart_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  beat_id uuid REFERENCES public.beats(id) NOT NULL,
  license_type text DEFAULT 'MP3 Lease',
  price decimal(10, 2) NOT NULL, currency text DEFAULT 'TL',
  created_at timestamp with time zone DEFAULT now(), UNIQUE(user_id, beat_id, license_type)
);

CREATE TABLE public.purchases (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  beat_id uuid REFERENCES public.beats(id) NOT NULL,
  price_paid decimal(10, 2) NOT NULL, currency text DEFAULT 'TL',
  transaction_id text, created_at timestamp with time zone DEFAULT now()
);

-- 3. GÜVENLİK KURALLARI (Fix 3'ün Gücüyle)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS REATE ON LICY "Public profiles";
CREATE POLICY "Public profiles" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS REATE ON LICY "Users update own";
CREATE POLICY "Users update own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS REATE ON LICY "Users insert own";
CREATE POLICY "Users insert own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

ALTER TABLE public.beats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS REATE ON LICY "Public beats";
CREATE POLICY "Public beats" ON public.beats FOR SELECT USING (true);
DROP POLICY IF EXISTS REATE ON LICY "Auth producers insert";
CREATE POLICY "Auth producers insert" ON public.beats FOR INSERT WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS REATE ON LICY "Public favorites";
CREATE POLICY "Public favorites" ON public.favorites FOR SELECT USING (true);
DROP POLICY IF EXISTS REATE ON LICY "Auth toggle favorite";
CREATE POLICY "Auth toggle favorite" ON public.favorites FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS REATE ON LICY "Auth remove favorite";
CREATE POLICY "Auth remove favorite" ON public.favorites FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS REATE ON LICY "Public follows";
CREATE POLICY "Public follows" ON public.follows FOR SELECT USING (true);
DROP POLICY IF EXISTS REATE ON LICY "Auth follow";
CREATE POLICY "Auth follow" ON public.follows FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS REATE ON LICY "Auth unfollow";
CREATE POLICY "Auth unfollow" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS REATE ON LICY "Conv access";
CREATE POLICY "Conv access" ON public.conversations FOR SELECT USING (EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = id AND user_id = auth.uid()));
DROP POLICY IF EXISTS REATE ON LICY "Create conv";
CREATE POLICY "Create conv" ON public.conversations FOR INSERT WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS REATE ON LICY "View participants";
CREATE POLICY "View participants" ON public.conversation_participants FOR SELECT USING (true);
DROP POLICY IF EXISTS REATE ON LICY "Join participants";
CREATE POLICY "Join participants" ON public.conversation_participants FOR INSERT WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS REATE ON LICY "View messages";
CREATE POLICY "View messages" ON public.messages FOR SELECT USING (EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS REATE ON LICY "Send messages";
CREATE POLICY "Send messages" ON public.messages FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()));

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS REATE ON LICY "Manage own cart";
CREATE POLICY "Manage own cart" ON public.cart_items FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS REATE ON LICY "View own purchases";
CREATE POLICY "View own purchases" ON public.purchases FOR SELECT USING (auth.uid() = user_id);

-- 4. STORAGE
DROP POLICY IF EXISTS REATE ON LICY "Enable upload for all";
CREATE POLICY "Enable upload for all" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('beat-files', 'cover-arts'));
DROP POLICY IF EXISTS REATE ON LICY "Public Storage Access";
CREATE POLICY "Public Storage Access" ON storage.objects FOR SELECT USING (true);
