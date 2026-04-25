-- =====================================================
-- SCRIPT DEBUG AKSES KAS
-- =====================================================
-- Jalankan script ini untuk debug masalah akses data kas
-- =====================================================

-- 1. Cek data di tabel books
SELECT 'books' as tabel, COUNT(*) as jumlah FROM public.books;

-- 2. Cek data di tabel txs  
SELECT 'txs' as tabel, COUNT(*) as jumlah FROM public.txs;

-- 3. Cek data di tabel meta
SELECT 'meta' as tabel, COUNT(*) as jumlah FROM public.meta;

-- 4. Cek user yang sedang login
SELECT 
  'current_user' as info,
  auth.uid() as user_id,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as email,
  (SELECT role FROM public.profiles WHERE id = auth.uid()) as role;

-- 5. Cek apakah user bisa baca tabel books
SELECT 
  'books_access' as test,
  id, nama, tipe, created_at
FROM public.books 
ORDER BY created_at DESC 
LIMIT 5;

-- 6. Cek apakah user bisa baca tabel txs
SELECT 
  'txs_access' as test,
  id, kas_id, jenis, nominal, created_at
FROM public.txs 
ORDER BY created_at DESC 
LIMIT 5;

-- 7. Cek apakah user bisa baca tabel meta
SELECT 
  'meta_access' as test,
  key, value
FROM public.meta;

-- 8. Cek RLS policies untuk books
SELECT 
  schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'books';

-- 9. Cek RLS policies untuk txs
SELECT 
  schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'txs';

-- 10. Cek RLS policies untuk meta
SELECT 
  schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'meta';

-- =====================================================
-- HASIL YANG DIHARAPKAN:
-- =====================================================
-- - books, txs, meta harus ada data jika sudah buat buku kas
-- - current_user harus menunjukkan user yang login
-- - *_access harus bisa menampilkan data (tidak error)
-- - Jika ada error di *_access, berarti masalah RLS policy
-- =====================================================