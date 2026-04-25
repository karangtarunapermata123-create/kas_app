-- =====================================================
-- SCRIPT SEDERHANA UNTUK MEMPERBAIKI INFINITE RECURSION
-- =====================================================
-- Jalankan script ini untuk memperbaiki error infinite recursion
-- saat edit nama di profiles
-- =====================================================

-- 1. Buat function helper untuk mengecek admin (mencegah infinite recursion)
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Drop dan recreate policy yang bermasalah untuk profiles
DROP POLICY IF EXISTS "Admin full access profiles" ON public.profiles;

-- 3. Buat policies baru yang tidak menyebabkan recursion
CREATE POLICY "Admin can update all profiles" ON public.profiles
  FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admin can insert profiles" ON public.profiles
  FOR INSERT
  WITH CHECK (public.is_admin() OR auth.uid() IS NULL);

CREATE POLICY "Admin can delete profiles" ON public.profiles
  FOR DELETE
  USING (public.is_admin());

-- 4. Update policy untuk user biasa agar lebih aman
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND 
    -- Pastikan user tidak bisa mengubah role sendiri
    role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- =====================================================
-- SELESAI
-- =====================================================
-- Sekarang edit nama di profiles tidak akan error lagi!
-- Function is_admin() mencegah infinite recursion.
-- =====================================================