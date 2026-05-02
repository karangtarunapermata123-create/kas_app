import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TabHeader } from '@/components/tab-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAdmin } from '@/lib/admin/admin-context';
import { useKas } from '@/lib/kas/kas-context';
import { formatRupiah } from '@/lib/kas/types';

// Minimalist gradient palettes
// Gradient cover sama di light & dark — warna pastel cerah
// Yang beda hanya teks (dark mode pakai teks gelap juga karena cover tetap terang)
const PALETTES: Array<{
  grad: [string, string, ...string[]];
  tab: string;     // tab depan — paling solid
  tabMid: string;  // tab tengah — sedikit lebih terang
  tabBack: string; // tab belakang — paling terang
  text: string;
  sub: string;
  divider: string;
  sep: string;
  ring: string;
}> = [
  { grad: ['#c7d2fe', '#a5b4fc'], tab: '#6366f1', tabMid: '#818cf8', tabBack: '#a5b4fc', text: '#1e1b4b', sub: 'rgba(30,27,75,0.5)',   divider: 'rgba(0,0,0,0.08)', sep: 'rgba(0,0,0,0.1)', ring: 'rgba(255,255,255,0.6)' },
  { grad: ['#a7f3d0', '#6ee7b7'], tab: '#059669', tabMid: '#10b981', tabBack: '#34d399', text: '#064e3b', sub: 'rgba(6,78,59,0.5)',    divider: 'rgba(0,0,0,0.08)', sep: 'rgba(0,0,0,0.1)', ring: 'rgba(255,255,255,0.6)' },
  { grad: ['#fecdd3', '#fda4af'], tab: '#e11d48', tabMid: '#f43f5e', tabBack: '#fb7185', text: '#4c0519', sub: 'rgba(76,5,25,0.5)',    divider: 'rgba(0,0,0,0.08)', sep: 'rgba(0,0,0,0.1)', ring: 'rgba(255,255,255,0.6)' },
  { grad: ['#fde68a', '#fcd34d'], tab: '#d97706', tabMid: '#f59e0b', tabBack: '#fbbf24', text: '#451a03', sub: 'rgba(69,26,3,0.5)',    divider: 'rgba(0,0,0,0.08)', sep: 'rgba(0,0,0,0.1)', ring: 'rgba(255,255,255,0.6)' },
  { grad: ['#bae6fd', '#7dd3fc'], tab: '#0284c7', tabMid: '#0ea5e9', tabBack: '#38bdf8', text: '#0c4a6e', sub: 'rgba(12,74,110,0.5)',  divider: 'rgba(0,0,0,0.08)', sep: 'rgba(0,0,0,0.1)', ring: 'rgba(255,255,255,0.6)' },
  { grad: ['#ddd6fe', '#c4b5fd'], tab: '#7c3aed', tabMid: '#8b5cf6', tabBack: '#a78bfa', text: '#2e1065', sub: 'rgba(46,16,101,0.5)',  divider: 'rgba(0,0,0,0.08)', sep: 'rgba(0,0,0,0.1)', ring: 'rgba(255,255,255,0.6)' },
  { grad: ['#bbf7d0', '#86efac'], tab: '#16a34a', tabMid: '#22c55e', tabBack: '#4ade80', text: '#14532d', sub: 'rgba(20,83,45,0.5)',   divider: 'rgba(0,0,0,0.08)', sep: 'rgba(0,0,0,0.1)', ring: 'rgba(255,255,255,0.6)' },
  { grad: ['#fed7aa', '#fdba74'], tab: '#ea580c', tabMid: '#f97316', tabBack: '#fb923c', text: '#431407', sub: 'rgba(67,20,7,0.5)',    divider: 'rgba(0,0,0,0.08)', sep: 'rgba(0,0,0,0.1)', ring: 'rgba(255,255,255,0.6)' },
  { grad: ['#99f6e4', '#5eead4'], tab: '#0d9488', tabMid: '#14b8a6', tabBack: '#2dd4bf', text: '#134e4a', sub: 'rgba(19,78,74,0.5)',   divider: 'rgba(0,0,0,0.08)', sep: 'rgba(0,0,0,0.1)', ring: 'rgba(255,255,255,0.6)' },
  { grad: ['#fbcfe8', '#f9a8d4'], tab: '#db2777', tabMid: '#ec4899', tabBack: '#f472b6', text: '#500724', sub: 'rgba(80,7,36,0.5)',    divider: 'rgba(0,0,0,0.08)', sep: 'rgba(0,0,0,0.1)', ring: 'rgba(255,255,255,0.6)' },
];

const BOOK_TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  PERIODIK: 'people',
  KOLEKTIF: 'layers',
  STANDARD: 'journal-outline',
};

const BOOK_TYPE_LABEL: Record<string, string> = {
  PERIODIK: 'Periodik',
  KOLEKTIF: 'Kolektif',
  STANDARD: 'Standar',
};

function BookCard({
  book,
  stats,
  index,
  cardWidth,
  isDark,
  onPress,
}: {
  book: { id: string; nama: string; tipe?: string; members?: any[]; categories?: string[] };
  stats: { masuk: number; keluar: number; saldo: number };
  index: number;
  cardWidth: number;
  isDark: boolean;
  onPress: () => void;
}) {
  const pal = PALETTES[index % PALETTES.length];
  const tipe = book.tipe ?? 'STANDARD';
  const cardHeight = Math.round(cardWidth * 1.45);

  // Proportional sizes
  const spiralZoneW = Math.max(18, Math.round(cardWidth * 0.13));
  const tabW = Math.max(4, Math.round(cardWidth * 0.02));   // sangat tipis
  const tabH = Math.max(28, Math.round(cardHeight * 0.12));  // tinggi tetap
  const fontSize = {
    type: Math.max(7, Math.round(cardWidth * 0.05)),
    name: Math.max(11, Math.round(cardWidth * 0.092)),
    saldoLabel: Math.max(7, Math.round(cardWidth * 0.05)),
    saldo: Math.max(11, Math.round(cardWidth * 0.1)),
    stat: Math.max(6, Math.round(cardWidth * 0.048)),
    statVal: Math.max(8, Math.round(cardWidth * 0.062)),
  };

  const ringCount = Math.floor(cardHeight / 16);
  const ringSize = Math.max(7, Math.round(spiralZoneW * 0.55));

  // Page stack: light → abu-abu, dark → putih
  const pageOffsets = [6, 4, 2];
  const pageOpacities = isDark ? [0.22, 0.14, 0.07] : [0.2, 0.13, 0.07];
  const pageBg = isDark ? '#ffffff' : '#9ca3af';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cardWrap,
        { width: cardWidth + 8, height: cardHeight + 8 },
        pressed && { opacity: 0.92, transform: [{ scale: 0.97 }] },
      ]}
    >
      {/* ── Page stack — lembar di belakang, mulai dari left:0 ── */}
      {pageOffsets.map((off, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: cardWidth,
            height: cardHeight,
            borderRadius: 12,
            backgroundColor: pageBg,
            opacity: pageOpacities[i],
            transform: [{ translateX: off }, { translateY: off }],
          }}
        />
      ))}

      {/* ── 3 Tab kanan — sisi kanan sejajar, sisi kiri bertingkat ── */}
      {/* Tab belakang — paling keluar kiri & kanan */}
      <View style={{
        position: 'absolute',
        right: -tabW + 1,
        top: Math.round(cardHeight * 0.37),
        width: tabW + 3,
        height: tabH,
        backgroundColor: pal.tabBack,
        borderTopRightRadius: 4,
        borderBottomRightRadius: 4,
        zIndex: 1,
      }} />
      {/* Tab tengah */}
      <View style={{
        position: 'absolute',
        right: -tabW + 2,
        top: Math.round(cardHeight * 0.26),
        width: tabW + 2.5,
        height: tabH,
        backgroundColor: pal.tabMid,
        borderTopRightRadius: 4,
        borderBottomRightRadius: 4,
        zIndex: 2,
      }} />
      {/* Tab depan — paling masuk kiri & kanan */}
      <View style={{
        position: 'absolute',
        right: -tabW + 3,
        top: Math.round(cardHeight * 0.15),
        width: tabW + 2,
        height: tabH,
        backgroundColor: pal.tab,
        borderTopRightRadius: 4,
        borderBottomRightRadius: 4,
        zIndex: 3,
      }} />

      {/* ── Main cover ── */}
      <View style={[styles.book, {
        width: cardWidth,
        height: cardHeight,
        borderRadius: 12,
        overflow: 'hidden',
        zIndex: 2,
        shadowColor: '#000',
        shadowOpacity: 0.12,
      }]}>
        {/* Gradient cover */}
        <LinearGradient
          colors={pal.grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* ── Spiral zone (kiri) ── */}
        <View style={[styles.spiralZone, { width: spiralZoneW }]}>
          {Array.from({ length: ringCount }).map((_, i) => (
            <View
              key={i}
              style={{
                width: ringSize,
                height: ringSize,
                borderRadius: ringSize / 2,
                borderWidth: Math.max(1.5, ringSize * 0.18),
                borderColor: pal.ring,
                backgroundColor: pal.grad[0],
                marginVertical: 1,
              }}
            />
          ))}
        </View>

        {/* ── Thin vertical separator line ── */}
        <View style={{
          position: 'absolute',
          left: spiralZoneW,
          top: 0,
          bottom: 0,
          width: 1,
          backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.4)',
        }} />

        {/* ── Content area ── */}
        <View style={[styles.contentArea, {
          marginLeft: spiralZoneW + 1,
          paddingHorizontal: Math.round(cardWidth * 0.08),
          paddingTop: Math.round(cardHeight * 0.05),
          paddingBottom: Math.round(cardHeight * 0.04),
        }]}>

          {/* Type label — top left, small caps */}
          <ThemedText style={[styles.typeLabel, {
            fontSize: fontSize.type,
            color: pal.sub,
            letterSpacing: 1.2,
          }]}>
            {BOOK_TYPE_LABEL[tipe]?.toUpperCase() ?? 'STANDAR'}
          </ThemedText>

          {/* Book name — bold, prominent */}
          <ThemedText
            numberOfLines={3}
            style={[styles.bookName, {
              fontSize: fontSize.name,
              color: pal.text,
              marginTop: Math.round(cardHeight * 0.012),
              lineHeight: fontSize.name * 1.3,
            }]}
          >
            {book.nama}
          </ThemedText>

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* Thin divider */}
          <View style={[styles.divider, { backgroundColor: pal.divider, marginBottom: Math.round(cardHeight * 0.025) }]} />

          {/* Saldo */}
          <ThemedText style={[styles.saldoLabel, { fontSize: fontSize.saldoLabel, color: pal.sub }]}>
            Saldo
          </ThemedText>
          <ThemedText
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.saldoValue, {
              fontSize: fontSize.saldo,
              color: stats.saldo >= 0 ? pal.text : (isDark ? '#fca5a5' : '#dc2626'),
            }]}
          >
            {formatRupiah(stats.saldo)}
          </ThemedText>

          {/* Masuk / Keluar */}
          <View style={[styles.statsRow, { marginTop: Math.round(cardHeight * 0.018) }]}>
            <View style={styles.statCol}>
              <ThemedText style={[styles.statLabel, { fontSize: fontSize.stat, color: pal.sub }]}>Masuk</ThemedText>
              <ThemedText
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[styles.statValue, { fontSize: fontSize.statVal, color: pal.text }]}
              >
                {formatRupiah(stats.masuk)}
              </ThemedText>
            </View>
            <View style={[styles.statSep, { backgroundColor: pal.sep }]} />
            <View style={styles.statCol}>
              <ThemedText style={[styles.statLabel, { fontSize: fontSize.stat, color: pal.sub }]}>Keluar</ThemedText>
              <ThemedText
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[styles.statValue, { fontSize: fontSize.statVal, color: pal.text }]}
              >
                {formatRupiah(stats.keluar)}
              </ThemedText>
            </View>
          </View>

        </View>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { isSuperAdmin, session } = useAdmin();
  const { ready, books, txsAll } = useKas();
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const mutedColor = useThemeColor({}, 'muted');

  const GAP = 14;
  const PADDING = 16;

  // Portrait phone → 2 cols | landscape phone / tablet / desktop → 5 cols
  const numCols = width >= 600 ? 5 : 2;
  // +tabW overhang per card (tab kanan nongol ~6px), sisakan ruang
  const cardWidth = Math.floor((width - PADDING * 2 - GAP * (numCols - 1)) / numCols) - 8;

  const bookStats = useMemo(() => {
    const stats: Record<string, { masuk: number; keluar: number; saldo: number }> = {};
    books.forEach(b => { stats[b.id] = { masuk: 0, keluar: 0, saldo: 0 }; });
    txsAll.forEach(tx => {
      if (stats[tx.kasId]) {
        if (tx.jenis === 'MASUK') {
          stats[tx.kasId].masuk += tx.nominal;
          stats[tx.kasId].saldo += tx.nominal;
        } else {
          stats[tx.kasId].keluar += tx.nominal;
          stats[tx.kasId].saldo -= tx.nominal;
        }
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
            style={({ pressed }) => [styles.btn, { backgroundColor: tintColor }, pressed && { opacity: 0.8 }]}
          >
            <ThemedText type="defaultSemiBold" style={{ color: 'white' }}>Buat Buku Kas Pertama</ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    );
  }

  // Build rows
  const rows: Array<typeof books> = [];
  for (let i = 0; i < books.length; i += numCols) {
    rows.push(books.slice(i, i + numCols));
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={['top']}>
      <TabHeader title="Buku Kas" subtitle="Pilih buku kas untuk melihat detail" style={{ paddingHorizontal: PADDING, paddingTop: 12, paddingBottom: 8 }} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: PADDING }]}
        showsVerticalScrollIndicator={false}
      >

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
                  isDark={isDark}
                  onPress={() =>
                    router.push({ pathname: '/kas-detail/[id]', params: { id: b.id } })
                  }
                />
              );
            })}
            {/* Fill empty slots in last row */}
            {row.length < numCols &&
              Array.from({ length: numCols - row.length }).map((_, i) => (
                <View key={`ph-${i}`} style={{ width: cardWidth + 8 }} />
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
          ]}
        >
          <Ionicons name="pencil" size={26} color="white" />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { paddingTop: 12, paddingBottom: 100 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  btn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', width: '100%' },
  row: { flexDirection: 'row', marginBottom: 16 },

  // Card wrapper — extra right padding buat tab yang nongol, bottom buat page stack
  cardWrap: {
    position: 'relative',
    paddingRight: 8,
    paddingBottom: 8,
  },

  // Main book cover
  book: {
    flexDirection: 'row',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },

  // Spiral zone kiri
  spiralZone: {
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 10,
    zIndex: 2,
  },

  // Content area kanan spiral
  contentArea: {
    flex: 1,
    flexDirection: 'column',
  },

  // Type label
  typeLabel: {
    fontWeight: '600',
    textTransform: 'uppercase',
  },

  // Book name
  bookName: {
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  // Divider
  divider: {
    height: 1,
    marginBottom: 0,
  },

  // Saldo
  saldoLabel: {
    fontWeight: '500',
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  saldoValue: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCol: {
    flex: 1,
    gap: 1,
  },
  statSep: {
    width: 1,
    height: 20,
    marginHorizontal: 6,
  },
  statLabel: {
    fontWeight: '500',
  },
  statValue: {
    fontWeight: '700',
  },

  // FAB
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
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
});
