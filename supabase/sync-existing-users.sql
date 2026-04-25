-- =====================================================
-- SCRIPT UNTUK SYNC USER YANG SUDAH ADA
-- =====================================================
-- Jalankan script ini untuk membuat profile untuk user
-- yang sudah ada di auth.users tapi belum ada di profiles
-- =====================================================

-- Insert profiles untuk user yang belum ada di tabel profiles
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
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- Cek hasil sync
SELECT 
  'Total users di auth.users:' as info,
  COUNT(*) as jumlah
FROM auth.users
UNION ALL
SELECT 
  'Total profiles yang ada:' as info,
  COUNT(*) as jumlah
FROM public.profiles
UNION ALL
SELECT 
  'User tanpa profile:' as info,
  COUNT(*) as jumlah
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- Jika ada user yang perlu dijadikan admin, update manual:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@example.com';