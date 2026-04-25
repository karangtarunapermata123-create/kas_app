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
import {
    ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

const BULAN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

type Profile = { id: string; nama_lengkap: string | null; email: string | null };
type DbSession = { id: string; label: string; tanggal: string };
type LocalAtt = { id: string; sessionId: string; userId: string };

const COL_NAME = 148;
const COL_MONTH = 54;
const ROW_H = 50;
const HEAD_H = 60;

export default function YearDetailScreen() {
  const { eventId, year } = useLocalSearchParams<{ eventId: string; year: string }>();
  const yearNum = parseInt(year ?? '0', 10);

  const { isAdmin } = useAdmin();
  const { events } = useAbsensi();

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const mutedColor = useThemeColor({}, 'muted');
  const textColor = useThemeColor({}, 'text');
  const dangerColor = useThemeColor({}, 'danger');
  const successColor = (useThemeColor({}, 'success') as string | undefined) ?? '#22c55e';

  const event = useMemo(() => events.find(e => e.id === eventId), [events, eventId]);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [dbSessions, setDbSessions] = useState<(DbSession | null)[]>(Array(12).fill(null));
  const [attendances, setAttendances] = useState<LocalAtt[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [activatingMonth, setActivatingMonth] = useState<number | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<{ userId: string; monthIdx: number; nama: string; hadir: boolean } | null>(null);

  const activeSessionIdsRef = useRef<Set<string>>(new Set());

  const refetchAttendancesForActiveSessions = useCallback(async () => {
    const ids = Array.from(activeSessionIdsRef.current);
    if (ids.length === 0) {
      setAttendances([]);
      return;
    }
    const { data } = await supabase
      .from('attendances')
      .select('id, session_id, user_id')
      .in('session_id', ids);
    if (data) {
      setAttendances(data.map((r: any) => ({ id: r.id, sessionId: r.session_id, userId: r.user_id })));
    }
  }, []);

  // Modal header bulan
  const [monthMenuIdx, setMonthMenuIdx] = useState<number | null>(null);
  // Modal QR
  const [qrMonth, setQrMonth] = useState<number | null>(null);
  // Hapus sesi bulan
  const [deletingMonth, setDeletingMonth] = useState<number | null>(null);
  const [confirmDeleteMonth, setConfirmDeleteMonth] = useState<number | null>(null);

  // ─── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!eventId || !yearNum) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        // Fetch absensi_members dulu, lalu filter profiles berdasarkan user_id
        const memberRes = await supabase.from('absensi_members').select('user_id');
        const memberIds = (memberRes.data ?? []).map((r: any) => r.user_id as string);

        const [profileRes, sesRes] = await Promise.all([
          memberIds.length > 0
            ? supabase.from('profiles').select('id, nama_lengkap, email').in('id', memberIds).order('nama_lengkap', { ascending: true })
            : Promise.resolve({ data: [] }),
          supabase.from('event_sessions')
            .select('id, label, tanggal')
            .eq('event_id', eventId)
            .gte('tanggal', `${yearNum}-01-01`)
            .lte('tanggal', `${yearNum}-12-31`),
        ]);
        if (cancelled) return;
        if (profileRes.data) setProfiles(profileRes.data as Profile[]);

        const slots: (DbSession | null)[] = Array(12).fill(null);
        for (const r of (sesRes.data ?? [])) {
          const m = parseInt((r as any).tanggal.split('-')[1], 10) - 1;
          if (m >= 0 && m < 12) slots[m] = { id: (r as any).id, label: (r as any).label, tanggal: (r as any).tanggal };
        }
        setDbSessions(slots);

        activeSessionIdsRef.current = new Set(slots.filter(Boolean).map(s => s!.id));

        const ids = slots.filter(Boolean).map(s => s!.id);
        if (ids.length > 0) {
          const { data: attData } = await supabase
            .from('attendances').select('id, session_id, user_id').in('session_id', ids);
          if (!cancelled && attData)
            setAttendances(attData.map((r: any) => ({ id: r.id, sessionId: r.session_id, userId: r.user_id })));
        }
      } catch (e) {
        console.error('year-detail load error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, yearNum, refetchAttendancesForActiveSessions]);

  useEffect(() => {
    if (!eventId || !yearNum) return;
    const channel = supabase
      .channel(`year-att-${eventId}-${yearNum}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendances', filter: `event_id=eq.${eventId}` },
        (payload) => {
          const newItem = payload.new as any;
          const aid = newItem.id as string | undefined;
          const sid = newItem.session_id as string | undefined;
          const uid = newItem.user_id as string | undefined;
          if (!aid || !sid || !uid) {
            refetchAttendancesForActiveSessions();
            return;
          }
          if (!activeSessionIdsRef.current.has(sid)) return;
          setAttendances(prev =>
            prev.some(a => a.id === aid) ? prev : [...prev, { id: aid, sessionId: sid, userId: uid }]
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'attendances' },
        (payload) => {
          const oldItem = payload.old as any;
          const aid = oldItem.id as string | undefined;
          const sid = oldItem.session_id as string | undefined;
          const uid = oldItem.user_id as string | undefined;

          if (aid) {
            setAttendances(prev => prev.filter(a => a.id !== aid));
            return;
          }

          if (!sid || !uid) {
            refetchAttendancesForActiveSessions();
            return;
          }
          if (!activeSessionIdsRef.current.has(sid)) return;
          setAttendances(prev => prev.filter(a => !(a.sessionId === sid && a.userId === uid)));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId, yearNum, refetchAttendancesForActiveSessions]);

  // Realtime subscription untuk sesi (agar saat diaktifkan langsung muncul)
  useEffect(() => {
    if (!eventId || !yearNum) return;
    const channel = supabase
      .channel(`year-sessions-${eventId}-${yearNum}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'event_sessions', 
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newSes = payload.new as any;
            if (newSes.event_id !== eventId) return; // Manual filter
            
            const m = parseInt(newSes.tanggal.split('-')[1], 10) - 1;
            const y = parseInt(newSes.tanggal.split('-')[0], 10);
            
            if (y === yearNum && m >= 0 && m < 12) {
              setDbSessions(prev => {
                const next = [...prev];
                next[m] = { id: newSes.id, label: newSes.label, tanggal: newSes.tanggal };
                return next;
              });
              activeSessionIdsRef.current.add(newSes.id);
            }
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any).id;
            if (activeSessionIdsRef.current.has(oldId)) {
              setDbSessions(prev => {
                const next = [...prev];
                const idx = next.findIndex(s => s?.id === oldId);
                if (idx !== -1) next[idx] = null;
                return next;
              });
              setAttendances(prev => prev.filter(a => a.sessionId !== oldId));
              activeSessionIdsRef.current.delete(oldId);
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId, yearNum]);

  // ─── Aktifkan bulan ─────────────────────────────────────────────────────────
  const onActivateMonth = useCallback(async (monthIdx: number) => {
    if (!isAdmin || !eventId) return;
    if (dbSessions[monthIdx]) return; // sudah aktif
    setActivatingMonth(monthIdx);
    setMonthMenuIdx(null);
    try {
      const tanggal = `${yearNum}-${String(monthIdx + 1).padStart(2, '0')}-01`;
      const label = `${BULAN_FULL[monthIdx]} ${yearNum}`;
      const now = Date.now();
      const id = `ev_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const { error } = await supabase.from('event_sessions').insert({
        id, event_id: eventId, label, tanggal, created_at: now,
      });
      if (error) throw new Error(error.message);
      setDbSessions(prev => {
        const next = [...prev];
        next[monthIdx] = { id, label, tanggal };
        return next;
      });

      activeSessionIdsRef.current = new Set([
        ...Array.from(activeSessionIdsRef.current),
        id,
      ]);
    } catch (e) {
      console.error('activate month error:', e);
    } finally {
      setActivatingMonth(null);
    }
  }, [isAdmin, eventId, yearNum, dbSessions]);

  // ─── Hapus sesi bulan ───────────────────────────────────────────────────────
  const onDeleteMonth = useCallback(async (monthIdx: number) => {
    if (!isAdmin) return;
    const ses = dbSessions[monthIdx];
    if (!ses) return;
    setDeletingMonth(monthIdx);
    setConfirmDeleteMonth(null);
    try {
      // Hapus attendances sesi ini dulu
      await supabase.from('attendances').delete().eq('session_id', ses.id);
      // Hapus sesi
      const { error } = await supabase.from('event_sessions').delete().eq('id', ses.id);
      if (error) throw new Error(error.message);
      // Update state lokal
      setDbSessions(prev => {
        const next = [...prev];
        next[monthIdx] = null;
        return next;
      });
      setAttendances(prev => prev.filter(a => a.sessionId !== ses.id));

      if (activeSessionIdsRef.current.has(ses.id)) {
        const next = new Set(activeSessionIdsRef.current);
        next.delete(ses.id);
        activeSessionIdsRef.current = next;
      }
    } catch (e) {
      console.error('delete month error:', e);
    } finally {
      setDeletingMonth(null);
    }
  }, [isAdmin, dbSessions]);

  // ─── Toggle hadir — hanya untuk bulan yang sudah aktif ──────────────────────
  const onToggle = useCallback((userId: string, monthIdx: number, nama: string) => {
    if (!isAdmin) return;
    const ses = dbSessions[monthIdx];
    if (!ses) return;
    const hadir = attendances.some(a => a.sessionId === ses.id && a.userId === userId);
    setConfirmToggle({ userId, monthIdx, nama, hadir });
  }, [isAdmin, dbSessions, attendances]);

  const onConfirmToggle = useCallback(async () => {
    if (!confirmToggle || !eventId) return;
    const { userId, monthIdx, nama, hadir } = confirmToggle;
    setConfirmToggle(null);
    const ses = dbSessions[monthIdx];
    if (!ses) return;
    const key = `${userId}-${monthIdx}`;
    setTogglingKey(key);
    try {
      if (hadir) {
        const { error } = await supabase.from('attendances')
          .delete().eq('session_id', ses.id).eq('user_id', userId);
        if (error) throw new Error(error.message);
        setAttendances(prev => prev.filter(a => !(a.sessionId === ses.id && a.userId === userId)));
      } else {
        const id = `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const { error } = await supabase.from('attendances').insert({
          id, event_id: eventId, session_id: ses.id,
          user_id: userId, nama_user: nama, waktu_absen: Date.now(),
        });
        if (error) throw new Error(error.message);
        setAttendances(prev => [...prev, { id, sessionId: ses.id, userId }]);
      }
    } catch (e) {
      console.error('toggle error:', e);
    } finally {
      setTogglingKey(null);
    }
  }, [confirmToggle, eventId, dbSessions]);

  // ─── Lookup ─────────────────────────────────────────────────────────────────
  const attBySession = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const a of attendances) {
      if (!map[a.sessionId]) map[a.sessionId] = new Set();
      map[a.sessionId].add(a.userId);
    }
    return map;
  }, [attendances]);

  const totalPerBulan = useMemo(() =>
    dbSessions.map(s => s ? (attBySession[s.id]?.size ?? 0) : null),
    [dbSessions, attBySession]
  );

  const qrSession = qrMonth !== null ? dbSessions[qrMonth] : null;
  const menuSession = monthMenuIdx !== null ? dbSessions[monthMenuIdx] : null;

  if (!event) return null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={['top']}>
      {/* Header halaman */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <Ionicons name="chevron-back" size={24} color={tintColor} />
          <ThemedText style={{ color: tintColor, fontSize: 16 }}>Kembali</ThemedText>
        </Pressable>
        <View style={styles.headerCenter}>
          <ThemedText type="defaultSemiBold" style={styles.headerTitle} numberOfLines={1}>
            {event.nama} · {yearNum}
          </ThemedText>
          <ThemedText type="muted" style={styles.headerSub}>
            {dbSessions.filter(Boolean).length} bulan aktif
          </ThemedText>
        </View>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={tintColor} size="large" />
        </View>
      ) : profiles.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={48} color={mutedColor} />
          <ThemedText type="muted" style={{ marginTop: 12 }}>Belum ada anggota</ThemedText>
        </View>
      ) : (
        <StickyTable
          profiles={profiles}
          dbSessions={dbSessions}
          attBySession={attBySession}
          totalPerBulan={totalPerBulan}
          isAdmin={isAdmin}
          activatingMonth={activatingMonth}
          deletingMonth={deletingMonth}
          togglingKey={togglingKey}
          tintColor={tintColor}
          backgroundColor={backgroundColor}
          borderColor={borderColor}
          mutedColor={mutedColor}
          successColor={successColor}
          dangerColor={dangerColor}
          onToggle={onToggle}
          onMonthPress={(m) => isAdmin ? setMonthMenuIdx(m) : undefined}
        />
      )}

      {/* ── Modal menu header bulan ── */}
      <Modal visible={monthMenuIdx !== null} transparent animationType="fade">
        <Pressable style={styles.menuOverlay} onPress={() => setMonthMenuIdx(null)}>
          <ThemedView type="card" style={[styles.menuCard, { borderColor }]}>
            {/* Judul */}
            <View style={[styles.menuTitleRow, { borderBottomColor: borderColor }]}>
              <View style={[styles.menuIconBox, { backgroundColor: tintColor + '18' }]}>
                <Ionicons name="calendar" size={18} color={tintColor} />
              </View>
              <View>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>
                  {monthMenuIdx !== null ? BULAN_FULL[monthMenuIdx] : ''} {yearNum}
                </ThemedText>
                <ThemedText type="muted" style={{ fontSize: 12 }}>
                  {menuSession ? 'Bulan aktif' : 'Belum aktif'}
                </ThemedText>
              </View>
            </View>

            {/* Opsi: Aktifkan */}
            {!menuSession && (
              <Pressable
                onPress={() => monthMenuIdx !== null && onActivateMonth(monthMenuIdx)}
                style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]}>
                <View style={[styles.menuItemIcon, { backgroundColor: successColor + '18' }]}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={successColor} />
                </View>
                <ThemedText style={[styles.menuItemText, { color: successColor }]}>Aktifkan Bulan Ini</ThemedText>
              </Pressable>
            )}

            {/* Opsi: Tampilkan QR — hanya kalau sudah aktif */}
            {menuSession && (
              <Pressable
                onPress={() => { setQrMonth(monthMenuIdx); setMonthMenuIdx(null); }}
                style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]}>
                <View style={[styles.menuItemIcon, { backgroundColor: tintColor + '18' }]}>
                  <Ionicons name="qr-code-outline" size={20} color={tintColor} />
                </View>
                <ThemedText style={[styles.menuItemText, { color: tintColor }]}>Tampilkan QR Code</ThemedText>
              </Pressable>
            )}

            {/* Opsi: Hapus sesi — hanya kalau sudah aktif */}
            {menuSession && (
              <Pressable
                onPress={() => { setConfirmDeleteMonth(monthMenuIdx); setMonthMenuIdx(null); }}
                style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]}>
                <View style={[styles.menuItemIcon, { backgroundColor: dangerColor + '18' }]}>
                  <Ionicons name="trash-outline" size={20} color={dangerColor} />
                </View>
                <ThemedText style={[styles.menuItemText, { color: dangerColor }]}>Hapus Sesi Bulan Ini</ThemedText>
              </Pressable>
            )}

            {/* Batal */}
            <Pressable
              onPress={() => setMonthMenuIdx(null)}
              style={({ pressed }) => [styles.menuItem, { marginTop: 4 }, pressed && { opacity: 0.6 }]}>
              <ThemedText type="muted" style={{ fontSize: 14, textAlign: 'center', flex: 1 }}>Batal</ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      </Modal>

      {/* ── Modal Konfirmasi Toggle ── */}
      <Modal visible={!!confirmToggle} transparent animationType="fade">
        <View style={styles.qrOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setConfirmToggle(null)} />
          <View style={[styles.qrCard, { backgroundColor }]}>
            <View style={[styles.confirmIconBox, {
              backgroundColor: (confirmToggle?.hadir ? dangerColor : successColor) + '18',
            }]}>
              <Ionicons
                name={confirmToggle?.hadir ? 'close-circle-outline' : 'checkmark-circle-outline'}
                size={28}
                color={confirmToggle?.hadir ? dangerColor : successColor}
              />
            </View>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 18, marginBottom: 6, textAlign: 'left', width: '100%' }}>
              {confirmToggle?.hadir ? 'Tandai Tidak Hadir?' : 'Tandai Hadir?'}
            </ThemedText>
            <ThemedText type="muted" style={{ fontSize: 14, lineHeight: 20, marginBottom: 24, width: '100%' }}>
              {confirmToggle?.hadir
                ? `Tandai "${confirmToggle?.nama}" sebagai tidak hadir?`
                : `Tandai "${confirmToggle?.nama}" sebagai hadir?`}
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <Pressable
                onPress={() => setConfirmToggle(null)}
                style={({ pressed }) => [styles.confirmBtn, { borderWidth: 1, borderColor, backgroundColor: 'transparent' }, pressed && { opacity: 0.8 }]}>
                <ThemedText style={{ fontWeight: '600', color: textColor }}>Batal</ThemedText>
              </Pressable>
              <Pressable
                onPress={onConfirmToggle}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  { backgroundColor: confirmToggle?.hadir ? dangerColor : successColor },
                  pressed && { opacity: 0.85 },
                ]}>
                <ThemedText style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>
                  {confirmToggle?.hadir ? 'Tidak Hadir' : 'Tandai Hadir'}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal QR ── */}
      <Modal visible={qrMonth !== null} transparent animationType="fade">
        <View style={styles.qrOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setQrMonth(null)} />
          <View style={[styles.qrCard, { backgroundColor }]}>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 18, marginBottom: 4, textAlign: 'center' }}>
              {qrMonth !== null ? BULAN_FULL[qrMonth] : ''} {yearNum}
            </ThemedText>
            <ThemedText type="muted" style={{ fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
              Tunjukkan QR ini kepada peserta
            </ThemedText>
            {qrSession && (
              <QRCode
                value={JSON.stringify({ eventId, sessionId: qrSession.id })}
                size={220}
                color={textColor}
                backgroundColor="transparent"
              />
            )}
            <Pressable
              onPress={() => setQrMonth(null)}
              style={({ pressed }) => [styles.closeBtn, { backgroundColor: tintColor }, pressed && { opacity: 0.8 }]}>
              <ThemedText style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>Tutup</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Modal Konfirmasi Hapus Sesi Bulan ── */}
      <Modal visible={confirmDeleteMonth !== null} transparent animationType="fade">
        <View style={styles.qrOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setConfirmDeleteMonth(null)} />
          <View style={[styles.qrCard, { backgroundColor, alignItems: 'flex-start' }]}>
            <View style={[styles.confirmIconBox, { backgroundColor: dangerColor + '18' }]}>
              <Ionicons name="trash-outline" size={28} color={dangerColor} />
            </View>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 18, marginBottom: 6, width: '100%' }}>
              Hapus Sesi Bulan Ini?
            </ThemedText>
            <ThemedText type="muted" style={{ fontSize: 14, lineHeight: 20, marginBottom: 24, width: '100%' }}>
              Hapus sesi{confirmDeleteMonth !== null ? ` "${BULAN_FULL[confirmDeleteMonth]} ${yearNum}"` : ''}? Semua data absensi bulan ini akan ikut terhapus.
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <Pressable
                onPress={() => setConfirmDeleteMonth(null)}
                style={({ pressed }) => [styles.confirmBtn, { borderWidth: 1, borderColor, backgroundColor: 'transparent' }, pressed && { opacity: 0.8 }]}>
                <ThemedText style={{ fontWeight: '600', color: textColor }}>Batal</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => confirmDeleteMonth !== null && onDeleteMonth(confirmDeleteMonth)}
                style={({ pressed }) => [styles.confirmBtn, { backgroundColor: dangerColor }, pressed && { opacity: 0.85 }]}>
                <ThemedText style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>Hapus</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <ScanQrFab />
    </SafeAreaView>
  );
}

type StickyTableProps = {
  profiles: Profile[];
  dbSessions: (DbSession | null)[];
  attBySession: Record<string, Set<string>>;
  totalPerBulan: (number | null)[];
  isAdmin: boolean;
  activatingMonth: number | null;
  deletingMonth: number | null;
  togglingKey: string | null;
  tintColor: string;
  backgroundColor: string;
  borderColor: string;
  mutedColor: string;
  successColor: string;
  dangerColor: string;
  onToggle: (userId: string, monthIdx: number, nama: string) => void;
  onMonthPress: (m: number) => void;
};

function StickyTable({
  profiles, dbSessions, attBySession, totalPerBulan,
  isAdmin, activatingMonth, deletingMonth, togglingKey,
  tintColor, backgroundColor: _unused, borderColor, mutedColor, successColor, dangerColor,
  onToggle, onMonthPress,
}: StickyTableProps) {
  const now = new Date();
  const { year } = useLocalSearchParams<{ year: string }>();
  const isCurrentYear = now.getFullYear() === parseInt(year ?? '0', 10);
  const currentMonthIdx = isCurrentYear ? now.getMonth() : -1;

  const headerScrollRef = useRef<ScrollView>(null);
  const footerScrollRef = useRef<ScrollView>(null);
  const bodyScrollRef = useRef<ScrollView>(null);
  const [bodyHeight, setBodyHeight] = useState(0);

  const onBodyScroll = useCallback((e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    headerScrollRef.current?.scrollTo({ x, animated: false });
    footerScrollRef.current?.scrollTo({ x, animated: false });
  }, []);

  const rightPanelWidth = 12 * COL_MONTH;

  // Hitung filler rows agar tabel mengisi sisa layar
  const contentRows = profiles.length;
  const fillerCount = bodyHeight > 0
    ? Math.max(0, Math.ceil((bodyHeight - contentRows * ROW_H) / ROW_H))
    : 0;

  return (
    <View style={{ flex: 1 }}>
      {/* ── Header ── */}
      <View style={[{
        flexDirection: 'row',
        height: HEAD_H,
        backgroundColor: tintColor + '12',
        borderBottomColor: borderColor,
        borderBottomWidth: 1,
        borderTopColor: borderColor,
        borderTopWidth: 1,
      }]}>
        {/* Sticky: kolom Nama */}
        <View style={[{
          width: COL_NAME, justifyContent: 'center', alignItems: 'center',
          borderRightColor: borderColor, borderRightWidth: 1,
        }]}>
          <ThemedText style={[styles.headText, { color: tintColor }]}>Nama</ThemedText>
        </View>
        {/* Scrollable: kolom bulan */}
        <ScrollView
          ref={headerScrollRef}
          horizontal
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          <View style={{ width: rightPanelWidth, flexDirection: 'row' }}>
            {Array.from({ length: 12 }, (_, m) => {
              const isActive = dbSessions[m] !== null;
              const isActivating = activatingMonth === m;
              const isDeleting = deletingMonth === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => onMonthPress(m)}
                  style={({ pressed }) => [
                    styles.monthCell, styles.cellCenter,
                    {
                      borderRightColor: borderColor, borderRightWidth: 1,
                      backgroundColor: isActive ? tintColor + '20' : 'rgba(127,127,127,0.06)',
                    },
                    m === currentMonthIdx && !isActive && { backgroundColor: tintColor + '08' },
                    pressed && isAdmin && { opacity: 0.65 },
                  ]}>
                  {isActivating || isDeleting ? (
                    <ActivityIndicator size="small" color={isDeleting ? dangerColor : tintColor} />
                  ) : (
                    <>
                      <ThemedText style={[styles.headText, { color: isActive ? tintColor : mutedColor }]}>
                        {BULAN_SHORT[m]}
                      </ThemedText>
                      {m === currentMonthIdx && (
                        <ThemedText style={{ fontSize: 7, color: tintColor, fontWeight: '700', marginTop: -2 }}>
                          BULAN INI
                        </ThemedText>
                      )}
                      {isActive && <View style={[styles.activeDot, { backgroundColor: tintColor }]} />}
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* ── Body ── */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => setBodyHeight(e.nativeEvent.layout.height)}
      >
        <View style={{ flexDirection: 'row' }}>
          {/* Sticky: kolom Nama */}
          <View style={{ width: COL_NAME, borderRightColor: borderColor, borderRightWidth: 1 }}>
            {profiles.map((p, rowIdx) => {
              const nama = p.nama_lengkap ?? p.email ?? '(tanpa nama)';
              return (
                <View
                  key={p.id}
                  style={[{
                    height: ROW_H, justifyContent: 'center', paddingHorizontal: 12,
                    borderBottomColor: borderColor, borderBottomWidth: 1,
                  }, rowIdx % 2 === 1 && { backgroundColor: 'rgba(127,127,127,0.03)' }]}>
                  <ThemedText style={styles.nameText} numberOfLines={1}>{nama}</ThemedText>
                </View>
              );
            })}
            {/* Filler rows kosong */}
            {Array.from({ length: fillerCount }, (_, i) => (
              <View key={`filler-left-${i}`} style={{
                height: ROW_H, borderBottomColor: borderColor, borderBottomWidth: 1,
              }} />
            ))}
          </View>

          {/* Scrollable: kolom bulan */}
          <ScrollView
            ref={bodyScrollRef}
            horizontal
            showsHorizontalScrollIndicator
            nestedScrollEnabled
            onScroll={onBodyScroll}
            scrollEventThrottle={16}
            style={{ flex: 1 }}
          >
            <View style={{ width: rightPanelWidth }}>
              {profiles.map((p, rowIdx) => {
                const nama = p.nama_lengkap ?? p.email ?? '(tanpa nama)';
                return (
                  <View
                    key={p.id}
                    style={[
                      styles.row,
                      { height: ROW_H, borderBottomColor: borderColor, borderBottomWidth: 1 },
                      rowIdx % 2 === 1 && { backgroundColor: 'rgba(127,127,127,0.03)' },
                    ]}>
                    {Array.from({ length: 12 }, (_, m) => {
                      const ses = dbSessions[m];
                      const isActive = ses !== null;
                      const key = `${p.id}-${m}`;
                      const isToggling = togglingKey === key;
                      const hadir = ses ? (attBySession[ses.id]?.has(p.id) ?? false) : false;
                      return (
                        <View
                          key={m}
                          style={[
                            styles.monthCell, styles.cellCenter,
                            { borderRightColor: borderColor, borderRightWidth: 1 },
                            !isActive && { backgroundColor: 'rgba(127,127,127,0.04)' },
                          ]}>
                          {!isActive ? (
                            <ThemedText style={{ color: mutedColor, fontSize: 16, opacity: 0.4 }}>–</ThemedText>
                          ) : isToggling ? (
                            <ActivityIndicator size="small" color={tintColor} />
                          ) : isAdmin ? (
                            <Pressable
                              onPress={() => onToggle(p.id, m, nama)}
                              style={({ pressed }) => [
                                styles.toggleBtn,
                                { backgroundColor: hadir ? successColor + '22' : dangerColor + '18' },
                                pressed && { opacity: 0.55, transform: [{ scale: 0.88 }] },
                              ]}>
                              <Ionicons name={hadir ? 'checkmark-circle' : 'close-circle'} size={22} color={hadir ? successColor : dangerColor} />
                            </Pressable>
                          ) : (
                            <View style={[styles.toggleBtn, { backgroundColor: hadir ? successColor + '22' : dangerColor + '18' }]}>
                              <Ionicons name={hadir ? 'checkmark-circle' : 'close-circle'} size={22} color={hadir ? successColor : dangerColor} />
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                );
              })}
              {/* Filler rows kosong */}
              {Array.from({ length: fillerCount }, (_, i) => (
                <View key={`filler-right-${i}`} style={[styles.row, {
                  height: ROW_H, borderBottomColor: borderColor, borderBottomWidth: 1,
                }]}>
                  {Array.from({ length: 12 }, (_, m) => (
                    <View key={m} style={[styles.monthCell, { borderRightColor: borderColor, borderRightWidth: 1 }]} />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      {/* ── Footer sticky Total Hadir ── */}
      <View style={{
        flexDirection: 'row',
        height: ROW_H,
        backgroundColor: tintColor + '08',
        borderTopColor: borderColor,
        borderTopWidth: 1.5,
      }}>
        {/* Sticky: label */}
        <View style={{
          width: COL_NAME, justifyContent: 'center', alignItems: 'center',
          borderRightColor: borderColor, borderRightWidth: 1,
        }}>
          <ThemedText style={[styles.footText, { color: tintColor }]}>Total Hadir</ThemedText>
        </View>
        {/* Scrollable: angka per bulan */}
        <ScrollView
          ref={footerScrollRef}
          horizontal
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          <View style={{ width: rightPanelWidth, flexDirection: 'row' }}>
            {totalPerBulan.map((count, m) => (
              <View key={m} style={[styles.monthCell, styles.cellCenter, { borderRightColor: borderColor, borderRightWidth: 1 }]}>
                <ThemedText style={[styles.footText, { color: count != null && count > 0 ? tintColor : mutedColor }]}>
                  {count != null ? count : '–'}
                </ThemedText>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRight: { width: 80 },
  backBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4, gap: 4, width: 80,
  },
  headerTitle: { fontSize: 17, textAlign: 'center' },
  headerSub: { fontSize: 12, marginTop: 1, textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row' },
  cellCenter: { justifyContent: 'center', alignItems: 'center' },
  nameCell: { width: COL_NAME },
  monthCell: { width: COL_MONTH },
  headText: { fontSize: 11, fontWeight: '700' },
  nameText: { fontSize: 13 },
  footText: { fontSize: 12, fontWeight: '700' },
  activeDot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },
  toggleBtn: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  // Menu modal
  menuOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', padding: 32,
  },
  menuCard: {
    width: '100%', maxWidth: 320, borderRadius: 20,
    padding: 8, borderWidth: 1,
  },
  menuTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, marginBottom: 4,
  },
  menuIconBox: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12,
  },
  menuItemIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  menuItemText: { fontSize: 15, fontWeight: '600' },
  // QR modal
  qrOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', padding: 24,
  },
  qrCard: {
    borderRadius: 24, padding: 28, alignItems: 'center',
    width: '100%', maxWidth: 380,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  closeBtn: {
    marginTop: 20, paddingVertical: 14, borderRadius: 14,
    alignItems: 'center', width: '100%',
  },
  confirmIconBox: {
    width: 52, height: 52, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  confirmBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
  },
});
