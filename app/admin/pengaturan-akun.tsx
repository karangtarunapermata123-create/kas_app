import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAccentColor } from '@/hooks/use-accent-color';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAdmin } from '@/lib/admin/admin-context';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PengaturanAkunScreen() {
  const { isAdmin, isSuperAdmin, signOut, session, namaLengkap, setNamaLengkap } = useAdmin();
  const { accentColor } = useAccentColor();
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'muted');
  const borderColor = useThemeColor({}, 'border');
  const dangerColor = useThemeColor({}, 'danger');

  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const [changePwVisible, setChangePwVisible] = useState(false);
  const [editNamaVisible, setEditNamaVisible] = useState(false);
  const [editNamaValue, setEditNamaValue] = useState('');
  const [savingNama, setSavingNama] = useState(false);
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);

  const onSignOut = () => setLogoutConfirmVisible(true);

  const onChangePassword = async () => {
    if (!session?.user?.email) {
      Alert.alert('Gagal', 'Session tidak ditemukan. Silakan login ulang.');
      return;
    }
    const current = oldPass.trim();
    const next = newPass.trim();
    const confirm = newPass2.trim();
    if (!current || !next || !confirm) return Alert.alert('Validasi', 'Semua kolom password wajib diisi.');
    if (next.length < 6) return Alert.alert('Validasi', 'Password baru minimal 6 karakter.');
    if (next !== confirm) return Alert.alert('Validasi', 'Konfirmasi password tidak cocok.');
    if (current === next) return Alert.alert('Validasi', 'Password baru tidak boleh sama dengan password lama.');
    setChangingPw(true);
    void supabase.auth.updateUser({ password: next });
    setChangingPw(false);
    setOldPass(''); setNewPass(''); setNewPass2('');
    signOut().catch(() => {});
  };

  const closeChangePw = () => {
    setChangePwVisible(false);
    setOldPass(''); setNewPass(''); setNewPass2('');
  };

  const onSaveNama = async () => {
    const nama = editNamaValue.trim();
    if (!nama) return Alert.alert('Validasi', 'Nama tidak boleh kosong.');
    const isProperCase = nama.split(' ').every(w => w.length === 0 || w[0] === w[0].toUpperCase());
    if (!isProperCase) return Alert.alert('Validasi', 'Nama harus diawali huruf kapital di setiap kata.');
    setSavingNama(true);
    try {
      const { error } = await supabase.from('profiles').upsert({ id: session?.user?.id, nama_lengkap: nama });
      if (error) throw new Error(error.message);
      setNamaLengkap(nama);
      setEditNamaVisible(false);
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
    } finally {
      setSavingNama(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <Ionicons name="chevron-back" size={24} color={tintColor} />
          <ThemedText style={{ color: tintColor, fontSize: 16 }}>Kembali</ThemedText>
        </Pressable>
        <View style={styles.headerCenter}>
          <ThemedText type="defaultSemiBold" style={styles.headerTitle}>Pengaturan Akun</ThemedText>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Info Akun */}
        <ThemedView type="card" style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.avatarBox, { backgroundColor: accentColor + '20' }]}>
              <Ionicons name="person" size={24} color={accentColor} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold" numberOfLines={1}>{namaLengkap ?? session?.user?.email}</ThemedText>
              <ThemedText type="muted" numberOfLines={1} style={{ fontSize: 12 }}>{session?.user?.email}</ThemedText>
            </View>
            <View style={[styles.roleBadge, { backgroundColor: isSuperAdmin ? '#ff6b35' + '20' : isAdmin ? accentColor + '20' : 'rgba(127,127,127,0.1)' }]}>
              <ThemedText style={{ fontSize: 11, color: isSuperAdmin ? '#ff6b35' : isAdmin ? accentColor : mutedColor, fontWeight: '600' }}>
                {isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Member'}
              </ThemedText>
            </View>
          </View>
        </ThemedView>

        {/* Aksi */}
        <ThemedView type="card" style={[styles.card, { gap: 0 }]}>
          <Pressable
            onPress={() => { setEditNamaValue(namaLengkap ?? ''); setEditNamaVisible(true); }}
            style={({ pressed }) => [styles.menuRow, { borderBottomColor: borderColor }, pressed && { opacity: 0.6 }]}>
            <View style={[styles.menuIcon, { backgroundColor: tintColor + '15' }]}>
              <Ionicons name="person-outline" size={18} color={tintColor} />
            </View>
            <ThemedText style={styles.menuLabel}>Edit Nama</ThemedText>
            <Ionicons name="chevron-forward" size={18} color={mutedColor} />
          </Pressable>
          <Pressable
            onPress={() => setChangePwVisible(true)}
            style={({ pressed }) => [styles.menuRow, { borderBottomColor: borderColor }, pressed && { opacity: 0.6 }]}>
            <View style={[styles.menuIcon, { backgroundColor: tintColor + '15' }]}>
              <Ionicons name="key-outline" size={18} color={tintColor} />
            </View>
            <ThemedText style={styles.menuLabel}>Ganti Password</ThemedText>
            <Ionicons name="chevron-forward" size={18} color={mutedColor} />
          </Pressable>
          <Pressable
            onPress={onSignOut}
            style={({ pressed }) => [styles.menuRow, { borderBottomWidth: 0 }, pressed && { opacity: 0.6 }]}>
            <View style={[styles.menuIcon, { backgroundColor: dangerColor + '15' }]}>
              <Ionicons name="log-out-outline" size={18} color={dangerColor} />
            </View>
            <ThemedText style={[styles.menuLabel, { color: dangerColor }]}>Keluar</ThemedText>
            <Ionicons name="chevron-forward" size={18} color={dangerColor} />
          </Pressable>
        </ThemedView>
      </ScrollView>

      {/* Modal Edit Nama */}
      <Modal visible={editNamaVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setEditNamaVisible(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalWrap}>
            <ThemedView type="card" style={styles.modalCard}>
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={[styles.modalIcon, { backgroundColor: tintColor + '15' }]}>
                  <Ionicons name="person-outline" size={28} color={tintColor} />
                </View>
                <ThemedText type="defaultSemiBold" style={styles.modalTitle}>Edit Nama</ThemedText>
                <ThemedText type="muted" style={styles.modalSub}>Gunakan nama asli dengan huruf kapital di awal setiap kata.</ThemedText>
              </View>
              <TextInput
                value={editNamaValue}
                onChangeText={setEditNamaValue}
                placeholder="Contoh: Budi Santoso"
                placeholderTextColor={mutedColor}
                autoCapitalize="words"
                style={[styles.input, { color: textColor, borderColor, marginBottom: 20 }]}
              />
              <View style={styles.btnRow}>
                <Pressable
                  onPress={() => setEditNamaVisible(false)}
                  style={({ pressed }) => [styles.btn, { flex: 1, borderWidth: 1, borderColor, backgroundColor: 'transparent' }, pressed && { opacity: 0.8 }]}>
                  <ThemedText type="defaultSemiBold" style={{ color: textColor }}>Batal</ThemedText>
                </Pressable>
                <Pressable
                  onPress={onSaveNama}
                  disabled={savingNama}
                  style={({ pressed }) => [styles.btn, { flex: 1, backgroundColor: tintColor }, (pressed || savingNama) && { opacity: 0.8 }]}>
                  <ThemedText type="defaultSemiBold" style={styles.btnTextWhite}>
                    {savingNama ? 'Menyimpan...' : 'Simpan'}
                  </ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal Ganti Password */}
      <Modal visible={changePwVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeChangePw} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalWrap}>
            <ThemedView type="card" style={styles.modalCard}>
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={[styles.modalIcon, { backgroundColor: tintColor + '15' }]}>
                  <Ionicons name="key-outline" size={28} color={tintColor} />
                </View>
                <ThemedText type="defaultSemiBold" style={styles.modalTitle}>Ganti Password</ThemedText>
                <ThemedText type="muted" style={[styles.modalSub, { textAlign: 'center' }]}>
                  Masukkan password saat ini dan password baru. Anda akan otomatis keluar setelah berhasil.
                </ThemedText>
              </View>
              <View style={{ gap: 12, marginBottom: 24 }}>
                <View>
                  <ThemedText type="defaultSemiBold" style={styles.inputLabel}>Password Saat Ini</ThemedText>
                  <TextInput value={oldPass} onChangeText={setOldPass} placeholder="••••••••"
                    placeholderTextColor={mutedColor} secureTextEntry autoCapitalize="none"
                    style={[styles.input, { color: textColor, borderColor, marginBottom: 0 }]} />
                </View>
                <View>
                  <ThemedText type="defaultSemiBold" style={styles.inputLabel}>Password Baru</ThemedText>
                  <TextInput value={newPass} onChangeText={setNewPass} placeholder="Minimal 6 karakter"
                    placeholderTextColor={mutedColor} secureTextEntry autoCapitalize="none"
                    style={[styles.input, { color: textColor, borderColor, marginBottom: 0 }]} />
                </View>
                <View>
                  <ThemedText type="defaultSemiBold" style={styles.inputLabel}>Konfirmasi Password Baru</ThemedText>
                  <TextInput value={newPass2} onChangeText={setNewPass2} placeholder="Ulangi password baru"
                    placeholderTextColor={mutedColor} secureTextEntry autoCapitalize="none"
                    style={[styles.input, { color: textColor, borderColor, marginBottom: 0 }]} />
                </View>
              </View>
              <View style={styles.btnRow}>
                <Pressable onPress={closeChangePw}
                  style={({ pressed }) => [styles.btn, { flex: 1, borderWidth: 1, borderColor, backgroundColor: 'transparent' }, pressed && { opacity: 0.8 }]}>
                  <ThemedText type="defaultSemiBold" style={{ color: textColor }}>Batal</ThemedText>
                </Pressable>
                <Pressable onPress={onChangePassword} disabled={changingPw}
                  style={({ pressed }) => [styles.btn, { flex: 1, backgroundColor: tintColor }, (pressed || changingPw) && { opacity: 0.8 }]}>
                  <ThemedText type="defaultSemiBold" style={styles.btnTextWhite}>
                    {changingPw ? 'Memproses...' : 'Simpan'}
                  </ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal Konfirmasi Keluar */}
      <Modal visible={logoutConfirmVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setLogoutConfirmVisible(false)} />
          <ThemedView type="card" style={[styles.modalCard, { width: '92%' }]}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={[styles.modalIcon, { backgroundColor: dangerColor + '15' }]}>
                <Ionicons name="log-out-outline" size={28} color={dangerColor} />
              </View>
              <ThemedText type="defaultSemiBold" style={styles.modalTitle}>Keluar</ThemedText>
              <ThemedText type="muted" style={[styles.modalSub, { textAlign: 'center' }]}>
                Apakah Anda yakin ingin keluar?
              </ThemedText>
            </View>
            <View style={styles.btnRow}>
              <Pressable onPress={() => setLogoutConfirmVisible(false)}
                style={({ pressed }) => [styles.btn, { flex: 1, borderWidth: 1, borderColor, backgroundColor: 'transparent' }, pressed && { opacity: 0.8 }]}>
                <ThemedText type="defaultSemiBold" style={{ color: textColor }}>Batal</ThemedText>
              </Pressable>
              <Pressable onPress={() => { setLogoutConfirmVisible(false); signOut().catch(() => {}); }}
                style={({ pressed }) => [styles.btn, { flex: 1, backgroundColor: dangerColor }, pressed && { opacity: 0.85 }]}>
                <ThemedText type="defaultSemiBold" style={styles.btnTextWhite}>Keluar</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRight: { width: 80 },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, gap: 4, width: 80 },
  headerTitle: { fontSize: 17, textAlign: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },
  card: {
    padding: 16, borderRadius: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
  },
  avatarBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1,
  },
  menuIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, fontSize: 15 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 24 },
  modalWrap: { width: '100%', maxWidth: 420 },
  modalCard: { padding: 24, borderRadius: 28, width: '100%' },
  modalIcon: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  modalSub: { fontSize: 13 },
  inputLabel: { fontSize: 13, marginBottom: 6, opacity: 0.8 },
  input: {
    borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, backgroundColor: 'rgba(127,127,127,0.03)',
  },
  btnRow: { flexDirection: 'row', gap: 12 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  btnTextWhite: { color: 'white', fontWeight: '700', fontSize: 15 },
});
