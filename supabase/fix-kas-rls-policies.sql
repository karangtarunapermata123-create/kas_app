-- =====================================================
-- SCRIPT UNTUK MEMPERBAIKI RLS POLICIES TABEL KAS
-- =====================================================
-- Jalankan script ini untuk memperbaiki RLS policies
-- yang menyebabkan masalah akses data kas
-- =====================================================

-- 1. Pastikan function is_admin sudah ada
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Drop dan recreate policies untuk tabel BOOKS
DROP POLICY IF EXISTS "Admin full access books" ON public.books;
DROP POLICY IF EXISTS "Authenticated read books" ON public.books;

CREATE POLICY "Admin full access books" ON public.books
  FOR ALL USING (public.is_admin());

CREATE POLICY "Authenticated read books" ON public.books
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 3. Drop dan recreate policies untuk tabel TXS
DROP POLICY IF EXISTS "Admin full access txs" ON public.txs;
DROP POLICY IF EXISTS "Authenticated read txs" ON public.txs;

CREATE POLICY "Admin full access txs" ON public.txs
  FOR ALL USING (public.is_admin());

CREATE POLICY "Authenticated read txs" ON public.txs
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 4. Drop dan recreate policies untuk tabel META
DROP POLICY IF EXISTS "Admin full access meta" ON public.meta;
DROP POLICY IF EXISTS "Authenticated read meta" ON public.meta;

CREATE POLICY "Admin full access meta" ON public.meta
  FOR ALL USING (public.is_admin());

CREATE POLICY "Authenticated read meta" ON public.meta
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 5. Test akses setelah perbaikan
SELECT 'Test akses books:' as info, COUNT(*) as jumlah FROM public.books;
SELECT 'Test akses txs:' as info, COUNT(*) as jumlah FROM public.txs;
SELECT 'Test akses meta:' as info, COUNT(*) as jumlah FROM public.meta;

-- =====================================================
-- SELESAI
-- =====================================================
-- RLS policies untuk tabel kas sudah diperbaiki!
-- Sekarang data kas seharusnya bisa diakses dengan normal.
-- =====================================================