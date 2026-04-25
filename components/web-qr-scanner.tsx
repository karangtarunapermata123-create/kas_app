import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

type Props = {
  visible: boolean;
  onScanned: (data: string) => void;
  onClose: () => void;
};

// Komponen video native HTML — hanya dirender di web
function VideoLayer({ onVideoReady }: { onVideoReady: (v: HTMLVideoElement, c: HTMLCanvasElement) => void }) {
  const divRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const div = divRef.current;
    if (!div) return;

    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.autoplay = true;
    video.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';

    const canvas = document.createElement('canvas');
    canvas.style.display = 'none';

    div.appendChild(video);
    div.appendChild(canvas);

    onVideoReady(video, canvas);

    return () => {
      video.remove();
      canvas.remove();
    };
  }, [onVideoReady]);

  return React.createElement('div', {
    ref: divRef,
    style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }
  });
}

export function WebQrScanner({ visible, onScanned, onClose }: Props) {
  const animRef = useRef<number>(0);
  const scannedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tintColor = useThemeColor({}, 'tint');

  const scan = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || scannedRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState < 2) {
      animRef.current = requestAnimationFrame(scan);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    import('jsqr').then(({ default: jsQR }) => {
      if (scannedRef.current) return;
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        scannedRef.current = true;
        onScanned(code.data);
      } else {
        animRef.current = requestAnimationFrame(scan);
      }
    });
  }, [onScanned]);

  const onVideoReady = useCallback((video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    videoRef.current = video;
    canvasRef.current = canvas;

    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Kamera tidak tersedia. Pastikan mengakses via HTTPS.');
      onClose();
      return;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      .catch(() => navigator.mediaDevices.getUserMedia({ video: true }))
      .then(stream => {
        streamRef.current = stream;
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          video.play();
          scannedRef.current = false;
          animRef.current = requestAnimationFrame(scan);
        };
      })
      .catch(e => {
        alert('Gagal akses kamera: ' + e.message);
        onClose();
      });
  }, [scan, onClose]);

  useEffect(() => {
    if (!visible) {
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    return () => {
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* @ts-ignore — VideoLayer hanya jalan di web */}
        <VideoLayer onVideoReady={onVideoReady} />
        <View style={styles.overlay}>
          <ThemedText style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>Scan QR Absensi</ThemedText>
          <View style={styles.frame} />
          <ThemedText style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, textAlign: 'center' }}>
            Arahkan kamera ke QR code
          </ThemedText>
          <Pressable onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, { backgroundColor: tintColor }, pressed && { opacity: 0.8 }]}>
            <Ionicons name="close" size={20} color="white" />
            <ThemedText style={{ color: 'white', fontWeight: '600' }}>Batal</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' } as any,
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'space-evenly', alignItems: 'center',
    padding: 24, zIndex: 10,
  } as any,
  frame: { width: 240, height: 240, borderWidth: 3, borderColor: 'white', borderRadius: 16 },
  closeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 24 },
});
