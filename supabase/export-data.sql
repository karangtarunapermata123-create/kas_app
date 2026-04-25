-- =====================================================
-- SCRIPT EXPORT DATA DARI SUPABASE LAMA
-- =====================================================
-- Jalankan query-query ini di SQL Editor Supabase lama
-- untuk mendapatkan data yang akan dimigrasikan
-- =====================================================

-- =====================================================
-- 1. EXPORT PROFILES
-- =====================================================
-- Copy hasil query ini dan simpan untuk import ke Supabase baru
SELECT 
  'INSERT INTO public.profiles (id, email, nama_lengkap, role, created_at, updated_at) VALUES' as header
UNION ALL
SELECT 
  CASE 
    WHEN ROW_NUMBER() OVER (ORDER BY created_at) = 1 THEN ''
    ELSE ','
  END ||
  '(''' || id || ''', ' ||
  COALESCE('''' || email || '''', 'NULL') || ', ' ||
  COALESCE('''' || replace(nama_lengkap, '''', '''''') || '''', 'NULL') || ', ' ||
  COALESCE('''' || role || '''', '''member''') || ', ' ||
  COALESCE('''' || created_at || '''', 'NOW()') || ', ' ||
  COALESCE('''' || updated_at || '''', 'NOW()') || ')'
FROM public.profiles 
ORDER BY created_at;

-- =====================================================
-- 2. EXPORT EVENTS
-- =====================================================
SELECT 
  'INSERT INTO public.events (id, nama, tipe, created_at) VALUES' as header
UNION ALL
SELECT 
  CASE 
    WHEN ROW_NUMBER() OVER (ORDER BY created_at) = 1 THEN ''
    ELSE ','
  END ||
  '(''' || id || ''', ' ||
  '''' || replace(nama, '''', '''''') || ''', ' ||
  '''' || tipe || ''', ' ||
  created_at || ')'
FROM public.events 
ORDER BY created_at;

-- =====================================================
-- 3. EXPORT EVENT_SESSIONS
-- =====================================================
SELECT 
  'INSERT INTO public.event_sessions (id, event_id, label, tanggal, created_at) VALUES' as header
UNION ALL
SELECT 
  CASE 
    WHEN ROW_NUMBER() OVER (ORDER BY created_at) = 1 THEN ''
    ELSE ','
  END ||
  '(''' || id || ''', ' ||
  '''' || event_id || ''', ' ||
  '''' || replace(label, '''', '''''') || ''', ' ||
  '''' || tanggal || ''', ' ||
  created_at || ')'
FROM public.event_sessions 
ORDER BY created_at;

-- =====================================================
-- 4. EXPORT ATTENDANCES
-- =====================================================
SELECT 
  'INSERT INTO public.attendances (id, event_id, session_id, user_id, nama_user, waktu_absen) VALUES' as header
UNION ALL
SELECT 
  CASE 
    WHEN ROW_NUMBER() OVER (ORDER BY waktu_absen) = 1 THEN ''
    ELSE ','
  END ||
  '(''' || id || ''', ' ||
  '''' || event_id || ''', ' ||
  '''' || session_id || ''', ' ||
  '''' || user_id || ''', ' ||
  '''' || replace(nama_user, '''', '''''') || ''', ' ||
  waktu_absen || ')'
FROM public.attendances 
ORDER BY waktu_absen;

-- =====================================================
-- 5. EXPORT ABSENSI_MEMBERS
-- =====================================================
SELECT 
  'INSERT INTO public.absensi_members (user_id) VALUES' as header
UNION ALL
SELECT 
  CASE 
    WHEN ROW_NUMBER() OVER (ORDER BY user_id) = 1 THEN ''
    ELSE ','
  END ||
  '(''' || user_id || ''')'
FROM public.absensi_members 
ORDER BY user_id;

-- =====================================================
-- 6. EXPORT UNDIAN_SESSIONS
-- =====================================================
SELECT 
  'INSERT INTO public.undian_sessions (id, label, tanggal, created_at) VALUES' as header
UNION ALL
SELECT 
  CASE 
    WHEN ROW_NUMBER() OVER (ORDER BY created_at) = 1 THEN ''
    ELSE ','
  END ||
  '(''' || id || ''', ' ||
  '''' || replace(label, '''', '''''') || ''', ' ||
  '''' || tanggal || ''', ' ||
  created_at || ')'
FROM public.undian_sessions 
ORDER BY created_at;

-- =====================================================
-- 7. EXPORT UNDIAN_MEMBERS
-- =====================================================
SELECT 
  'INSERT INTO public.undian_members (id, session_id, user_id, created_at) VALUES' as header
UNION ALL
SELECT 
  CASE 
    WHEN ROW_NUMBER() OVER (ORDER BY created_at) = 1 THEN ''
    ELSE ','
  END ||
  '(''' || id || ''', ' ||
  '''' || session_id || ''', ' ||
  '''' || user_id || ''', ' ||
  created_at || ')'
FROM public.undian_members 
ORDER BY created_at;

-- =====================================================
-- 8. EXPORT UNDIAN_RESULTS
-- =====================================================
SELECT 
  'INSERT INTO public.undian_results (id, session_id, winner_id, winner_name, drawn_at) VALUES' as header
UNION ALL
SELECT 
  CASE 
    WHEN ROW_NUMBER() OVER (ORDER BY drawn_at) = 1 THEN ''
    ELSE ','
  END ||
  '(''' || id || ''', ' ||
  '''' || session_id || ''', ' ||
  '''' || winner_id || ''', ' ||
  '''' || replace(winner_name, '''', '''''') || ''', ' ||
  drawn_at || ')'
FROM public.undian_results 
ORDER BY drawn_at;

-- =====================================================
-- 9. EXPORT BOOKS (Buku Kas)
-- =====================================================
SELECT 
  'INSERT INTO public.books (id, nama, tipe, period_config, period_rates, members, categories, created_at, updated_at) VALUES' as header
UNION ALL
SELECT 
  CASE 
    WHEN ROW_NUMBER() OVER (ORDER BY created_at) = 1 THEN ''
    ELSE ','
  END ||
  '(''' || id || ''', ' ||
  '''' || replace(nama, '''', '''''') || ''', ' ||
  COALESCE('''' || tipe || '''', '''STANDARD''') || ', ' ||
  COALESCE('''' || replace(period_config::text, '''', '''''') || '''::jsonb', 'NULL') || ', ' ||
  COALESCE('''' || replace(period_rates::text, '''', '''''') || '''::jsonb', 'NULL') || ', ' ||
  COALESCE('''' || replace(members::text, '''', '''''') || '''::jsonb', 'NULL') || ', ' ||
  COALESCE('''' || replace(categories::text, '''', '''''') || '''::jsonb', 'NULL') || ', ' ||
  created_at || ', ' ||
  updated_at || ')'
FROM public.books 
ORDER BY created_at;

-- =====================================================
-- 10. EXPORT TXS (Transaksi Kas)
-- =====================================================
SELECT 
  'INSERT INTO public.txs (id, kas_id, tanggal_iso, jenis, kategori, deskripsi, nominal, periodik_data, created_at, updated_at) VALUES' as header
UNION ALL
SELECT 
  CASE 
    WHEN ROW_NUMBER() OVER (ORDER BY created_at) = 1 THEN ''
    ELSE ','
  END ||
  '(''' || id || ''', ' ||
  '''' || kas_id || ''', ' ||
  '''' || tanggal_iso || ''', ' ||
  '''' || jenis || ''', ' ||
  '''' || replace(kategori, '''', '''''') || ''', ' ||
  '''' || replace(deskripsi, '''', '''''') || ''', ' ||
  nominal || ', ' ||
  COALESCE('''' || replace(periodik_data::text, '''', '''''') || '''::jsonb', 'NULL') || ', ' ||
  created_at || ', ' ||
  updated_at || ')'
FROM public.txs 
ORDER BY created_at;

-- =====================================================
-- 11. EXPORT META (Metadata Aplikasi)
-- =====================================================
SELECT 
  'INSERT INTO public.meta (key, value, created_at, updated_at) VALUES' as header
UNION ALL
SELECT 
  CASE 
    WHEN ROW_NUMBER() OVER (ORDER BY key) = 1 THEN ''
    ELSE ','
  END ||
  '(''' || key || ''', ' ||
  '''' || replace(value, '''', '''''') || ''', ' ||
  COALESCE('''' || created_at || '''', 'NOW()') || ', ' ||
  COALESCE('''' || updated_at || '''', 'NOW()') || ')'
FROM public.meta 
ORDER BY key;

-- =====================================================
-- 12. EXPORT AUTH USERS (untuk referensi)
-- =====================================================
-- Query ini untuk melihat daftar user yang perlu dibuat ulang
-- di Supabase baru (authentication tidak bisa dimigrasikan otomatis)
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users 
ORDER BY created_at;

-- =====================================================
-- CARA PENGGUNAAN:
-- =====================================================
-- 1. Jalankan setiap query di atas satu per satu
-- 2. Copy hasil query dan simpan sebagai file .sql
-- 3. Jalankan file .sql tersebut di Supabase baru
-- 4. Pastikan urutan import sesuai dengan dependency:
--    - profiles (pertama)
--    - events
--    - event_sessions
--    - attendances
--    - absensi_members
--    - undian_sessions
--    - undian_members
--    - undian_results
--    - books
--    - txs
--    - meta (terakhir)
-- =====================================================