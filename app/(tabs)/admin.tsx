import { TabHeader } from '@/components/tab-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAccentColor } from '@/hooks/use-accent-color';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAdmin } from '@/lib/admin/admin-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { paddingBottom: 40 },
  card: {
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: { fontSize: 16 },
  cardDesc: { fontSize: 13, marginTop: 2 },
  avatarBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
});

export default function AdminScreen() {
  const { isAdmin, session, namaLengkap } = useAdmin();
  const { accentColor } = useAccentColor();

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const mutedColor = useThemeColor({}, 'muted');

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TabHeader title="Pengaturan" style={{ paddingHorizontal: 20, paddingTop: 20, marginBottom: 16 }} />

        {/* Card Akun — navigasi ke halaman pengaturan akun */}
        <Pressable onPress={() => router.push('/admin/pengaturan-akun')} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
          <ThemedView type="card" style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.avatarBox, { backgroundColor: accentColor + '20' }]}>
                <Ionicons name="person" size={24} color={accentColor} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" numberOfLines={1}>{namaLengkap ?? session?.user?.email}</ThemedText>
                <ThemedText type="muted" numberOfLines={1} style={{ fontSize: 12 }}>{session?.user?.email}</ThemedText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.roleBadge, { backgroundColor: isAdmin ? accentColor + '20' : 'rgba(127,127,127,0.1)' }]}>
                  <ThemedText style={{ fontSize: 11, color: isAdmin ? accentColor : mutedColor, fontWeight: '600' }}>
                    {isAdmin ? 'Admin' : 'Member'}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={mutedColor} />
              </View>
            </View>
          </ThemedView>
        </Pressable>

        {/* Card Tema Warna */}
        <Pressable onPress={() => router.push('/admin/pengaturan-tema')} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
          <ThemedView type="card" style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={styles.cardTitle}>Tema Warna</ThemedText>
                <ThemedText type="muted" style={styles.cardDesc}>Pilih warna aksen aplikasi.</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={tintColor} />
            </View>
          </ThemedView>
        </Pressable>

        {/* Card Kelola Akun Anggota — hanya admin */}
        {isAdmin && (
          <Pressable onPress={() => router.push('/admin/kelola-anggota')} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <ThemedView type="card" style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="defaultSemiBold" style={styles.cardTitle}>Kelola Akun Anggota</ThemedText>
                  <ThemedText type="muted" style={styles.cardDesc}>Buat dan kelola akun anggota.</ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={tintColor} />
              </View>
            </ThemedView>
          </Pressable>
        )}


      </ScrollView>
    </SafeAreaView>
  );
}
