import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAdmin } from '@/lib/admin/admin-context';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
    Alert, Animated, Modal, Pressable, ScrollView, StyleSheet, View,
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

export default function UndianSessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { isAdmin } = useAdmin();
  
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'muted');
  const borderColor = useThemeColor({}, 'border');
  const dangerColor = useThemeColor({}, 'danger');
  const successColor = (useThemeColor({}, 'success') as string | undefined) ?? '#22c55e';
  const backgroundColor = useThemeColor({}, 'background');

  const [session, setSession] = useState<UndianSession | null>(null);
  const [members, setMembers] = useState<UndianMember[]>([]);
  const [results, setResults] = useState<UndianResult[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [currentView, setCurrentView] = useState<'members' | 'winners'>('members');

  // Lottery animation
  const [isDrawing, setIsDrawing] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;

  // Lottery result confirmation
  const [pendingResult, setPendingResult] = useState<{
    winner: UndianMember;
    winnerName: string;
  } | null>(null);
  const [savingResult, setSavingResult] = useState(false);

  // Delete result confirmation
  const [deleteResultTarget, setDeleteResultTarget] = useState<{
    id: string;
    winnerName: string;
  } | null>(null);
  const [deletingResult, setDeletingResult] = useState(false);

  const loadData = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      const [sessionRes, membersRes, resultsRes] = await Promise.all([
        supabase
          .from('undian_sessions')
          .select('*')
          .eq('id', sessionId)
          .single(),
        supabase
          .from('undian_members')
          .select('id, session_id, user_id')
          .eq('session_id', sessionId),
        supabase
          .from('undian_results')
          .select('*')
          .eq('session_id', sessionId)
          .order('drawn_at', { ascending: false })
      ]);

      if (sessionRes.data) setSession(sessionRes.data);
      if (resultsRes.data) setResults(resultsRes.data);

      // Load member details separately
      if (membersRes.data && membersRes.data.length > 0) {
        const userIds = membersRes.data.map((m: any) => m.user_id);
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
      console.error('Load session detail error:', e);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  // Real-time subscriptions
  useFocusEffect(useCallback(() => {
    if (!sessionId) return;

    const resultsChannel = supabase
      .channel(`undian_results_${sessionId}`)
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'undian_results',
          filter: `session_id=eq.${sessionId}`
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    const membersChannel = supabase
      .channel(`undian_members_${sessionId}`)
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'undian_members',
          filter: `session_id=eq.${sessionId}`
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    const sessionChannel = supabase
      .channel(`undian_session_${sessionId}`)
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'undian_sessions',
          filter: `id=eq.${sessionId}`
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(resultsChannel);
      supabase.removeChannel(membersChannel);
      supabase.removeChannel(sessionChannel);
    };
  }, [sessionId, loadData]));

  const onDrawLottery = useCallback(async () => {
    if (members.length === 0) {
      return Alert.alert('Tidak Ada Peserta', 'Belum ada anggota yang terdaftar untuk sesi ini.');
    }

    // Filter out members who have already won
    const winnerIds = new Set(results.map(r => r.winner_id));
    const availableMembers = members.filter(m => !winnerIds.has(m.user_id));

    if (availableMembers.length === 0) {
      return Alert.alert('Semua Sudah Terpilih', 'Semua peserta sudah pernah mendapat giliran di sesi ini.');
    }

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
    setTimeout(() => {
      // Pick random winner from available members only
      const randomIndex = Math.floor(Math.random() * availableMembers.length);
      const winner = availableMembers[randomIndex];
      const winnerName = winner.nama_lengkap || winner.email || 'Anggota';

      // Stop animation
      spinValue.stopAnimation();
      setIsDrawing(false);

      // Show confirmation modal instead of saving immediately
      setPendingResult({ winner, winnerName });
    }, 3000);
  }, [members, results, spinValue]);

  const onSaveResult = useCallback(async () => {
    if (!pendingResult) return;
    
    setSavingResult(true);
    try {
      const resultId = `result_${Date.now()}`;
      const { error } = await supabase
        .from('undian_results')
        .insert({
          id: resultId,
          session_id: sessionId,
          winner_id: pendingResult.winner.user_id,
          winner_name: pendingResult.winnerName,
          drawn_at: Date.now(),
        });

      if (error) throw new Error(error.message);

      setPendingResult(null);
      loadData();
      Alert.alert('Tersimpan!', `${pendingResult.winnerName} berhasil disimpan sebagai yang terpilih.`);
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
    } finally {
      setSavingResult(false);
    }
  }, [pendingResult, sessionId, loadData]);

  const onCancelResult = useCallback(() => {
    setPendingResult(null);
  }, []);

  const onDeleteResult = useCallback(async (resultId: string, winnerName: string) => {
    setDeleteResultTarget({ id: resultId, winnerName });
  }, []);

  const confirmDeleteResult = useCallback(async () => {
    if (!deleteResultTarget) return;
    
    setDeletingResult(true);
    try {
      const { error } = await supabase
        .from('undian_results')
        .delete()
        .eq('id', deleteResultTarget.id);

      if (error) throw new Error(error.message);
      
      setDeleteResultTarget(null);
      loadData();
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
    } finally {
      setDeletingResult(false);
    }
  }, [deleteResultTarget, loadData]);

  const cancelDeleteResult = useCallback(() => {
    setDeleteResultTarget(null);
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="dice-outline" size={40} color={mutedColor} />
          <ThemedText type="muted" style={{ marginTop: 8 }}>Memuat...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={mutedColor} />
          <ThemedText type="muted" style={{ marginTop: 8 }}>Sesi tidak ditemukan</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <View style={styles.backBtn}>
          <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="chevron-back" size={24} color={tintColor} />
            <ThemedText style={{ color: tintColor, fontSize: 16 }}>Kembali</ThemedText>
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>{session.label}</ThemedText>
          <ThemedText type="muted" style={{ fontSize: 12 }}>Detail Sesi Undian</ThemedText>
        </View>
        <View style={styles.rightSection}>
          {isAdmin && (
            <Pressable
              onPress={() => router.push({ 
                pathname: '/undian/undian-members', 
                params: { sessionId } 
              })}
              style={({ pressed }) => [
                styles.editBtn,
                { backgroundColor: tintColor },
                pressed && { opacity: 0.75 },
              ]}>
              <Ionicons name="people" size={18} color="white" />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Content Area */}
        {currentView === 'members' ? (
          /* Daftar yang Belum Dapat */
          <ThemedView type="card" style={[styles.card, { borderColor }]}>
            {/* Arrow Navigation */}
            <View style={styles.arrowNav}>
              <Pressable
                onPress={() => setCurrentView('members')}
                disabled={currentView === 'members'}
                style={({ pressed }) => [
                  styles.arrowButton,
                  { borderColor },
                  currentView === 'members' && { opacity: 0.3 },
                  pressed && { opacity: 0.7 }
                ]}>
                <Ionicons name="chevron-back" size={20} color={tintColor} />
              </Pressable>

              <ThemedText type="defaultSemiBold" style={{ fontSize: 16, flex: 1, textAlign: 'center' }}>
                Daftar yang Belum Dapat ({members.filter(m => !results.some(r => r.winner_id === m.user_id)).length})
              </ThemedText>

              <Pressable
                onPress={() => setCurrentView('winners')}
                disabled={currentView === 'winners'}
                style={({ pressed }) => [
                  styles.arrowButton,
                  { borderColor },
                  currentView === 'winners' && { opacity: 0.3 },
                  pressed && { opacity: 0.7 }
                ]}>
                <Ionicons name="chevron-forward" size={20} color={tintColor} />
              </Pressable>
            </View>
            
            <View style={styles.cardHeader}>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>Daftar yang Belum Dapat</ThemedText>
              <ThemedText type="muted" style={{ fontSize: 12 }}>
                {members.filter(m => !results.some(r => r.winner_id === m.user_id)).length} orang
              </ThemedText>
            </View>
            
            {(() => {
              const availableMembers = members.filter(m => !results.some(r => r.winner_id === m.user_id));
              
              if (availableMembers.length === 0) {
                return (
                  <View style={styles.emptyMembers}>
                    <Ionicons name="people-outline" size={32} color={mutedColor} />
                    <ThemedText type="muted" style={{ marginTop: 8, textAlign: 'center' }}>
                      {members.length === 0 
                        ? (isAdmin ? 'Belum ada peserta. Tambah peserta untuk memulai undian.' : 'Belum ada peserta terdaftar.')
                        : 'Semua peserta sudah mendapat giliran.'
                      }
                    </ThemedText>
                  </View>
                );
              }

              return (
                <View style={{ gap: 8, marginTop: 12 }}>
                  {availableMembers.map((member, index) => {
                    const nama = member.nama_lengkap || member.email || 'Anggota';
                    
                    return (
                      <View key={member.id} style={[styles.memberRow, { borderColor }]}>
                        <View style={[styles.memberNumber, { backgroundColor: tintColor + '18' }]}>
                          <ThemedText style={{ color: tintColor, fontWeight: '700', fontSize: 12 }}>
                            {index + 1}
                          </ThemedText>
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText type="defaultSemiBold" style={{ fontSize: 14 }}>
                            {nama}
                          </ThemedText>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })()}
          </ThemedView>
        ) : (
          /* Daftar Pemenang */
          <ThemedView type="card" style={[styles.card, { borderColor }]}>
            {/* Arrow Navigation */}
            <View style={styles.arrowNav}>
              <Pressable
                onPress={() => setCurrentView('members')}
                disabled={currentView === 'members'}
                style={({ pressed }) => [
                  styles.arrowButton,
                  { borderColor },
                  currentView === 'members' && { opacity: 0.3 },
                  pressed && { opacity: 0.7 }
                ]}>
                <Ionicons name="chevron-back" size={20} color={tintColor} />
              </Pressable>

              <ThemedText type="defaultSemiBold" style={{ fontSize: 16, flex: 1, textAlign: 'center' }}>
                Daftar yang Sudah Dapat ({results.length})
              </ThemedText>

              <Pressable
                onPress={() => setCurrentView('winners')}
                disabled={currentView === 'winners'}
                style={({ pressed }) => [
                  styles.arrowButton,
                  { borderColor },
                  currentView === 'winners' && { opacity: 0.3 },
                  pressed && { opacity: 0.7 }
                ]}>
                <Ionicons name="chevron-forward" size={20} color={tintColor} />
              </Pressable>
            </View>

            <View style={styles.cardHeader}>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>Daftar yang Sudah Dapat</ThemedText>
              <ThemedText type="muted" style={{ fontSize: 12 }}>
                {results.length} undian
              </ThemedText>
            </View>
            
            {results.length === 0 ? (
              <View style={styles.emptyMembers}>
                <Ionicons name="trophy-outline" size={32} color={mutedColor} />
                <ThemedText type="muted" style={{ marginTop: 8, textAlign: 'center' }}>
                  Belum ada yang sudah dapat. Mulai undian untuk menentukan yang beruntung.
                </ThemedText>
              </View>
            ) : (
              <View style={{ gap: 8, marginTop: 12 }}>
                {results.map((result, index) => (
                  <View key={result.id} style={[styles.winnerRow, { borderColor }]}>
                    <View style={[styles.winnerNumber, { backgroundColor: successColor + '18' }]}>
                      <ThemedText style={{ color: successColor, fontWeight: '700', fontSize: 12 }}>
                        {index + 1}
                      </ThemedText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="defaultSemiBold" style={{ fontSize: 14 }}>
                        {result.winner_name}
                      </ThemedText>
                      <ThemedText type="muted" style={{ fontSize: 12 }}>
                        {new Date(result.drawn_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </ThemedText>
                    </View>
                    {isAdmin && (
                      <Pressable
                        onPress={() => onDeleteResult(result.id, result.winner_name)}
                        style={({ pressed }) => [
                          styles.deleteButton,
                          { backgroundColor: dangerColor + '15' },
                          pressed && { opacity: 0.7 }
                        ]}>
                        <Ionicons name="trash-outline" size={16} color={dangerColor} />
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ThemedView>
        )}
      </ScrollView>

      {/* Tombol Undian */}
      {isAdmin && members.length > 0 && (() => {
        const winnerIds = new Set(results.map(r => r.winner_id));
        const availableMembers = members.filter(m => !winnerIds.has(m.user_id));
        return availableMembers.length > 0;
      })() && (
        <View style={styles.fabContainer}>
          <Pressable
            onPress={onDrawLottery}
            disabled={isDrawing}
            style={({ pressed }) => [
              styles.drawButton,
              { backgroundColor: successColor },
              (pressed || isDrawing) && { opacity: 0.85, transform: [{ scale: 0.95 }] }
            ]}>
            {isDrawing ? (
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons name="dice" size={24} color="white" />
              </Animated.View>
            ) : (
              <Ionicons name="dice" size={24} color="white" />
            )}
            <ThemedText style={styles.drawButtonText}>
              {isDrawing ? 'Mengundi...' : 'Mulai Undian'}
            </ThemedText>
          </Pressable>
        </View>
      )}

      {/* Modal Konfirmasi Hasil Undian */}
      <Modal visible={!!pendingResult} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <ThemedView type="card" style={[styles.confirmCard, { borderColor }]}>
            <View style={[styles.confirmIcon, { backgroundColor: successColor + '18' }]}>
              <Ionicons name="trophy" size={32} color={successColor} />
            </View>
            
            <ThemedText type="defaultSemiBold" style={{ fontSize: 20, textAlign: 'center', marginBottom: 8 }}>
              Konfirmasi Hasil Undian
            </ThemedText>
            
            <ThemedText style={{ fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 16, color: successColor }}>
              {pendingResult?.winnerName}
            </ThemedText>
            
            <ThemedText type="muted" style={{ fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
              Apakah Anda ingin menyimpan hasil undian ini? Setelah disimpan, {pendingResult?.winnerName} akan tercatat sebagai yang sudah dapat.
            </ThemedText>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={onCancelResult}
                disabled={savingResult}
                style={({ pressed }) => [
                  styles.confirmButton,
                  { borderWidth: 1, borderColor, backgroundColor: 'transparent' },
                  pressed && { opacity: 0.7 }
                ]}>
                <ThemedText style={{ fontWeight: '600', color: textColor }}>
                  Batal
                </ThemedText>
              </Pressable>
              
              <Pressable
                onPress={onSaveResult}
                disabled={savingResult}
                style={({ pressed }) => [
                  styles.confirmButton,
                  { backgroundColor: successColor },
                  (pressed || savingResult) && { opacity: 0.8 }
                ]}>
                <ThemedText style={{ fontWeight: '700', color: 'white' }}>
                  {savingResult ? 'Menyimpan...' : 'Simpan'}
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* Modal Konfirmasi Hapus Hasil */}
      <Modal visible={!!deleteResultTarget} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <ThemedView type="card" style={[styles.confirmCard, { borderColor }]}>
            <View style={[styles.confirmIcon, { backgroundColor: dangerColor + '18' }]}>
              <Ionicons name="trash-outline" size={32} color={dangerColor} />
            </View>
            
            <ThemedText type="defaultSemiBold" style={{ fontSize: 20, textAlign: 'center', marginBottom: 8 }}>
              Hapus Hasil Undian
            </ThemedText>
            
            <ThemedText style={{ fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 16, color: dangerColor }}>
              {deleteResultTarget?.winnerName}
            </ThemedText>
            
            <ThemedText type="muted" style={{ fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
              Apakah Anda yakin ingin menghapus {deleteResultTarget?.winnerName} dari daftar yang sudah dapat? Tindakan ini tidak dapat dibatalkan.
            </ThemedText>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={cancelDeleteResult}
                disabled={deletingResult}
                style={({ pressed }) => [
                  styles.confirmButton,
                  { borderWidth: 1, borderColor, backgroundColor: 'transparent' },
                  pressed && { opacity: 0.7 }
                ]}>
                <ThemedText style={{ fontWeight: '600', color: textColor }}>
                  Batal
                </ThemedText>
              </Pressable>
              
              <Pressable
                onPress={confirmDeleteResult}
                disabled={deletingResult}
                style={({ pressed }) => [
                  styles.confirmButton,
                  { backgroundColor: dangerColor },
                  (pressed || deletingResult) && { opacity: 0.8 }
                ]}>
                <ThemedText style={{ fontWeight: '700', color: 'white' }}>
                  {deletingResult ? 'Menghapus...' : 'Hapus'}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { 
    width: 90, 
    justifyContent: 'flex-start' 
  },
  rightSection: { 
    width: 90, 
    alignItems: 'flex-end' 
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { padding: 20, paddingBottom: 100 },
  arrowNav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  arrowButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: { borderRadius: 20, padding: 20, borderWidth: 1 },
  cardHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  winnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
  },
  winnerNumber: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  winnerIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyMembers: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
  },
  memberNumber: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  winCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 80,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
  },
  drawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  drawButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  confirmOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 24,
  },
  confirmCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
  },
  confirmIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});