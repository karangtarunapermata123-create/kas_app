import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TabHeader } from '@/components/tab-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAdmin } from '@/lib/admin/admin-context';
import { useKas } from '@/lib/kas/kas-context';
import { formatRupiah } from '@/lib/kas/types';

export default function HomeScreen() {
  const { isAdmin } = useAdmin();
  const { ready, books, txsAll } = useKas();
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const mutedColor = useThemeColor({}, 'muted');

  // Debug info - hapus setelah masalah teratasi
  console.log('HomeScreen Debug:', { ready, booksCount: books.length, txsCount: txsAll.length });

  const bookStats = useMemo(() => {
    const stats: Record<string, { masuk: number; keluar: number; saldo: number }> = {};
    books.forEach(b => { stats[b.id] = { masuk: 0, keluar: 0, saldo: 0 }; });
    txsAll.forEach(tx => {
      if (stats[tx.kasId]) {
        if (tx.jenis === 'MASUK') { stats[tx.kasId].masuk += tx.nominal; stats[tx.kasId].saldo += tx.nominal; }
        else { stats[tx.kasId].keluar += tx.nominal; stats[tx.kasId].saldo -= tx.nominal; }
      }
    });
    return stats;
  }, [books, txsAll]);

  // Show loading state while kas context is not ready
  if (!ready) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={['top']}>
        <ThemedView style={styles.emptyContainer}>
          <Ionicons name="hourglass-outline" size={80} color={mutedColor} style={{ marginBottom: 20 }} />
          <ThemedText type="title" style={{ textAlign: 'center', marginBottom: 10 }}>Memuat...</ThemedText>
          <ThemedText type="muted" style={{ textAlign: 'center' }}>
            Sedang memuat data buku kas Anda.
          </ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  // Show empty state only when ready and no books
  if (ready && books.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={['top']}>
        <ThemedView style={styles.emptyContainer}>
          <Ionicons name="wallet-outline" size={80} color={mutedColor} style={{ marginBottom: 20 }} />
          <ThemedText type="title" style={{ textAlign: 'center', marginBottom: 10 }}>Selamat Datang!</ThemedText>
          <ThemedText type="muted" style={{ textAlign: 'center', marginBottom: 30 }}>
            Anda belum memiliki buku kas. Silakan buat buku kas pertama Anda.
          </ThemedText>
          <Pressable
            onPress={() => router.push('/admin/kelola-buku-kas')}
            style={({ pressed }) => [styles.btn, { backgroundColor: tintColor }, pressed && { opacity: 0.8 }]}>
            <ThemedText type="defaultSemiBold" style={{ color: 'white' }}>Buat Buku Kas Pertama</ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    );
  }

  // Show books list when ready and books exist
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <TabHeader title="Buku Kas" subtitle="Pilih buku kas untuk melihat detail" />

        {books.map(b => {
          const stats = bookStats[b.id] || { masuk: 0, keluar: 0, saldo: 0 };
          return (
            <Pressable
              key={b.id}
              onPress={() => router.push({ pathname: '/kas-detail/[id]', params: { id: b.id } })}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: tintColor },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              <View style={styles.cardTop}>
                <ThemedText type="defaultSemiBold" style={styles.cardName}>{b.nama}</ThemedText>
                <View style={styles.badge}>
                  <ThemedText style={styles.badgeText}>
                    {b.tipe === 'PERIODIK' ? 'Periodik' : 'Standar'}
                  </ThemedText>
                </View>
              </View>

              <ThemedText style={styles.cardBalance}>{formatRupiah(stats.saldo)}</ThemedText>

              <View style={styles.cardStats}>
                <View style={styles.statItem}>
                  <Ionicons name="arrow-down-circle-outline" size={14} color="rgba(255,255,255,0.8)" />
                  <ThemedText style={styles.statLabel}>Masuk</ThemedText>
                  <ThemedText style={styles.statValue}>{formatRupiah(stats.masuk)}</ThemedText>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Ionicons name="arrow-up-circle-outline" size={14} color="rgba(255,255,255,0.8)" />
                  <ThemedText style={styles.statLabel}>Keluar</ThemedText>
                  <ThemedText style={styles.statValue}>{formatRupiah(stats.keluar)}</ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" style={{ marginLeft: 8 }} />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {isAdmin && (
        <Pressable
          onPress={() => router.push('/admin/kelola-buku-kas')}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: tintColor },
            pressed && { opacity: 0.88, transform: [{ scale: 0.96 }] },
          ]}>
          <Ionicons name="pencil" size={26} color="white" />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40, gap: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  btn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', width: '100%' },
  card: {
    borderRadius: 16,
    padding: 20,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardName: { color: 'white', fontSize: 16, flex: 1 },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { color: 'rgba(255,255,255,0.9)', fontSize: 11 },
  cardBalance: { color: 'white', fontSize: 28, fontWeight: '700' },
  cardStats: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  statDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 8 },
  statLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  statValue: { color: 'white', fontSize: 12, fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
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
});
