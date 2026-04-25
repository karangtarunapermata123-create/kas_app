import { TabHeader } from '@/components/tab-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAdmin } from '@/lib/admin/admin-context';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
    Alert, Animated,
    Modal,
    Pressable, ScrollView, StyleSheet,
    TextInput, View, useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type UndianSession = {
  id: string;
  label: string;
  tanggal: string;
  created_at: number;
};

type UndianResult = {
  id: string;
  session_id: string;
  winner_id: string;
  winner_name: string;
  drawn_at: number;
};

type UndianMember = {
  id: string;
  session_id: string;
  user_id: string;
  nama_lengkap: string | null;
  email: string | null;
};

export default function UndianScreen() {
  const { isAdmin } = useAdmin();
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'muted');
  const borderColor = useThemeColor({}, 'border');
  const dangerColor = useThemeColor({}, 'danger');
  const successColor = (useThemeColor({}, 'success') as string | undefined) ?? '#22c55e';
  const backgroundColor = useThemeColor({}, 'background');
  const { height } = useWindowDimensions();

  const [sessions, setSessions] = useState<UndianSession[]>([]);
  const [results, setResults] = useState<UndianResult[]>([]);
  const [members, setMembers] = useState<UndianMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Add session form
  const [addSessionVisible, setAddSessionVisible] = useState(false);
  const [newSessionLabel, setNewSessionLabel] = useState('');
  const [newSessionTanggal, setNewSessionTanggal] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [savingSession, setSavingSession] = useState(false);

  // Delete session
  const [deleteSessionTarget, setDeleteSessionTarget] = useState<{ id: string; label: string } | null>(null);
  const [deletingSession, setDeletingSession] = useState(false);

  // Lottery animation
  const [drawingSession, setDrawingSession] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;

  // Edit mode
  const [isEditMode, setIsEditMode] = useState(false);

  // FAB menu
  const [adminFabMenuVisible, setAdminFabMenuVisible] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [sessionsRes, resultsRes, membersRes] = await Promise.all([
        supabase
          .from('undian_sessions')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('undian_results')
          .select('*')
          .order('drawn_at', { ascending: false }),
        supabase
          .from('undian_members')
          .select('id, session_id, user_id')
      ]);

      if (sessionsRes.data) setSessions(sessionsRes.data);
      if (resultsRes.data) setResults(resultsRes.data);
      
      // Load member details separately (avoid joins)
      if (membersRes.data && membersRes.data.length > 0) {
        const userIds = [...new Set(membersRes.data.map((m: any) => m.user_id))];
        const profilesRes = await supabase
          .from('profiles')
          .select('id, nama_lengkap, email')
          .in('id', userIds);
        
        if (profilesRes.data) {
          const memberData = membersRes.data.map((member: any) => {
            const profile = profilesRes.data.find(p => p.id === member.user_id);
            return {
              id: member.id,
              session_id: member.session_id,
              user_id: member.user_id,
              nama_lengkap: profile?.nama_lengkap || null,
              email: profile?.email || null,
            };
          });
          setMembers(memberData);
        }
      } else {
        setMembers([]);
      }
    } catch (e) {
      console.error('Load undian data error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  // Real-time subscriptions
  useFocusEffect(useCallback(() => {
    const sessionsChannel = supabase
      .channel('undian_sessions_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'undian_sessions' },
        () => {
          loadData();
        }
      )
      .subscribe();

    const resultsChannel = supabase
      .channel('undian_results_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'undian_results' },
        () => {
          loadData();
        }
      )
      .subscribe();

    const membersChannel = supabase
      .channel('undian_members_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'undian_members' },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(resultsChannel);
      supabase.removeChannel(membersChannel);
    };
  }, [loadData]));

  const onAddSession = useCallback(async () => {
    if (!newSessionLabel.trim()) return Alert.alert('Error', 'Label sesi wajib diisi.');
    setSavingSession(true);
    try {
      const sessionId = `undian_${Date.now()}`;
      const { error } = await supabase
        .from('undian_sessions')
        .insert({
          id: sessionId,
          label: newSessionLabel.trim(),
          tanggal: newSessionTanggal,
          created_at: Date.now(),
        });

      if (error) throw new Error(error.message);
      
      setAddSessionVisible(false);
      setNewSessionLabel('');
      loadData();
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
    } finally {
      setSavingSession(false);
    }
  }, [newSessionLabel, newSessionTanggal, loadData]);

  const onDeleteSession = useCallback(async (sessionId: string) => {
    setDeletingSession(true);
    try {
      const { error } = await supabase
        .from('undian_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw new Error(error.message);
      
      setDeleteSessionTarget(null);
      loadData();
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
    } finally {
      setDeletingSession(false);
    }
  }, [loadData]);

  const onDrawLottery = useCallback(async (sessionId: string) => {
    const sessionMembers = members.filter(m => m.session_id === sessionId);
    
    if (sessionMembers.length === 0) {
      return Alert.alert('Tidak Ada Peserta', 'Belum ada anggota yang terdaftar untuk sesi ini.');
    }

    // Check if session already has a result
    const existingResult = results.find(r => r.session_id === sessionId);
    if (existingResult) {
      return Alert.alert('Sudah Diundi', 'Sesi ini sudah pernah diundi.');
    }

    setDrawingSession(sessionId);
    setIsDrawing(true);

    // Start spinning animation
    spinValue.setValue(0);
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();

    // Simulate drawing delay
    setTimeout(async () => {
      try {
        // Pick random winner from session members
        const randomIndex = Math.floor(Math.random() * sessionMembers.length);
        const winner = sessionMembers[randomIndex];
        const winnerName = winner.nama_lengkap || winner.email || 'Anggota';

        const resultId = `result_${Date.now()}`;
        const { error } = await supabase
          .from('undian_results')
          .insert({
            id: resultId,
            session_id: sessionId,
            winner_id: winner.user_id,
            winner_name: winnerName,
            drawn_at: Date.now(),
          });

        if (error) throw new Error(error.message);

        // Stop animation
        spinValue.stopAnimation();
        setIsDrawing(false);
        setDrawingSession(null);

        Alert.alert('Selamat!', `Pemenang: ${winnerName}`, [
          { text: 'OK', onPress: () => loadData() }
        ]);
      } catch (e: any) {
        spinValue.stopAnimation();
        setIsDrawing(false);
        setDrawingSession(null);
        Alert.alert('Gagal', e.message);
      }
    }, 3000);
  }, [members, results, spinValue, loadData]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getSessionResult = (sessionId: string) => {
    return results.find(r => r.session_id === sessionId);
  };

  const getSessionMembers = (sessionId: string) => {
    return members.filter(m => m.session_id === sessionId);
  };

  const onEditSessionMembers = (sessionId: string) => {
    router.push({ 
      pathname: '/undian/undian-members', 
      params: { sessionId } 
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TabHeader
          title="Undian"
          subtitle={isAdmin ? 'Kelola sesi undian arisan' : 'Lihat hasil undian'}
        />

        {/* Daftar Sesi */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>Daftar Sesi Undian</ThemedText>
            {isAdmin && (
              <View style={[styles.roleBadge, { backgroundColor: tintColor + '20' }]}>
                <ThemedText style={{ fontSize: 11, color: tintColor, fontWeight: '600' }}>
                  Admin
                </ThemedText>
              </View>
            )}
          </View>

          {loading ? (
            <View style={styles.empty}>
              <Ionicons name="dice-outline" size={40} color={mutedColor} />
              <ThemedText type="muted" style={{ marginTop: 8, textAlign: 'center' }}>Memuat...</ThemedText>
            </View>
          ) : sessions.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="dice-outline" size={40} color={mutedColor} />
              <ThemedText type="muted" style={{ marginTop: 8, textAlign: 'center' }}>
                {isAdmin ? 'Belum ada sesi undian. Tambah sesi baru!' : 'Belum ada sesi undian.'}
              </ThemedText>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {sessions.map(session => {
                const result = getSessionResult(session.id);
                const sessionMembers = getSessionMembers(session.id);
                const isCurrentlyDrawing = drawingSession === session.id;
                
                return (
                  <ThemedView key={session.id} style={[styles.sessionRow, { borderColor }]}>
                    <Pressable 
                      style={styles.sessionInfo}
                      onPress={() => router.push({ 
                        pathname: '/undian/session-detail', 
                        params: { sessionId: session.id } 
                      })}>
                      <View style={[styles.sessionIcon, { backgroundColor: tintColor + '18' }]}>
                        {isCurrentlyDrawing ? (
                          <Animated.View style={{ transform: [{ rotate: spin }] }}>
                            <Ionicons name="dice" size={18} color={tintColor} />
                          </Animated.View>
                        ) : (
                          <Ionicons name="dice" size={18} color={tintColor} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="defaultSemiBold" style={{ fontSize: 14 }}>{session.label}</ThemedText>
                        <ThemedText type="muted" style={{ fontSize: 12 }}>
                          {result ? `Pemenang: ${result.winner_name}` : `${sessionMembers.length} peserta`}
                        </ThemedText>
                      </View>
                    </Pressable>

                    {isAdmin && (
                      <View style={styles.sessionActions}>
                        {isEditMode && (
                          <>
                            <Pressable 
                              onPress={() => onEditSessionMembers(session.id)}
                              style={({ pressed }) => [styles.iconBtn, { backgroundColor: tintColor + '15' }, pressed && { opacity: 0.6 }]}>
                              <Ionicons name="people-outline" size={18} color={tintColor} />
                            </Pressable>
                            <Pressable 
                              onPress={() => setDeleteSessionTarget({ id: session.id, label: session.label })}
                              style={({ pressed }) => [styles.iconBtn, { backgroundColor: dangerColor + '15' }, pressed && { opacity: 0.6 }]}>
                              <Ionicons name="trash-outline" size={18} color={dangerColor} />
                            </Pressable>
                          </>
                        )}
                      </View>
                    )}
                  </ThemedView>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* FAB untuk admin */}
      {isAdmin && (
        <View style={[styles.fabSingle, { alignItems: 'center', justifyContent: 'center' }]}>
          {isEditMode ? (
            <Pressable
              onPress={() => setIsEditMode(false)}
              style={({ pressed }) => [
                styles.fab, 
                { backgroundColor: successColor }, 
                pressed && { opacity: 0.8, transform: [{ scale: 0.9 }] }
              ]}>
              <Ionicons name="checkmark" size={32} color="white" />
            </Pressable>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Pressable
                onPress={() => setAdminFabMenuVisible(true)}
                style={({ pressed }) => [
                  styles.fabSmall, 
                  { backgroundColor: backgroundColor, borderColor: borderColor, borderWidth: 1, marginBottom: 12 }, 
                  pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] }
                ]}>
                <Ionicons name="pencil" size={18} color={tintColor} />
              </Pressable>
              <Pressable
                onPress={() => setAddSessionVisible(true)}
                style={({ pressed }) => [styles.fab, { backgroundColor: tintColor }, pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] }]}>
                <Ionicons name="add" size={28} color="white" />
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* FAB Menu Modal */}
      <Modal visible={adminFabMenuVisible} transparent animationType="fade">
        <View style={styles.fabMenuOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setAdminFabMenuVisible(false)} />
          <ThemedView type="card" style={styles.fabMenuCard}>
            <Pressable
              onPress={() => { setAdminFabMenuVisible(false); setIsEditMode(true); }}
              style={({ pressed }) => [styles.fabMenuItem, pressed && { opacity: 0.75 }]}>
              <View style={[styles.fabMenuIcon, { backgroundColor: tintColor + '18' }]}>
                <Ionicons name="create-outline" size={22} color={tintColor} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>Kelola Sesi</ThemedText>
                <ThemedText type="muted" style={{ fontSize: 12, marginTop: 2 }}>Hapus sesi undian</ThemedText>
              </View>
            </Pressable>

            <Pressable
              onPress={() => { setAdminFabMenuVisible(false); setAddSessionVisible(true); }}
              style={({ pressed }) => [styles.fabMenuItem, pressed && { opacity: 0.75 }]}>
              <View style={[styles.fabMenuIcon, { backgroundColor: tintColor + '18' }]}>
                <Ionicons name="add-circle-outline" size={22} color={tintColor} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>Tambah Sesi</ThemedText>
                <ThemedText type="muted" style={{ fontSize: 12, marginTop: 2 }}>Buat sesi undian baru</ThemedText>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setAdminFabMenuVisible(false)}
              style={({ pressed }) => [styles.fabMenuCancel, pressed && { opacity: 0.75 }]}>
              <ThemedText type="muted" style={{ fontSize: 14, textAlign: 'center' }}>Batal</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>

      {/* Modal Tambah Sesi */}
      <Modal visible={addSessionVisible} transparent animationType="slide">
        <View style={styles.modalWrap}>
          <Pressable style={styles.overlay} onPress={() => setAddSessionVisible(false)} />
          <ThemedView type="card" style={[styles.modalCard, { maxHeight: height * 0.6 }]}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 18 }}>Tambah Sesi Undian</ThemedText>
              <Pressable onPress={() => setAddSessionVisible(false)}>
                <Ionicons name="close" size={22} color={textColor} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={{ gap: 14, paddingBottom: 24 }}>
                <View>
                  <ThemedText type="muted" style={styles.label}>Label Sesi</ThemedText>
                  <TextInput 
                    value={newSessionLabel} 
                    onChangeText={setNewSessionLabel}
                    placeholder="Contoh: Undian Januari 2025"
                    placeholderTextColor={mutedColor} 
                    style={[styles.input, { borderColor, color: textColor }]} 
                  />
                </View>
                <View>
                  <ThemedText type="muted" style={styles.label}>Tanggal (YYYY-MM-DD)</ThemedText>
                  <TextInput 
                    value={newSessionTanggal} 
                    onChangeText={setNewSessionTanggal}
                    placeholderTextColor={mutedColor} 
                    style={[styles.input, { borderColor, color: textColor }]} 
                  />
                </View>
                <Pressable 
                  onPress={onAddSession} 
                  disabled={savingSession}
                  style={({ pressed }) => [styles.btn, { backgroundColor: tintColor }, (pressed || savingSession) && { opacity: 0.8 }]}>
                  <ThemedText style={styles.btnText}>
                    {savingSession ? 'Menyimpan...' : 'Tambah Sesi'}
                  </ThemedText>
                </Pressable>
              </View>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      {/* Modal Konfirmasi Hapus Sesi */}
      <Modal visible={!!deleteSessionTarget} transparent animationType="fade">
        <View style={styles.qrOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setDeleteSessionTarget(null)} />
          <ThemedView type="card" style={[styles.qrCard, { alignItems: 'flex-start' }]}>
            <View style={[styles.sessionIcon, { backgroundColor: dangerColor + '18', marginBottom: 16, width: 48, height: 48, borderRadius: 14 }]}>
              <Ionicons name="trash-outline" size={22} color={dangerColor} />
            </View>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 18, marginBottom: 8 }}>Hapus Sesi</ThemedText>
            <ThemedText type="muted" style={{ fontSize: 14, lineHeight: 20, marginBottom: 24 }}>
              Hapus sesi "{deleteSessionTarget?.label}"? Hasil undian sesi ini akan ikut terhapus.
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <Pressable 
                onPress={() => setDeleteSessionTarget(null)}
                disabled={deletingSession}
                style={({ pressed }) => [styles.btn, { flex: 1, borderWidth: 1, borderColor, backgroundColor: 'transparent' }, pressed && { opacity: 0.8 }]}>
                <ThemedText style={{ fontWeight: '600', color: textColor }}>Batal</ThemedText>
              </Pressable>
              <Pressable
                disabled={deletingSession}
                onPress={() => deleteSessionTarget && onDeleteSession(deleteSessionTarget.id)}
                style={({ pressed }) => [styles.btn, { flex: 1, backgroundColor: dangerColor }, (pressed || deletingSession) && { opacity: 0.7 }]}>
                <ThemedText style={styles.btnText}>
                  {deletingSession ? 'Menghapus...' : 'Hapus'}
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40, gap: 16 },
  card: { borderRadius: 20, padding: 20, borderWidth: 1 },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, marginTop: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 32 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  sessionInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  sessionIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  sessionActions: { flexDirection: 'row', gap: 6, paddingRight: 10 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  memberAvatar: { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  btnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(127,127,127,0.3)', alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  qrOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 24 },
  qrCard: { borderRadius: 24, padding: 28, alignItems: 'center', width: '100%', maxWidth: 400 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    alignSelf: 'center',
  },
  fabSingle: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    zIndex: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabMenuOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 24,
  },
  fabMenuCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 12,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
  },
  fabMenuIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabMenuCancel: {
    marginTop: 6,
    paddingVertical: 12,
    borderRadius: 16,
  },
});