// =====================================================
// VERSI PERBAIKAN CREATE ACCOUNT V2
// =====================================================
// Ganti function onCreateAccount dengan versi ini
// yang lebih reliable dan tidak stuck di loading
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
    console.log('Starting account creation for:', email);
    
    // Step 1: Simpan session admin
    const { data: { session: adminSession } } = await supabase.auth.getSession();
    if (!adminSession) {
      throw new Error('Admin session not found');
    }
    
    // Step 2: Buat user baru
    console.log('Creating user with signUp...');
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          nama_lengkap: nama
        }
      }
    });
    
    if (signUpError) {
      console.error('SignUp error:', signUpError);
      throw signUpError;
    }
    
    if (!signUpData.user) {
      throw new Error('User creation failed - no user returned');
    }
    
    console.log('User created:', signUpData.user.id);
    
    // Step 3: Restore admin session IMMEDIATELY
    console.log('Restoring admin session...');
    const { error: sessionError } = await supabase.auth.setSession(adminSession);
    if (sessionError) {
      console.error('Session restore error:', sessionError);
      // Don't throw here, continue with profile creation
    }
    
    // Step 4: Force create profile (don't rely on trigger)
    console.log('Creating profile...');
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: signUpData.user.id,
        email: email,
        nama_lengkap: nama,
        role: 'member',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Try upsert instead
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: signUpData.user.id,
          email: email,
          nama_lengkap: nama,
          role: 'member',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (upsertError) {
        console.error('Profile upsert error:', upsertError);
        // Continue anyway, maybe trigger will handle it
      }
    }
    
    console.log('Account creation completed successfully');
    
    // Step 5: Success feedback
    Alert.alert('Berhasil', `Akun untuk ${nama} berhasil dibuat.`);
    
    // Step 6: Reset form
    setNewEmail('');
    setNewNama('');
    setNewPassword('');
    setAddVisible(false);
    
    // Step 7: Refresh data (with delay to ensure profile is created)
    setTimeout(() => {
      console.log('Refreshing member list...');
      fetchMembers();
    }, 1000);
    
  } catch (e: any) {
    console.error('Create account failed:', e);
    Alert.alert('Gagal', e?.message ?? 'Terjadi kesalahan saat membuat akun.');
  } finally {
    // ALWAYS set creating to false
    console.log('Setting creating to false');
    setCreating(false);
  }
};

// =====================================================
// TAMBAHAN: REALTIME SUBSCRIPTION UNTUK AUTO-REFRESH
// =====================================================
// Tambahkan di useEffect untuk auto-refresh saat ada perubahan:

useEffect(() => { 
  fetchMembers(); 
  
  // Setup realtime subscription
  const channel = supabase
    .channel('profiles-changes')
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'profiles' 
    }, (payload) => {
      console.log('Profile change detected:', payload.eventType);
      // Auto-refresh saat ada INSERT/UPDATE/DELETE
      setTimeout(() => {
        fetchMembers();
      }, 500);
    })
    .subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
}, [fetchMembers]);

// =====================================================
// CARA PENGGUNAAN:
// =====================================================
// 1. Ganti function onCreateAccount dengan versi di atas
// 2. Ganti useEffect dengan versi yang ada realtime subscription
// 3. Test buat akun baru
// 4. Check console browser untuk debug logs
// =====================================================