import { ScanQrFab } from '@/components/scan-qr-fab';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAbsensi } from '@/lib/absensi/absensi-context';
import { useAdmin } from '@/lib/admin/admin-context';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

type Profile = { id: string; nama_lengkap: string | null; email: string | null };

export default function SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { isAdmin } = useAdmin();
  const { sessions, attendances, lastAbsenAt, deleteSession, absen, removeAbsen } = useAbsensi();
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'muted');
  const borderColor = useThemeColor({}, 'border');
  const dangerColor = useThemeColor({}, 'danger');
  const successColor = useThemeColor({}, 'success');
  const backgroundColor = useThemeColor({}, 'background');

  const [qrOpen, setQrOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingSession, setDeletingSession] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [confirmToggle, setConfirmToggle] = useState<typeof rows[number] | null>(null);

  // State lokal untuk attendance sesi ini
  const [localAttendances, setLocalAttendances] = useState(() =>
    attendances.filter(a => a.sessionId === sessionId)
  );

  const session = useMemo(() => sessions.find(s => s.id === sessionId), [sessions, sessionId]);

  // Fetch langsung dari DB — sumber kebenaran utama
  const fetchLocalAttendances = useCallback(async () => {
    if (!sessionId) return;
    const { data } = await supabase
      .from('attendances')
      .select('id, event_id, session_id, user_id, nama_user, waktu_absen')
      .eq('session_id', sessionId);
    if (data) {
      setLocalAttendances(data.map((r: any) => ({
        id: r.id,
        eventId: r.event_id,
        sessionId: r.session_id,
        userId: r.user_id,
        namaUser: r.nama_user,
        waktuAbsen: r.waktu_absen,
      })));
    }
  }, [sessionId]);

  // Fetch saat mount
  useEffect(() => {
    fetchLocalAttendances();
  }, [fetchLocalAttendances]);

  // Re-fetch setiap kali ada absen baru di context (lastAbsenAt berubah)
  // Ini bekerja karena context tetap aktif meski screen di-freeze
  const prevLastAbsenAt = useRef(lastAbsenAt);
  useEffect(() => {
    if (lastAbsenAt !== prevLastAbsenAt.current) {
      prevLastAbsenAt.current = lastAbsenAt;
      fetchLocalAttendances();
    }
  }, [lastAbsenAt, fetchLocalAttendances]);

  // AppState listener — fetch saat app kembali active (user switch tab/app)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchLocalAttendances();
    });
    return () => sub.remove();
  }, [fetchLocalAttendances]);

  // Realtime subscription langsung untuk sesi ini
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`session-att-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendances', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const att = {
            id: (payload.new as any).id,
            eventId: (payload.new as any).event_id,
            sessionId: (payload.new as any).session_id,
            userId: (payload.new as any).user_id,
            namaUser: (payload.new as any).nama_user,
            waktuAbsen: (payload.new as any).waktu_absen,
          };
          setLocalAttendances(prev =>
            prev.some(a => a.userId === att.userId) ? prev : [...prev, att]
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'attendances', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          setLocalAttendances(prev =>
            prev.filter(a => a.id !== (payload.old as any).id)
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  // Polling setiap 3 detik sebagai fallback terakhir
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(fetchLocalAttendances, 3000);
    return () => clearInterval(interval);
  }, [sessionId, fetchLocalAttendances]);

  useEffect(() => {
    supabase
      .from('absensi_members')
      .select('user_id')
      .then(async ({ data: memberData }) => {
        if (!memberData || memberData.length === 0) {
          setProfiles([]);
          return;
        }
        const ids = memberData.map((r: any) => r.user_id as string);
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, nama_lengkap, email')
          .in('id', ids)
          .order('nama_lengkap', { ascending: true });
        if (profileData) setProfiles(profileData as Profile[]);
      });
  }, []);

  const rows = useMemo(() => {
    return profiles.map(p => {
      const att = localAttendances.find(a => a.userId === p.id);
      return {
        id: p.id,
        nama: p.nama_lengkap ?? p.email ?? '(tanpa nama)',
        hadir: !!att,
        waktu: att ? att.waktuAbsen : null,
      };
    });
  }, [profiles, localAttendances]);

  const hadirCount = rows.filter(r => r.hadir).length;
  const tidakHadirCount = rows.filter(r => !r.hadir).length;

  const onToggle = useCallback(async (row: typeof rows[number]) => {
    if (!isAdmin || !session) return;
    setConfirmToggle(row);
  }, [isAdmin, session]);

  const onConfirmToggle = useCallback(async () => {
    const row = confirmToggle;
    if (!row || !session) return;
    setConfirmToggle(null);
    setTogglingIds(prev => new Set(prev).add(row.id));
    try {
      if (row.hadir) {
        await removeAbsen(session.id, row.id);
      } else {
        await absen(session.eventId, session.id, row.id, row.nama);
      }
    } catch {
      // realtime akan sync state
    } finally {
      setTogglingIds(prev => { const s = new Set(prev); s.delete(row.id); return s; });
    }
  }, [confirmToggle, session, absen, removeAbsen]);

  const onConfirmDelete = async () => {
    if (!sessionId) return;
    setDeletingSession(true);
    try {
      await deleteSession(sessionId);
      setDeleteOpen(false);
      router.back();
    } catch {
      setDeleteOpen(false);
    } finally {
      setDeletingSession(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={tintColor} />
          <ThemedText style={{ color: tintColor, fontSize: 16 }}>Kembali</ThemedText>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }} numberOfLines={1}>
            {session?.label ?? 'Detail Absensi'}
          </ThemedText>
          <ThemedText type="muted" style={{ fontSize: 12 }}>{session?.tanggal}</ThemedText>
        </View>
        <View style={styles.headerRight}>
          {isAdmin && session ? (
            <>
              <Pressable
                onPress={() => setQrOpen(true)}
                style={({ pressed }) => [styles.headerIconBtn, { backgroundColor: tintColor + '15' }, pressed && { opacity: 0.65 }]}>
                <Ionicons name="qr-code" size={20} color={tintColor} />
              </Pressable>
              <Pressable
                onPress={() => setDeleteOpen(true)}
                style={({ pressed }) => [styles.headerIconBtn, { backgroundColor: dangerColor + '15' }, pressed && { opacity: 0.65 }]}>
                <Ionicons name="trash-outline" size={20} color={dangerColor} />
              </Pressable>
            </>
          ) : (
            <View style={{ width: 88 }} />
          )}
        </View>
      </View>

      {/* Info bar */}
      <View style={[styles.infoBar, { borderBottomColor: borderColor }]}>
        <View style={styles.infoChip}>
          <View style={[styles.infoDot, { backgroundColor: successColor ?? '#22c55e' }]} />
          <ThemedText style={{ fontSize: 13, fontWeight: '600', color: successColor ?? '#22c55e' }}>
            {hadirCount} Hadir
          </ThemedText>
        </View>
        <View style={[styles.infoSep, { backgroundColor: borderColor }]} />
        <View style={styles.infoChip}>
          <View style={[styles.infoDot, { backgroundColor: dangerColor }]} />
          <ThemedText style={{ fontSize: 13, fontWeight: '600', color: dangerColor }}>
            {tidakHadirCount} Tidak Hadir
          </ThemedText>
        </View>
        <View style={[styles.infoSep, { backgroundColor: borderColor }]} />
        <ThemedText type="muted" style={{ fontSize: 13 }}>{rows.length} total</ThemedText>
      </View>

      {/* Tabel header */}
      <View style={[styles.tableHeader, { backgroundColor: tintColor + '12', borderColor }]}>
        <ThemedText style={[styles.colNo, { color: tintColor, fontWeight: '700', fontSize: 12 }]}>No</ThemedText>
        <ThemedText style={[styles.colName, { color: tintColor, fontWeight: '700', fontSize: 12 }]}>Nama</ThemedText>
        <View style={[styles.colStatus]}>
          <ThemedText style={{ color: tintColor, fontWeight: '700', fontSize: 12 }}>
            Status{isAdmin ? ' ✎' : ''}
          </ThemedText>
        </View>
        <ThemedText style={[styles.colTime, { color: tintColor, fontWeight: '700', fontSize: 12 }]}>Waktu</ThemedText>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {rows.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={mutedColor} />
            <ThemedText type="muted" style={{ marginTop: 12, textAlign: 'center' }}>Belum ada data pengguna</ThemedText>
          </View>
        ) : (
          rows.map((row, i) => {
            const isToggling = togglingIds.has(row.id);
            const statusColor = row.hadir ? (successColor ?? '#22c55e') : dangerColor;
            return (
              <View
                key={row.id}
                style={[
                  styles.tableRow,
                  { borderBottomColor: borderColor },
                  !row.hadir && { backgroundColor: dangerColor + '08' },
                  i % 2 === 1 && row.hadir && { backgroundColor: 'rgba(127,127,127,0.03)' },
                ]}>
                <ThemedText style={[styles.colNo, { fontSize: 14, color: mutedColor }]}>{i + 1}</ThemedText>
                <ThemedText type="defaultSemiBold" style={[styles.colName, { fontSize: 14 }]} numberOfLines={1}>
                  {row.nama}
                </ThemedText>

                {/* Badge ikon — bisa diklik admin */}
                <View style={styles.colStatus}>
                  {isToggling ? (
                    <ActivityIndicator size="small" color={statusColor} />
                  ) : isAdmin ? (
                    <Pressable
                      onPress={() => onToggle(row)}
                      style={({ pressed }) => [
                        styles.iconBadge,
                        { backgroundColor: statusColor + '18' },
                        pressed && { opacity: 0.55, transform: [{ scale: 0.9 }] },
                      ]}>
                      <Ionicons
                        name={row.hadir ? 'checkmark-circle' : 'close-circle'}
                        size={20}
                        color={statusColor}
                      />
                    </Pressable>
                  ) : (
                    <View style={[styles.iconBadge, { backgroundColor: statusColor + '18' }]}>
                      <Ionicons
                        name={row.hadir ? 'checkmark-circle' : 'close-circle'}
                        size={20}
                        color={statusColor}
                      />
                    </View>
                  )}
                </View>

                <ThemedText type="muted" style={[styles.colTime, { fontSize: 12 }]}>
                  {row.waktu
                    ? new Date(row.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </ThemedText>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal QR */}
      <Modal visible={qrOpen} transparent animationType="fade">
        <View style={styles.qrOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setQrOpen(false)} />
          <ThemedView type="card" style={styles.qrCard}>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 18, marginBottom: 4, textAlign: 'center' }}>
              {session?.label}
            </ThemedText>
            <ThemedText type="muted" style={{ fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
              Tunjukkan QR ini kepada peserta
            </ThemedText>
            {session && (
              <QRCode
                value={JSON.stringify({ eventId: session.eventId, sessionId: session.id })}
                size={220}
                color={textColor}
                backgroundColor="transparent"
              />
            )}
            <Pressable
              onPress={() => setQrOpen(false)}
              style={({ pressed }) => [styles.actionBtn, { backgroundColor: tintColor }, pressed && { opacity: 0.85 }]}>
              <ThemedText style={styles.actionBtnText}>Tutup</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>

      {/* Modal Hapus Sesi */}
      <Modal visible={deleteOpen} transparent animationType="fade">
        <View style={styles.qrOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setDeleteOpen(false)} />
          <ThemedView type="card" style={[styles.qrCard, { alignItems: 'flex-start' }]}>
            <View style={[styles.dangerIconWrap, { backgroundColor: dangerColor + '18' }]}>
              <Ionicons name="trash-outline" size={22} color={dangerColor} />
            </View>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 18, marginBottom: 8 }}>Hapus Sesi</ThemedText>
            <ThemedText type="muted" style={{ fontSize: 14, lineHeight: 20, marginBottom: 8 }}>
              Data absensi untuk sesi ini akan ikut terhapus.
            </ThemedText>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 14, marginBottom: 24 }}>{session?.label}</ThemedText>
            <View style={styles.delActions}>
              <Pressable
                onPress={() => setDeleteOpen(false)}
                disabled={deletingSession}
                style={({ pressed }) => [styles.delBtn, { borderWidth: 1, borderColor, backgroundColor: 'transparent' }, pressed && { opacity: 0.85 }]}>
                <ThemedText style={{ fontWeight: '600', color: textColor }}>Batal</ThemedText>
              </Pressable>
              <Pressable
                onPress={onConfirmDelete}
                disabled={deletingSession}
                style={({ pressed }) => [styles.delBtn, { backgroundColor: dangerColor }, (pressed || deletingSession) && { opacity: 0.7 }]}>
                <ThemedText style={styles.actionBtnText}>{deletingSession ? 'Menghapus...' : 'Hapus'}</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
      {/* Modal Konfirmasi Toggle */}
      <Modal visible={!!confirmToggle} transparent animationType="fade">
        <View style={styles.qrOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setConfirmToggle(null)} />
          <ThemedView type="card" style={[styles.qrCard, { alignItems: 'flex-start' }]}>
            <View style={[styles.dangerIconWrap, {
              backgroundColor: (confirmToggle?.hadir ? dangerColor : (successColor ?? '#22c55e')) + '18',
            }]}>
              <Ionicons
                name={confirmToggle?.hadir ? 'close-circle-outline' : 'checkmark-circle-outline'}
                size={26}
                color={confirmToggle?.hadir ? dangerColor : (successColor ?? '#22c55e')}
              />
            </View>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 18, marginBottom: 6 }}>
              {confirmToggle?.hadir ? 'Tandai Tidak Hadir?' : 'Tandai Hadir?'}
            </ThemedText>
            <ThemedText type="muted" style={{ fontSize: 14, lineHeight: 20, marginBottom: 24 }}>
              {confirmToggle?.hadir
                ? `Tandai "${confirmToggle?.nama}" sebagai tidak hadir?`
                : `Tandai "${confirmToggle?.nama}" sebagai hadir?`}
            </ThemedText>
            <View style={styles.delActions}>
              <Pressable
                onPress={() => setConfirmToggle(null)}
                style={({ pressed }) => [styles.delBtn, { borderWidth: 1, borderColor, backgroundColor: 'transparent' }, pressed && { opacity: 0.8 }]}>
                <ThemedText style={{ fontWeight: '600', color: textColor }}>Batal</ThemedText>
              </Pressable>
              <Pressable
                onPress={onConfirmToggle}
                style={({ pressed }) => [
                  styles.delBtn,
                  { backgroundColor: confirmToggle?.hadir ? dangerColor : (successColor ?? '#22c55e') },
                  pressed && { opacity: 0.85 },
                ]}>
                <ThemedText style={styles.actionBtnText}>
                  {confirmToggle?.hadir ? 'Tidak Hadir' : 'Tandai Hadir'}
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
      <ScanQrFab />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 80 },
  headerRight: { width: 88, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  headerIconBtn: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  infoBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1 },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoDot: { width: 8, height: 8, borderRadius: 4 },
  infoSep: { width: 1, height: 14 },
  tableHeader: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderTopWidth: 1 },
  tableRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 11, borderBottomWidth: 1, alignItems: 'center' },
  colNo: { width: 32, textAlign: 'center' },
  colName: { flex: 1, paddingHorizontal: 10 },
  colStatus: { width: 90, alignItems: 'center' },
  colTime: { width: 52, textAlign: 'right' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  iconBadge: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 80 },
  qrOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 24 },
  qrCard: { borderRadius: 24, padding: 28, alignItems: 'center', width: '100%', maxWidth: 400 },
  actionBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 20, width: '100%' },
  actionBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  dangerIconWrap: { marginBottom: 16, width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  delActions: { flexDirection: 'row', gap: 12, width: '100%' },
  delBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
});
