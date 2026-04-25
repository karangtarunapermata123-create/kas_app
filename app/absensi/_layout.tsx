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
  const { absen } = useAbsensi();

  const tintColor = useThemeColor({}, 'tint');

  const [scanVisible, setScanVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

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
      Alert.alert('Berhasil', 'Absensi berhasil dicatat!');
    } catch (e: any) {
      Alert.alert('Gagal', e.message || 'QR tidak valid.');
    }
  }, [session, namaLengkap, absen]);

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
});
