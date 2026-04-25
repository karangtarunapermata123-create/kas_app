import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAccentColor } from '@/hooks/use-accent-color';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAdmin } from '@/lib/admin/admin-context';
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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

type MemberAccount = { id: string; email: string; nama_lengkap: string | null; role: string };

export default function KelolaAnggotaScreen() {
  const { session } = useAdmin();
  const { accentColor } = useAccentColor();
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'muted');
  const borderColor = useThemeColor({}, 'border');
  const dangerColor = useThemeColor({}, 'danger');

  const [memberAccounts, setMemberAccounts] = useState<MemberAccount[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal Buat Akun
  const [addVisible, setAddVisible] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newNama, setNewNama] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);

  // Modal Rename
  const [renameTarget, setRenameTarget] = useState<MemberAccount | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Modal Hapus
  const [deleteTarget, setDeleteTarget] = useState<MemberAccount | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  // Sort
  type SortBy = 'role' | 'nama' | 'email';
  const [sortBy, setSortBy] = useState<SortBy>('role');
  const [sortDropdownVisible, setSortDropdownVisible] = useState(false);

  const SORT_OPTIONS: { key: SortBy; label: string; icon: string }[] = [
    { key: 'role', label: 'Role', icon: 'shield-checkmark-outline' },
    { key: 'nama', label: 'Nama (A–Z)', icon: 'text-outline' },
    { key: 'email', label: 'Email (A–Z)', icon: 'mail-outline' },
  ];

  const sortedMembers = [...memberAccounts].sort((a, b) => {
    if (sortBy === 'role') {
      // admin di atas, lalu sort nama
      if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
      return (a.nama_lengkap ?? '').localeCompare(b.nama_lengkap ?? '');
    }
    if (sortBy === 'nama') return (a.nama_lengkap ?? '').localeCompare(b.nama_lengkap ?? '');
    if (sortBy === 'email') return a.email.localeCompare(b.email);
    return 0;
  });

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, nama_lengkap, role')
        .order('nama_lengkap', { ascending: true });
      if (!error && data) setMemberAccounts(data as MemberAccount[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

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
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!s?.access_token) return Alert.alert('Gagal', 'Session tidak ditemukan.');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${s.access_token}`,
          'apikey': SUPABASE_ANON_KEY ?? '',
        },
        body: JSON.stringify({ email, password: pass, namaLengkap: nama }),
      });
      let json: any = {};
      try { json = await res.json(); } catch {}
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
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

  const onRename = async () => {
    if (!renameTarget) return;
    const nama = renameValue.trim();
    if (!nama) return Alert.alert('Validasi', 'Nama tidak boleh kosong.');
    const isProperCase = nama.split(' ').every((w: string) => w.length === 0 || w[0] === w[0].toUpperCase());
    if (!isProperCase) return Alert.alert('Validasi', 'Nama harus diawali huruf kapital di setiap kata.');
    setRenaming(true);
    try {
      const { error } = await supabase.from('profiles').update({ nama_lengkap: nama }).eq('id', renameTarget.id);
      if (error) throw new Error(error.message);
      setRenameTarget(null); setRenameValue('');
      fetchMembers();
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Terjadi kesalahan.');
    } finally {
      setRenaming(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!s?.access_token) return Alert.alert('Gagal', 'Session tidak ditemukan.');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${s.access_token}`,
          'apikey': SUPABASE_ANON_KEY ?? '',
          'x-client-info': 'supabase-js/2',
        },
        body: JSON.stringify({ userId: deleteTarget.id }),
      });
      let json: any = {};
      try { json = await res.json(); } catch {}
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setDeleteConfirmVisible(false); setDeleteTarget(null);
      fetchMembers();
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Terjadi kesalahan.');
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
          <ThemedText type="defaultSemiBold" style={styles.headerTitle}>Kelola Akun Anggota</ThemedText>
          <ThemedText type="muted" style={styles.headerSub}>
            {loading ? 'Memuat...' : `${memberAccounts.length} akun terdaftar`}
          </ThemedText>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Sort bar — sticky, di luar ScrollView */}
      <View style={[styles.sortBar, { borderBottomColor: borderColor }]}>
        <ThemedText type="muted" style={styles.sortLabel}>Urutkan:</ThemedText>
        <Pressable
          onPress={() => setSortDropdownVisible(true)}
          style={({ pressed }) => [styles.sortTrigger, { borderColor: tintColor + '60', backgroundColor: tintColor + '10' }, pressed && { opacity: 0.7 }]}>
          <Ionicons name={SORT_OPTIONS.find(o => o.key === sortBy)?.icon as any} size={14} color={tintColor} />
          <ThemedText style={[styles.sortTriggerText, { color: tintColor }]}>
            {SORT_OPTIONS.find(o => o.key === sortBy)?.label}
          </ThemedText>
          <Ionicons name="chevron-down" size={14} color={tintColor} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {loading ? (
          <ThemedText type="muted" style={{ textAlign: 'center', paddingVertical: 40 }}>Memuat...</ThemedText>
        ) : memberAccounts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={mutedColor} />
            <ThemedText type="muted" style={{ fontSize: 15, marginTop: 8 }}>Belum ada akun terdaftar</ThemedText>
          </View>
        ) : (
          <View style={styles.list}>
            {sortedMembers.map((m) => (
              <ThemedView key={m.id} type="card" style={[styles.memberCard, { borderColor }]}>
                <View style={[styles.avatar, { backgroundColor: (m.role === 'admin' ? tintColor : accentColor) + '20' }]}>
                  <Ionicons
                    name={m.role === 'admin' ? 'shield-checkmark' : 'person'}
                    size={20}
                    color={m.role === 'admin' ? tintColor : accentColor}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ThemedText type="defaultSemiBold" style={{ fontSize: 15, flexShrink: 1 }} numberOfLines={1}>
                      {m.nama_lengkap ?? '(tanpa nama)'}
                    </ThemedText>
                    <View style={[styles.roleBadge, { backgroundColor: m.role === 'admin' ? tintColor + '20' : 'rgba(127,127,127,0.1)' }]}>
                      <ThemedText style={{ fontSize: 10, color: m.role === 'admin' ? tintColor : mutedColor, fontWeight: '600' }}>
                        {m.role === 'admin' ? 'Admin' : 'Member'}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText type="muted" style={{ fontSize: 12 }} numberOfLines={1}>{m.email}</ThemedText>
                </View>
                {m.id !== session?.user?.id && m.role !== 'admin' && (
                  <Pressable
                    onPress={() => { setRenameTarget(m); setRenameValue(m.nama_lengkap ?? ''); }}
                    style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}>
                    <Ionicons name="create-outline" size={18} color={tintColor} />
                  </Pressable>
                )}
                {m.id !== session?.user?.id && m.role !== 'admin' && (
                  <Pressable
                    onPress={() => { setDeleteTarget(m); setDeleteConfirmVisible(true); }}
                    style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}>
                    <Ionicons name="trash-outline" size={18} color={dangerColor} />
                  </Pressable>
                )}
              </ThemedView>
            ))}
          </View>
        )}

        {/* Tombol Buat Akun di bawah */}
        <View style={styles.bottomBtn} />
      </ScrollView>

      {/* FAB Buat Akun */}
      <Pressable
        onPress={() => setAddVisible(true)}
        style={({ pressed }) => [styles.fab, { backgroundColor: tintColor }, pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] }]}>
        <Ionicons name="person-add" size={22} color="white" />
      </Pressable>

      {/* Modal Buat Akun */}
      <Modal visible={addVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setAddVisible(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalWrap}>
            <ThemedView type="card" style={styles.modalCard}>
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={[styles.modalIcon, { backgroundColor: tintColor + '15' }]}>
                  <Ionicons name="person-add-outline" size={28} color={tintColor} />
                </View>
                <ThemedText type="defaultSemiBold" style={styles.modalTitle}>Buat Akun Anggota</ThemedText>
                <ThemedText type="muted" style={styles.modalSub}>Akun akan langsung aktif dan bisa digunakan untuk login.</ThemedText>
              </View>
              <View style={{ gap: 10, marginBottom: 20 }}>
                <TextInput value={newNama} onChangeText={setNewNama} placeholder="Nama Lengkap (contoh: Budi Santoso)"
                  placeholderTextColor={mutedColor} autoCapitalize="words"
                  style={[styles.input, { color: textColor, borderColor }]} />
                <TextInput value={newEmail} onChangeText={setNewEmail} placeholder="Email"
                  placeholderTextColor={mutedColor} keyboardType="email-address" autoCapitalize="none"
                  style={[styles.input, { color: textColor, borderColor }]} />
                <TextInput value={newPassword} onChangeText={setNewPassword} placeholder="Password (min. 6 karakter)"
                  placeholderTextColor={mutedColor} secureTextEntry
                  style={[styles.input, { color: textColor, borderColor }]} />
              </View>
              <View style={styles.btnRow}>
                <Pressable onPress={() => { setAddVisible(false); setNewEmail(''); setNewNama(''); setNewPassword(''); }}
                  style={({ pressed }) => [styles.btn, { flex: 1, borderWidth: 1, borderColor, backgroundColor: 'transparent' }, pressed && { opacity: 0.8 }]}>
                  <ThemedText type="defaultSemiBold" style={{ color: textColor }}>Batal</ThemedText>
                </Pressable>
                <Pressable onPress={onCreateAccount} disabled={creating}
                  style={({ pressed }) => [styles.btn, { flex: 1, backgroundColor: tintColor }, (pressed || creating) && { opacity: 0.8 }]}>
                  <ThemedText type="defaultSemiBold" style={styles.btnText}>{creating ? 'Membuat...' : 'Buat Akun'}</ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal Rename */}
      <Modal visible={!!renameTarget} transparent animationType="fade">
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => { setRenameTarget(null); setRenameValue(''); }} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalWrap}>
            <ThemedView type="card" style={styles.modalCard}>
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={[styles.modalIcon, { backgroundColor: tintColor + '15' }]}>
                  <Ionicons name="person-outline" size={28} color={tintColor} />
                </View>
                <ThemedText type="defaultSemiBold" style={styles.modalTitle}>Ubah Nama</ThemedText>
                <ThemedText type="muted" style={styles.modalSub}>{renameTarget?.email}</ThemedText>
              </View>
              <TextInput value={renameValue} onChangeText={setRenameValue} placeholder="Nama Lengkap"
                placeholderTextColor={mutedColor} autoCapitalize="words"
                style={[styles.input, { color: textColor, borderColor, marginBottom: 20 }]} />
              <View style={styles.btnRow}>
                <Pressable onPress={() => { setRenameTarget(null); setRenameValue(''); }}
                  style={({ pressed }) => [styles.btn, { flex: 1, borderWidth: 1, borderColor, backgroundColor: 'transparent' }, pressed && { opacity: 0.8 }]}>
                  <ThemedText type="defaultSemiBold" style={{ color: textColor }}>Batal</ThemedText>
                </Pressable>
                <Pressable onPress={onRename} disabled={renaming}
                  style={({ pressed }) => [styles.btn, { flex: 1, backgroundColor: tintColor }, (pressed || renaming) && { opacity: 0.8 }]}>
                  <ThemedText type="defaultSemiBold" style={styles.btnText}>{renaming ? 'Menyimpan...' : 'Simpan'}</ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Dropdown Sort */}
      <Modal visible={sortDropdownVisible} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setSortDropdownVisible(false)}>
          <ThemedView type="card" style={styles.dropdownCard}>
            <ThemedText type="defaultSemiBold" style={styles.dropdownTitle}>Urutkan berdasarkan</ThemedText>
            {SORT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => { setSortBy(opt.key); setSortDropdownVisible(false); }}
                style={({ pressed }) => [
                  styles.dropdownItem,
                  sortBy === opt.key && { backgroundColor: tintColor + '12' },
                  pressed && { opacity: 0.7 },
                ]}>
                <View style={[styles.dropdownItemIcon, { backgroundColor: sortBy === opt.key ? tintColor + '20' : 'rgba(127,127,127,0.08)' }]}>
                  <Ionicons name={opt.icon as any} size={16} color={sortBy === opt.key ? tintColor : mutedColor} />
                </View>
                <ThemedText style={[styles.dropdownItemText, sortBy === opt.key && { color: tintColor, fontWeight: '600' }]}>
                  {opt.label}
                </ThemedText>
                {sortBy === opt.key && <Ionicons name="checkmark" size={18} color={tintColor} />}
              </Pressable>
            ))}
          </ThemedView>
        </Pressable>
      </Modal>

      {/* Modal Konfirmasi Hapus */}
      <Modal visible={deleteConfirmVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => { setDeleteConfirmVisible(false); setDeleteTarget(null); }} />
          <ThemedView type="card" style={[styles.modalCard, { width: '92%' }]}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={[styles.modalIcon, { backgroundColor: dangerColor + '15' }]}>
                <Ionicons name="person-remove-outline" size={28} color={dangerColor} />
              </View>
              <ThemedText type="defaultSemiBold" style={styles.modalTitle}>Hapus Akun</ThemedText>
              <ThemedText type="muted" style={[styles.modalSub, { textAlign: 'center' }]}>
                Hapus akun "{deleteTarget?.nama_lengkap ?? deleteTarget?.email}"? Tindakan ini tidak dapat dibatalkan.
              </ThemedText>
            </View>
            <View style={styles.btnRow}>
              <Pressable onPress={() => { setDeleteConfirmVisible(false); setDeleteTarget(null); }}
                style={({ pressed }) => [styles.btn, { flex: 1, borderWidth: 1, borderColor, backgroundColor: 'transparent' }, pressed && { opacity: 0.8 }]}>
                <ThemedText type="defaultSemiBold" style={{ color: textColor }}>Batal</ThemedText>
              </Pressable>
              <Pressable onPress={onDelete}
                style={({ pressed }) => [styles.btn, { flex: 1, backgroundColor: dangerColor }, pressed && { opacity: 0.85 }]}>
                <ThemedText type="defaultSemiBold" style={styles.btnText}>Hapus</ThemedText>
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
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRight: { width: 80 }, // sama lebar dengan backBtn biar judul benar-benar tengah
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  headerTitle: { fontSize: 17, textAlign: 'center' },
  headerSub: { fontSize: 12, marginTop: 1, textAlign: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },
  list: { gap: 10 },
  memberCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 16, borderWidth: 1,
  },
  avatar: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  bottomBtn: { height: 80 }, // spacer agar konten tidak tertutup FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  btnRow: { flexDirection: 'row', gap: 12 },
  btnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 24 },
  modalWrap: { width: '100%', maxWidth: 420 },
  modalCard: { padding: 24, borderRadius: 28, width: '100%' },
  modalIcon: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  modalSub: { fontSize: 13 },
  input: {
    borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15,
    backgroundColor: 'rgba(127,127,127,0.03)',
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  sortLabel: { fontSize: 12, marginRight: 2 },
  sortTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  sortTriggerText: { fontSize: 12, fontWeight: '600' },
  dropdownCard: {
    width: '88%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 8,
    paddingBottom: 12,
  },
  dropdownTitle: {
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 12,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  dropdownItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownItemText: { flex: 1, fontSize: 14 },
});
