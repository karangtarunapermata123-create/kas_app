-- =====================================================
-- SCRIPT UNTUK MENAMBAH PROFILE SINGLE USER
-- =====================================================
-- Ganti UUID dan email sesuai dengan user yang ingin ditambahkan
-- =====================================================

-- 1. Cek user yang ada di auth.users tapi belum ada profilenya
SELECT 
  u.id,
  u.email,
  u.created_at,
  CASE WHEN p.id IS NULL THEN 'BELUM ADA PROFILE' ELSE 'SUDAH ADA PROFILE' END as status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- 2. Insert profile untuk user tertentu (ganti UUID dan email)
-- INSERT INTO public.profiles (id, email, nama_lengkap, role, created_at, updated_at)
-- VALUES (
--   'uuid-user-disini',
--   'email@user.com',
--   'Nama Lengkap User',
--   'member',
--   NOW(),
--   NOW()
-- );

-- 3. Atau insert berdasarkan email (lebih mudah)
-- INSERT INTO public.profiles (id, email, nama_lengkap, role, created_at, updated_at)
-- SELECT 
--   u.id,
--   u.email,
--   'Nama Lengkap User' as nama_lengkap,
--   'member' as role,
--   u.created_at,
--   NOW() as updated_at
-- FROM auth.users u
-- WHERE u.email = 'email@user.com'
-- AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = u.id);

-- 4. Set role admin untuk user tertentu
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@example.com';

-- 5. Cek hasil
SELECT 
  p.id,
  p.email,
  p.nama_lengkap,
  p.role,
  p.created_at
FROM public.profiles p
ORDER BY p.created_at DESC;

-- =====================================================
-- CARA PENGGUNAAN:
-- =====================================================
-- 1. Jalankan query #1 untuk lihat user mana yang belum ada profilenya
-- 2. Uncomment dan edit query #2 atau #3 sesuai kebutuhan
-- 3. Jalankan query yang sudah diedit
-- 4. Jika perlu set admin, uncomment dan edit query #4
-- 5. Jalankan query #5 untuk cek hasil
-- =====================================================