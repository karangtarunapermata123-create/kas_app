import { Ionicons } from '@expo/vector-icons';
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

// Palette: each entry defines the notebook cover, accent stripe, and page tint
const PALETTES = [
  { cover: '#1e3a5f', stripe: '#f59e0b', page: '#fef9ee', icon: '#f59e0b' },   // navy + amber
  { cover: '#14532d', stripe: '#86efac', page: '#f0fdf4', icon: '#86efac' },   // forest + mint
  { cover: '#7c2d12', stripe: '#fb923c', page: '#fff7ed', icon: '#fb923c' },   // mahogany + orange
  { cover: '#4c1d95', stripe: '#c4b5fd', page: '#f5f3ff', icon: '#c4b5fd' },   // deep purple + lavender
  { cover: '#0c4a6e', stripe: '#38bdf8', page: '#f0f9ff', icon: '#38bdf8' },   // ocean + sky
  { cover: '#3f3f46', stripe: '#a3e635', page: '#f7fee7', icon: '#a3e635' },   // charcoal + lime
  { cover: '#831843', stripe: '#f9a8d4', page: '#fdf2f8', icon: '#f9a8d4' },   // burgundy + pink
  { cover: '#1c1917', stripe: '#fcd34d', page: '#fffbeb', icon: '#fcd34d' },   // espresso + gold
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
  const cardHeight = Math.round(cardWidth * 1.42);

  // Proportional sizes
  const spineW = Math.max(10, Math.round(cardWidth * 0.09));
  const fontSize = {
    badge: Math.max(8, Math.round(cardWidth * 0.056)),
    name: Math.max(10, Math.round(cardWidth * 0.086)),
    saldoLabel: Math.max(7, Math.round(cardWidth * 0.052)),
    saldo: Math.max(10, Math.round(cardWidth * 0.098)),
    stat: Math.max(7, Math.round(cardWidth * 0.052)),
    statVal: Math.max(8, Math.round(cardWidth * 0.066)),
  };

  // Page stack colors — abu di light mode, abu gelap di dark mode
  const pageColors = isDark
    ? ['#2a2a2a', '#333', '#3d3d3d', '#444']
    : ['#aaa', '#bbb', '#ccc', '#d8d8d8'];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cardWrap,
        { width: cardWidth + 10, height: cardHeight + 10 },
        pressed && { opacity: 0.9, transform: [{ scale: 0.97 }, { translateY: 2 }] },
      ]}
    >
      {/* ── Page edges — offset kanan+bawah sekaligus, pojok menyatu ── */}
      <View style={[styles.pageStack, {
        width: cardWidth,
        height: cardHeight,
        left: 6,
        top: 6,
        backgroundColor: pageColors[0],
        borderRadius: 6,
      }]} />
      <View style={[styles.pageStack, {
        width: cardWidth,
        height: cardHeight,
        left: 4,
        top: 4,
        backgroundColor: pageColors[1],
        borderRadius: 6,
      }]} />
      <View style={[styles.pageStack, {
        width: cardWidth,
        height: cardHeight,
        left: 2,
        top: 2,
        backgroundColor: pageColors[2],
        borderRadius: 6,
      }]} />
      <View style={[styles.pageStack, {
        width: cardWidth,
        height: cardHeight,
        left: 1,
        top: 1,
        backgroundColor: pageColors[3],
        borderRadius: 6,
      }]} />

      {/* ── Ribbon penanda halaman — di belakang cover, nongol dari sisi kanan ── */}
      {[0, 1, 2].map((i) => {
        const rH = Math.max(14, Math.round(cardHeight * 0.09));
        const rW = Math.max(8, Math.round(cardWidth * 0.07));
        const topPos = Math.round(cardHeight * 0.15) + i * (rH + Math.round(cardHeight * 0.06));
        const colors = [pal.stripe, pal.stripe + '66', pal.stripe + 'aa'];
        return (
          <View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: 0,
              top: topPos,
              width: rW,
              height: rH,
              backgroundColor: colors[i],
              borderTopRightRadius: 4,
              borderBottomRightRadius: 4,
              zIndex: 1,
            }}
          />
        );
      })}

      {/* ── Main book body ── */}
      <View style={[styles.book, {
        width: cardWidth,
        height: cardHeight,
        shadowColor: pal.cover,
        zIndex: 2,
      }]}>
        {/* Spine */}
        <View style={[styles.spine, {
          width: spineW,
          backgroundColor: pal.cover,
          borderTopLeftRadius: 6,
          borderBottomLeftRadius: 6,
        }]}>
          {/* Deretan titik-titik di spine */}
          {Array.from({ length: Math.floor(cardHeight / 14) }).map((_, i) => (
            <View
              key={i}
              style={[styles.spineDot, {
                backgroundColor: i % 3 === 0 ? pal.stripe : 'rgba(255,255,255,0.18)',
                width: Math.max(3, Math.round(spineW * 0.35)),
                height: Math.max(3, Math.round(spineW * 0.35)),
                borderRadius: 99,
              }]}
            />
          ))}
        </View>

        {/* Cover */}
        <View style={[styles.cover, {
          flex: 1,
          backgroundColor: pal.cover,
          borderTopRightRadius: 6,
          borderBottomRightRadius: 6,
          overflow: 'hidden',
        }]}>
          {/* Top accent stripe — marginLeft negatif agar nutup celah spine */}
          <View style={[styles.topStripe, {
            backgroundColor: pal.stripe,
            height: Math.max(4, Math.round(cardHeight * 0.035)),
            marginLeft: -spineW,
            paddingLeft: spineW,
          }]} />

          {/* Subtle texture lines */}
          <View style={[styles.textureLine, {
            top: cardHeight * 0.18,
            backgroundColor: 'rgba(255,255,255,0.05)',
            height: 1,
          }]} />
          <View style={[styles.textureLine, {
            top: cardHeight * 0.28,
            backgroundColor: 'rgba(255,255,255,0.04)',
            height: 1,
          }]} />

          {/* Content area */}
          <View style={[styles.contentArea, { paddingHorizontal: Math.round(cardWidth * 0.1) }]}>
            {/* Icon + Type badge in one row */}
            <View style={[styles.iconRow, { marginTop: Math.round(cardHeight * 0.04) }]}>
              <View style={[styles.iconBadge, {
                backgroundColor: 'rgba(255,255,255,0.12)',
                width: Math.round(cardWidth * 0.17),
                height: Math.round(cardWidth * 0.17),
                borderRadius: Math.round(cardWidth * 0.05),
              }]}>
                <Ionicons
                  name={BOOK_TYPE_ICON[tipe] ?? 'journal-outline'}
                  size={Math.round(cardWidth * 0.09)}
                  color={pal.stripe}
                />
              </View>
              <View style={[styles.typeBadge, {
                backgroundColor: 'rgba(255,255,255,0.1)',
                marginLeft: 6,
              }]}>
                <ThemedText style={[styles.typeBadgeText, { fontSize: fontSize.badge, color: pal.stripe }]}>
                  {BOOK_TYPE_LABEL[tipe] ?? 'Standar'}
                </ThemedText>
              </View>
            </View>

            {/* Book name */}
            <ThemedText
              numberOfLines={2}
              style={[styles.bookName, {
                fontSize: fontSize.name,
                marginTop: Math.round(cardHeight * 0.018),
                lineHeight: fontSize.name * 1.25,
              }]}
            >
              {book.nama}
            </ThemedText>

            {/* Divider */}
            <View style={[styles.divider, {
              backgroundColor: pal.stripe + '40',
              marginVertical: Math.round(cardHeight * 0.018),
            }]} />

            {/* Saldo */}
            <ThemedText style={[styles.saldoLabel, { fontSize: fontSize.saldoLabel, color: 'rgba(255,255,255,0.55)' }]}>
              Saldo
            </ThemedText>
            <ThemedText
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.saldoValue, {
                fontSize: fontSize.saldo,
                color: stats.saldo >= 0 ? pal.stripe : '#fca5a5',
              }]}
            >
              {formatRupiah(stats.saldo)}
            </ThemedText>

            {/* Masuk / Keluar row */}
            <View style={[styles.statsRow, { marginTop: Math.round(cardHeight * 0.015) }]}>
              <View style={styles.statCol}>
                <ThemedText style={[styles.statLabel, { fontSize: fontSize.stat, color: 'rgba(255,255,255,0.5)' }]}>
                  Masuk
                </ThemedText>
                <ThemedText
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[styles.statValue, { fontSize: fontSize.statVal, color: pal.stripe }]}
                >
                  {formatRupiah(stats.masuk)}
                </ThemedText>
              </View>
              <View style={[styles.statSep, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
              <View style={styles.statCol}>
                <ThemedText style={[styles.statLabel, { fontSize: fontSize.stat, color: 'rgba(255,255,255,0.5)' }]}>
                  Keluar
                </ThemedText>
                <ThemedText
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[styles.statValue, { fontSize: fontSize.statVal, color: 'rgba(255,255,255,0.7)' }]}
                >
                  {formatRupiah(stats.keluar)}
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Bottom meta row */}
          <View style={[styles.metaRow, { paddingHorizontal: Math.round(cardWidth * 0.1), paddingBottom: Math.round(cardHeight * 0.04) }]}>
            {tipe === 'PERIODIK' && (
              <View style={styles.metaChip}>
                <Ionicons name="people-outline" size={9} color="rgba(255,255,255,0.45)" />
                <ThemedText style={styles.metaText}>{book.members?.length ?? 0}</ThemedText>
              </View>
            )}
            {(book.categories?.length ?? 0) > 0 && (
              <View style={styles.metaChip}>
                <Ionicons name="pricetag-outline" size={9} color="rgba(255,255,255,0.45)" />
                <ThemedText style={styles.metaText}>{book.categories!.length}</ThemedText>
              </View>
            )}
            <View style={{ flex: 1 }} />
            <Ionicons name="chevron-forward" size={11} color="rgba(255,255,255,0.25)" />
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
  // -10 per card to account for the page-stack shadow offset (cardWrap = cardWidth + 10)
  const cardWidth = Math.floor((width - PADDING * 2 - GAP * (numCols - 1)) / numCols) - 10;

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
                <View key={`ph-${i}`} style={{ width: cardWidth }} />
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
  scrollContent: { paddingTop: 8, paddingBottom: 100 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  btn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', width: '100%' },
  row: { flexDirection: 'row', marginBottom: 10 },

  // Card wrapper
  cardWrap: {
    position: 'relative',
  },

  // Page stack layers (behind the book)
  pageStack: {
    position: 'absolute',
  },

  // Main book
  book: {
    position: 'absolute',
    top: 0,
    left: 0,
    flexDirection: 'row',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },

  // Spine
  spine: {
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 6,
  },
  spineStripe: {
    borderRadius: 2,
  },
  spineDot: {
    borderRadius: 99,
  },

  // Cover
  cover: {
    position: 'relative',
  },
  topStripe: {
    width: '100%',
  },

  // Ribbon bookmark — di luar cover agar tidak terpotong overflow:hidden
  ribbon: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  ribbonNotch: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    position: 'absolute',
    bottom: 0,
  },

  // Texture lines
  textureLine: {
    position: 'absolute',
    left: 0,
    right: 0,
  },

  // Content
  contentArea: {
    flex: 1,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  typeBadgeText: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  bookName: {
    color: 'white',
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  divider: {
    height: 1,
  },
  saldoLabel: {
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  saldoValue: {
    fontWeight: '800',
    letterSpacing: -0.5,
    color: 'white',
  },
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
    height: 22,
    marginHorizontal: 6,
  },
  statLabel: {
    fontWeight: '500',
  },
  statValue: {
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  metaText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
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
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
});
