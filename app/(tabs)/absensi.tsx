import { TabHeader } from '@/components/tab-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebQrScanner } from '@/components/web-qr-scanner';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAbsensi } from '@/lib/absensi/absensi-context';
import { useAdmin } from '@/lib/admin/admin-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
    Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet,
    TextInput, View, useWindowDimensions,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AbsensiScreen() {
  const { isAdmin, session, namaLengkap } = useAdmin();
  const { events, sessions, attendances, addEvent, deleteEvent, addSession, deleteSession, absen, renameEvent, refreshData } = useAbsensi();

  useFocusEffect(useCallback(() => {
    refreshData();
  }, [refreshData]));
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'muted');
  const borderColor = useThemeColor({}, 'border');
  const dangerColor = useThemeColor({}, 'danger');
  const successColor = (useThemeColor({}, 'success') as string | undefined) ?? '#22c55e';
  const backgroundColor = useThemeColor({}, 'background');
  const { height } = useWindowDimensions();

  // Add event form
  const [addVisible, setAddVisible] = useState(false);
  const [newNama, setNewNama] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTipe, setNewTipe] = useState<'SEKALI' | 'RUTIN'>('SEKALI');
  const [newPeriod, setNewPeriod] = useState<'WEEKLY' | 'MONTHLY'>('MONTHLY');
  const [saving, setSaving] = useState(false);

  const [adminFabMenuVisible, setAdminFabMenuVisible] = useState(false);

  // Add session form
  const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

  const autoGenerateSession = useCallback((eventId: string) => {
    const ev = events.find(e => e.id === eventId);
    if (!ev || ev.tipe !== 'RUTIN') return;

    const evSessions = sessions.filter(s => s.eventId === eventId);
    const now = new Date();

    if (ev.periodType === 'MONTHLY') {
      // Cari bulan berikutnya dari sesi terakhir
      let nextDate = now;
      if (evSessions.length > 0) {
        const last = evSessions.sort((a, b) => a.tanggal > b.tanggal ? -1 : 1)[0];
        const [y, m] = last.tanggal.split('-').map(Number);
        nextDate = new Date(y, m, 1); // bulan berikutnya
      }
      const label = `${BULAN[nextDate.getMonth()]} ${nextDate.getFullYear()}`;
      const tanggal = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-01`;
      setNewSessionLabel(label);
      setNewSessionTanggal(tanggal);
    } else if (ev.periodType === 'WEEKLY') {
      // Cari minggu berikutnya
      let nextDate = now;
      if (evSessions.length > 0) {
        const last = evSessions.sort((a, b) => a.tanggal > b.tanggal ? -1 : 1)[0];
        const lastD = new Date(last.tanggal);
        nextDate = new Date(lastD.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
      // Hitung nomor minggu dalam tahun
      const startOfYear = new Date(nextDate.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((nextDate.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
      const label = `Minggu ${weekNum} - ${BULAN[nextDate.getMonth()]} ${nextDate.getFullYear()}`;
      const tanggal = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
      setNewSessionLabel(label);
      setNewSessionTanggal(tanggal);
    }
  }, [events, sessions]);

  const [addSessionVisible, setAddSessionVisible] = useState(false);
  const [sessionEventId, setSessionEventId] = useState<string | null>(null);
  const [newSessionLabel, setNewSessionLabel] = useState('');
  const [newSessionTanggal, setNewSessionTanggal] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [savingSession, setSavingSession] = useState(false);

  // Edit mode untuk kegiatan
  const [isEditMode, setIsEditMode] = useState(false);

  // Scanner
  const [scanVisible, setScanVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  // Detail / QR
  const [qrSession, setQrSession] = useState<{ eventId: string; sessionId: string; label: string } | null>(null);

  // Delete confirms
  const [deleteEventTarget, setDeleteEventTarget] = useState<{ id: string; nama: string } | null>(null);
  const [deleteEventNama, setDeleteEventNama] = useState('');
  const [deletingEvent, setDeletingEvent] = useState(false);
  const [deleteSessionTarget, setDeleteSessionTarget] = useState<{ id: string; label: string } | null>(null);
  const [deletingSession, setDeletingSession] = useState(false);

  // Success modal for scan QR
  const [scanSuccessVisible, setScanSuccessVisible] = useState(false);
  const [scanSuccessData, setScanSuccessData] = useState<{
    eventName: string;
    sessionLabel: string;
    userName: string;
  } | null>(null);

  // Rename event
  const [renameTarget, setRenameTarget] = useState<{ id: string; nama: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const onRenameEvent = useCallback(async () => {
    if (!renameTarget) return;
    const nama = renameValue.trim();
    if (!nama) return Alert.alert('Validasi', 'Nama tidak boleh kosong.');
    setRenaming(true);
    try {
      await renameEvent(renameTarget.id, nama);
      setRenameTarget(null);
      setRenameValue('');
    } catch (e: any) { Alert.alert('Gagal', e.message); }
    finally { setRenaming(false); }
  }, [renameTarget, renameValue, renameEvent]);

  const onAddEvent = useCallback(async () => {
    if (!newNama.trim()) return Alert.alert('Error', 'Nama kegiatan wajib diisi.');
    setSaving(true);
    try {
      const ev = await addEvent(newNama, newDesc, newTipe, newTipe === 'RUTIN' ? newPeriod : undefined);
      // Untuk SEKALI, langsung buat satu sesi
      if (newTipe === 'SEKALI') {
        const d = new Date();
        const tanggal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        await addSession(ev.id, newNama.trim(), tanggal);
      }
      setAddVisible(false);
      setNewNama(''); setNewDesc(''); setNewTipe('SEKALI');
    } catch (e: any) { Alert.alert('Gagal', e.message); }
    finally { setSaving(false); }
  }, [newNama, newDesc, newTipe, newPeriod, addEvent, addSession]);

  const onAddSession = useCallback(async () => {
    if (!sessionEventId || !newSessionLabel.trim()) return Alert.alert('Error', 'Label sesi wajib diisi.');
    setSavingSession(true);
    try {
      await addSession(sessionEventId, newSessionLabel, newSessionTanggal);
      setAddSessionVisible(false);
      setNewSessionLabel('');
    } catch (e: any) { Alert.alert('Gagal', e.message); }
    finally { setSavingSession(false); }
  }, [sessionEventId, newSessionLabel, newSessionTanggal, addSession]);

  const onScan = useCallback(async () => {
    if (Platform.OS !== 'web') {
      if (!permission?.granted) {
        const res = await requestPermission();
        if (!res.granted) return Alert.alert('Izin Kamera', 'Izin kamera diperlukan untuk scan QR.');
      }
    }
    scannedRef.current = false;
    setScanVisible(true);
  }, [permission, requestPermission]);

  const onBarcodeScanned = useCallback(async ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setScanVisible(false);
    try {
      const parsed = JSON.parse(data);
      if (!parsed.eventId || !parsed.sessionId) throw new Error('QR tidak valid.');
      const userId = session?.user?.id ?? 'guest';
      const namaUser = namaLengkap ?? session?.user?.email ?? 'Pengguna';
      await absen(parsed.eventId, parsed.sessionId, userId, namaUser);
      
      // Find event and session info for success modal
      const event = events.find(e => e.id === parsed.eventId);
      const sessionInfo = sessions.find(s => s.id === parsed.sessionId);
      
      setScanSuccessData({
        eventName: event?.nama || 'Kegiatan',
        sessionLabel: sessionInfo?.label || 'Sesi',
        userName: namaUser
      });
      setScanSuccessVisible(true);
    } catch (e: any) { Alert.alert('Gagal', e.message || 'QR tidak valid.'); }
  }, [session, namaLengkap, absen, events, sessions]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TabHeader
          title="Absensi"
          subtitle={isAdmin ? 'Kelola kegiatan dan absensi' : 'Scan QR untuk absen'}
        />

        {/* Scan button untuk member */}
        {!isAdmin && (
          <></>
        )}

{/* Daftar kegiatan untuk member */}
          {!isAdmin && (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>Daftar Kegiatan</ThemedText>
                <View style={[styles.roleBadge, { backgroundColor: isAdmin ? tintColor + '20' : 'rgba(127,127,127,0.1)' }]}>
                  <ThemedText style={{ fontSize: 11, color: isAdmin ? tintColor : undefined, fontWeight: '600' }}>
                    {isAdmin ? 'Admin' : 'Member'}
                  </ThemedText>
                </View>
              </View>
             {events.length > 0 ? (
               <View style={{ gap: 10 }}>
                 {events.map(ev => {
                   const evSessions = sessions.filter(s => s.eventId === ev.id);
                   return (
<Pressable key={ev.id} onPress={() => {
                        if (ev.tipe === 'SEKALI') {
                          if (evSessions.length >= 1) {
                            router.push({ pathname: '/absensi/session-detail', params: { sessionId: evSessions[0].id } });
                          } else {
                            router.push({ pathname: '/absensi/event-detail', params: { eventId: ev.id } });
                          }
                        } else {
                          router.push({ pathname: '/absensi/event-detail', params: { eventId: ev.id } });
                        }
                      }}
                       style={({ pressed }) => [styles.eventRow, { borderColor }, pressed && { opacity: 0.7 }]}>
                       <View style={styles.eventInfo}>
<View style={[styles.eventIcon, { backgroundColor: tintColor + '18' }]}>
                            <Ionicons name="calendar" size={18} color={tintColor} />
                          </View>
                         <View style={{ flex: 1 }}>
                           <ThemedText type="defaultSemiBold" style={{ fontSize: 14 }}>{ev.nama}</ThemedText>
<ThemedText type="muted" style={{ fontSize: 12 }}>
                              {ev.tipe === 'RUTIN' 
                                ? `Rutin · ${ev.periodType === 'WEEKLY' ? 'Mingguan' : 'Bulanan'}`
                                : `${attendances.filter(a => a.eventId === ev.id).length} hadir`}
                            </ThemedText>
                         </View>
                       </View>
                     </Pressable>
                   );
                 })}
               </View>
             ) : (
               <View style={styles.empty}>
                 <Ionicons name="calendar-outline" size={40} color={mutedColor} />
                 <ThemedText type="muted" style={{ marginTop: 8, textAlign: 'center' }}>Belum ada kegiatan dibuat</ThemedText>
               </View>
)}
            </View>
          )}

{/* Daftar kegiatan untuk admin */}
          {isAdmin && (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>Daftar Kegiatan</ThemedText>
              </View>
            {events.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="calendar-outline" size={40} color={mutedColor} />
                <ThemedText type="muted" style={{ marginTop: 8, textAlign: 'center' }}>Belum ada kegiatan.</ThemedText>
              </View>
            ) : (
              <View style={{ gap: 10, marginTop: 12 }}>
                {Array.from(new Map(events.map(ev => [ev.id, ev])).values()).map(ev => {
                  const evSessions = sessions.filter(s => s.eventId === ev.id);
                  return (
                    <ThemedView key={`event-${ev.id}`} style={[styles.eventRow, { borderColor }]}>
                      <Pressable style={styles.eventInfo} onPress={() => {
                        if (ev.tipe === 'SEKALI') {
                          if (evSessions.length >= 1) {
                            router.push({ pathname: '/absensi/session-detail', params: { sessionId: evSessions[0].id } });
                          } else {
                            router.push({ pathname: '/absensi/event-detail', params: { eventId: ev.id } });
                          }
                        } else {
                          router.push({ pathname: '/absensi/event-detail', params: { eventId: ev.id } });
                        }
                      }}>
                        <View style={[styles.eventIcon, { backgroundColor: tintColor + '18' }]}>
                          <Ionicons name="calendar" size={18} color={tintColor} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText type="defaultSemiBold" style={{ fontSize: 14 }}>{ev.nama}</ThemedText>
                          <ThemedText type="muted" style={{ fontSize: 12 }}>
                            {ev.tipe === 'RUTIN' 
                              ? `Rutin · ${ev.periodType === 'WEEKLY' ? 'Mingguan' : 'Bulanan'}`
                              : `${attendances.filter(a => a.eventId === ev.id).length} hadir`}
                          </ThemedText>
                        </View>
                      </Pressable>
                      <View style={styles.eventActions}>
                        {isEditMode ? (
                          <>
                            <Pressable onPress={() => { setRenameTarget({ id: ev.id, nama: ev.nama }); setRenameValue(ev.nama); }}
                              style={({ pressed }) => [styles.iconBtn, { backgroundColor: tintColor + '15' }, pressed && { opacity: 0.6 }]}>
                              <Ionicons name="create-outline" size={18} color={tintColor} />
                            </Pressable>
                            <Pressable onPress={() => { setDeleteEventNama(ev.nama); setDeleteEventTarget({ id: ev.id, nama: ev.nama }); }}
                              style={({ pressed }) => [styles.iconBtn, { backgroundColor: dangerColor + '15' }, pressed && { opacity: 0.6 }]}>
                              <Ionicons name="trash-outline" size={18} color={dangerColor} />
                            </Pressable>
                          </>
                        ) : (
                          ev.tipe === 'SEKALI' && evSessions.length > 0 && (
                            <Pressable onPress={() => {
                              const ses = evSessions[0];
                              setQrSession({ eventId: ev.id, sessionId: ses.id, label: ses.label });
                            }}
                              style={({ pressed }) => [styles.iconBtn, { backgroundColor: tintColor + '15' }, pressed && { opacity: 0.6 }]}>
                              <Ionicons name="qr-code" size={18} color={tintColor} />
                            </Pressable>
                          )
                        )}
                      </View>
                    </ThemedView>
                  );
                })}
              </View>
)}
            </View>
          )}
      </ScrollView>

      {/* FAB Scan QR untuk member */}
      {!isAdmin && (
        <Pressable
          onPress={onScan}
          style={({ pressed }) => [styles.fab, styles.fabSingle, { backgroundColor: tintColor }, pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] }]}>
          <Ionicons name="qr-code-outline" size={28} color="white" />
        </Pressable>
      )}

      {/* FAB untuk admin — scan QR & mini pencil */}
      {isAdmin && (
        <View style={[styles.fabSingle, { alignItems: 'center', justifyContent: 'center' }]}>
          {isEditMode ? (
            <Pressable
              key="btn-done"
              onPress={() => setIsEditMode(false)}
              style={({ pressed }) => [
                styles.fab, 
                { backgroundColor: successColor }, 
                pressed && { opacity: 0.8, transform: [{ scale: 0.9 }] }
              ]}>
              <Ionicons name="checkmark" size={32} color="white" />
            </Pressable>
          ) : (
            <View key="btn-group" style={{ alignItems: 'center' }}>
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
                key="btn-qr"
                onPress={onScan}
                style={({ pressed }) => [styles.fab, { backgroundColor: tintColor }, pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] }]}>
                <Ionicons name="qr-code-outline" size={28} color="white" />
              </Pressable>
            </View>
          )}
        </View>
      )}

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
                <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>Kelola Kegiatan</ThemedText>
                <ThemedText type="muted" style={{ fontSize: 12, marginTop: 2 }}>Edit nama atau hapus kegiatan</ThemedText>
              </View>
            </Pressable>

            <Pressable
              onPress={() => { setAdminFabMenuVisible(false); setAddVisible(true); }}
              style={({ pressed }) => [styles.fabMenuItem, pressed && { opacity: 0.75 }]}>
              <View style={[styles.fabMenuIcon, { backgroundColor: tintColor + '18' }]}>
                <Ionicons name="add-circle-outline" size={22} color={tintColor} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>Tambah Kegiatan</ThemedText>
                <ThemedText type="muted" style={{ fontSize: 12, marginTop: 2 }}>Buat kegiatan baru untuk absensi</ThemedText>
              </View>
            </Pressable>

            <Pressable
              onPress={() => { setAdminFabMenuVisible(false); router.push('/absensi/absensi-members'); }}
              style={({ pressed }) => [styles.fabMenuItem, pressed && { opacity: 0.75 }]}>
              <View style={[styles.fabMenuIcon, { backgroundColor: tintColor + '18' }]}>
                <Ionicons name="people-outline" size={22} color={tintColor} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>Edit Anggota</ThemedText>
                <ThemedText type="muted" style={{ fontSize: 12, marginTop: 2 }}>Pilih anggota untuk semua kegiatan</ThemedText>
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

      {/* Modal Tambah Kegiatan */}
      <Modal visible={addVisible} transparent animationType="slide">
        <View style={styles.modalWrap}>
          <Pressable style={styles.overlay} onPress={() => setAddVisible(false)} />
          <ThemedView type="card" style={[styles.modalCard, { maxHeight: height * 0.85 }]}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 18 }}>Tambah Kegiatan</ThemedText>
              <Pressable onPress={() => setAddVisible(false)}><Ionicons name="close" size={22} color={textColor} /></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={{ gap: 14, paddingBottom: 24 }}>
                <View>
                  <ThemedText type="muted" style={styles.label}>Nama Kegiatan</ThemedText>
                  <TextInput value={newNama} onChangeText={setNewNama} placeholder="Contoh: Arisan RT"
                    placeholderTextColor={mutedColor} style={[styles.input, { borderColor, color: textColor }]} />
                </View>
                <View>
                  <ThemedText type="muted" style={styles.label}>Deskripsi (opsional)</ThemedText>
                  <TextInput value={newDesc} onChangeText={setNewDesc} placeholder="Deskripsi..."
                    placeholderTextColor={mutedColor} multiline numberOfLines={2}
                    style={[styles.input, { borderColor, color: textColor, height: 64, textAlignVertical: 'top' }]} />
                </View>
                <View>
                  <ThemedText type="muted" style={styles.label}>Tipe Kegiatan</ThemedText>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {(['SEKALI', 'RUTIN'] as const).map(t => (
                      <Pressable key={t} onPress={() => setNewTipe(t)}
                        style={[styles.typeBtn, { borderColor }, newTipe === t && { backgroundColor: tintColor, borderColor: tintColor }]}>
                        <ThemedText style={[{ fontSize: 13, fontWeight: '600' }, newTipe === t && { color: 'white' }]}>
                          {t === 'SEKALI' ? 'Sekali' : 'Rutin (Berulang)'}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>
                {newTipe === 'RUTIN' && (
                  <View>
                    <ThemedText type="muted" style={styles.label}>Periode</ThemedText>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      {(['MONTHLY', 'WEEKLY'] as const).map(p => (
                        <Pressable key={p} onPress={() => setNewPeriod(p)}
                          style={[styles.typeBtn, { borderColor }, newPeriod === p && { backgroundColor: tintColor, borderColor: tintColor }]}>
                          <ThemedText style={[{ fontSize: 13, fontWeight: '600' }, newPeriod === p && { color: 'white' }]}>
                            {p === 'MONTHLY' ? 'Bulanan' : 'Mingguan'}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
                <Pressable onPress={onAddEvent} disabled={saving}
                  style={({ pressed }) => [styles.btn, { backgroundColor: tintColor }, (pressed || saving) && { opacity: 0.8 }]}>
                  <ThemedText style={styles.btnText}>{saving ? 'Menyimpan...' : 'Simpan Kegiatan'}</ThemedText>
                </Pressable>
              </View>
            </ScrollView>
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
              <ThemedText type="defaultSemiBold" style={{ fontSize: 18 }}>Tambah Sesi</ThemedText>
              <Pressable onPress={() => setAddSessionVisible(false)}><Ionicons name="close" size={22} color={textColor} /></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={{ gap: 14, paddingBottom: 24 }}>
                <View>
                  <ThemedText type="muted" style={styles.label}>Label Sesi</ThemedText>
                  <TextInput value={newSessionLabel} onChangeText={setNewSessionLabel}
                    placeholder="Contoh: Januari 2025 / Minggu 1"
                    placeholderTextColor={mutedColor} style={[styles.input, { borderColor, color: textColor }]} />
                </View>
                <View>
                  <ThemedText type="muted" style={styles.label}>Tanggal (YYYY-MM-DD)</ThemedText>
                  <TextInput value={newSessionTanggal} onChangeText={setNewSessionTanggal}
                    placeholderTextColor={mutedColor} style={[styles.input, { borderColor, color: textColor }]} />
                </View>
                <Pressable onPress={onAddSession} disabled={savingSession}
                  style={({ pressed }) => [styles.btn, { backgroundColor: tintColor }, (pressed || savingSession) && { opacity: 0.8 }]}>
                  <ThemedText style={styles.btnText}>{savingSession ? 'Menyimpan...' : 'Tambah Sesi'}</ThemedText>
                </Pressable>
              </View>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      {/* Modal Detail Absensi per Sesi */}
      {/* Modal QR Code */}
      <Modal visible={!!qrSession} transparent animationType="fade">
        <View style={styles.qrOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setQrSession(null)} />
          <ThemedView type="card" style={styles.qrCard}>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 18, marginBottom: 4, textAlign: 'center' }}>{qrSession?.label}</ThemedText>
            <ThemedText type="muted" style={{ fontSize: 13, marginBottom: 20, textAlign: 'center' }}>Tunjukkan QR ini kepada peserta</ThemedText>
            {qrSession && (
              <QRCode value={JSON.stringify({ eventId: qrSession.eventId, sessionId: qrSession.sessionId })}
                size={220} color={textColor} backgroundColor="transparent" />
            )}
            <Pressable onPress={() => setQrSession(null)}
              style={({ pressed }) => [styles.btn, { backgroundColor: tintColor, marginTop: 20, alignSelf: 'stretch', borderRadius: 16 }, pressed && { opacity: 0.8 }]}>
              <ThemedText style={styles.btnText}>Tutup</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>

      {/* Modal Rename Kegiatan */}
      <Modal visible={!!renameTarget} transparent animationType="fade">
        <View style={styles.qrOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => { setRenameTarget(null); setRenameValue(''); }} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', maxWidth: 400 }}>
            <ThemedView type="card" style={[styles.qrCard, { alignItems: 'flex-start' }]}>
              <View style={[styles.eventIcon, { backgroundColor: tintColor + '18', marginBottom: 16, width: 48, height: 48, borderRadius: 14 }]}>
                <Ionicons name="create-outline" size={22} color={tintColor} />
              </View>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 18, marginBottom: 16 }}>Rename Kegiatan</ThemedText>
              <TextInput
                value={renameValue}
                onChangeText={setRenameValue}
                placeholder="Nama kegiatan..."
                placeholderTextColor={mutedColor}
                style={[styles.input, { borderColor, color: textColor, width: '100%', marginBottom: 20 }]}
                autoFocus
              />
              <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                <Pressable onPress={() => { setRenameTarget(null); setRenameValue(''); }}
                  style={({ pressed }) => [styles.btn, { flex: 1, borderWidth: 1, borderColor, backgroundColor: 'transparent' }, pressed && { opacity: 0.8 }]}>
                  <ThemedText style={{ fontWeight: '600', color: textColor }}>Batal</ThemedText>
                </Pressable>
                <Pressable onPress={onRenameEvent} disabled={renaming}
                  style={({ pressed }) => [styles.btn, { flex: 1, backgroundColor: tintColor }, (pressed || renaming) && { opacity: 0.8 }]}>
                  <ThemedText style={styles.btnText}>{renaming ? 'Menyimpan...' : 'Simpan'}</ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal Konfirmasi Hapus Kegiatan */}
      <Modal visible={!!deleteEventTarget} transparent animationType="fade">
        <View style={styles.qrOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setDeleteEventTarget(null)} />
          <ThemedView type="card" style={[styles.qrCard, { alignItems: 'flex-start' }]}>
            <View style={[styles.eventIcon, { backgroundColor: dangerColor + '18', marginBottom: 16, width: 48, height: 48, borderRadius: 14 }]}>
              <Ionicons name="trash-outline" size={22} color={dangerColor} />
            </View>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 18, marginBottom: 8 }}>Hapus Kegiatan</ThemedText>
            <ThemedText type="muted" style={{ fontSize: 14, lineHeight: 20, marginBottom: 24 }}>
              Hapus "{deleteEventNama}"? Semua sesi dan data absensi akan ikut terhapus.
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <Pressable
                onPress={() => setDeleteEventTarget(null)}
                disabled={deletingEvent}
                style={({ pressed }) => [styles.btn, { flex: 1, borderWidth: 1, borderColor, backgroundColor: 'transparent' }, pressed && { opacity: 0.8 }]}>
                <ThemedText style={{ fontWeight: '600', color: textColor }}>Batal</ThemedText>
              </Pressable>
              <Pressable
                disabled={deletingEvent}
                onPress={async () => {
                  if (!deleteEventTarget) return;
                  setDeletingEvent(true);
                  try {
                    await deleteEvent(deleteEventTarget.id);
                    setDeleteEventTarget(null);
                  } catch (e: any) {
                    Alert.alert('Gagal', e?.message ?? 'Gagal menghapus kegiatan.');
                  } finally {
                    setDeletingEvent(false);
                  }
                }}
                style={({ pressed }) => [styles.btn, { flex: 1, backgroundColor: dangerColor }, (pressed || deletingEvent) && { opacity: 0.7 }]}>
                <ThemedText style={styles.btnText}>{deletingEvent ? 'Menghapus...' : 'Hapus'}</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* Modal Konfirmasi Hapus Sesi */}
      <Modal visible={!!deleteSessionTarget} transparent animationType="fade">
        <View style={styles.qrOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setDeleteSessionTarget(null)} />
          <ThemedView type="card" style={[styles.qrCard, { alignItems: 'flex-start' }]}>
            <View style={[styles.eventIcon, { backgroundColor: dangerColor + '18', marginBottom: 16, width: 48, height: 48, borderRadius: 14 }]}>
              <Ionicons name="trash-outline" size={22} color={dangerColor} />
            </View>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 18, marginBottom: 8 }}>Hapus Sesi</ThemedText>
            <ThemedText type="muted" style={{ fontSize: 14, lineHeight: 20, marginBottom: 24 }}>
              Hapus sesi "{deleteSessionTarget?.label}"? Data absensi sesi ini akan ikut terhapus.
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <Pressable onPress={() => setDeleteSessionTarget(null)}
                disabled={deletingSession}
                style={({ pressed }) => [styles.btn, { flex: 1, borderWidth: 1, borderColor, backgroundColor: 'transparent' }, pressed && { opacity: 0.8 }]}>
                <ThemedText style={{ fontWeight: '600', color: textColor }}>Batal</ThemedText>
              </Pressable>
              <Pressable
                disabled={deletingSession}
                onPress={async () => {
                  if (!deleteSessionTarget) return;
                  setDeletingSession(true);
                  try {
                    await deleteSession(deleteSessionTarget.id);
                    setDeleteSessionTarget(null);
                  } catch (e: any) {
                    Alert.alert('Gagal', e?.message ?? 'Gagal menghapus sesi.');
                  } finally {
                    setDeletingSession(false);
                  }
                }}
                style={({ pressed }) => [styles.btn, { flex: 1, backgroundColor: dangerColor }, (pressed || deletingSession) && { opacity: 0.7 }]}>
                <ThemedText style={styles.btnText}>{deletingSession ? 'Menghapus...' : 'Hapus'}</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* Modal Berhasil Scan QR */}
      <Modal visible={scanSuccessVisible} transparent animationType="fade">
        <View style={styles.qrOverlay}>
          <ThemedView type="card" style={[styles.qrCard, { alignItems: 'center' }]}>
            <View style={[styles.eventIcon, { backgroundColor: successColor + '18', marginBottom: 20, width: 64, height: 64, borderRadius: 20 }]}>
              <Ionicons name="checkmark-circle" size={32} color={successColor} />
            </View>
            
            <ThemedText type="defaultSemiBold" style={{ fontSize: 20, textAlign: 'center', marginBottom: 8 }}>
              Absensi Berhasil!
            </ThemedText>
            
            <ThemedText style={{ fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 4, color: successColor }}>
              {scanSuccessData?.userName}
            </ThemedText>
            
            <ThemedText type="muted" style={{ fontSize: 14, textAlign: 'center', marginBottom: 6 }}>
              {scanSuccessData?.eventName}
            </ThemedText>
            
            <ThemedText type="muted" style={{ fontSize: 13, textAlign: 'center', marginBottom: 24 }}>
              {scanSuccessData?.sessionLabel}
            </ThemedText>

            <Pressable
              onPress={() => {
                setScanSuccessVisible(false);
                setScanSuccessData(null);
              }}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: successColor, alignSelf: 'stretch', borderRadius: 16 },
                pressed && { opacity: 0.8 }
              ]}>
              <ThemedText style={styles.btnText}>Tutup</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>

      {/* Scanner — native pakai CameraView, web pakai WebQrScanner */}
      {Platform.OS === 'web' ? (
        <WebQrScanner
          visible={scanVisible}
          onScanned={(data) => { setScanVisible(false); onBarcodeScanned({ data }); }}
          onClose={() => setScanVisible(false)}
        />
      ) : (
        <Modal visible={scanVisible} animationType="slide">
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              onBarcodeScanned={onBarcodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            />
            <SafeAreaView style={styles.scanOverlay} edges={['top', 'bottom']}>
              <ThemedText style={{ color: 'white', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>Scan QR Absensi</ThemedText>
              <View style={styles.scanFrame} />
              <ThemedText style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' }}>Arahkan kamera ke QR code sesi</ThemedText>
              <Pressable
                onPress={() => setScanVisible(false)}
                style={({ pressed }) => [styles.btn, { backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 16 }, pressed && { opacity: 0.7 }]}>
              <ThemedText style={{ color: 'white', fontWeight: '600' }}>Batal</ThemedText>
              </Pressable>
            </SafeAreaView>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
   safe: { flex: 1 },
   scroll: { padding: 20, paddingBottom: 40, gap: 16 },
   card: { borderRadius: 20, padding: 20 },
   roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, marginTop: 4 },
   cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 32 },
  eventRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  eventInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  eventIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  eventActions: { flexDirection: 'row', gap: 6, paddingRight: 10 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  btnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  typeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, borderWidth: 1 },
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(127,127,127,0.3)', alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  qrOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 24 },
  qrCard: { borderRadius: 24, padding: 28, alignItems: 'center', width: '100%', maxWidth: 400 },
  attRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 12 },
  attNum: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  tableHeader: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, marginBottom: 4 },
  tableRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  tableColNo: { width: 32, textAlign: 'center' },
  tableColName: { flex: 1, paddingHorizontal: 8 },
  tableColTime: { width: 60, textAlign: 'right' },
  scanOverlay: { flex: 1, justifyContent: 'space-between', alignItems: 'center', padding: 24 },
  scanFrame: { width: 240, height: 240, borderWidth: 3, borderColor: 'white', borderRadius: 16 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#22c55e', // Default green
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
  fabGroup: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'row',
    gap: 14,
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
