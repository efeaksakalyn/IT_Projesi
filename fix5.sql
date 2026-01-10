-- Transactions tablosu için 'Herkes kendi işlemini kaydedebilir' izni
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Profile bakiyesini güncellemek için izin
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can update own profile balance" ON public.profiles;
CREATE POLICY "Users can update own profile balance" ON public.profiles FOR UPDATE
USING (auth.uid() = id);