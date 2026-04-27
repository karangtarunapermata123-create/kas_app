import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ACCENT_COLORS, useAccentColor } from '@/hooks/use-accent-color';
import { useColorSchemeOverride, type ColorSchemeOverride } from '@/hooks/use-color-scheme-override';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PengaturanTemaScreen() {
  const { accentColor, setAccent } = useAccentColor();
  const { override, setScheme } = useColorSchemeOverride();
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'muted');

  const SCHEME_OPTIONS: { key: ColorSchemeOverride; label: string; icon: string; desc: string }[] = [
    { key: 'light', label: 'Terang', icon: 'sunny', desc: 'Selalu gunakan tema terang' },
    { key: 'dark', label: 'Gelap', icon: 'moon', desc: 'Selalu gunakan tema gelap' },
    { key: 'system', label: 'Ikuti Sistem', icon: 'phone-portrait-outline', desc: 'Sesuaikan dengan pengaturan perangkat' },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <Ionicons name="chevron-back" size={24} color={tintColor} />
          <ThemedText style={{ color: tintColor, fontSize: 16 }}>Kembali</ThemedText>
        </Pressable>
        <View style={styles.headerCenter}>
          <ThemedText type="defaultSemiBold" style={styles.headerTitle}>Tema Warna</ThemedText>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} showsVerticalScrollIndicator={false}>

        {/* Mode Tampilan */}
        <ThemedView type="card" style={styles.card}>
          <ThemedText type="defaultSemiBold" style={styles.cardTitle}>Mode Tampilan</ThemedText>
          <ThemedText type="muted" style={styles.cardDesc}>Pilih tampilan terang, gelap, atau ikuti sistem.</ThemedText>
          <View style={{ gap: 8, marginTop: 8 }}>
            {SCHEME_OPTIONS.map(opt => {
              const isActive = override === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setScheme(opt.key)}
                  style={({ pressed }) => [{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    padding: 14, borderRadius: 14, borderWidth: 1.5,
                    borderColor: isActive ? tintColor : borderColor,
                    backgroundColor: isActive ? tintColor + '10' : 'transparent',
                    opacity: pressed ? 0.7 : 1,
                  }]}
                >
                  <View style={{
                    width: 38, height: 38, borderRadius: 12,
                    backgroundColor: isActive ? tintColor + '20' : 'rgba(127,127,127,0.08)',
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Ionicons name={opt.icon as any} size={20} color={isActive ? tintColor : mutedColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="defaultSemiBold" style={{ fontSize: 14, color: isActive ? tintColor : textColor }}>
                      {opt.label}
                    </ThemedText>
                    <ThemedText type="muted" style={{ fontSize: 12 }}>{opt.desc}</ThemedText>
                  </View>
                  {isActive && <Ionicons name="checkmark-circle" size={22} color={tintColor} />}
                </Pressable>
              );
            })}
          </View>
        </ThemedView>

        {/* Warna Aksen */}
        <ThemedView type="card" style={styles.card}>
          <ThemedText type="defaultSemiBold" style={styles.cardTitle}>Warna Aksen</ThemedText>
          <ThemedText type="muted" style={styles.cardDesc}>Pilih warna aksen yang digunakan di seluruh aplikasi.</ThemedText>
          <View style={styles.colorGrid}>
            {ACCENT_COLORS.map(c => (
              <Pressable
                key={c.value}
                onPress={() => setAccent(c.value)}
                style={[styles.colorDot, { backgroundColor: c.value }, accentColor === c.value && styles.colorDotActive]}>
                {accentColor === c.value && <Ionicons name="checkmark" size={18} color="white" />}
              </Pressable>
            ))}
          </View>
        </ThemedView>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRight: { width: 80 },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, gap: 4, width: 80 },
  headerTitle: { fontSize: 17, textAlign: 'center' },
  card: {
    padding: 20, borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
    gap: 8,
  },
  cardTitle: { fontSize: 16 },
  cardDesc: { fontSize: 13 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  colorDot: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  colorDotActive: {
    transform: [{ scale: 1.15 }],
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
});
