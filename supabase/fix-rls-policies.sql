-- =====================================================
-- SCRIPT UNTUK MEMPERBAIKI RLS POLICIES
-- =====================================================
-- Jalankan script ini jika mengalami error "infinite recursion"
-- pada RLS policies yang sudah ada
-- =====================================================

-- Drop semua policies yang bermasalah
DROP POLICY IF EXISTS "Admin full access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can delete profiles" ON public.profiles;

DROP POLICY IF EXISTS "Admin full access events" ON public.events;
DROP POLICY IF EXISTS "Admin full access event_sessions" ON public.event_sessions;
DROP POLICY IF EXISTS "Admin full access attendances" ON public.attendances;
DROP POLICY IF EXISTS "Admin full access absensi_members" ON public.absensi_members;
DROP POLICY IF EXISTS "Admin full access undian_sessions" ON public.undian_sessions;
DROP POLICY IF EXISTS "Admin full access undian_members" ON public.undian_members;
DROP POLICY IF EXISTS "Admin full access undian_results" ON public.undian_results;
DROP POLICY IF EXISTS "Admin full access books" ON public.books;
DROP POLICY IF EXISTS "Admin full access txs" ON public.txs;
DROP POLICY IF EXISTS "Admin full access meta" ON public.meta;

-- Buat function helper untuk mengecek admin (mencegah infinite recursion)
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- PROFILES - RLS policies yang diperbaiki
-- =====================================================

-- User bisa baca semua profiles
CREATE POLICY "Authenticated read profiles" ON public.profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- User bisa update profil sendiri (nama_lengkap saja, tidak bisa ubah role)
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND 
    role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- Admin bisa insert profiles baru
CREATE POLICY "Admin can insert profiles" ON public.profiles
  FOR INSERT
  WITH CHECK (
    public.is_admin() OR
    auth.uid() IS NULL  -- Allow system/trigger to insert
  );

-- Admin bisa update semua profiles (termasuk role)
CREATE POLICY "Admin can update all profiles" ON public.profiles
  FOR UPDATE
  USING (public.is_admin());

-- Admin bisa delete profiles
CREATE POLICY "Admin can delete profiles" ON public.profiles
  FOR DELETE
  USING (public.is_admin());

-- =====================================================
-- TABEL LAIN - RLS policies yang diperbaiki
-- =====================================================

-- Events
CREATE POLICY "Admin full access events" ON public.events
  FOR ALL USING (public.is_admin());

-- Event Sessions
CREATE POLICY "Admin full access event_sessions" ON public.event_sessions
  FOR ALL USING (public.is_admin());

-- Attendances
CREATE POLICY "Admin full access attendances" ON public.attendances
  FOR ALL USING (public.is_admin());

-- Absensi Members
CREATE POLICY "Admin full access absensi_members" ON public.absensi_members
  FOR ALL USING (public.is_admin());

-- Undian Sessions
CREATE POLICY "Admin full access undian_sessions" ON public.undian_sessions
  FOR ALL USING (public.is_admin());

-- Undian Members
CREATE POLICY "Admin full access undian_members" ON public.undian_members
  FOR ALL USING (public.is_admin());

-- Undian Results
CREATE POLICY "Admin full access undian_results" ON public.undian_results
  FOR ALL USING (public.is_admin());

-- Books (Kas)
CREATE POLICY "Admin full access books" ON public.books
  FOR ALL USING (public.is_admin());

-- Txs (Kas)
CREATE POLICY "Admin full access txs" ON public.txs
  FOR ALL USING (public.is_admin());

-- Meta
CREATE POLICY "Admin full access meta" ON public.meta
  FOR ALL USING (public.is_admin());

-- =====================================================
-- SELESAI
-- =====================================================
-- RLS policies sudah diperbaiki!
-- Sekarang edit nama di profiles tidak akan error lagi.
-- =====================================================