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
    ActivityIndicator,
    Alert,
    Modal, Pressable, ScrollView, StyleSheet, View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

type Profile = { id: string; nama_lengkap: string | null; email: string | null };
type DbSession = { id: string; label: string; tanggal: string };
type LocalAtt = { id: string; sessionId: string; userId: string };

const COL_NAME = 148;
const COL_WEEK = 100;
const ROW_H = 50;
const HEAD_H = 60;

const BULAN_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function WeeklyYearDetailScreen() {
  const { eventId, year } = useLocalSearchParams<{ eventId: string; year: string }>();
  const yearNum = parseInt(year ?? '0', 10);

  const { isAdmin } = useAdmin();
  const { events, addSession } = useAbsensi();

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const mutedColor = useThemeColor({}, 'muted');
  const textColor = useThemeColor({}, 'text');
  const dangerColor = useThemeColor({}, 'danger');
  const successColor = (useThemeColor({}, 'success') as string | undefined) ?? '#22c55e';

  const event = useMemo(() => events.find(e => e.id === eventId), [events, eventId]);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [dbSessions, setDbSessions] = useState<DbSession[]>([]);
  const [attendances, setAttendances] = useState<LocalAtt[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  
  // State navigasi bulan
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    if (now.getFullYear() === yearNum) return now.getMonth();
    return 0;
  });

  const [activatingWeek, setActivatingWeek] = useState<string | null>(null);
  const [activationMenu, setActivationMenu] = useState<{ label: string; tanggal: string; isCurrentWeek: boolean } | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<{ userId: string; sessionId: string; nama: string; hadir: boolean } | null>(null);
  const [sessionMenuId, setSessionMenuId] = useState<string | null>(null);
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);

  const activeSessionIdsRef = useRef<Set<string>>(new Set());

  // Hitung minggu dalam bulan terpilih
  const weeksInMonth = useMemo(() => {
    const weeks: { label: string; tanggal: string; isCurrentWeek: boolean }[] = [];
    const firstDay = new Date(yearNum, selectedMonth, 1);
    const lastDay = new Date(yearNum, selectedMonth + 1, 0);
    
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // Cari Senin pertama
    let curr = new Date(firstDay);
    while (curr.getDay() !== 1) {
      curr.setDate(curr.getDate() + 1);
    }
    
    let weekCounter = 1;
    while (curr <= lastDay) {
      // Cek apakah ini minggu ini
      const startOfWeek = new Date(curr);
      const endOfWeek = new Date(curr);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      const isCurrentWeek = now >= startOfWeek && now <= endOfWeek;
      
      weeks.push({
        label: `Minggu ${weekCounter}`,
        tanggal: `${yearNum}-${String(selectedMonth + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`,
        isCurrentWeek,
      });
      curr.setDate(curr.getDate() + 7);
      weekCounter++;
    }
    
    // Jika tidak ada senin (bulan sangat pendek/awal tahun), pastikan ada minimal slot
    if (weeks.length === 0) {
      // Fallback manual 4 minggu
      for (let i = 1; i <= 4; i++) {
        weeks.push({
          label: `Minggu ${i}`,
          tanggal: `${yearNum}-${String(selectedMonth + 1).padStart(2, '0')}-${String(i * 7).padStart(2, '0')}`,
          isCurrentWeek: false,
        });
      }
    }
    
    return weeks;
  }, [yearNum, selectedMonth]);

  const fetchSessions = useCallback(async () => {
    if (!eventId || !yearNum) return;
    const lastDay = new Date(yearNum, selectedMonth + 1, 0).getDate();
    const monthStr = String(selectedMonth + 1).padStart(2, '0');
    
    const { data } = await supabase.from('event_sessions')
      .select('id, label, tanggal')
      .eq('event_id', eventId)
      .gte('tanggal', `${yearNum}-${monthStr}-01`)
      .lte('tanggal', `${yearNum}-${monthStr}-${lastDay}`)
      .order('tanggal', { ascending: true });
    
    if (data) {
      setDbSessions(data as DbSession[]);
      activeSessionIdsRef.current = new Set(data.map(s => s.id));
      
      const ids = data.map(s => s.id);
      if (ids.length > 0) {
        const { data: attData } = await supabase
          .from('attendances').select('id, session_id, user_id').in('session_id', ids);
        if (attData)
          setAttendances(attData.map((r: any) => ({ id: r.id, sessionId: r.session_id, userId: r.user_id })));
      } else {
        setAttendances([]);
      }
    }
  }, [eventId, yearNum, selectedMonth]);

  useEffect(() => {
    if (!eventId || !yearNum) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const profileRes = await supabase
          .from('absensi_members')
          .select('user_id');
        if (cancelled) return;
        const memberIds = (profileRes.data ?? []).map((r: any) => r.user_id as string);
        if (memberIds.length > 0) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, nama_lengkap, email')
            .in('id', memberIds)
            .order('nama_lengkap', { ascending: true });
          if (!cancelled && profileData) setProfiles(profileData as Profile[]);
        } else {
          setProfiles([]);
        }
        await fetchSessions();
      } catch (e) {
        console.error('weekly-year-detail load error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, yearNum, selectedMonth, fetchSessions]);

  // Realtime subscription
  useEffect(() => {
    if (!eventId || !yearNum) return;
    const channel = supabase
      .channel(`weekly-att-${eventId}-${yearNum}-${selectedMonth}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendances', filter: `event_id=eq.${eventId}` },
        (payload) => {
          const newItem = payload.new as any;
          const aid = newItem.id as string | undefined;
          const sid = newItem.session_id as string | undefined;
          const uid = newItem.user_id as string | undefined;
          if (!aid || !sid || !uid || !activeSessionIdsRef.current.has(sid)) return;
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

          // Jika ada ID (biasanya ada di payload.old), hapus berdasarkan ID
          if (aid) {
            setAttendances(prev => prev.filter(a => a.id !== aid));
            return;
          }

          // Fallback jika ID tidak ada tapi ada sid/uid (jarang di DELETE tanpa full replication)
          if (sid && uid) {
            setAttendances(prev => prev.filter(a => !(a.sessionId === sid && a.userId === uid)));
            return;
          }

          // Jika benar-benar tidak ada data (hanya dapet {}, tapi ini jarang), fetch ulang
          fetchSessions();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId, yearNum, selectedMonth]);

  // Realtime subscription untuk sesi (agar saat diaktifkan langsung muncul)
  useEffect(() => {
    if (!eventId || !yearNum) return;
    const channel = supabase
      .channel(`weekly-sessions-${eventId}-${yearNum}-${selectedMonth}`)
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
            
            const dateParts = newSes.tanggal.split('-');
            const y = parseInt(dateParts[0], 10);
            const m = parseInt(dateParts[1], 10) - 1;
            
            if (y === yearNum && m === selectedMonth) {
              setDbSessions(prev => {
                const idx = prev.findIndex(s => s.id === newSes.id);
                if (idx !== -1) {
                  const next = [...prev];
                  next[idx] = { id: newSes.id, label: newSes.label, tanggal: newSes.tanggal };
                  return next;
                } else {
                  return [...prev, { id: newSes.id, label: newSes.label, tanggal: newSes.tanggal }]
                    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
                }
              });
              activeSessionIdsRef.current.add(newSes.id);
            }
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any).id;
            if (oldId && activeSessionIdsRef.current.has(oldId)) {
              setDbSessions(prev => prev.filter(s => s.id !== oldId));
              setAttendances(prev => prev.filter(a => a.sessionId !== oldId));
              activeSessionIdsRef.current.delete(oldId);
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId, yearNum, selectedMonth]);

  const onActivateWeek = useCallback(async (weekLabel: string, tanggal: string) => {
    if (!isAdmin || !eventId) return;
    setActivatingWeek(tanggal);
    try {
      const fullLabel = `${weekLabel} - ${BULAN_FULL[selectedMonth]} ${yearNum}`;
      await addSession(eventId, fullLabel, tanggal);
      await fetchSessions();
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Gagal mengaktifkan minggu');
    } finally {
      setActivatingWeek(null);
    }
  }, [isAdmin, eventId, selectedMonth, yearNum, addSession, fetchSessions]);

  const onDeleteSession = useCallback(async (sessionId: string) => {
    if (!isAdmin) return;
    try {
      await supabase.from('attendances').delete().eq('session_id', sessionId);
      const { error } = await supabase.from('event_sessions').delete().eq('id', sessionId);
      if (error) throw new Error(error.message);
      await fetchSessions();
    } catch (e) {
      console.error('delete session error:', e);
    } finally {
      setSessionMenuId(null);
    }
  }, [isAdmin, fetchSessions]);

  const onToggle = useCallback((userId: string, sessionId: string, nama: string) => {
    if (!isAdmin) return;
    const hadir = attendances.some(a => a.sessionId === sessionId && a.userId === userId);
    setConfirmToggle({ userId, sessionId, nama, hadir });
  }, [isAdmin, attendances]);

  const onColumnPress = useCallback((col: { label: string; tanggal: string; isCurrentWeek: boolean; session: DbSession | null }) => {
    if (!isAdmin) return;
    if (col.session) {
      setSessionMenuId(col.session.id);
    } else {
      setActivationMenu({ label: col.label, tanggal: col.tanggal, isCurrentWeek: col.isCurrentWeek });
    }
  }, [isAdmin]);

  const onConfirmToggle = useCallback(async () => {
    if (!confirmToggle || !eventId) return;
    const { userId, sessionId, nama, hadir } = confirmToggle;
    setConfirmToggle(null);
    const key = `${userId}-${sessionId}`;
    setTogglingKey(key);
    try {
      if (hadir) {
        const { error } = await supabase.from('attendances')
          .delete().eq('session_id', sessionId).eq('user_id', userId);
        if (error) throw new Error(error.message);
        setAttendances(prev => prev.filter(a => !(a.sessionId === sessionId && a.userId === userId)));
      } else {
        const id = `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const { error } = await supabase.from('attendances').insert({
          id, event_id: eventId, session_id: sessionId,
          user_id: userId, nama_user: nama, waktu_absen: Date.now(),
        });
        if (error) throw new Error(error.message);
        setAttendances(prev => [...prev, { id, sessionId, userId }]);
      }
    } catch (e) {
      console.error('toggle error:', e);
    } finally {
      setTogglingKey(null);
    }
  }, [confirmToggle, eventId]);

  const attBySession = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const a of attendances) {
      if (!map[a.sessionId]) map[a.sessionId] = new Set();
      map[a.sessionId].add(a.userId);
    }
    return map;
  }, [attendances]);

  // Map weeksInMonth ke dbSessions (jika ada)
  const columns = useMemo(() => {
    return weeksInMonth.map(w => {
      // Cari sesi yang tanggalnya sama
      const found = dbSessions.find(s => s.tanggal === w.tanggal);
      return { ...w, session: found || null };
    });
  }, [weeksInMonth, dbSessions]);

  const totalPerCol = useMemo(() =>
    columns.map(c => c.session ? (attBySession[c.session.id]?.size ?? 0) : null),
    [columns, attBySession]
  );

  const menuSession = sessionMenuId ? dbSessions.find(s => s.id === sessionMenuId) : null;
  const qrSession = qrSessionId ? dbSessions.find(s => s.id === qrSessionId) : null;

  if (!event) return null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={['top']}>
      {/* Header Utama */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={tintColor} />
          <ThemedText style={{ color: tintColor, fontSize: 16 }}>Kembali</ThemedText>
        </Pressable>
        <View style={styles.headerCenter}>
          <ThemedText type="defaultSemiBold" style={styles.headerTitle} numberOfLines={1}>
            {event.nama} · {yearNum}
          </ThemedText>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Navigasi Bulan */}
      <View style={[styles.monthNav, { borderBottomColor: borderColor }]}>
        <Pressable
          onPress={() => setSelectedMonth(m => (m > 0 ? m - 1 : 11))}
          style={({ pressed }) => [styles.monthBtn, pressed && { opacity: 0.6 }]}>
          <Ionicons name="chevron-back" size={20} color={tintColor} />
        </Pressable>
        <ThemedText type="defaultSemiBold" style={{ fontSize: 16, width: 120, textAlign: 'center' }}>
          {BULAN_FULL[selectedMonth]}
        </ThemedText>
        <Pressable
          onPress={() => setSelectedMonth(m => (m < 11 ? m + 1 : 0))}
          style={({ pressed }) => [styles.monthBtn, pressed && { opacity: 0.6 }]}>
          <Ionicons name="chevron-forward" size={20} color={tintColor} />
        </Pressable>
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
          columns={columns}
          attBySession={attBySession}
          totalPerCol={totalPerCol}
          isAdmin={isAdmin}
          activatingWeek={activatingWeek}
          togglingKey={togglingKey}
          tintColor={tintColor}
          backgroundColor={backgroundColor}
          borderColor={borderColor}
          mutedColor={mutedColor}
          successColor={successColor}
          dangerColor={dangerColor}
          onToggle={onToggle}
          onActivateWeek={onActivateWeek}
          onColumnPress={onColumnPress}
          onSessionPress={(id) => isAdmin ? setSessionMenuId(id) : undefined}
        />
      )}

      {/* Modal Menu Sesi */}
      <Modal visible={sessionMenuId !== null} transparent animationType="fade">
        <Pressable style={styles.menuOverlay} onPress={() => setSessionMenuId(null)}>
          <ThemedView type="card" style={[styles.menuCard, { borderColor }]}>
            <View style={[styles.menuTitleRow, { borderBottomColor: borderColor }]}>
              <View style={[styles.menuIconBox, { backgroundColor: tintColor + '18' }]}>
                <Ionicons name="calendar" size={18} color={tintColor} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }} numberOfLines={1}>
                  {menuSession?.label}
                </ThemedText>
                <ThemedText type="muted" style={{ fontSize: 12 }}>
                  {menuSession?.tanggal}
                </ThemedText>
              </View>
            </View>

            <Pressable
              onPress={() => { setQrSessionId(sessionMenuId); setSessionMenuId(null); }}
              style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]}>
              <View style={[styles.menuItemIcon, { backgroundColor: tintColor + '18' }]}>
                <Ionicons name="qr-code-outline" size={20} color={tintColor} />
              </View>
              <ThemedText style={[styles.menuItemText, { color: tintColor }]}>Tampilkan QR Code</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => {
                if (sessionMenuId) {
                  Alert.alert(
                    'Hapus Sesi',
                    `Hapus sesi ini? Data absensi juga akan dihapus.`,
                    [
                      { text: 'Batal', style: 'cancel' },
                      { text: 'Hapus', style: 'destructive', onPress: () => onDeleteSession(sessionMenuId) }
                    ]
                  );
                }
              }}
              style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]}>
              <View style={[styles.menuItemIcon, { backgroundColor: dangerColor + '18' }]}>
                <Ionicons name="trash-outline" size={20} color={dangerColor} />
              </View>
              <ThemedText style={[styles.menuItemText, { color: dangerColor }]}>Hapus Sesi Ini</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setSessionMenuId(null)}
              style={({ pressed }) => [styles.menuItem, { marginTop: 4 }, pressed && { opacity: 0.6 }]}>
              <ThemedText type="muted" style={{ fontSize: 14, textAlign: 'center', flex: 1 }}>Batal</ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      </Modal>

      {/* Modal Aktifkan Sesi (Custom) */}
      <Modal visible={activationMenu !== null} transparent animationType="fade">
        <Pressable style={styles.menuOverlay} onPress={() => setActivationMenu(null)}>
          <ThemedView type="card" style={[styles.menuCard, { borderColor }]}>
            <View style={[styles.menuTitleRow, { borderBottomColor: borderColor }]}>
              <View style={[styles.menuIconBox, { backgroundColor: tintColor + '12' }]}>
                <Ionicons name="calendar-outline" size={20} color={tintColor} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }} numberOfLines={1}>
                  {activationMenu?.label} - {BULAN_FULL[selectedMonth]} {yearNum}
                </ThemedText>
                <ThemedText type="muted" style={{ fontSize: 12 }}>
                  Belum aktif
                </ThemedText>
              </View>
            </View>

            <Pressable
              onPress={() => {
                if (activationMenu) {
                  onActivateWeek(activationMenu.label, activationMenu.tanggal);
                  setActivationMenu(null);
                }
              }}
              style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]}>
              <View style={[styles.menuItemIcon, { backgroundColor: successColor + '18' }]}>
                <Ionicons name="checkmark-circle-outline" size={22} color={successColor} />
              </View>
              <ThemedText style={[styles.menuItemText, { color: successColor }]}>
                Aktifkan Minggu ini
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setActivationMenu(null)}
              style={({ pressed }) => [styles.menuItem, { marginTop: 4 }, pressed && { opacity: 0.6 }]}>
              <ThemedText type="muted" style={{ fontSize: 14, textAlign: 'center', flex: 1 }}>Batal</ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      </Modal>

      {/* Modal QR */}
      <Modal visible={qrSessionId !== null} transparent animationType="fade">
        <View style={styles.qrOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setQrSessionId(null)} />
          <View style={[styles.qrCard, { backgroundColor }]}>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 18, marginBottom: 4, textAlign: 'center' }}>
              {qrSession?.label}
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
              onPress={() => setQrSessionId(null)}
              style={[styles.closeBtn, { backgroundColor: tintColor + '15' }]}>
              <ThemedText style={{ color: tintColor, fontWeight: '700' }}>Tutup</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal Konfirmasi Toggle */}
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

      <ScanQrFab />
    </SafeAreaView>
  );
}

type StickyTableProps = {
  profiles: Profile[];
  columns: { label: string; tanggal: string; isCurrentWeek: boolean; session: DbSession | null }[];
  attBySession: Record<string, Set<string>>;
  totalPerCol: (number | null)[];
  isAdmin: boolean;
  activatingWeek: string | null;
  togglingKey: string | null;
  tintColor: string;
  backgroundColor: string;
  borderColor: string;
  mutedColor: string;
  successColor: string;
  dangerColor: string;
  onToggle: (userId: string, sessionId: string, nama: string) => void;
  onActivateWeek: (label: string, tanggal: string) => void;
  onColumnPress: (col: { label: string; tanggal: string; isCurrentWeek: boolean; session: DbSession | null }) => void;
  onSessionPress: (id: string) => void;
};

function StickyTable({
  profiles, columns, attBySession, totalPerCol,
  isAdmin, activatingWeek, togglingKey,
  tintColor, backgroundColor, borderColor, mutedColor, successColor, dangerColor,
  onToggle, onActivateWeek, onColumnPress, onSessionPress,
}: StickyTableProps) {
  const headerScrollRef = useRef<ScrollView>(null);
  const footerScrollRef = useRef<ScrollView>(null);
  const bodyScrollRef = useRef<ScrollView>(null);
  const [bodyHeight, setBodyHeight] = useState(0);

  const onBodyScroll = useCallback((e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    headerScrollRef.current?.scrollTo({ x, animated: false });
    footerScrollRef.current?.scrollTo({ x, animated: false });
  }, []);

  const rightPanelWidth = columns.length * COL_WEEK;
  const contentRows = profiles.length;
  const fillerCount = bodyHeight > 0
    ? Math.max(0, Math.ceil((bodyHeight - contentRows * ROW_H) / ROW_H))
    : 0;

  return (
    <View style={{ flex: 1 }}>
      <View style={[{
        flexDirection: 'row', height: HEAD_H, backgroundColor: tintColor + '12',
        borderBottomColor: borderColor, borderBottomWidth: 1,
        borderTopColor: borderColor, borderTopWidth: 1,
      }]}>
        <View style={[{
          width: COL_NAME, justifyContent: 'center', alignItems: 'center',
          borderRightColor: borderColor, borderRightWidth: 1,
        }]}>
          <ThemedText style={[styles.headText, { color: tintColor }]}>Nama</ThemedText>
        </View>
        <ScrollView ref={headerScrollRef} horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={{ width: rightPanelWidth, flexDirection: 'row' }}>
            {columns.map((col, idx) => {
              const isActivating = activatingWeek === col.tanggal;
              return (
                <Pressable
                  key={idx}
                  onPress={() => onColumnPress(col)}
                  style={({ pressed }) => [
                    styles.weekCell, styles.cellCenter,
                    { borderRightColor: borderColor, borderRightWidth: 1, backgroundColor: col.session ? tintColor + '20' : 'transparent' },
                    col.isCurrentWeek && !col.session && { backgroundColor: tintColor + '08' },
                    pressed && isAdmin && { opacity: 0.65 },
                  ]}>
                  {isActivating ? (
                    <ActivityIndicator size="small" color={tintColor} />
                  ) : (
                    <>
                      <ThemedText style={[styles.headText, { color: col.session ? tintColor : mutedColor, textAlign: 'center' }]} numberOfLines={1}>
                        {col.label}
                      </ThemedText>
                      {col.isCurrentWeek && (
                        <ThemedText style={{ fontSize: 8, color: tintColor, fontWeight: '700' }}>MINGGU INI</ThemedText>
                      )}
                      {col.session && (
                        <View style={[styles.activeDot, { backgroundColor: tintColor }]} />
                      )}
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} onLayout={(e) => setBodyHeight(e.nativeEvent.layout.height)}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: COL_NAME, borderRightColor: borderColor, borderRightWidth: 1 }}>
            {profiles.map((p, rowIdx) => (
              <View key={p.id} style={[{
                height: ROW_H, justifyContent: 'center', paddingHorizontal: 12,
                borderBottomColor: borderColor, borderBottomWidth: 1,
              }, rowIdx % 2 === 1 && { backgroundColor: 'rgba(127,127,127,0.03)' }]}>
                <ThemedText style={styles.nameText} numberOfLines={1}>{p.nama_lengkap ?? p.email ?? '(tanpa nama)'}</ThemedText>
              </View>
            ))}
            {Array.from({ length: fillerCount }, (_, i) => (
              <View key={`filler-left-${i}`} style={{ height: ROW_H, borderBottomColor: borderColor, borderBottomWidth: 1 }} />
            ))}
          </View>

          <ScrollView ref={bodyScrollRef} horizontal showsHorizontalScrollIndicator nestedScrollEnabled onScroll={onBodyScroll} scrollEventThrottle={16} style={{ flex: 1 }}>
            <View style={{ width: rightPanelWidth }}>
              {profiles.map((p, rowIdx) => (
                <View key={p.id} style={[styles.row, { height: ROW_H, borderBottomColor: borderColor, borderBottomWidth: 1 }, rowIdx % 2 === 1 && { backgroundColor: 'rgba(127,127,127,0.03)' }]}>
                  {columns.map((col, idx) => {
                    const sessionId = col.session?.id;
                    const key = `${p.id}-${sessionId}`;
                    const isToggling = sessionId && togglingKey === key;
                    const hadir = sessionId ? (attBySession[sessionId]?.has(p.id) ?? false) : false;
                    return (
                      <View key={idx} style={[styles.weekCell, styles.cellCenter, { borderRightColor: borderColor, borderRightWidth: 1 }]}>
                        {!sessionId ? (
                          <Ionicons name="remove" size={16} color={mutedColor + '40'} />
                        ) : isToggling ? (
                          <ActivityIndicator size="small" color={tintColor} />
                        ) : isAdmin ? (
                          <Pressable
                            onPress={() => onToggle(p.id, sessionId, p.nama_lengkap ?? p.email ?? '')}
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
              ))}
              {Array.from({ length: fillerCount }, (_, i) => (
                <View key={`filler-right-${i}`} style={[styles.row, { height: ROW_H, borderBottomColor: borderColor, borderBottomWidth: 1 }]}>
                  {columns.map((_, idx) => (
                    <View key={idx} style={[styles.weekCell, { borderRightColor: borderColor, borderRightWidth: 1 }]} />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      <View style={{ flexDirection: 'row', height: ROW_H, backgroundColor: tintColor + '08', borderTopColor: borderColor, borderTopWidth: 1.5 }}>
        <View style={{ width: COL_NAME, justifyContent: 'center', alignItems: 'center', borderRightColor: borderColor, borderRightWidth: 1 }}>
          <ThemedText style={[styles.footText, { color: tintColor }]}>Total Hadir</ThemedText>
        </View>
        <ScrollView ref={footerScrollRef} horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={{ width: rightPanelWidth, flexDirection: 'row' }}>
            {totalPerCol.map((count, idx) => (
              <View key={idx} style={[styles.weekCell, styles.cellCenter, { borderRightColor: borderColor, borderRightWidth: 1 }]}>
                <ThemedText style={[styles.footText, { color: count !== null && count > 0 ? tintColor : mutedColor }]}>
                  {count ?? '-'}
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
    gap: 4, width: 80,
  },
  headerTitle: { fontSize: 17, textAlign: 'center' },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderBottomWidth: 1, gap: 16,
  },
  monthBtn: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(127,127,127,0.1)',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row' },
  cellCenter: { justifyContent: 'center', alignItems: 'center' },
  weekCell: { width: COL_WEEK },
  headText: { fontSize: 11, fontWeight: '700' },
  nameText: { fontSize: 13 },
  footText: { fontSize: 12, fontWeight: '700' },
  activeDot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },
  toggleBtn: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  activateBtn: {
    paddingHorizontal: 6, paddingVertical: 6, borderRadius: 8,
    minWidth: 80, alignItems: 'center',
  },
  activateText: { color: 'white', fontSize: 10, fontWeight: '700' },
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
