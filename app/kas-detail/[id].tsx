import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KolektifTable } from '@/components/kolektif-table';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAdmin } from '@/lib/admin/admin-context';
import { useKas } from '@/lib/kas/kas-context';
import type { KasTx } from '@/lib/kas/types';
import { computeSaldo, formatRupiah, normalizeTanggalISO } from '@/lib/kas/types';

const COLS = [
  { key: 'tanggal', label: 'Tgl', w: 80, align: 'left' as const },
  { key: 'kategori', label: 'Kategori', w: 120, align: 'left' as const },
  { key: 'deskripsi', label: 'Deskripsi', w: 180, align: 'left' as const },
  { key: 'masuk', label: 'Masuk', w: 100, align: 'right' as const },
  { key: 'keluar', label: 'Keluar', w: 100, align: 'right' as const },
];

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

type SortKey = 'tanggal' | 'kategori' | 'deskripsi' | 'nominal';
type SortOrder = 'asc' | 'desc';
type TypeFilter = 'ALL' | 'MASUK' | 'KELUAR';

export default function KasDetailScreen() {
  const { id, defaultYear, defaultMonth } = useLocalSearchParams<{ id: string; defaultYear?: string; defaultMonth?: string }>();
  const { books, txsAll, upsertTx, updateCategories } = useKas();
  const { isSuperAdmin, session } = useAdmin();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'muted');
  const successColor = useThemeColor({}, 'success');
  const dangerColor = useThemeColor({}, 'danger');

  const book = useMemo(() => books.find(b => b.id === id), [books, id]);
  const txsActive = useMemo(() => txsAll.filter(t => t.kasId === id), [txsAll, id]);

  // Super admin selalu bisa edit; user lain hanya jika ada di editorIds buku ini
  const canEditTx = useMemo(() => {
    if (isSuperAdmin) return true;
    if (!session?.user?.id || !book?.editorIds?.length) return false;
    return book.editorIds.includes(session.user.id);
  }, [isSuperAdmin, session?.user?.id, book?.editorIds]);

  const now = new Date();
  const initialYear = defaultYear ? Number(defaultYear) : now.getFullYear();
  const initialMonth = defaultMonth
    ? (defaultMonth === 'ALL' ? 'ALL' as const : Math.max(0, Math.min(11, Number(defaultMonth) - 1)))
    : now.getMonth();
  const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>(initialMonth);
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('tanggal');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');

  useEffect(() => {
    const d = new Date();
    const y = defaultYear ? Number(defaultYear) : d.getFullYear();
    const m = defaultMonth
      ? (defaultMonth === 'ALL' ? 'ALL' as const : Math.max(0, Math.min(11, Number(defaultMonth) - 1)))
      : d.getMonth();
    setSelectedYear(y);
    setSelectedMonth(m);
    setSearchQuery('');
    setTypeFilter('ALL');
    setSortKey('tanggal');
    setSortOrder('desc');
  }, [id, defaultYear, defaultMonth]);

  const [addTxVisible, setAddTxVisible] = useState(false);
  const [addTxJenis, setAddTxJenis] = useState<'MASUK' | 'KELUAR'>('MASUK');
  const [addTxTanggalISO, setAddTxTanggalISO] = useState('');
  const [addTxKategori, setAddTxKategori] = useState('');
  const [addTxDeskripsi, setAddTxDeskripsi] = useState('');
  const [addTxNominal, setAddTxNominal] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [txCatPickerVisible, setTxCatPickerVisible] = useState(false);
  const [txCatEditMode, setTxCatEditMode] = useState(false);
  const [txNewCategoryName, setTxNewCategoryName] = useState('');
  const txNewCategoryInputRef = useRef<TextInput>(null);

  const txCategories = useMemo(
    () => book?.categories?.length ? book.categories : ['Iuran', 'Konsumsi', 'Kegiatan', 'Lain-lain'],
    [book],
  );

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', e => setKeyboardHeight(e.endCoordinates?.height ?? 0));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const openAddTx = useCallback(() => {
    const d = new Date();
    const yyyy = selectedYear;
    const mm = selectedMonth === 'ALL' ? String(d.getMonth() + 1).padStart(2, '0') : String((selectedMonth as number) + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setAddTxJenis('MASUK');
    setAddTxTanggalISO(`${yyyy}-${mm}-${dd}`);
    setAddTxKategori(txCategories[0] ?? '');
    setAddTxDeskripsi('');
    setAddTxNominal('');
    setTxCatEditMode(false);
    setTxNewCategoryName('');
    setAddTxVisible(true);
  }, [isSuperAdmin, selectedMonth, selectedYear, txCategories]);

  const closeAddTx = useCallback(() => { Keyboard.dismiss(); setAddTxVisible(false); }, []);

  const onAddTxCategory = useCallback(async () => {
    const name = txNewCategoryName.trim();
    if (!name) return;
    if (txCategories.includes(name)) { Alert.alert('Gagal', 'Kategori sudah ada.'); return; }
    try {
      await updateCategories(id, [...txCategories, name]);
      setTxNewCategoryName('');
      // Fokuskan kembali ke field input kategori, bukan ke field lain
      setTimeout(() => { txNewCategoryInputRef.current?.focus(); }, 50);
    } catch (e: any) { Alert.alert('Gagal', e?.message || 'Gagal menambah kategori'); }
  }, [id, isSuperAdmin, txCategories, txNewCategoryName, updateCategories]);

  const onDeleteTxCategory = useCallback(async (name: string) => {
    Alert.alert('Hapus Kategori', `Hapus kategori "${name}"?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
        try {
          const next = txCategories.filter(c => c !== name);
          await updateCategories(id, next);
          if (addTxKategori === name) setAddTxKategori(next[0] ?? '');
        } catch (e: any) { Alert.alert('Gagal', e?.message || 'Gagal menghapus kategori'); }
      }},
    ]);
  }, [id, addTxKategori, isSuperAdmin, txCategories, updateCategories]);

  const onSaveAddTx = useCallback(async () => {
    const n = Math.round(Number(String(addTxNominal).replace(/[^\d]/g, '')));
    if (!Number.isFinite(n) || n <= 0) { Alert.alert('Validasi', 'Nominal harus angka > 0.'); return; }
    const kategori = addTxKategori.trim();
    if (!kategori) { Alert.alert('Validasi', 'Kategori tidak boleh kosong.'); return; }
    const nowTs = Date.now();
    const tx: KasTx = {
      id: `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      kasId: id,
      tanggalISO: normalizeTanggalISO(addTxTanggalISO),
      jenis: addTxJenis,
      kategori,
      deskripsi: addTxDeskripsi.trim(),
      nominal: n,
      createdAt: nowTs,
      updatedAt: nowTs,
    };
    try { await upsertTx(tx); closeAddTx(); }
    catch (e: any) { Alert.alert('Gagal', e?.message || 'Gagal menyimpan transaksi'); }
  }, [id, addTxDeskripsi, addTxJenis, addTxKategori, addTxNominal, addTxTanggalISO, closeAddTx, isSuperAdmin, upsertTx]);

  const filteredAndSortedTxs = useMemo(() => {
    let result = txsActive.filter(tx => {
      const [y, m] = tx.tanggalISO.split('-').map(Number);
      const yearMatch = y === selectedYear;
      const monthMatch = selectedMonth === 'ALL' || m === (selectedMonth as number) + 1;
      return yearMatch && monthMatch;
    });
    if (typeFilter !== 'ALL') result = result.filter(tx => tx.jenis === typeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(tx =>
        (tx.deskripsi || '').toLowerCase().includes(q) ||
        (tx.kategori || '').toLowerCase().includes(q),
      );
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'tanggal') cmp = a.tanggalISO.localeCompare(b.tanggalISO);
      else if (sortKey === 'kategori') cmp = (a.kategori || '').localeCompare(b.kategori || '');
      else if (sortKey === 'deskripsi') cmp = (a.deskripsi || '').localeCompare(b.deskripsi || '');
      else if (sortKey === 'nominal') cmp = a.nominal - b.nominal;
      return sortOrder === 'desc' ? -cmp : cmp;
    });
    return result;
  }, [txsActive, selectedMonth, selectedYear, searchQuery, sortKey, sortOrder, typeFilter]);

  const summary = useMemo(() => computeSaldo(filteredAndSortedTxs), [filteredAndSortedTxs]);

  const changeMonth = (delta: number) => {
    if (selectedMonth === 'ALL') { setSelectedYear(prev => prev + delta); return; }
    let nextMonth = (selectedMonth as number) + delta;
    let nextYear = selectedYear;
    if (nextMonth > 11) { nextMonth = 0; nextYear += 1; }
    else if (nextMonth < 0) { nextMonth = 11; nextYear -= 1; }
    setSelectedMonth(nextMonth);
    setSelectedYear(nextYear);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortOrder('desc'); }
  };

  const TABLE_PADDING = 44; // 20 margin kiri + 20 kanan + 2 border kiri + 2 border kanan
  const minTableWidth = COLS.reduce((a, c) => a + c.w, 0);
  const availableWidth = screenWidth - TABLE_PADDING;
  const scale = availableWidth > minTableWidth ? availableWidth / minTableWidth : 1;
  const effectiveCols = useMemo(() => COLS.map(c => ({ ...c, w: Math.floor(c.w * scale) })), [scale]);
  const tableWidth = useMemo(() => effectiveCols.reduce((a, c) => a + c.w, 0), [effectiveCols]);

  const allStats = useMemo(() => {
    if (book?.tipe === 'PERIODIK') {
      const filtered = txsActive.filter((t) => !t.periodikData?.memberId?.startsWith('__TRANSFER'));
      return computeSaldo(filtered);
    }
    if (book?.tipe === 'KOLEKTIF') {
      // Hanya hitung transaksi MASUK (setor) yang bukan skip
      const filtered = txsActive.filter((t) => t.jenis === 'MASUK' && !t.periodikData?.isTidakSetor);
      return computeSaldo(filtered);
    }
    return computeSaldo(txsActive);
  }, [book?.tipe, txsActive]);

  const isPeriodik = book?.tipe === 'PERIODIK';
  const isPeriodikMonthly = isPeriodik && book?.periodConfig?.tipe === 'MONTHLY';
  const isKolektif = book?.tipe === 'KOLEKTIF';

  if (!book) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor }]} edges={['top']}>
        <View style={s.backRow}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={tintColor} />
            <ThemedText style={{ color: tintColor, fontSize: 16 }}>Kembali</ThemedText>
          </Pressable>
        </View>
        <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ThemedText type="muted">Buku kas tidak ditemukan.</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor }]} edges={['top']}>
      {/* Back button */}
      <View style={[s.backRow, { borderBottomColor: borderColor }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={tintColor} />
          <ThemedText style={{ color: tintColor, fontSize: 16 }}>Kembali</ThemedText>
        </Pressable>
        <ThemedText type="defaultSemiBold" style={s.headerTitle} numberOfLines={1}>{book.nama}</ThemedText>
        <View style={{ width: 80 }} />
      </View>

      {isKolektif ? (
        /* Layout KOLEKTIF — full width */
        <View style={{ flex: 1 }}>
          <View style={s.tableTitleRow}>
            <ThemedText type="defaultSemiBold" style={s.listTitle}>Status Setor Anggota</ThemedText>
          </View>
          <View style={{ flex: 1, marginBottom: 16 }}>
            <KolektifTable book={book} txs={txsActive} canEdit={canEditTx} />
          </View>
        </View>
      ) : isPeriodik ? (
        /* Layout PERIODIK — flex:1 supaya tabel mengisi layar penuh */
        <View style={{ flex: 1 }}>
          {/* Month nav */}
          <View style={[s.monthNav, { borderColor, marginHorizontal: 20, marginTop: 16, marginBottom: 8 }]}>
            <Pressable onPress={() => isPeriodikMonthly ? setSelectedYear(p => p - 1) : changeMonth(-1)} style={s.navBtn}>
              <Ionicons name="chevron-back" size={20} color={tintColor} />
            </Pressable>
            <Pressable onPress={() => setIsPickerVisible(true)} style={s.monthInfo}>
              <ThemedText type="defaultSemiBold" style={s.monthText}>
                {isPeriodikMonthly ? `Tahun ${selectedYear}` : selectedMonth === 'ALL' ? `Semua Bulan ${selectedYear}` : `${MONTHS[selectedMonth as number]} ${selectedYear}`}
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => isPeriodikMonthly ? setSelectedYear(p => p + 1) : changeMonth(1)} style={s.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={tintColor} />
            </Pressable>
          </View>

          <View style={s.tableTitleRow}>
            <ThemedText type="defaultSemiBold" style={s.listTitle}>Status Iuran Anggota</ThemedText>
            <Pressable onPress={() => router.push({ pathname: '/kas-detail/report', params: { kasId: id } })} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
              <ThemedText style={[s.reportLink, { color: tintColor }]}>Lihat Selengkapnya</ThemedText>
            </Pressable>
          </View>

          <View style={{ flex: 1, marginHorizontal: 20, marginBottom: 20 }}>
            <PeriodicTable book={book} txs={txsActive} selectedYear={selectedYear} selectedMonth={selectedMonth} canEdit={canEditTx} />
          </View>
        </View>
      ) : (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Month nav */}
        <View style={[s.monthNav, { borderColor, marginHorizontal: 20, marginTop: 16 }]}>
          <Pressable onPress={() => changeMonth(-1)} style={s.navBtn}>
            <Ionicons name="chevron-back" size={20} color={tintColor} />
          </Pressable>
          <Pressable onPress={() => setIsPickerVisible(true)} style={s.monthInfo}>
            <ThemedText type="defaultSemiBold" style={s.monthText}>
              {selectedMonth === 'ALL' ? `Semua Bulan ${selectedYear}` : `${MONTHS[selectedMonth as number]} ${selectedYear}`}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => changeMonth(1)} style={s.navBtn}>
            <Ionicons name="chevron-forward" size={20} color={tintColor} />
          </Pressable>
        </View>

        {/* Search & filter */}
        <View style={s.controlsRow}>
          <View style={[s.searchContainer, { borderColor }]}>
            <Ionicons name="search-outline" size={18} color={mutedColor} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Cari data..."
              placeholderTextColor={mutedColor}
              style={[s.searchInput, { color: textColor }]}
            />
          </View>
        </View>

        <View style={s.typeFilterRow}>
          {(['ALL', 'MASUK', 'KELUAR'] as TypeFilter[]).map(f => (
            <Pressable key={f} onPress={() => setTypeFilter(f)} style={[s.filterBtn, typeFilter === f && { backgroundColor: f === 'MASUK' ? successColor : f === 'KELUAR' ? dangerColor : tintColor, borderColor: 'transparent' }]}>
              <ThemedText style={[s.filterBtnText, typeFilter === f && { color: 'white' }]}>
                {f === 'ALL' ? 'Semua' : f === 'MASUK' ? 'Pemasukan' : 'Pengeluaran'}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <View style={s.tableTitleRow}>
          <ThemedText type="defaultSemiBold" style={s.listTitle}>Transaksi ({filteredAndSortedTxs.length})</ThemedText>
          <Pressable onPress={() => router.push({ pathname: '/kas-detail/report', params: { kasId: id } })} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <ThemedText style={[s.reportLink, { color: tintColor }]}>Lihat Selengkapnya</ThemedText>
          </Pressable>
        </View>

        {/* Tabel STANDARD */}
        <ScrollView horizontal showsHorizontalScrollIndicator style={s.tableOuterScroll} contentContainerStyle={s.tableScroll} nestedScrollEnabled>
          <View style={[s.table, { minWidth: tableWidth, height: Math.max(screenHeight * 0.5, 300), borderColor }]}>
            {/* Header */}
            <View style={[s.tableHeader, { backgroundColor: tintColor + '12', borderColor }]}>
              {effectiveCols.map((col, ci) => (
                <Pressable key={col.key} onPress={() => toggleSort(col.key as SortKey)} style={[s.tableCell, { width: col.w, borderRightColor: borderColor }, ci === effectiveCols.length - 1 && { borderRightWidth: 0 }]}>
                  <ThemedText type="defaultSemiBold" style={[s.tableHeaderText, { color: tintColor }, col.align === 'right' && s.right]}>
                    {col.label}{sortKey === col.key ? (sortOrder === 'desc' ? ' ↓' : ' ↑') : ''}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {/* Body scrollable */}
            <ScrollView style={{ flex: 1 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {filteredAndSortedTxs.length === 0 ? (
                <ThemedView style={s.empty}>
                  <Ionicons name="receipt-outline" size={48} color="rgba(127,127,127,0.3)" />
                  <ThemedText type="subtitle">Belum ada data</ThemedText>
                  <ThemedText type="muted" style={s.emptyText}>Mulai tambahkan transaksi pertama!</ThemedText>
                </ThemedView>
              ) : (
                filteredAndSortedTxs.map((item, index) => (
                  <Pressable key={item.id} onPress={() => canEditTx && router.push({ pathname: '/transaction/form', params: { id: item.id } })} style={[s.tableRow, { borderColor, backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(127,127,127,0.04)' }]}>
                    {effectiveCols.map((col, ci) => {
                      let val = '';
                      if (col.key === 'tanggal') val = item.tanggalISO.slice(5).replace('-', '/');
                      else if (col.key === 'kategori') val = item.kategori;
                      else if (col.key === 'deskripsi') val = item.deskripsi;
                      else if (col.key === 'masuk') val = item.jenis === 'MASUK' ? formatRupiah(item.nominal) : '';
                      else if (col.key === 'keluar') val = item.jenis === 'KELUAR' ? formatRupiah(item.nominal) : '';
                      return (
                        <View key={col.key} style={[s.tableCell, { width: col.w, borderRightColor: borderColor }, ci === effectiveCols.length - 1 && { borderRightWidth: 0 }]}>
                          <ThemedText numberOfLines={1} style={[s.tableCellText, col.align === 'right' && s.right, col.key === 'masuk' && val ? { color: successColor } : {}, col.key === 'keluar' && val ? { color: dangerColor } : {}]}>{val}</ThemedText>
                        </View>
                      );
                    })}
                  </Pressable>
                ))
              )}
            </ScrollView>

            {/* Footer sticky */}
            {filteredAndSortedTxs.length > 0 && (
              <View style={[s.tableFooter, { borderTopColor: borderColor, borderColor, backgroundColor: tintColor + '10' }]}>
                <View style={[s.tableCell, { width: effectiveCols[0].w + effectiveCols[1].w + effectiveCols[2].w, borderRightColor: borderColor }]}>
                  <ThemedText type="defaultSemiBold" style={{ color: tintColor }}>Total</ThemedText>
                </View>
                <View style={[s.tableCell, { width: effectiveCols[3].w, borderRightColor: borderColor }]}>
                  <ThemedText type="defaultSemiBold" style={[s.right, { color: successColor }]}>{formatRupiah(summary.masuk)}</ThemedText>
                </View>
                <View style={[s.tableCell, { width: effectiveCols[4].w, borderRightWidth: 0 }]}>
                  <ThemedText type="defaultSemiBold" style={[s.right, { color: dangerColor }]}>{formatRupiah(summary.keluar)}</ThemedText>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </ScrollView>
      )}

      {/* FAB — hanya untuk STANDARD dan user yang punya akses edit */}
      {canEditTx && !isPeriodik && !isKolektif && (
        <Pressable
          onPress={openAddTx}
          style={({ pressed }) => [s.fab, { backgroundColor: tintColor }, pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }]}
        >
          <Ionicons name="add" size={32} color="white" />
        </Pressable>
      )}

      {/* Add Tx Modal */}
      <Modal visible={addTxVisible} transparent animationType="fade">
        <Pressable style={s.txModalOverlay} onPress={closeAddTx}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
            style={{ flex: 1, width: '100%', justifyContent: 'flex-end' }}
          >
            <ThemedView
              type="card"
              style={[
                s.txModalCard,
                {
                  backgroundColor,
                  width: '100%',
                  minHeight: 320,
                  maxHeight: Math.min(520, Math.round(screenHeight * 0.78)),
                },
              ]}
            >
              <Pressable
                style={{ flex: 1 }}
                onPress={() => {}}
              >
                <View style={s.txModalHeader}>
                  <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>Tambah Transaksi</ThemedText>
                  <Pressable onPress={closeAddTx} style={s.txModalCloseBtn}>
                    <Ionicons name="close" size={18} color={textColor} />
                  </Pressable>
                </View>
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
                  <View style={s.txFieldRow}>
                    <Pressable onPress={() => setAddTxJenis('MASUK')} style={[s.txChip, addTxJenis === 'MASUK' && { backgroundColor: successColor + '18', borderColor: successColor }]}>
                      <ThemedText type="defaultSemiBold" style={{ color: addTxJenis === 'MASUK' ? successColor : mutedColor }}>MASUK</ThemedText>
                    </Pressable>
                    <Pressable onPress={() => setAddTxJenis('KELUAR')} style={[s.txChip, addTxJenis === 'KELUAR' && { backgroundColor: dangerColor + '18', borderColor: dangerColor }]}>
                      <ThemedText type="defaultSemiBold" style={{ color: addTxJenis === 'KELUAR' ? dangerColor : mutedColor }}>KELUAR</ThemedText>
                    </Pressable>
                  </View>
                  <ThemedText type="muted" style={s.txLabel}>Tanggal (YYYY-MM-DD)</ThemedText>
                  <TextInput value={addTxTanggalISO} onChangeText={setAddTxTanggalISO} placeholder="2026-03-25" placeholderTextColor={mutedColor} style={[s.txInput, { borderColor, color: textColor }]} />
                  <ThemedText type="muted" style={s.txLabel}>Kategori</ThemedText>
                  <Pressable onPress={() => setTxCatPickerVisible(true)} style={[s.txPickerInput, { borderColor }]}>
                    <ThemedText style={!addTxKategori ? { color: mutedColor } : { color: textColor }}>{addTxKategori || 'Pilih Kategori'}</ThemedText>
                    <Ionicons name="chevron-down" size={18} color={mutedColor} />
                  </Pressable>
                  <ThemedText type="muted" style={s.txLabel}>Deskripsi (opsional)</ThemedText>
                  <TextInput value={addTxDeskripsi} onChangeText={setAddTxDeskripsi} placeholder="Catatan" placeholderTextColor={mutedColor} style={[s.txInput, { borderColor, color: textColor }]} />
                  <ThemedText type="muted" style={s.txLabel}>Nominal</ThemedText>
                  <TextInput value={addTxNominal} onChangeText={setAddTxNominal} placeholder="10000" placeholderTextColor={mutedColor} keyboardType="number-pad" style={[s.txInput, { borderColor, color: textColor }]} />
                </ScrollView>
                <View style={[s.txModalFooter, { borderTopColor: borderColor, paddingBottom: 16 }]}>
                  <Pressable onPress={onSaveAddTx} style={({ pressed }) => [s.txPrimaryBtn, { backgroundColor: tintColor }, pressed && { opacity: 0.85 }]}>
                    <ThemedText type="defaultSemiBold" style={{ color: 'white' }}>Tambah Transaksi</ThemedText>
                  </Pressable>
                </View>
              </Pressable>
            </ThemedView>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Category Picker Modal */}
      <Modal visible={txCatPickerVisible} transparent animationType="slide">
        <Pressable style={s.txCatOverlay} onPress={() => { Keyboard.dismiss(); setTxCatPickerVisible(false); setTxCatEditMode(false); }}>
          <Pressable style={[s.txCatModal, { backgroundColor }]} onPress={() => {}}>
            <View style={s.txCatHeader}>
              <ThemedText type="subtitle">{txCatEditMode ? 'Setting Kategori' : 'Pilih Kategori'}</ThemedText>
              <Pressable onPress={() => setTxCatEditMode(v => !v)}>
                <Ionicons name={txCatEditMode ? 'checkmark-circle' : 'settings-outline'} size={22} color={tintColor} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              <View style={s.txCatGrid}>
                {txCategories.map(cat => (
                  <View key={cat} style={[s.txCatItemWrap, txCatEditMode && { paddingRight: 40 }]}>
                    <Pressable
                      onPress={() => { if (txCatEditMode) return; setAddTxKategori(cat); setTxCatPickerVisible(false); }}
                      style={[s.txCatItem, addTxKategori === cat && !txCatEditMode && { backgroundColor: tintColor, borderColor: tintColor }]}
                    >
                      <ThemedText style={[s.txCatItemText, addTxKategori === cat && !txCatEditMode && { color: 'white' }]}>{cat}</ThemedText>
                    </Pressable>
                    {txCatEditMode && (
                      <Pressable onPress={() => onDeleteTxCategory(cat)} style={s.txCatDeleteBtn}>
                        <Ionicons name="close-circle" size={20} color={dangerColor} />
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>
            {txCatEditMode && (
              <View style={s.txCatAddRow}>
                <TextInput value={txNewCategoryName} onChangeText={setTxNewCategoryName} placeholder="Kategori baru..." placeholderTextColor={mutedColor} style={[s.txCatAddInput, { borderColor, color: textColor }]} ref={txNewCategoryInputRef} autoFocus />
                <Pressable onPress={onAddTxCategory} style={[s.txCatAddBtn, { backgroundColor: tintColor }]}>
                  <Ionicons name="add" size={22} color="white" />
                </Pressable>
              </View>
            )}
            <Pressable onPress={() => { Keyboard.dismiss(); setTxCatPickerVisible(false); setTxCatEditMode(false); }} style={[s.txCatCloseBtn, { backgroundColor: tintColor }]}>
              <ThemedText style={{ color: 'white' }} type="defaultSemiBold">Tutup</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Month Picker Modal */}
      <Modal visible={isPickerVisible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setIsPickerVisible(false)} />
          <ThemedView type="card" style={s.pickerModal}>
            <ThemedText type="subtitle" style={{ marginBottom: 16 }}>Pilih Periode</ThemedText>
            <ThemedText type="defaultSemiBold" style={s.pickerLabel}>Tahun</ThemedText>
            <View style={s.yearPickerNav}>
              <Pressable onPress={() => setSelectedYear(p => p - 1)} style={s.yearNavBtn}>
                <Ionicons name="chevron-back" size={20} color={tintColor} />
              </Pressable>
              <ThemedText type="subtitle" style={s.yearDisplayText}>{selectedYear}</ThemedText>
              <Pressable onPress={() => setSelectedYear(p => p + 1)} style={s.yearNavBtn}>
                <Ionicons name="chevron-forward" size={20} color={tintColor} />
              </Pressable>
            </View>
            <ThemedText type="defaultSemiBold" style={[s.pickerLabel, { marginTop: 12 }]}>Bulan</ThemedText>
            <View style={s.monthGrid}>
              <Pressable onPress={() => { setSelectedMonth('ALL'); setIsPickerVisible(false); }} style={[s.monthChip, selectedMonth === 'ALL' && { backgroundColor: tintColor }]}>
                <ThemedText style={[s.monthChipText, selectedMonth === 'ALL' && { color: 'white' }]}>Semua</ThemedText>
              </Pressable>
              {MONTHS.map((m, i) => (
                <Pressable key={m} onPress={() => { setSelectedMonth(i); setIsPickerVisible(false); }} style={[s.monthChip, selectedMonth === i && { backgroundColor: tintColor }]}>
                  <ThemedText style={[s.monthChipText, selectedMonth === i && { color: 'white' }]}>{m.slice(0, 3)}</ThemedText>
                </Pressable>
              ))}
            </View>
          </ThemedView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function PeriodicTable({ book, txs, selectedYear, selectedMonth, canEdit }: {
  book: import('@/lib/kas/types').KasBook;
  txs: KasTx[];
  selectedYear: number;
  selectedMonth: number | 'ALL';
  canEdit: boolean;
}) {
  const { isSuperAdmin } = useAdmin();
  const { upsertTx, deleteTx } = useKas();
  const borderColor = useThemeColor({}, 'border');
  const successColor = useThemeColor({}, 'success');
  const dangerColor = useThemeColor({}, 'danger');
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'muted');
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const members = book?.members || [];
  const isWeekly = book?.periodConfig?.tipe === 'WEEKLY';
  const nominal = book?.periodConfig?.nominal || 0;
  const categories = book?.categories?.length ? book.categories : ['Iuran'];
  const nominalByCategory = (cat: string) => (book?.periodRates?.[cat] ?? nominal);
  const transferredSet = useMemo(() => {
    const count = new Map<string, { out: number; ret: number }>();
    txs.forEach((tx) => {
      const pd = tx.periodikData;
      if (!pd?.periodId || !pd?.categoryId || typeof pd?.memberId !== 'string') return;
      const key = `${pd.periodId}_${pd.categoryId}`;
      const entry = count.get(key) ?? { out: 0, ret: 0 };
      if (tx.jenis === 'KELUAR' && pd.memberId.startsWith('__TRANSFER__')) entry.out++;
      if (tx.jenis === 'MASUK' && pd.memberId.startsWith('__TRANSFER_RETURN_IN__')) entry.ret++;
      count.set(key, entry);
    });
    const s = new Set<string>();
    count.forEach((v, k) => { if (v.out > v.ret) s.add(k); });
    return s;
  }, [txs]);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [modalTarget, setModalTarget] = useState<{
    memberId: string; memberName: string;
    periodId: string; periodLabel: string;
    category: string; existing: KasTx | null;
  } | null>(null);
  const [modalCount, setModalCount] = useState(1);
  const [modalTidakSetor, setModalTidakSetor] = useState(false);

  const headerScrollRef = React.useRef<ScrollView>(null);
  const bodyScrollRef = React.useRef<ScrollView>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Web: enable mouse wheel scroll on nested ScrollView
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = (bodyScrollRef.current as any)?._nativeTag ?? (bodyScrollRef.current as any)?.getScrollableNode?.();
    if (!el) return;
    const node = typeof el === 'number' ? document.querySelector(`[data-tag="${el}"]`) : el;
    if (node) node.style.overflowY = 'auto';
  }, []);

  const onBodyHorizontalScroll = React.useCallback((e: any) => {
    headerScrollRef.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false });
  }, []);

  const columns = useMemo(() => {
    if (isWeekly) {
      if (selectedMonth === 'ALL') {
        return Array.from({ length: 52 }, (_, i) => ({ id: `${selectedYear}-W${i + 1}`, label: `W${i + 1}` }));
      } else {
        const monthStr = String((selectedMonth as number) + 1).padStart(2, '0');
        return [1, 2, 3, 4, 5].map(w => ({ id: `${selectedYear}-${monthStr}-W${w}`, label: `Mg ${w}` }));
      }
    } else {
      return MONTHS.map((m, i) => {
        const monthStr = String(i + 1).padStart(2, '0');
        return { id: `${selectedYear}-${monthStr}`, label: m.slice(0, 3) };
      });
    }
  }, [isWeekly, selectedYear, selectedMonth]);

  const transferredBadges = useMemo(() => {
    const items: Array<{ key: string; label: string }> = [];
    const colLabelById = new Map(columns.map(c => [c.id, c.label]));
    transferredSet.forEach((k) => {
      const [periodId, cat] = k.split('_');
      if (!periodId || !cat) return;
      if (!colLabelById.has(periodId)) return;
      items.push({ key: k, label: `${cat} · ${colLabelById.get(periodId)}: sudah ditransfer` });
    });
    items.sort((a, b) => a.label.localeCompare(b.label));
    return items;
  }, [columns, transferredSet]);
 
  const paymentMap = useMemo(() => {
    const map = new Map<string, KasTx>();
    txs.forEach(tx => {
      if (tx.periodikData) {
        const catId = tx.periodikData.categoryId || 'Iuran';
        map.set(`${tx.periodikData.memberId}_${tx.periodikData.periodId}_${catId}`, tx);
      }
    });
    return map;
  }, [txs]);

  const openModal = (memberId: string, memberName: string, periodId: string, periodLabel: string, category: string) => {
    if (!canEdit) return;
    if (transferredSet.has(`${periodId}_${category}`)) {
      Alert.alert('Info', 'Kategori untuk periode ini sudah ditransfer.');
      return;
    }
    const existing = paymentMap.get(`${memberId}_${periodId}_${category}`) ?? null;
    setModalTarget({ memberId, memberName, periodId, periodLabel, category, existing });
    setModalCount(existing?.periodikData?.count ?? 1);
    setModalTidakSetor(existing?.periodikData?.isTidakSetor ?? false);
    setModalVisible(true);
  };

  const closeModal = () => { setModalVisible(false); setModalTarget(null); setModalSaving(false); };

  const onSaveModal = async () => {
    if (!modalTarget || modalSaving) return;
    setModalSaving(true);
    const { memberId, memberName, periodId, periodLabel, category, existing } = modalTarget;

    try {
      // Pakai ID yang sama kalau edit, biar upsertTx langsung overwrite tanpa race condition
      const txId = existing?.id ?? `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const createdAt = existing?.createdAt ?? Date.now();
      const now = new Date();
      const tanggal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      if (!modalTidakSetor) {
        await upsertTx({
          id: txId,
          kasId: book.id,
          tanggalISO: tanggal,
          jenis: 'MASUK',
          kategori: category,
          deskripsi: `Iuran ${category} ${periodLabel} - ${memberName}${modalCount > 1 ? ` (${modalCount}x)` : ''}`,
          nominal: nominalByCategory(category) * modalCount,
          periodikData: { memberId, periodId, categoryId: category, count: modalCount, isTidakSetor: false },
          createdAt,
          updatedAt: Date.now(),
        });
      } else {
        await upsertTx({
          id: txId,
          kasId: book.id,
          tanggalISO: tanggal,
          jenis: 'KELUAR',
          kategori: category,
          deskripsi: `Tidak Setor ${category} ${periodLabel} - ${memberName}`,
          nominal: 0,
          periodikData: { memberId, periodId, categoryId: category, count: 0, isTidakSetor: true },
          createdAt,
          updatedAt: Date.now(),
        });
      }
      closeModal();
    } catch (err) {
      console.error('Failed to save checklist:', err);
      Alert.alert('Gagal', 'Gagal menyimpan perubahan. Silakan coba lagi.');
    } finally {
      setModalSaving(false);
    }
  };

  const onDeleteModal = () => {
    if (!modalTarget?.existing) return;
    setDeleteConfirmVisible(true);
  };

  const confirmDelete = async () => {
    if (!modalTarget?.existing) return;
    await deleteTx(modalTarget.existing.id);
    setDeleteConfirmVisible(false);
    closeModal();
  };

  const closeDeleteConfirm = () => setDeleteConfirmVisible(false);

  const [containerWidth, setContainerWidth] = useState(0);
  // Gunakan windowWidth sebagai fallback agar tabel langsung mengisi layar saat orientasi berubah
  // 40 = marginHorizontal 20 kiri+kanan dari parent
  const effectiveContainerWidth = containerWidth > 0 ? containerWidth : Math.max(0, windowWidth - 40);

  if (members.length === 0) {
    return (
      <ThemedView style={{ alignItems: 'center', paddingVertical: 60, gap: 8 }}>
        <Ionicons name="people-outline" size={48} color="rgba(127,127,127,0.3)" />
        <ThemedText type="subtitle">Belum ada anggota</ThemedText>
        <ThemedText type="muted">Tambahkan anggota di menu Admin.</ThemedText>
      </ThemedView>
    );
  }

  const BASE_COL_WIDTH = 35;
  const nameWidth = 70;
  const visibleCategories = selectedCategory ? [selectedCategory] : categories;
  const catWidth = visibleCategories.length > 1 ? 50 : 0;
  const leftPanelWidth = nameWidth + catWidth;
  const availableForRight = Math.max(0, effectiveContainerWidth - leftPanelWidth);
  const naturalWidth = columns.length * BASE_COL_WIDTH;
  // Kalau ada ruang lebih, scale up colWidth agar kolom mengisi full — tidak ada ruang kosong
  const colWidth = columns.length > 0 && availableForRight > naturalWidth
    ? Math.floor(availableForRight / columns.length)
    : BASE_COL_WIDTH;
  const rightPanelRenderWidth = columns.length * colWidth;

  return (
    <View style={{ flex: 1 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
      {categories.map((cat) => {
        const isActive = selectedCategory === cat;
        return (
          <Pressable
            key={cat}
            onPress={() => setSelectedCategory(isActive ? null : cat)}
            style={({ pressed }) => [{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5,
              borderColor: isActive ? tintColor : borderColor,
              backgroundColor: isActive ? tintColor + '18' : borderColor + '14',
            }, pressed && { opacity: 0.7 }]}>
            {isActive && <Ionicons name="checkmark-circle" size={12} color={tintColor} />}
            <ThemedText style={{ fontSize: 11, fontWeight: '700', color: isActive ? tintColor : textColor }} numberOfLines={1}>{cat}</ThemedText>
            <ThemedText style={{ fontSize: 11, color: isActive ? tintColor : mutedColor }} numberOfLines={1}>{formatRupiah(nominalByCategory(cat))}</ThemedText>
          </Pressable>
        );
      })}
    </View>
    <View
      style={{ flex: 1, backgroundColor }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w && w !== containerWidth) setContainerWidth(w);
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden', backgroundColor }}>
        <View style={{ width: leftPanelWidth, borderRightWidth: 1, borderRightColor: borderColor, backgroundColor }}>
          <View style={{ borderBottomWidth: 1, borderBottomColor: borderColor, backgroundColor: 'rgba(127,127,127,0.1)', height: 32, flexDirection: 'row' }}>
            <View style={{ width: nameWidth, justifyContent: 'center', paddingHorizontal: 4 }}>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 9 }}>Nama</ThemedText>
            </View>
            {visibleCategories.length > 1 && (
              <View style={{ width: catWidth, justifyContent: 'center', paddingHorizontal: 4 }}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 9 }}>Kat.</ThemedText>
              </View>
            )}
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} ref={headerScrollRef} scrollEnabled={false} style={{ flex: 1 }}>
          <View style={{ width: rightPanelRenderWidth, borderBottomWidth: 1, borderBottomColor: borderColor, backgroundColor: 'rgba(127,127,127,0.1)', height: 32, flexDirection: 'row' }}>
            {columns.map(col => (
              <View key={col.id} style={{ width: colWidth, alignItems: 'center', justifyContent: 'center' }}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 8 }}>{col.label}</ThemedText>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Body */}
      <ScrollView 
        ref={bodyScrollRef}
        style={{ borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, overflow: 'hidden', maxHeight: windowHeight * 0.55 }} 
        nestedScrollEnabled
        showsVerticalScrollIndicator={true}
        onLayout={() => {
          if (Platform.OS === 'web') {
            const node = (bodyScrollRef.current as any)?.getScrollableNode?.();
            if (node) node.style.overflowY = 'auto';
          }
        }}>
        <View style={{ flexDirection: 'row', backgroundColor }}>
          {/* Left panel */}
          <View style={{ width: leftPanelWidth, borderRightWidth: 1, borderRightColor: borderColor }}>
            {members.flatMap((m, mIndex) => {
              const rowBg = mIndex % 2 === 0 ? 'transparent' : 'rgba(127,127,127,0.02)';
              return visibleCategories.map((cat, cIndex) => (
                <View key={`${m.id}_${cat}_left`} style={{ flexDirection: 'row', backgroundColor: rowBg, borderBottomWidth: cIndex === visibleCategories.length - 1 ? 1 : 0, borderBottomColor: 'rgba(127,127,127,0.05)', height: 28 }}>
                  <View style={{ width: nameWidth, justifyContent: 'center', paddingHorizontal: 4 }}>
                    {cIndex === 0 && <ThemedText style={{ fontSize: 10, color: textColor }} numberOfLines={1}>{m.nama}</ThemedText>}
                  </View>
                  {visibleCategories.length > 1 && (
                    <View style={{ width: catWidth, justifyContent: 'center', paddingHorizontal: 4 }}>
                      <ThemedText style={{ fontSize: 8, opacity: 0.8, color: textColor }} numberOfLines={1}>{cat}</ThemedText>
                    </View>
                  )}
                </View>
              ));
            })}
          </View>

          {/* Right panel */}
          <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled onScroll={onBodyHorizontalScroll} scrollEventThrottle={16} style={{ flex: 1 }}>
            <View style={{ width: rightPanelRenderWidth }}>
              {members.flatMap((m, mIndex) => {
                const rowBg = mIndex % 2 === 0 ? 'transparent' : 'rgba(127,127,127,0.02)';
                return visibleCategories.map((cat, cIndex) => (
                  <View key={`${m.id}_${cat}_right`} style={{ flexDirection: 'row', backgroundColor: rowBg, borderBottomWidth: cIndex === visibleCategories.length - 1 ? 1 : 0, borderBottomColor: 'rgba(127,127,127,0.05)', height: 28 }}>
                    {columns.map(col => {
                      const tx = paymentMap.get(`${m.id}_${col.id}_${cat}`);
                      const isPaid = !!tx && !tx.periodikData?.isTidakSetor;
                      const isTidakSetor = !!tx?.periodikData?.isTidakSetor;
                      const count = tx?.periodikData?.count ?? 1;
                      const transferred = transferredSet.has(`${col.id}_${cat}`);
                      return (
                        <Pressable
                          key={col.id}
                          onPress={() => openModal(m.id, m.nama, col.id, col.label, cat)}
                          disabled={!canEdit || transferred}
                          style={{ width: colWidth, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <View style={{
                            width: 18, height: 18, borderRadius: 4, borderWidth: 1,
                            borderColor: transferred ? tintColor : (isTidakSetor ? dangerColor : isPaid ? successColor : borderColor),
                            backgroundColor: transferred ? tintColor + '20' : (isTidakSetor ? dangerColor + '20' : isPaid ? successColor + '20' : 'transparent'),
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            {transferred
                              ? <Ionicons name="swap-horizontal" size={11} color={tintColor} />
                              : isTidakSetor
                              ? <Ionicons name="close" size={11} color={dangerColor} />
                              : isPaid
                                ? (count > 1
                                  ? <ThemedText style={{ fontSize: 10, color: successColor, fontWeight: '700', lineHeight: 14, textAlign: 'center', includeFontPadding: false }}>{count}x</ThemedText>
                                  : <Ionicons name="checkmark" size={11} color={successColor} />)
                                : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ));
              })}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>

    {/* Payment Modal */}
    <Modal visible={modalVisible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={closeModal} />
        <ThemedView type="card" style={{ width: '100%', borderRadius: 24, padding: 24, gap: 16 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 17 }}>
                {modalTarget?.memberName}
              </ThemedText>
              <ThemedText type="muted" style={{ fontSize: 13, marginTop: 2 }}>
                {modalTarget?.category} · {modalTarget?.periodLabel}
              </ThemedText>
            </View>
            <Pressable onPress={closeModal} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(127,127,127,0.1)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={20} color={textColor} />
            </Pressable>
          </View>

          {/* Tidak Setor toggle */}
          <Pressable
            onPress={() => setModalTidakSetor(v => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: modalTidakSetor ? dangerColor : borderColor, backgroundColor: modalTidakSetor ? dangerColor + '10' : 'rgba(127,127,127,0.03)' }}
          >
            <View style={{ width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: modalTidakSetor ? dangerColor : borderColor, backgroundColor: modalTidakSetor ? dangerColor : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {modalTidakSetor && <Ionicons name="close" size={16} color="white" />}
            </View>
            <ThemedText style={{ color: modalTidakSetor ? dangerColor : textColor, fontWeight: '600' }}>Tandai Tidak Setor</ThemedText>
          </Pressable>

          {/* Jumlah bayar — hanya tampil kalau bukan tidak setor */}
          {!modalTidakSetor && (
            <View style={{ gap: 12, paddingVertical: 8 }}>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 14, opacity: 0.8 }}>Jumlah Bayar</ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <Pressable
                  onPress={() => setModalCount(c => Math.max(1, c - 1))}
                  style={{ width: 48, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(127,127,127,0.03)' }}
                >
                  <Ionicons name="remove" size={24} color={tintColor} />
                </Pressable>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <ThemedText type="defaultSemiBold" style={{ fontSize: 28 }}>{modalCount}x</ThemedText>
                  <ThemedText type="muted" style={{ fontSize: 14, fontWeight: '600', color: tintColor }}>{formatRupiah(nominalByCategory(modalTarget?.category ?? '') * modalCount)}</ThemedText>
                </View>
                <Pressable
                  onPress={() => setModalCount(c => c + 1)}
                  style={{ width: 48, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(127,127,127,0.03)' }}
                >
                  <Ionicons name="add" size={24} color={tintColor} />
                </Pressable>
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            {modalTarget?.existing && (
              <Pressable
                onPress={onDeleteModal}
                style={({ pressed }) => [{ width: 56, height: 56, borderRadius: 16, borderWidth: 1.5, borderColor: dangerColor, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="trash-outline" size={22} color={dangerColor} />
              </Pressable>
            )}
            <Pressable
              onPress={onSaveModal}
              disabled={modalSaving}
              style={({ pressed }) => [{ flex: 1, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: modalTidakSetor ? dangerColor : tintColor }, (pressed || modalSaving) && { opacity: 0.8 }]}
            >
              <ThemedText type="defaultSemiBold" style={{ color: 'white', fontSize: 16 }}>
                {modalSaving ? 'Menyimpan...' : (modalTidakSetor ? 'Tandai Tidak Setor' : 'Simpan')}
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>

    {/* Delete Confirmation Modal */}
    <Modal visible={deleteConfirmVisible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={closeDeleteConfirm} />
        <ThemedView type="card" style={{ width: '100%', borderRadius: 28, padding: 24 }}>
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: dangerColor + '15', marginBottom: 16, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="trash-outline" size={32} color={dangerColor} />
            </View>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 20, marginBottom: 8 }}>Hapus Catatan</ThemedText>
            <ThemedText type="muted" style={{ textAlign: 'center', fontSize: 15, lineHeight: 22, marginBottom: 0 }}>
              Hapus catatan {modalTarget?.category} {modalTarget?.periodLabel} untuk {modalTarget?.memberName}?
            </ThemedText>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={closeDeleteConfirm}
              style={({ pressed }) => [{ flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor, alignItems: 'center', backgroundColor: 'transparent' }, pressed && { opacity: 0.8 }]}>
              <ThemedText type="defaultSemiBold" style={{ color: textColor }}>Batal</ThemedText>
            </Pressable>
            <Pressable
              onPress={confirmDelete}
              style={({ pressed }) => [{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: dangerColor, alignItems: 'center' }, pressed && { opacity: 0.85 }]}>
              <ThemedText type="defaultSemiBold" style={{ color: 'white' }}>Hapus</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 80 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16 },
  reportLink: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  tableTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  listTitle: { fontSize: 15 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  navBtn: { padding: 12 },
  monthInfo: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  monthText: { fontSize: 15 },
  controlsRow: { paddingHorizontal: 20, marginTop: 12 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  typeFilterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginTop: 10 },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.2)',
    alignItems: 'center',
  },
  filterBtnText: { fontSize: 13, fontWeight: '500' },
  tableOuterScroll: { marginHorizontal: 20 },
  tableScroll: { paddingBottom: 8 },
  table: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1 },
  tableHeaderText: { fontSize: 12, opacity: 0.7 },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1 },
  tableCell: { justifyContent: 'center', paddingHorizontal: 4, borderRightWidth: 1 },
  tableCellText: { fontSize: 13 },
  tableDivider: { height: 0 }, // tidak dipakai lagi, grid pakai borderBottomWidth di tableRow
  tableFooter: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopWidth: 1,
  },
  tableFooterSticky: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopWidth: 1,
  },
  right: { textAlign: 'right' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { textAlign: 'center', marginTop: 4 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  txModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  txModalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  txModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  txModalCloseBtn: { padding: 4 },
  txFieldRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  txChip: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(127,127,127,0.2)', alignItems: 'center' },
  txLabel: { fontSize: 12, marginBottom: 4, marginTop: 8 },
  txInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  txPickerInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txModalFooter: { borderTopWidth: 1, paddingTop: 12 },
  txPrimaryBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  txCatOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  txCatModal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  txCatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  txCatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  txCatItemWrap: { position: 'relative' },
  txCatItem: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(127,127,127,0.2)' },
  txCatItemText: { fontSize: 14 },
  txCatDeleteBtn: { position: 'absolute', top: -8, right: -8 },
  txCatAddRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  txCatAddInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  txCatAddBtn: { width: 44, height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  txCatCloseBtn: { marginTop: 16, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  pickerModal: { borderRadius: 16, padding: 20, width: '100%' },
  pickerLabel: { fontSize: 13, marginBottom: 8 },
  yearPickerNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yearNavBtn: { padding: 8 },
  yearDisplayText: { fontSize: 20 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(127,127,127,0.2)' },
  monthChipText: { fontSize: 13 },
});
