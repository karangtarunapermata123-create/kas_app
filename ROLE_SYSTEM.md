# Sistem Role Aplikasi Kas IRB

## Overview
Aplikasi ini menggunakan sistem role berbasis hierarki dengan 3 tingkatan akses:

## Role Hierarchy

### 1. Super Admin (`super_admin`)
**Akses Penuh - Kontrol Tertinggi**
- ✅ Mengelola buku kas (buat, edit, hapus)
- ✅ Mengubah role anggota (admin ↔ member)
- ✅ Mengelola akun anggota (buat, edit, hapus)
- ✅ Mengelola kegiatan absensi
- ✅ Mengelola undian arisan
- ✅ Akses semua fitur aplikasi

### 2. Admin (`admin`)
**Akses Menengah - Manajemen Operasional**
- ❌ Tidak bisa mengelola buku kas
- ❌ Tidak bisa mengubah role anggota
- ✅ Mengelola akun member (buat, edit, hapus member saja)
- ✅ Mengelola kegiatan absensi
- ✅ Mengelola undian arisan
- ✅ Akses fitur operasional

### 3. Member (`member`)
**Akses Terbatas - Partisipasi Saja**
- ❌ Tidak bisa mengelola apapun
- ✅ Melihat buku kas
- ✅ Scan QR absensi
- ✅ Melihat hasil undian
- ✅ Akses fitur dasar

## Implementasi Teknis

### Database Schema
```sql
-- Enum type untuk role
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'member');

-- Table profiles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  nama_lengkap TEXT,
  role user_role DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Context Provider
```typescript
type Role = 'super_admin' | 'admin' | 'member';

type AdminContextValue = {
  ready: boolean;
  isAdmin: boolean;        // true untuk admin dan super_admin
  isSuperAdmin: boolean;   // true hanya untuk super_admin
  role: Role | null;
  // ... other properties
};
```

### Permission Checks
```typescript
// Contoh penggunaan di komponen
const { isAdmin, isSuperAdmin } = useAdmin();

// Kelola buku kas - hanya super admin
{isSuperAdmin && (
  <Button onPress={() => router.push('/admin/kelola-buku-kas')} />
)}

// Kelola anggota - admin dan super admin
{isAdmin && (
  <Button onPress={() => router.push('/admin/kelola-anggota')} />
)}
```

## Fitur Role Management

### Mengubah Role Anggota
1. **Akses**: Hanya Super Admin
2. **Lokasi**: `/admin/kelola-anggota`
3. **Fitur**:
   - Tombol swap role (admin ↔ member)
   - Modal konfirmasi perubahan role
   - Tidak bisa mengubah role super admin lain
   - Tidak bisa mengubah role diri sendiri

### Pembatasan Akses
- **Kelola Buku Kas**: Halaman menampilkan pesan "Akses Terbatas" untuk non-super admin
- **Kelola Anggota**: Admin hanya bisa edit/hapus member, tidak bisa ubah role
- **FAB Buttons**: Muncul sesuai permission level

## Migration Database

Untuk menambahkan role super_admin ke database yang sudah ada:

```sql
-- 1. Jalankan migration
-- File: supabase/migrations/add_super_admin_role.sql

-- 2. Set super admin pertama (manual)
UPDATE profiles 
SET role = 'super_admin' 
WHERE email = 'your-super-admin@email.com';
```

## UI/UX Changes

### Role Badges
- **Super Admin**: Orange badge dengan ikon shield
- **Admin**: Blue badge dengan ikon shield-checkmark  
- **Member**: Gray badge dengan ikon person

### Button Visibility
- FAB kelola buku kas: Hanya super admin
- FAB kelola anggota: Admin dan super admin
- Tombol ubah role: Hanya super admin

### Access Control Messages
Pesan yang informatif saat akses ditolak:
- "Akses Terbatas - Hanya Super Admin yang dapat mengelola buku kas"
- Ikon dan styling yang konsisten

## Security Considerations

1. **Client-side Protection**: UI elements disembunyikan berdasarkan role
2. **Server-side Validation**: Supabase RLS policies harus ditambahkan
3. **Role Validation**: Setiap API call harus memvalidasi role di backend
4. **Audit Trail**: Pertimbangkan logging untuk perubahan role

## Best Practices

1. **Principle of Least Privilege**: Berikan akses minimum yang diperlukan
2. **Role Separation**: Jangan gabungkan permission yang tidak related
3. **Clear Hierarchy**: Struktur role yang mudah dipahami
4. **Graceful Degradation**: UI tetap berfungsi meski akses terbatas
5. **User Feedback**: Pesan error yang jelas dan helpful

## Future Enhancements

1. **Custom Permissions**: Granular permission per fitur
2. **Role Templates**: Template role untuk organisasi berbeda
3. **Temporary Access**: Role sementara dengan expiry
4. **Audit Logs**: Track semua perubahan role dan akses
5. **Bulk Role Management**: Ubah role multiple users sekaligus