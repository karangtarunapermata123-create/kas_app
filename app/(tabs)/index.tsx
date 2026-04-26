import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TabHeader } from '@/components/tab-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAdmin } from '@/lib/admin/admin-context';
import { useKas } from '@/lib/kas/kas-context';
import { formatRupiah } from '@/lib/kas/types';

const BOOK_COLORS = [
  { cover: '#2563eb', spine: '#1d4ed8', accent: '#93c5fd' },
  { cover: '#16a34a', spine: '#15803d', accent: '#86efac' },
  { cover: '#dc2626', spine: '#b91c1c', accent: '#fca5a5' },
  { cover: '#9333ea', spine: '#7e22ce', accent: '#d8b4fe' },
  { cover: '#ea580c', spine: '#c2410c', accent: '#fdba74' },
  { cover: '#0891b2', spine: '#0e7490', accent: '#67e8f9' },
  { cover: '#ca8a04', spine: '#a16207', accent: '#fde047' },
  { cover: '#be185d', spine: '#9d174d', accent: '#f9a8d4' },
];

function BookCard({ book, stats, index, cardWidth, onPress }: {
  book: { id: string; nama: string; tipe?: string; members?: any[]; categories?: string[] };
  stats: { masuk: number; keluar: number; saldo: number };
  index: number;
  cardWidth: number;
  onPress: () => void;
}) {
  const colors = BOOK_COLORS[index % BOOK_COLORS.length];
  const isPeriodik = book.tipe === 'PERIODIK';
  const spineWidth = 10;
  const cardHeight = cardWidth * 1.45; // proporsi buku portrait

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { width: cardWidth, height: cardHeight + 5, marginBottom: 8 },
        pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
      ]}
    >
      {/* Efek halaman di belakang */}
      <View style={[styles.pages1, {
        backgroundColor: '#d1d5db',
        width: cardWidth - spineWidth - 2,
        height: cardHeight,
        right: 0, bottom: -4,
      }]} />
      <View style={[styles.pages1, {
        backgroundColor: '#e5e7eb',
        width: cardWidth - spineWidth - 1,
        height: cardHeight,
        right: 0, bottom: -2,
      }]} />

      {/* Buku utama */}
      <View style={[styles.bookOuter, { width: cardWidth, height: cardHeight }]}>
        {/* Spine */}
        <View style={[styles.spine, { backgroundColor: colors.spine, width: spineWidth }]}>
          <View style={[styles.spineLine, { height: cardHeight * 0.25 }]} />
          <View style={[styles.spineLine, { height: cardHeight * 0.1 }]} />
        </View>

        {/* Cover */}
        <View style={[styles.cover, { backgroundColor: colors.cover, flex: 1 }]}>
          {/* Dekorasi lingkaran besar di pojok kanan atas */}
          <View style={[styles.deco, {
            backgroundColor: 'rgba(255,255,255,0.07)',
            width: cardWidth * 0.9,
            height: cardWidth * 0.9,
            borderRadius: cardWidth * 0.45,
            top: -cardWidth * 0.35,
            right: -cardWidth * 0.3,
          }]} />

          {/* Ikon */}
          <View style={[styles.iconBox, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
            <Ionicons name={isPeriodik ? 'people' : 'journal'} size={18} color="white" />
          </View>

          {/* Badge tipe */}
          <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <ThemedText style={styles.badgeText}>
              {isPeriodik ? 'Periodik' : 'Standar'}
            </ThemedText>
          </View>

          {/* Nama buku */}
          <ThemedText style={styles.bookName} numberOfLines={3}>{book.nama}</ThemedText>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.accent + '50' }]} />

          {/* Saldo */}
          <ThemedText style={styles.saldoLabel}>Saldo</ThemedText>
          <ThemedText
            style={[styles.saldoVal, { color: stats.saldo >= 0 ? colors.accent : '#fca5a5' }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatRupiah(stats.saldo)}
          </ThemedText>

          {/* Masuk / Keluar */}
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Ionicons name="arrow-down-circle" size={10} color={colors.accent} />
              <ThemedText style={[styles.statLbl, { color: colors.accent }]}>Masuk</ThemedText>
              <ThemedText style={styles.statNum} numberOfLines={1} adjustsFontSizeToFit>
                {formatRupiah(stats.masuk)}
              </ThemedText>
            </View>
            <View style={[styles.statSep, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
            <View style={styles.statCol}>
              <Ionicons name="arrow-up-circle" size={10} color="rgba(255,255,255,0.65)" />
              <ThemedText style={[styles.statLbl, { color: 'rgba(255,255,255,0.65)' }]}>Keluar</ThemedText>
              <ThemedText style={styles.statNum} numberOfLines={1} adjustsFontSizeToFit>
                {formatRupiah(stats.keluar)}
              </ThemedText>
            </View>
          </View>

          {/* Meta bawah */}
          <View style={styles.metaRow}>
            {isPeriodik && (
              <View style={styles.metaChip}>
                <Ionicons name="people-outline" size={9} color="rgba(255,255,255,0.55)" />
                <ThemedText style={styles.metaTxt}>{book.members?.length ?? 0}</ThemedText>
              </View>
            )}
            {(book.categories?.length ?? 0) > 0 && (
              <View style={styles.metaChip}>
                <Ionicons name="pricetag-outline" size={9} color="rgba(255,255,255,0.55)" />
                <ThemedText style={styles.metaTxt}>{book.categories!.length}</ThemedText>
              </View>
            )}
            <View style={{ flex: 1 }} />
            <Ionicons name="chevron-forward" size={13} color="rgba(255,255,255,0.3)" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { isSuperAdmin, session } = useAdmin();
  const { ready, books, txsAll } = useKas();
  const { width, height } = useWindowDimensions();
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const mutedColor = useThemeColor({}, 'muted');

  console.log('HomeScreen Debug:', {
    ready,
    booksCount: books.length,
    txsCount: txsAll.length,
    hasSession: !!session,
  });

  const GAP = 12;
  const PADDING = 16;

  // Jumlah kolom berdasarkan lebar layar:
  // ≥1024px (desktop/tablet besar) → 5 kolom
  // ≥600px (landscape HP / tablet kecil) → 5 kolom
  // <600px (portrait HP) → 2 kolom
  const numCols = width >= 600 ? 5 : 2;
  const cardWidth = Math.floor((width - PADDING * 2 - GAP * (numCols - 1)) / numCols);

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

  if (!ready || !session) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={['top']}>
        <ThemedView style={styles.emptyContainer}>
          <Ionicons name="hourglass-outline" size={80} color={mutedColor} style={{ marginBottom: 20 }} />
          <ThemedText type="title" style={{ textAlign: 'center', marginBottom: 10 }}>Memuat...</ThemedText>
          <ThemedText type="muted" style={{ textAlign: 'center' }}>Sedang memuat data buku kas Anda.</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

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

  // Susun buku jadi baris sesuai numCols
  const rows: Array<typeof books> = [];
  for (let i = 0; i < books.length; i += numCols) {
    rows.push(books.slice(i, i + numCols));
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: PADDING }]}
        showsVerticalScrollIndicator={false}
      >
        <TabHeader title="Buku Kas" subtitle="Pilih buku kas untuk melihat detail" />

        {rows.map((row, rowIdx) => (
          <View key={rowIdx} style={[styles.row, { gap: GAP }]}>
            {row.map((b, colIdx) => {
              const globalIdx = rowIdx * numCols + colIdx;
              const stats = bookStats[b.id] || { masuk: 0, keluar: 0, saldo: 0 };
              return (
                <BookCard
                  key={b.id}
                  book={b}
                  stats={stats}
                  index={globalIdx}
                  cardWidth={cardWidth}
                  onPress={() => router.push({ pathname: '/kas-detail/[id]', params: { id: b.id } })}
                />
              );
            })}
            {/* Placeholder untuk baris yang tidak penuh */}
            {row.length < numCols && Array.from({ length: numCols - row.length }).map((_, i) => (
              <View key={`placeholder-${i}`} style={{ width: cardWidth }} />
            ))}
          </View>
        ))}
      </ScrollView>

      {isSuperAdmin && (
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
  scrollContent: { paddingTop: 8, paddingBottom: 100 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  btn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', width: '100%' },
  row: { flexDirection: 'row', marginBottom: 4 },

  // Efek halaman
  pages1: { position: 'absolute', borderRadius: 4, borderTopRightRadius: 7, borderBottomRightRadius: 7 },

  // Buku
  bookOuter: {
    flexDirection: 'row',
    borderRadius: 7,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
  },
  spine: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  spineLine: {
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 1,
  },
  cover: {
    padding: 10,
    paddingBottom: 8,
    overflow: 'hidden',
    position: 'relative',
    gap: 4,
  },
  deco: { position: 'absolute' },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: { color: 'rgba(255,255,255,0.9)', fontSize: 9, fontWeight: '600' },
  bookName: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
    letterSpacing: -0.2,
    marginTop: 2,
  },
  divider: { height: 1, marginVertical: 2 },
  saldoLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '500' },
  saldoVal: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.4,
    minWidth: 0,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statCol: { flex: 1, gap: 1 },
  statSep: { width: 1, height: 24, marginHorizontal: 6 },
  statLbl: { fontSize: 8, fontWeight: '500' },
  statNum: { color: 'white', fontSize: 10, fontWeight: '600', minWidth: 0 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  metaTxt: { color: 'rgba(255,255,255,0.55)', fontSize: 9 },

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
