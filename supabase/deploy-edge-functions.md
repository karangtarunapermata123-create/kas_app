# Deploy Supabase Edge Functions

## 🚀 Cara Deploy Edge Functions

### **Prasyarat:**
1. Install Supabase CLI: https://supabase.com/docs/guides/cli
2. Login ke Supabase CLI: `supabase login`

### **Deploy Functions:**

```bash
# Deploy create-user function
supabase functions deploy create-user

# Deploy delete-user function  
supabase functions deploy delete-user

# Atau deploy semua sekaligus
supabase functions deploy
```

### **Set Environment Variables:**

Di Supabase Dashboard > Edge Functions > Settings, tambahkan:
- `SUPABASE_URL`: URL project Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (dari Settings > API)

## 🔧 Alternatif: Tanpa Edge Functions

Jika tidak ingin menggunakan Edge Functions, bisa menggunakan client-side approach dengan beberapa keterbatasan:

### **1. Buat User dengan signUp (Recommended)**

```typescript
// Ganti onCreateAccount di kelola-anggota.tsx
const onCreateAccount = async () => {
  const email = newEmail.trim();
  const nama = newNama.trim();
  const pass = newPassword.trim();
  
  if (!email || !nama || !pass) return Alert.alert('Validasi', 'Email, nama, dan password wajib diisi.');
  if (pass.length < 6) return Alert.alert('Validasi', 'Password minimal 6 karakter.');
  
  setCreating(true);
  try {
    // Simpan session admin saat ini
    const { data: { session: adminSession } } = await supabase.auth.getSession();
    
    // Buat user baru (ini akan mengubah session)
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          nama_lengkap: nama
        }
      }
    });
    
    if (error) throw error;
    
    // Restore session admin
    if (adminSession) {
      await supabase.auth.setSession(adminSession);
    }
    
    Alert.alert('Berhasil', `Akun untuk ${nama} berhasil dibuat.`);
    setNewEmail(''); setNewNama(''); setNewPassword('');
    setAddVisible(false);
    fetchMembers();
  } catch (e: any) {
    Alert.alert('Gagal', e?.message ?? 'Terjadi kesalahan.');
  } finally {
    setCreating(false);
  }
};
```

### **2. Disable Delete Function**

Hapus tombol delete atau ganti dengan disable user:

```typescript
// Ganti onDelete dengan disable user
const onDisableUser = async () => {
  if (!deleteTarget) return;
  try {
    // Update profile menjadi disabled
    const { error } = await supabase
      .from('profiles')
      .update({ role: 'disabled' })
      .eq('id', deleteTarget.id);
      
    if (error) throw error;
    
    setDeleteConfirmVisible(false); 
    setDeleteTarget(null);
    fetchMembers();
  } catch (e: any) {
    Alert.alert('Gagal', e?.message ?? 'Terjadi kesalahan.');
  }
};
```

## 📝 Rekomendasi

**Untuk Production:** Deploy Edge Functions (lebih aman dan proper)
**Untuk Development/Testing:** Gunakan alternatif client-side

Edge Functions memberikan keamanan lebih baik karena menggunakan service role key yang tidak exposed ke client.