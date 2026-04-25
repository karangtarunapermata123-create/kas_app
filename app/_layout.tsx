import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import 'react-native-reanimated';

import { AdminLogin } from '@/components/admin-login';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AbsensiProvider } from '@/lib/absensi/absensi-context';
import { AdminProvider, useAdmin } from '@/lib/admin/admin-context';
import { KasProvider } from '@/lib/kas/kas-context';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Perbaikan Khusus Web: Inject font-face secara manual agar ikon tidak kotak-kotak di Netlify
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const ioniconsTtf = require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf');
  const materialIconsTtf = require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf');

  const iconFontStyles = `
    @font-face {
      font-family: 'ionicons';
      src: url(${ioniconsTtf}) format('truetype');
    }
    @font-face {
      font-family: 'Ionicons';
      src: url(${ioniconsTtf}) format('truetype');
    }
    @font-face {
      font-family: 'material-icons';
      src: url(${materialIconsTtf}) format('truetype');
    }
    @font-face {
      font-family: 'MaterialIcons';
      src: url(${materialIconsTtf}) format('truetype');
    }
  `;
  const style = document.createElement('style');
  style.type = 'text/css';
  if ((style as any).styleSheet) {
    (style as any).styleSheet.cssText = iconFontStyles;
  } else {
    style.appendChild(document.createTextNode(iconFontStyles));
  }
  document.head.appendChild(style);

  // Fix tab bar tidak terpotong di web
  const fixStyle = document.createElement('style');
  fixStyle.appendChild(document.createTextNode(`
    html, body, #root { height: 100%; overflow-x: hidden; }
    @supports (height: 100dvh) {
      body { min-height: 100dvh; }
    }
    body { padding-bottom: calc(env(safe-area-inset-bottom) + var(--vv-bottom-inset, 0px)); }
    * { box-sizing: border-box; }
  `));
  document.head.appendChild(fixStyle);}

if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
  const updateVisualViewportInsets = () => {
    const vv = window.visualViewport;
    const bottomInset = vv ? Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)) : 0;
    document.documentElement.style.setProperty('--vv-bottom-inset', `${bottomInset}px`);
  };

  updateVisualViewportInsets();

  window.addEventListener('resize', updateVisualViewportInsets);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateVisualViewportInsets);
    window.visualViewport.addEventListener('scroll', updateVisualViewportInsets);
  }
}

export const unstable_settings = {
  anchor: '(tabs)',
};

function AppContent() {
  const { ready, session } = useAdmin();

  // Jika belum ready, tetap biarkan splash screen menutup perlahan agar tidak macet
  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: '#fff' }} />;
  }

  if (!session) return <AdminLogin />;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="transaction/form"
          options={{ presentation: 'modal', title: 'Transaksi', headerShown: true }}
        />
        <Stack.Screen name="kas-detail/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="kas-detail/report" options={{ headerShown: false }} />
        <Stack.Screen name="absensi/event-detail" options={{ headerShown: false }} />
        <Stack.Screen name="absensi/session-detail" options={{ headerShown: false }} />
        <Stack.Screen name="absensi/year-detail" options={{ headerShown: false }} />
        <Stack.Screen name="absensi/absensi-members" options={{ headerShown: false }} />
        <Stack.Screen name="undian/undian-members" options={{ headerShown: false }} />
        <Stack.Screen name="admin/kelola-anggota" options={{ headerShown: false }} />
        <Stack.Screen name="admin/kelola-buku-kas" options={{ headerShown: false }} />
        <Stack.Screen name="admin/pengaturan-akun" options={{ headerShown: false }} />
        <Stack.Screen name="admin/pengaturan-tema" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded, error] = useFonts({
    ...Ionicons.font,
    ...MaterialIcons.font,
  });

  useEffect(() => {
    // Timeout darurat: Jika dalam 10 detik splash screen belum tertutup, paksa tutup.
    // Ini sangat penting untuk versi APK.
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 10000);

    if (loaded || error) {
      clearTimeout(timer);
      SplashScreen.hideAsync().catch(() => {});
    }
    return () => clearTimeout(timer);
  }, [loaded, error]);

  // JANGAN gunakan return null di sini. Selalu render pohon komponen utama.

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AdminProvider>
        <KasProvider>
          <AbsensiProvider>
          <AppContent />
          </AbsensiProvider>
        </KasProvider>
      </AdminProvider>
    </ThemeProvider>
  );
}
