-- =====================================================
-- DEBUG PROFILE CREATION ISSUES
-- =====================================================
-- Script untuk debug masalah pembuatan profile
-- =====================================================

-- 1. Cek apakah trigger auto-create profile aktif
SELECT 
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 2. Cek function handle_new_user
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- 3. Cek user terbaru di auth.users
SELECT 
  id,
  email,
  created_at,
  raw_user_meta_data
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- 4. Cek profile terbaru di profiles
SELECT 
  id,
  email,
  nama_lengkap,
  role,
  created_at
FROM public.profiles 
ORDER BY created_at DESC 
LIMIT 5;

-- 5. Cek user yang ada di auth tapi tidak ada profilenya
SELECT 
  u.id,
  u.email,
  u.created_at,
  'MISSING PROFILE' as status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;

-- 6. Manual create profile untuk user yang missing (jika ada)
-- Uncomment dan ganti UUID jika diperlukan:
/*
INSERT INTO public.profiles (id, email, nama_lengkap, role, created_at, updated_at)
SELECT 
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'nama_lengkap',
    u.raw_user_meta_data->>'full_name',
    split_part(u.email, '@', 1)
  ) as nama_lengkap,
  'member' as role,
  u.created_at,
  NOW() as updated_at
FROM auth.users u
WHERE u.id = 'USER_UUID_DISINI'
AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = u.id);
*/

-- 7. Test RLS policies untuk profiles
SELECT 
  'Can read profiles:' as test,
  COUNT(*) as count
FROM public.profiles;

SELECT 
  'Current user info:' as test,
  auth.uid() as user_id,
  (SELECT role FROM public.profiles WHERE id = auth.uid()) as role;

-- =====================================================
-- HASIL YANG DIHARAPKAN:
-- =====================================================
-- 1. Trigger on_auth_user_created harus ada dan aktif
-- 2. Function handle_new_user harus ada
-- 3. Tidak boleh ada user di auth.users tanpa profile
-- 4. RLS policies harus bisa baca profiles
-- =====================================================