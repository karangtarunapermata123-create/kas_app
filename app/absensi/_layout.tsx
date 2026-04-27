import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebQrScanner } from '@/components/web-qr-scanner';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAbsensi } from '@/lib/absensi/absensi-context';
import { useAdmin } from '@/lib/admin/admin-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AbsensiLayout() {
  const insets = useSafeAreaInsets();
  const { isAdmin, session, namaLengkap } = useAdmin();
  const { absen, events, sessions } = useAbsensi();

  const tintColor = useThemeColor({}, 'tint');
  const successColor = (useThemeColor({}, 'success') as string | undefined) ?? '#22c55e';

  const [scanVisible, setScanVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  const [scanSuccessVisible, setScanSuccessVisible] = useState(false);
  const [scanSuccessData, setScanSuccessData] = useState<{
    eventName: string;
    sessionLabel: string;
    userName: string;
  } | null>(null);

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

      const event = events.find(e => e.id === parsed.eventId);
      const sessionInfo = sessions.find(s => s.id === parsed.sessionId);
      setScanSuccessData({
        eventName: event?.nama || 'Kegiatan',
        sessionLabel: sessionInfo?.label || 'Sesi',
        userName: namaUser,
      });
      setScanSuccessVisible(true);
    } catch (e: any) {
      Alert.alert('Gagal', e.message || 'QR tidak valid.');
    }
  }, [session, namaLengkap, absen, events, sessions]);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />

      {!isAdmin && (
        <Pressable
          onPress={onScan}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: tintColor, bottom: 24 + insets.bottom, right: 24 },
            pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] },
          ]}>
          <Ionicons name="qr-code-outline" size={28} color="white" />
        </Pressable>
      )}

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
              <View style={styles.scanFrame} />
              <Pressable
                onPress={() => setScanVisible(false)}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && { opacity: 0.7 },
                ]}>
                <Ionicons name="close" size={22} color="white" />
              </Pressable>
            </SafeAreaView>
          </View>
        </Modal>
      )}

      {/* Modal Berhasil Scan QR */}
      <Modal visible={scanSuccessVisible} transparent animationType="fade">
        <View style={styles.qrOverlay}>
          <ThemedView type="card" style={[styles.qrCard, { alignItems: 'center' }]}>
            <View style={{ backgroundColor: successColor + '18', marginBottom: 20, width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center' }}>
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
              onPress={() => { setScanSuccessVisible(false); setScanSuccessData(null); }}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: successColor, alignSelf: 'stretch', borderRadius: 16 },
                pressed && { opacity: 0.8 },
              ]}>
              <ThemedText style={styles.btnText}>Tutup</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
  scanOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 260,
    height: 260,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
    backgroundColor: 'transparent',
  },
  cancelBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
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
    width: '100%',
    maxWidth: 400,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  btnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
});
