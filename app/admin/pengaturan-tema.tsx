import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ACCENT_COLORS, useAccentColor } from '@/hooks/use-accent-color';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PengaturanTemaScreen() {
  const { accentColor, setAccent } = useAccentColor();
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');

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
    margin: 16, padding: 20, borderRadius: 20,
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
