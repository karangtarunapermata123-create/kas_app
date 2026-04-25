# Panduan Migrasi Supabase

## Langkah-langkah Migrasi

### 1. Persiapan Supabase Baru

1. **Buat project Supabase baru**
   - Login ke [supabase.com](https://supabase.com)
   - Buat project baru
   - Catat URL dan anon key yang baru

2. **Jalankan schema SQL**
   - Buka SQL Editor di dashboard Supabase baru
   - Copy paste isi file `full-schema.sql`
   - Jalankan script tersebut

3. **Sync existing users (jika ada)**
   - Jika sudah ada user di Authentication tapi belum ada di tabel profiles
   - Jalankan script `sync-existing-users.sql`
   - Set role admin untuk user yang diperlukan

4. **Perbaiki tabel events (jika migrasi dari schema lama)**
   - Jika ada error "could not find created_by column"
   - Jalankan script `fix-events-table.sql`
   - Script ini akan menambahkan kolom yang hilang

### 3. Export Data dari Supabase Lama

Jalankan query berikut di SQL Editor Supabase lama untuk export data:

#### Export Profiles
```sql
-- Copy hasil query ini dan simpan sebagai CSV atau JSON
SELECT * FROM public.profiles ORDER BY created_at;
```

#### Export Events
```sql
SELECT * FROM public.events ORDER BY created_at;
```

#### Export Event Sessions
```sql
SELECT * FROM public.event_sessions ORDER BY created_at;
```

#### Export Attendances
```sql
SELECT * FROM public.attendances ORDER BY waktu_absen;
```

#### Export Absensi Members
```sql
SELECT * FROM public.absensi_members;
```

#### Export Undian Sessions
```sql
SELECT * FROM public.undian_sessions ORDER BY created_at;
```

#### Export Undian Members
```sql
SELECT * FROM public.undian_members ORDER BY created_at;
```

#### Export Undian Results
```sql
SELECT * FROM public.undian_results ORDER BY drawn_at;
```

#### Export Kas Records (jika ada)
```sql
SELECT * FROM public.books ORDER BY created_at;
```

#### Export Kas Transactions
```sql
SELECT * FROM public.txs ORDER BY created_at;
```

#### Export Meta
```sql
SELECT * FROM public.meta ORDER BY key;
```

### 4. Import Data ke Supabase Baru

#### Cara 1: Menggunakan SQL Insert (Recommended)

Buat file SQL untuk setiap tabel dengan format:

```sql
-- Contoh untuk profiles
INSERT INTO public.profiles (id, email, nama_lengkap, role, created_at, updated_at) VALUES
('uuid-1', 'admin@example.com', 'Admin User', 'admin', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00'),
('uuid-2', 'user@example.com', 'Regular User', 'member', '2024-01-01 00:00:00+00', '2024-01-01 00:00:00+00');
```

#### Cara 2: Menggunakan CSV Import

1. Export data sebagai CSV dari Supabase lama
2. Di Supabase baru, buka Table Editor
3. Pilih tabel yang ingin diimport
4. Klik "Insert" > "Import data from CSV"
5. Upload file CSV

### 5. Migrasi Users Authentication

**PENTING**: User authentication tidak bisa dimigrasikan otomatis. Ada beberapa opsi:

#### Opsi A: Reset Password Semua User
1. Export daftar email user dari `auth.users`
2. Di Supabase baru, invite semua user via email
3. User akan mendapat email untuk set password baru

#### Opsi B: Buat User Manual (untuk jumlah user sedikit)
1. Di dashboard Supabase baru, buka Authentication > Users
2. Klik "Add user" untuk setiap user
3. Masukkan email dan password sementara
4. Minta user untuk ganti password

### 6. Update Environment Variables

Update file `.env` dengan credentials Supabase baru:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-new-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-new-anon-key
```

### 7. Testing Setelah Migrasi

1. **Test Authentication**
   - Login dengan akun admin
   - Test registrasi user baru

2. **Test Fitur Absensi**
   - Buat event baru
   - Tambah sesi absensi
   - Test absen masuk/keluar

3. **Test Fitur Undian**
   - Buat sesi undian baru
   - Tambah anggota undian
   - Test jalankan undian

4. **Test Fitur Kas** (jika ada)
   - Tambah catatan kas masuk/keluar
   - Test laporan kas

### 8. Checklist Migrasi

- [ ] Schema SQL berhasil dijalankan
- [ ] Data profiles berhasil dimigrasikan
- [ ] Data events berhasil dimigrasikan
- [ ] Data event_sessions berhasil dimigrasikan
- [ ] Data attendances berhasil dimigrasikan
- [ ] Data absensi_members berhasil dimigrasikan
- [ ] Data undian berhasil dimigrasikan
- [ ] Data kas (books, txs, meta) berhasil dimigrasikan
- [ ] Users authentication berhasil dimigrasikan
- [ ] Environment variables sudah diupdate
- [ ] App berhasil connect ke Supabase baru
- [ ] Semua fitur berfungsi normal
- [ ] RLS policies berfungsi dengan benar

### 9. Troubleshooting

#### Error: "relation does not exist"
- Pastikan schema SQL sudah dijalankan dengan benar
- Check apakah semua tabel sudah terbuat

#### Error: "RLS policy violation"
- Pastikan user admin sudah ada di tabel profiles
- Check role user sudah diset ke 'admin'

#### Error: "could not find created_by column"
- Jalankan script `fix-events-table.sql` untuk menambahkan kolom yang hilang
- Error ini terjadi karena tabel events tidak memiliki semua kolom yang dibutuhkan
- Script akan menambahkan: deskripsi, period_type, created_by, updated_at

#### Error: "infinite recursion detected in policy"
- Jalankan script `fix-rls-policies.sql` untuk memperbaiki RLS policies
- Error ini terjadi karena policy admin mengecek tabel profiles dalam loop
- Script akan membuat function helper `is_admin()` untuk mencegah recursion

#### User tidak muncul di tabel profiles
- Jalankan script `sync-existing-users.sql` untuk sync user yang sudah ada
- Pastikan trigger `on_auth_user_created` sudah aktif untuk user baru
- Manual insert jika diperlukan:
```sql
INSERT INTO public.profiles (id, email, nama_lengkap, role) 
VALUES ('user-uuid', 'user@email.com', 'Nama User', 'member');
```
- Import data dengan urutan yang benar:
  1. profiles
  2. events
  3. event_sessions
  4. attendances
  5. absensi_members
  6. undian_sessions
  7. undian_members
  8. undian_results
  9. books (kas)
  10. txs (kas)
  11. meta

#### Error: "Foreign key constraint"
- Pastikan URL dan anon key sudah benar
- Restart development server
- Clear cache aplikasi

#### App tidak bisa connect

**Sebelum migrasi:**
- Backup semua data dari Supabase lama
- Simpan credentials Supabase lama
- Test migrasi di environment development dulu

**Jika ada masalah:**
- Kembalikan environment variables ke Supabase lama
- Restart aplikasi
- Investigasi masalah di Supabase baru

### 10. Backup & Rollback Plan

### 11. Post-Migration
   - Check response time query
   - Monitor usage dashboard

1. **Monitor performa**
   - Update credentials di dokumentasi tim
   - Update deployment scripts

3. **Hapus Supabase lama** (setelah yakin migrasi berhasil)
   - Tunggu minimal 1-2 minggu
   - Pastikan semua fitur berjalan normal
   - Backup final sebelum hapus