// =====================================================
// ALTERNATIF KODE UNTUK BUAT USER TANPA EDGE FUNCTIONS
// =====================================================
// Ganti function onCreateAccount di app/admin/kelola-anggota.tsx
// dengan kode di bawah ini
// =====================================================

const onCreateAccount = async () => {
  const email = newEmail.trim();
  const nama = newNama.trim();
  const pass = newPassword.trim();
  
  if (!email || !nama || !pass) return Alert.alert('Validasi', 'Email, nama, dan password wajib diisi.');
  if (pass.length < 6) return Alert.alert('Validasi', 'Password minimal 6 karakter.');
  
  const isProperCase = nama.split(' ').every((w: string) => w.length === 0 || w[0] === w[0].toUpperCase());
  if (!isProperCase) return Alert.alert('Validasi', 'Nama harus diawali huruf kapital di setiap kata.');
  
  setCreating(true);
  try {
    // Simpan session admin saat ini
    const { data: { session: adminSession } } = await supabase.auth.getSession();
    
    // Buat user baru menggunakan signUp
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
    
    // Restore session admin (penting!)
    if (adminSession) {
      await supabase.auth.setSession(adminSession);
    }
    
    // Update profile jika perlu (trigger auto-create sudah handle ini)
    if (data.user) {
      await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          email,
          nama_lengkap: nama,
          role: 'member'
        });
    }
    
    Alert.alert('Berhasil', `Akun untuk ${nama} berhasil dibuat.`);
    setNewEmail(''); 
    setNewNama(''); 
    setNewPassword('');
    setAddVisible(false);
    fetchMembers();
  } catch (e: any) {
    Alert.alert('Gagal', e?.message ?? 'Terjadi kesalahan.');
  } finally {
    setCreating(false);
  }
};

// =====================================================
// ALTERNATIF UNTUK DELETE USER (DISABLE INSTEAD)
// =====================================================
// Ganti function onDelete dengan ini:

const onDelete = async () => {
  if (!deleteTarget) return;
  try {
    // Disable user instead of delete (karena tidak bisa delete tanpa service role)
    const { error } = await supabase
      .from('profiles')
      .update({ role: 'disabled' })
      .eq('id', deleteTarget.id);
      
    if (error) throw error;
    
    Alert.alert('Berhasil', `Akun ${deleteTarget.nama_lengkap} telah dinonaktifkan.`);
    setDeleteConfirmVisible(false); 
    setDeleteTarget(null);
    fetchMembers();
  } catch (e: any) {
    Alert.alert('Gagal', e?.message ?? 'Terjadi kesalahan.');
  }
};

// =====================================================
// UPDATE FILTER UNTUK HIDE DISABLED USERS
// =====================================================
// Update fetchMembers untuk tidak menampilkan user disabled:

const fetchMembers = useCallback(async () => {
  setLoading(true);
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, nama_lengkap, role')
      .neq('role', 'disabled') // Hide disabled users
      .order('nama_lengkap', { ascending: true });
    if (!error && data) setMemberAccounts(data as MemberAccount[]);
  } finally {
    setLoading(false);
  }
}, []);

// =====================================================
// CARA PENGGUNAAN:
// =====================================================
// 1. Ganti function onCreateAccount di kelola-anggota.tsx
// 2. Ganti function onDelete di kelola-anggota.tsx  
// 3. Update fetchMembers di kelola-anggota.tsx
// 4. Test buat user baru
// =====================================================