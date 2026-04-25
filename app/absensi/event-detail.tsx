import { ScanQrFab } from '@/components/scan-qr-fab';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAbsensi } from '@/lib/absensi/absensi-context';
import { useAdmin } from '@/lib/admin/admin-context';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function EventDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { isAdmin } = useAdmin();
  const { events, sessions, attendances, addSession, deleteSession, renameSession } = useAbsensi();
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'muted');
  const borderColor = useThemeColor({}, 'border');
  const dangerColor = useThemeColor({}, 'danger');
  const backgroundColor = useThemeColor({}, 'background');
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [addSessionVisible, setAddSessionVisible] = useState(false);
  const [newSessionLabel, setNewSessionLabel] = useState('');
  const [newSessionTanggal, setNewSessionTanggal] = useState('');
  const [savingSession, setSavingSession] = useState(false);

  const [qrSession, setQrSession] = useState<{ eventId: string; sessionId: string; label: string } | null>(null);
  const [deleteSessionTarget, setDeleteSessionTarget] = useState<{ id: string; label: string } | null>(null);
  const [deletingSession, setDeletingSession] = useState(false);
  const [renameSessionTarget, setRenameSessionTarget] = useState<{ id: string; label: string } | null>(null);
  const [renameSessionValue, setRenameSessionValue] = useState('');
  const [renamingSession, setRenamingSession] = useState(false);

  const onRenameSession = useCallback(async () => {
    if (!renameSessionTarget) return;
    const label = renameSessionValue.trim();
    if (!label) return Alert.alert('Validasi', 'Label tidak boleh kosong.');
    setRenamingSession(true);
    try {
      await renameSession(renameSessionTarget.id, label);
      setRenameSessionTarget(null);
      setRenameSessionValue('');
    } catch (e: any) { Alert.alert('Gagal', e.message); }
    finally { setRenamingSession(false); }
  }, [renameSessionTarget, renameSessionValue, renameSession]);

  const event = useMemo(() => events.find(e => e.id === eventId), [events, eventId]);
  const eventSessions = useMemo(() => sessions.filter(s => s.eventId === eventId), [sessions, eventId]);
  const singleSession = useMemo(
    () => event?.tipe === 'SEKALI' && eventSessions.length >= 1 ? eventSessions[0] : null,
    [event, eventSessions]
  );

  // Untuk RUTIN: kelompokkan sesi per tahun
  const isRutin = event?.tipe === 'RUTIN';
  const isMonthly = isRutin && event.periodType === 'MONTHLY';
  const isWeekly = isRutin && event.periodType === 'WEEKLY';

  // Untuk SEKALI: kalau context belum punya sesi, fetch langsung dari DB
  const [dbSingleSessionId, setDbSingleSessionId] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    if (!eventId || event?.tipe !== 'SEKALI') return;
    supabase
      .from('event_sessions')
      .select('id')
      .eq('event_id', eventId)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setDbSingleSessionId((data[0] as any).id);
      });
  }, [eventId, event?.tipe]));

  // Untuk RUTIN: ambil daftar tahun langsung dari DB (bukan dari context)
  // supaya sesi yang dibuat di year-detail langsung kelihatan
  const [dbYears, setDbYears] = useState<number[]>([]);
  const [manualYears, setManualYears] = useState<number[]>([]);

  const loadManualYears = useCallback(async () => {
    if (!eventId) return;
    try {
      const saved = await AsyncStorage.getItem(`manual_years_${eventId}`);
      if (saved) {
        setManualYears(JSON.parse(saved));
      }
    } catch (e) { console.error('loadManualYears error:', e); }
  }, [eventId]);

  useFocusEffect(useCallback(() => {
    if (!isRutin || !eventId) return;
    
    loadManualYears();

    const now = new Date();
    const currentYear = now.getFullYear();

    supabase
      .from('event_sessions')
      .select('tanggal')
      .eq('event_id', eventId)
      .then(({ data }) => {
        const yearSet = new Set<number>();
        // Selalu masukkan tahun sekarang sebagai opsi awal jika belum ada sesi
        yearSet.add(currentYear);
        
        if (data) {
          for (const r of data) {
            const y = parseInt((r as any).tanggal.split('-')[0], 10);
            if (!isNaN(y)) yearSet.add(y);
          }
        }
        setDbYears(Array.from(yearSet).sort((a, b) => b - a));
      });
  }, [isRutin, eventId, loadManualYears]));

  const yearGroups = useMemo(() => {
    const combined = new Set([...dbYears, ...manualYears]);
    return Array.from(combined).sort((a, b) => b - a);
  }, [dbYears, manualYears]);

  useEffect(() => {
    const sessionId = singleSession?.id ?? dbSingleSessionId;
    if (sessionId) {
      router.replace({ pathname: '/absensi/session-detail', params: { sessionId } });
    }
  }, [singleSession, dbSingleSessionId]);

  // Kalau event dihapus saat halaman ini masih terbuka, kembali otomatis
  useEffect(() => {
    if (events.length > 0 && !event) {
      router.back();
    }
  }, [event, events.length]);

  const prepareNextSessionDefaults = useCallback(() => {
    if (!event || event.tipe !== 'RUTIN' || !eventId) return;
    const evSessions = sessions.filter(s => s.eventId === eventId);
    const now = new Date();

    if (event.periodType === 'MONTHLY') {
      let nextDate = now;
      if (evSessions.length > 0) {
        const last = [...evSessions].sort((a, b) => (a.tanggal > b.tanggal ? -1 : 1))[0];
        const [y, m] = last.tanggal.split('-').map(Number);
        nextDate = new Date(y, m, 1);
      }
      const label = `${BULAN[nextDate.getMonth()]} ${nextDate.getFullYear()}`;
      const tanggal = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-01`;
      setNewSessionLabel(label);
      setNewSessionTanggal(tanggal);
    } else if (event.periodType === 'WEEKLY') {
      let nextDate = now;
      if (evSessions.length > 0) {
        const last = [...evSessions].sort((a, b) => (a.tanggal > b.tanggal ? -1 : 1))[0];
        const lastD = new Date(last.tanggal);
        nextDate = new Date(lastD.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
      const startOfYear = new Date(nextDate.getFullYear(), 0, 1);
      const weekNum = Math.ceil(
        ((nextDate.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7,
      );
      const label = `Minggu ${weekNum} - ${BULAN[nextDate.getMonth()]} ${nextDate.getFullYear()}`;
      const tanggal = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
      setNewSessionLabel(label);
      setNewSessionTanggal(tanggal);
    }
  }, [event, eventId, sessions]);

  const openAddSession = useCallback(() => {
    if (!isAdmin || !event || event.tipe !== 'RUTIN') return;
    prepareNextSessionDefaults();
    setAddSessionVisible(true);
  }, [isAdmin, event, prepareNextSessionDefaults]);

  const onSubmitSession = useCallback(async () => {
    if (!eventId || !newSessionLabel.trim()) {
      Alert.alert('Error', 'Label sesi wajib diisi.');
      return;
    }
    setSavingSession(true);
    try {
      await addSession(eventId, newSessionLabel.trim(), newSessionTanggal);
      setAddSessionVisible(false);
      setNewSessionLabel('');
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Gagal menambah sesi');
    } finally {
      setSavingSession(false);
    }
  }, [eventId, newSessionLabel, newSessionTanggal, addSession]);

  const [confirmAddYear, setConfirmAddYear] = useState(false);
  const [pendingNextYear, setPendingNextYear] = useState<number | null>(null);

  const onConfirmAddYear = useCallback(async () => {
    if (!pendingNextYear || !eventId || !event) return;
    setConfirmAddYear(false);
    
    // Simpan ke manualYears agar tetap ke-render walaupun belum ada sesi
    const newManualYears = [...manualYears, pendingNextYear];
    setManualYears(newManualYears);
    try {
      await AsyncStorage.setItem(`manual_years_${eventId}`, JSON.stringify(newManualYears));
    } catch (e) { console.error('saveManualYears error:', e); }

    // Langsung navigasi ke detail tahun tersebut
    if (event.periodType === 'MONTHLY') {
      router.push({ pathname: '/absensi/year-detail', params: { eventId: eventId, year: String(pendingNextYear) } });
    } else {
      router.push({ pathname: '/absensi/weekly-year-detail', params: { eventId: eventId, year: String(pendingNextYear) } });
    }
  }, [pendingNextYear, eventId, event, manualYears]);

  // FAB tambah sesi hanya untuk WEEKLY (MONTHLY dikelola otomatis di year-detail)
  const showSessionFab = isAdmin && event?.tipe === 'RUTIN' && event?.periodType !== 'MONTHLY';
  const showScanFab = isAdmin;

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
            {event?.nama ?? 'Detail Kegiatan'}
          </ThemedText>
          <ThemedText type="muted" style={{ fontSize: 12 }}>
            {event?.tipe === 'RUTIN' ? `Rutin · ${event.periodType === 'WEEKLY' ? 'Mingguan' : 'Bulanan'}` : 'Sekali'}
          </ThemedText>
        </View>
        <View style={styles.headerRight}>
          {isAdmin && isRutin ? (
            <Pressable
              onPress={() => {
                const nextYear = yearGroups.length > 0 ? yearGroups[0] + 1 : new Date().getFullYear();
                setPendingNextYear(nextYear);
                setConfirmAddYear(true);
              }}
              style={({ pressed }) => [
                styles.iconBtn,
                { backgroundColor: tintColor + '15' },
                pressed && { opacity: 0.65 },
              ]}>
              <Ionicons name="add" size={20} color={tintColor} />
            </Pressable>
          ) : showSessionFab ? (
            <Pressable
              onPress={openAddSession}
              accessibilityRole="button"
              accessibilityLabel="Tambah sesi"
              style={({ pressed }) => [
                styles.iconBtn,
                { backgroundColor: tintColor + '15' },
                pressed && { opacity: 0.65 },
              ]}>
              <Ionicons name="add" size={20} color={tintColor} />
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>
      </View>


      {/* RUTIN: tampilkan daftar tahun */}
      {isRutin ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: 16,
            gap: 10,
            paddingBottom: showScanFab ? 24 + 60 + insets.bottom : 24,
          }}>
          {yearGroups.length === 0 ? (
            <View style={[styles.empty, { minHeight: 200 }]}>
              <Ionicons name="calendar-outline" size={48} color={mutedColor} />
              <ThemedText type="muted" style={{ marginTop: 12 }}>Belum ada sesi</ThemedText>
            </View>
          ) : (
            yearGroups.map(yr => {
              const pathname = isMonthly ? '/absensi/year-detail' : '/absensi/weekly-year-detail';
              return (
                <ThemedView key={yr} style={[styles.sessionCard, { borderColor }]}>
                  <View style={styles.sessionRowWrap}>
                    <Pressable
                      style={styles.sessionMain}
                      onPress={() => router.push({ pathname: pathname as any, params: { eventId: eventId!, year: String(yr) } })}>
                      <View style={styles.sessionRow}>
                        <View style={[styles.sessionNum, { backgroundColor: tintColor + '15' }]}>
                          <Ionicons name="calendar" size={16} color={tintColor} />
                        </View>
                        <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>{yr}</ThemedText>
                        <Ionicons name="chevron-forward" size={16} color={mutedColor} style={{ marginLeft: 4 }} />
                      </View>
                    </Pressable>
                    {isAdmin && (
                      <Pressable
                        onPress={() => setDeleteSessionTarget({ id: String(yr), label: String(yr) })}
                        style={({ pressed }) => [styles.iconBtn, { backgroundColor: dangerColor + '15' }, pressed && { opacity: 0.65 }]}>
                        <Ionicons name="trash-outline" size={18} color={dangerColor} />
                      </Pressable>
                    )}
                  </View>
                </ThemedView>
              );
            })
          )}
        </ScrollView>
      ) : (
      /* SEKALI: tampilkan daftar sesi seperti biasa */
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          gap: 10,
          paddingBottom: showScanFab ? 24 + 60 + insets.bottom : 16,
        }}>
        {eventSessions.length === 0 ? (
          <View style={[styles.empty, { minHeight: 200 }]}>
            <Ionicons name="calendar-outline" size={48} color={mutedColor} />
            <ThemedText type="muted" style={{ marginTop: 12 }}>Belum ada sesi</ThemedText>
          </View>
        ) : (
          eventSessions.map((ses, idx) => {
            const count = attendances.filter(a => a.sessionId === ses.id).length;
            return (
              <ThemedView key={ses.id} style={[styles.sessionCard, { borderColor }]}>
                <View style={styles.sessionRowWrap}>
                  <Pressable
                    style={styles.sessionMain}
                    onPress={() => router.push({ pathname: '/absensi/session-detail', params: { sessionId: ses.id } })}>
                    <View style={styles.sessionRow}>
                      <View style={[styles.sessionNum, { backgroundColor: tintColor + '15' }]}>
                        <ThemedText style={{ color: tintColor, fontWeight: '600', fontSize: 14 }}>{idx + 1}</ThemedText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="defaultSemiBold" style={{ fontSize: 14 }}>{ses.label}</ThemedText>
                        <ThemedText type="muted" style={{ fontSize: 12 }}>{ses.tanggal}</ThemedText>
                      </View>
                      <View style={styles.sessionCount}>
                        <Ionicons name="people" size={14} color={mutedColor} />
                        <ThemedText type="muted" style={{ fontSize: 12 }}>{count}</ThemedText>
                      </View>
                    </View>
                  </Pressable>
                  {isAdmin && eventId ? (
                    <View style={styles.sessionActions}>
                      <Pressable
                        onPress={() => { setRenameSessionTarget({ id: ses.id, label: ses.label }); setRenameSessionValue(ses.label); }}
                        style={({ pressed }) => [styles.iconBtn, { backgroundColor: tintColor + '15' }, pressed && { opacity: 0.65 }]}>
                        <Ionicons name="create-outline" size={18} color={tintColor} />
                      </Pressable>
                      <Pressable
                        onPress={() => setQrSession({ eventId: eventId, sessionId: ses.id, label: ses.label })}
                        style={({ pressed }) => [styles.iconBtn, { backgroundColor: tintColor + '15' }, pressed && { opacity: 0.65 }]}>
                        <Ionicons name="qr-code" size={18} color={tintColor} />
                      </Pressable>
                      <Pressable
                        onPress={() => setDeleteSessionTarget({ id: ses.id, label: ses.label })}
                        style={({ pressed }) => [styles.iconBtn, { backgroundColor: dangerColor + '15' }, pressed && { opacity: 0.65 }]}>
                        <Ionicons name="trash-outline" size={18} color={dangerColor} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </ThemedView>
            );
          })
        )}
      </ScrollView>
      )}

      {/* Modal Konfirmasi Tambah Tahun */}
      <Modal visible={confirmAddYear} transparent animationType="fade">
        <View style={styles.qrOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setConfirmAddYear(false)} />
          <ThemedView type="card" style={[styles.qrCard, { alignItems: 'flex-start' }]}>
            <View style={[styles.dangerIconWrap, { backgroundColor: tintColor + '18' }]}>
              <Ionicons name="calendar-outline" size={22} color={tintColor} />
            </View>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 18, marginBottom: 8 }}>Tambah Tahun</ThemedText>
            <ThemedText type="muted" style={{ fontSize: 14, lineHeight: 20, marginBottom: 24 }}>
              Tambah tahun <ThemedText type="defaultSemiBold">{pendingNextYear}</ThemedText> untuk kegiatan ini?
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <Pressable
                onPress={() => setConfirmAddYear(false)}
                style={({ pressed }) => [styles.btn, { flex: 1, borderWidth: 1, borderColor, backgroundColor: 'transparent' }, pressed && { opacity: 0.8 }]}>
                <ThemedText style={{ fontWeight: '600', color: textColor }}>Batal</ThemedText>
              </Pressable>
              <Pressable
                onPress={onConfirmAddYear}
                style={({ pressed }) => [styles.btn, { flex: 1, backgroundColor: tintColor }, pressed && { opacity: 0.8 }]}>
                <ThemedText style={styles.btnText}>Tambah</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      <Modal visible={addSessionVisible} transparent animationType="slide">
        <View style={styles.modalWrap}>
          <Pressable style={styles.overlay} onPress={() => setAddSessionVisible(false)} />
          <ThemedView type="card" style={[styles.modalCard, { maxHeight: height * 0.6 }]}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 18 }}>
                Tambah Sesi
              </ThemedText>
              <Pressable onPress={() => setAddSessionVisible(false)}>
                <Ionicons name="close" size={22} color={textColor} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={{ gap: 14, paddingBottom: 24 }}>
                <View>
                  <ThemedText type="muted" style={styles.label}>
                    Label Sesi
                  </ThemedText>
                  <TextInput
                    value={newSessionLabel}
                    onChangeText={setNewSessionLabel}
                    placeholder="Contoh: Januari 2026 / Minggu 1"
                    placeholderTextColor={mutedColor}
                    style={[styles.input, { borderColor, color: textColor }]}
                  />
                </View>
                <View>
                  <ThemedText type="muted" style={styles.label}>
                    Tanggal (YYYY-MM-DD)
                  </ThemedText>
                  <TextInput
                    value={newSessionTanggal}
                    onChangeText={setNewSessionTanggal}
                    placeholderTextColor={mutedColor}
                    style={[styles.input, { borderColor, color: textColor }]}
                  />
                </View>
                <Pressable
                  onPress={onSubmitSession}
                  disabled={savingSession}
                  style={({ pressed }) => [
                    styles.btn,
                    { backgroundColor: tintColor },
                    (pressed || savingSession) && { opacity: 0.8 },
                  ]}>
                  <ThemedText style={styles.btnText}>{savingSession ? 'Menyimpan...' : 'Tambah Sesi'}</ThemedText>
                </Pressable>
              </View>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      {/* Modal Rename Sesi */}
      <Modal visible={!!renameSessionTarget} transparent animationType="fade">
        <View style={styles.qrOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => { setRenameSessionTarget(null); setRenameSessionValue(''); }} />
          <ThemedView type="card" style={[styles.qrCard, { alignItems: 'flex-start' }]}>
            <View style={[styles.dangerIconWrap, { backgroundColor: tintColor + '18' }]}>
              <Ionicons name="create-outline" size={22} color={tintColor} />
            </View>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 18, marginBottom: 16 }}>Rename Sesi</ThemedText>
            <TextInput
              value={renameSessionValue}
              onChangeText={setRenameSessionValue}
              placeholder="Label sesi..."
              placeholderTextColor={mutedColor}
              style={[styles.input, { borderColor, color: textColor, width: '100%', marginBottom: 20 }]}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <Pressable
                onPress={() => { setRenameSessionTarget(null); setRenameSessionValue(''); }}
                style={({ pressed }) => [styles.btn, { flex: 1, borderWidth: 1, borderColor, backgroundColor: 'transparent' }, pressed && { opacity: 0.8 }]}>
                <ThemedText style={{ fontWeight: '600', color: textColor }}>Batal</ThemedText>
              </Pressable>
              <Pressable
                onPress={onRenameSession}
                disabled={renamingSession}
                style={({ pressed }) => [styles.btn, { flex: 1, backgroundColor: tintColor }, (pressed || renamingSession) && { opacity: 0.8 }]}>
                <ThemedText style={styles.btnText}>{renamingSession ? 'Menyimpan...' : 'Simpan'}</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* Modal QR untuk sesi */}
      <Modal visible={!!qrSession} transparent animationType="fade">
        <View style={styles.qrOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setQrSession(null)} />
          <ThemedView type="card" style={styles.qrCard}>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 18, marginBottom: 4, textAlign: 'center' }}>
              {qrSession?.label}
            </ThemedText>
            <ThemedText type="muted" style={{ fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
              Tunjukkan QR ini kepada peserta
            </ThemedText>
            {qrSession && (
              <QRCode
                value={JSON.stringify({ eventId: qrSession.eventId, sessionId: qrSession.sessionId })}
                size={220}
                color={textColor}
                backgroundColor="transparent"
              />
            )}
            <Pressable
              onPress={() => setQrSession(null)}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: tintColor, marginTop: 20 },
                pressed && { opacity: 0.85 },
              ]}>
              <ThemedText style={styles.btnText}>Tutup</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>

      {/* Konfirmasi hapus sesi / tahun */}
      <Modal visible={!!deleteSessionTarget} transparent animationType="fade">
        <View style={styles.qrOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setDeleteSessionTarget(null)} />
          <ThemedView type="card" style={[styles.qrCard, { alignItems: 'flex-start' }]}>
            <View style={[styles.dangerIconWrap, { backgroundColor: dangerColor + '18' }]}>
              <Ionicons name="trash-outline" size={22} color={dangerColor} />
            </View>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 18, marginBottom: 8 }}>
              {isRutin ? `Hapus Tahun ${deleteSessionTarget?.label}` : 'Hapus Sesi'}
            </ThemedText>
            <ThemedText type="muted" style={{ fontSize: 14, lineHeight: 20, marginBottom: 24 }}>
              {isRutin
                ? `Semua sesi dan data absensi tahun ${deleteSessionTarget?.label} akan ikut terhapus.`
                : `Data absensi untuk sesi "${deleteSessionTarget?.label}" akan ikut terhapus.`}
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <Pressable
                onPress={() => setDeleteSessionTarget(null)}
                disabled={deletingSession}
                style={({ pressed }) => [
                  styles.btn,
                  { flex: 1, borderWidth: 1, borderColor, backgroundColor: 'transparent' },
                  pressed && { opacity: 0.85 },
                ]}>
                <ThemedText style={{ fontWeight: '600', color: textColor }}>Batal</ThemedText>
              </Pressable>
              <Pressable
                disabled={deletingSession}
                onPress={async () => {
                  if (!deleteSessionTarget) return;
                  setDeletingSession(true);
                  try {
                    if (isRutin) {
                      // Hapus semua sesi tahun tersebut
                      const yr = parseInt(deleteSessionTarget.id, 10);
                      const toDelete = eventSessions.filter(s => s.tanggal.startsWith(`${yr}-`));
                      // Juga fetch dari DB kalau ada sesi yang belum ada di context
                      const { data: dbSessions } = await supabase
                        .from('event_sessions')
                        .select('id')
                        .eq('event_id', eventId!)
                        .gte('tanggal', `${yr}-01-01`)
                        .lte('tanggal', `${yr}-12-31`);
                      const allIds = new Set([
                        ...toDelete.map(s => s.id),
                        ...(dbSessions ?? []).map((s: any) => s.id),
                      ]);
                      for (const id of allIds) await deleteSession(id);
                      // Update dbYears state lokal
                      setDbYears(prev => prev.filter(y => y !== yr));
                      
                      // Hapus juga dari manualYears jika ada
                      const updatedManual = manualYears.filter(y => y !== yr);
                      setManualYears(updatedManual);
                      try {
                        await AsyncStorage.setItem(`manual_years_${eventId}`, JSON.stringify(updatedManual));
                      } catch (e) { console.error('saveManualYears error:', e); }
                    } else {
                      await deleteSession(deleteSessionTarget.id);
                    }
                    setDeleteSessionTarget(null);
                  } catch (e: any) {
                    Alert.alert('Gagal', e?.message ?? 'Gagal menghapus.');
                  } finally {
                    setDeletingSession(false);
                  }
                }}
                style={({ pressed }) => [
                  styles.btn,
                  { flex: 1, backgroundColor: dangerColor },
                  (pressed || deletingSession) && { opacity: 0.7 },
                ]}>
                <ThemedText style={styles.btnText}>{deletingSession ? 'Menghapus...' : 'Hapus'}</ThemedText>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  headerRight: {
    width: 80,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 8,
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  empty: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  sessionRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionMain: {
    flex: 1,
    minWidth: 0,
  },
  sessionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sessionNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fab: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  modalWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalCard: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 8,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(127,127,127,0.35)',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
  qrOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 24,
  },
  qrCard: {
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  dangerIconWrap: {
    marginBottom: 16,
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});