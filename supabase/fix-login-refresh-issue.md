# Fix Login Refresh Issue - Buku Kas Tab

## 🐛 Masalah yang Diperbaiki

Setelah login, tab buku kas menampilkan "Buat Buku Kas Pertama" meskipun sudah ada buku kas di database. Buku kas baru muncul setelah refresh halaman.

## 🔍 Root Cause Analysis

1. **KasContext tidak bereaksi terhadap perubahan session**: `KasProvider` hanya load data sekali saat app dimuat, tidak ketika user login/logout
2. **Tidak ada dependency pada session**: Context tidak tahu kapan user login atau logout
3. **Race condition**: Home screen bisa render sebelum data kas selesai dimuat setelah login

## ✅ Solusi yang Diterapkan

### 1. Menambahkan Dependency Session di KasContext

**File**: `lib/kas/kas-context.tsx`

- Import `useAdmin` untuk akses session
- Tambahkan `session` sebagai dependency di useEffect
- Reset state ke empty ketika tidak ada session
- Reload data ketika session berubah (login)
- Tambahkan logging untuk debugging

### 2. Perbaikan Loading State di Home Screen

**File**: `app/(tabs)/index.tsx`

- Tambahkan check `session` selain `ready`
- Show loading state jika tidak ada session atau context belum ready
- Tambahkan logging untuk debugging

## 🔧 Perubahan Detail

### KasContext Changes:
```typescript
// Tambah import
import { useAdmin } from '@/lib/admin/admin-context';

// Dalam KasProvider
const { session } = useAdmin();

// useEffect dengan dependency session
useEffect(() => {
  if (!session) {
    setState(emptyKasStateV2());
    setReady(true);
    return;
  }
  
  // Load data ketika ada session
  // ...
}, [session, setupRealtime]);
```

### Home Screen Changes:
```typescript
// Tambah session check
const { isAdmin, session } = useAdmin();

// Loading condition
if (!ready || !session) {
  return <LoadingScreen />;
}
```

## 🧪 Testing

Untuk menguji perbaikan:

1. **Logout** dari aplikasi
2. **Login** kembali
3. **Perhatikan tab buku kas** - seharusnya langsung menampilkan daftar buku kas yang ada
4. **Tidak perlu refresh** - data harus muncul otomatis

## 📊 Expected Behavior

### Sebelum Perbaikan:
1. Login ✅
2. Tab buku kas menampilkan "Buat Buku Kas Pertama" ❌
3. Refresh halaman ✅
4. Buku kas muncul ✅

### Setelah Perbaikan:
1. Login ✅
2. Tab buku kas langsung menampilkan daftar buku kas ✅
3. Tidak perlu refresh ✅

## 🔍 Debug Logs

Console logs yang ditambahkan untuk monitoring:

```
Session changed in KasProvider: true/false
Loading kas data for session...
Kas data loaded: { booksCount: X, txsCount: Y }
HomeScreen Debug: { ready: true, booksCount: X, txsCount: Y, hasSession: true }
```

## 🚀 Next Steps

1. Test login/logout flow
2. Verify data loads immediately after login
3. Remove debug logs after confirmation
4. Monitor for any performance issues

## 📝 Notes

- Perbaikan ini juga akan membantu dengan masalah serupa di tab lain
- Context sekarang lebih responsive terhadap perubahan auth state
- Loading states lebih konsisten across the app