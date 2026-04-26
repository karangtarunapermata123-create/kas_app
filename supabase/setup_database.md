# Database Setup Guide

## Langkah-langkah Setup Database

### 1. Jalankan Initial Schema
Buka **Supabase SQL Editor** dan jalankan file `00_initial_schema.sql`:

```sql
-- Copy dan paste seluruh isi file supabase/migrations/00_initial_schema.sql
-- ke Supabase SQL Editor dan jalankan
```

### 2. Jalankan Migration Super Admin Role
Setelah initial schema berhasil, jalankan file `add_super_admin_role.sql`:

```sql
-- Copy dan paste seluruh isi file supabase/migrations/add_super_admin_role.sql
-- ke Supabase SQL Editor dan jalankan
```

### 3. Jalankan Migration Undian (Opsional)
Jika ingin menggunakan fitur undian, jalankan:

```sql
-- Copy dan paste seluruh isi file supabase/migrations/undian.sql
-- ke Supabase SQL Editor dan jalankan
```

### 4. Jalankan Migration Absensi Members (Opsional)
Jika ingin menggunakan fitur absensi members, jalankan:

```sql
-- Copy dan paste seluruh isi file supabase/migrations/event_members.sql
-- ke Supabase SQL Editor dan jalankan
```

### 5. Buat Super Admin Pertama
Setelah semua migration berhasil, buat super admin pertama:

```sql
-- Ganti email dan password sesuai kebutuhan
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'your-email@domain.com',
  crypt('your-password', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"nama_lengkap":"Super Admin"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);

-- Kemudian update role menjadi super_admin
UPDATE public.profiles 
SET role = 'super_admin' 
WHERE email = 'your-email@domain.com';
```

### 6. Verifikasi Setup
Cek apakah setup berhasil:

```sql
-- Cek enum user_role
SELECT unnest(enum_range(NULL::user_role));

-- Cek tabel profiles
SELECT * FROM public.profiles;

-- Cek RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
```

## Troubleshooting

### Error: type "user_role" does not exist
- Pastikan menjalankan `00_initial_schema.sql` terlebih dahulu
- Jika masih error, jalankan manual:
```sql
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'member');
```

### Error: relation "profiles" does not exist
- Pastikan menjalankan `00_initial_schema.sql` yang membuat tabel profiles
- Cek apakah tabel sudah ada: `SELECT * FROM information_schema.tables WHERE table_name = 'profiles';`

### Error: permission denied
- Pastikan menggunakan service role key atau admin access di Supabase
- Cek RLS policies apakah sudah benar

## Struktur Database Final

Setelah setup selesai, database akan memiliki:

### Tables:
- `profiles` - User profiles dengan role system
- `books` - Buku kas
- `txs` - Transaksi kas
- `events` - Kegiatan absensi
- `event_sessions` - Sesi kegiatan
- `attendances` - Data kehadiran
- `undian_sessions` - Sesi undian (opsional)
- `undian_results` - Hasil undian (opsional)
- `undian_members` - Anggota undian (opsional)
- `absensi_members` - Anggota absensi (opsional)

### Enum Types:
- `user_role` - ('super_admin', 'admin', 'member')

### Functions:
- `handle_new_user()` - Auto-create profile saat user baru register

### Policies:
- RLS policies untuk setiap tabel sesuai role hierarchy