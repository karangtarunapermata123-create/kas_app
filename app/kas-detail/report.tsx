import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAdmin } from '@/lib/admin/admin-context';
import { useKas } from '@/lib/kas/kas-context';
import { computeSaldo, formatRupiah } from '@/lib/kas/types';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function KasDetailReportScreen() {
  const { kasId } = useLocalSearchParams<{ kasId: string }>();
  const { books, txsAll, upsertTx } = useKas();
  const { isSuperAdmin } = useAdmin();

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const mutedColor = useThemeColor({}, 'muted');
  const successColor = useThemeColor({}, 'success');
  const dangerColor = useThemeColor({}, 'danger');
  const borderColor = useThemeColor({}, 'border');

  const book = useMemo(() => books.find(b => b.id === kasId), [books, kasId]);
  const txsActive = useMemo(() => txsAll.filter(t => t.kasId === kasId), [txsAll, kasId]);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [isPickerVisible, setIsPickerVisible] = useState(false);

  const isPeriodik = book?.tipe === 'PERIODIK';
  const isPeriodikMonthly = isPeriodik && book?.periodConfig?.tipe === 'MONTHLY';
  const isPeriodikWeekly = isPeriodik && book?.periodConfig?.tipe === 'WEEKLY';
  const standardBooks = useMemo(
    () => books.filter(b => (b.tipe ?? 'STANDARD') !== 'PERIODIK' && b.id !== kasId),
    [books, kasId],
  );
  const [transferVisible, setTransferVisible] = useState(false);
  const [transferTarget, setTransferTarget] = useState<{ monthIndex: number; cat: string; amount: number } | null>(null);
  const [transferDestId, setTransferDestId] = useState('');

  const isTransferTx = (tx: any) => typeof tx?.periodikData?.memberId === 'string' && tx.periodikData.memberId.startsWith('__TRANSFER');

  const filteredTxs = useMemo(() => {
    const selYear = Number(selectedYear);
    const selMonth = selectedMonth === 'ALL' ? 'ALL' : Number(selectedMonth);
    return txsActive.filter(tx => {
      let txYear: number, txMonth: number;
      if (tx.periodikData?.periodId) {
        txYear = parseInt(tx.periodikData.periodId.substring(0, 4));
        const monthPart = tx.periodikData.periodId.split('-')[1];
        txMonth = monthPart ? parseInt(monthPart.replace('W', '')) : 1;
      } else {
        const [y, m] = tx.tanggalISO.split('-').map(Number);
        txYear = y; txMonth = m;
      }
      if (txYear !== selYear) return false;
      if (isPeriodik) return true;
      return selMonth === 'ALL' || txMonth === (selMonth as number) + 1;
    });
  }, [txsActive, selectedMonth, selectedYear, isPeriodik]);

  const filteredTxsNoTransfer = useMemo(() => {
    if (!isPeriodik) return filteredTxs;
    return filteredTxs.filter(tx => !isTransferTx(tx));
  }, [filteredTxs, isPeriodik]);

  // Ringkasan tetap mengikuti transaksi yang benar-benar tercatat (termasuk transfer),
  // supaya Pengeluaran pada card tidak jadi 0 setelah transfer.
  const summary = useMemo(() => computeSaldo(filteredTxs), [filteredTxs]);
  const totalSummary = useMemo(() => computeSaldo(txsActive), [txsActive]);

  const changeMonth = (delta: number) => {
    if (selectedMonth === 'ALL') { setSelectedYear(p => p + delta); return; }
    let next = (selectedMonth as number) + delta;
    let yr = selectedYear;
    if (next > 11) { next = 0; yr += 1; }
    else if (next < 0) { next = 11; yr -= 1; }
    setSelectedMonth(next);
    setSelectedYear(yr);
  };

  const categorySummary = useMemo(() => {
    const cats: Record<string, { masuk: number; keluar: number }> = {};
    filteredTxsNoTransfer.forEach(tx => {
      const cat = tx.kategori || 'Tanpa Kategori';
      if (!cats[cat]) cats[cat] = { masuk: 0, keluar: 0 };
      if (tx.jenis === 'MASUK') cats[cat].masuk += tx.nominal;
      else cats[cat].keluar += tx.nominal;
    });
    return Object.entries(cats).sort((a, b) => (b[1].masuk + b[1].keluar) - (a[1].masuk + a[1].keluar));
  }, [filteredTxsNoTransfer]);

  const monthlyCategorySummary = useMemo(() => {
    if (!isPeriodik) return [] as Array<{ monthIndex: number; totalMasuk: number; totalKeluar: number; categories: Array<[string, { masuk: number; keluar: number }]>; transferred: Record<string, boolean>; transferredTo: Record<string, string> }>;
    const buckets: Array<Record<string, { masuk: number; keluar: number }>> = Array.from({ length: 12 }, () => ({}));
    const totals: Array<{ masuk: number; keluar: number }> = Array.from({ length: 12 }, () => ({ masuk: 0, keluar: 0 }));
    const transferred: Array<Record<string, boolean>> = Array.from({ length: 12 }, () => ({}));
    const transferredTo: Array<Record<string, string>> = Array.from({ length: 12 }, () => ({}));

    filteredTxsNoTransfer.forEach(tx => {
      let mi: number | null = null;
      if (tx.periodikData?.periodId) {
        const mp = tx.periodikData.periodId.split('-')[1];
        if (mp && !mp.startsWith('W')) { const m = Number(mp); if (!isNaN(m) && m >= 1 && m <= 12) mi = m - 1; }
      }
      if (mi === null) { const p = tx.tanggalISO?.split('-'); if (p?.length >= 2) { const m = Number(p[1]); if (!isNaN(m) && m >= 1 && m <= 12) mi = m - 1; } }
      if (mi === null) return;
      const cat = tx.kategori || 'Tanpa Kategori';
      if (!buckets[mi][cat]) buckets[mi][cat] = { masuk: 0, keluar: 0 };
      if (tx.jenis === 'MASUK') { buckets[mi][cat].masuk += tx.nominal; totals[mi].masuk += tx.nominal; }
      else { buckets[mi][cat].keluar += tx.nominal; totals[mi].keluar += tx.nominal; }
    });

    const transferCount: Array<Record<string, { out: number; ret: number; to?: string }>> = Array.from({ length: 12 }, () => ({}));
    const bookNameById = new Map(books.map(b => [b.id, b.nama]));
    filteredTxs.forEach((tx) => {
      const pd = tx.periodikData;
      if (!pd?.periodId) return;
      const mp = pd.periodId.split('-')[1];
      if (!mp || mp.startsWith('W')) return;
      const monthNum = Number(mp);
      if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) return;
      const mi = monthNum - 1;
      const cat = tx.kategori || pd.categoryId || 'Tanpa Kategori';
      const rec = transferCount[mi][cat] ?? { out: 0, ret: 0 };
      if (tx.jenis === 'KELUAR' && typeof pd.memberId === 'string' && pd.memberId.startsWith('__TRANSFER__')) {
        rec.out++;
        if (!rec.to) {
          const parts = pd.memberId.split(':');
          if (parts.length >= 2) {
            const nm = bookNameById.get(parts[1]);
            if (nm) rec.to = nm;
          }
          if (!rec.to && typeof tx.deskripsi === 'string') {
            const m = /^Transfer ke (.+)$/i.exec(tx.deskripsi.trim());
            if (m?.[1]) rec.to = m[1].trim();
          }
        }
      }
      if (tx.jenis === 'MASUK' && typeof pd.memberId === 'string' && pd.memberId.startsWith('__TRANSFER_RETURN_IN__')) rec.ret++;
      transferCount[mi][cat] = rec;
    });
    transferCount.forEach((mrec, mi) => {
      Object.entries(mrec).forEach(([cat, v]) => {
        if (v.out > v.ret) {
          transferred[mi][cat] = true;
          if (v.to) transferredTo[mi][cat] = v.to;
        }
      });
    });

    return buckets
      .map((b, i) => ({
        monthIndex: i,
        totalMasuk: totals[i].masuk,
        totalKeluar: totals[i].keluar,
        categories: Object.entries(b).sort((a, b) => (b[1].masuk + b[1].keluar) - (a[1].masuk + a[1].keluar)),
        transferred: transferred[i],
        transferredTo: transferredTo[i],
      }))
      .filter(m => m.categories.length > 0);
  }, [books, filteredTxs, filteredTxsNoTransfer, isPeriodik]);

  const totalVolume = summary.masuk + summary.keluar;
  const masukPercent = totalVolume > 0 ? (summary.masuk / totalVolume) * 100 : 0;
  const keluarPercent = totalVolume > 0 ? (summary.keluar / totalVolume) * 100 : 0;

  const openTransfer = (monthIndex: number, cat: string, amount: number) => {
    if (!isSuperAdmin) return;
    if (!isPeriodik) return;
    if (amount <= 0) return;
    if (standardBooks.length === 0) {
      Alert.alert('Tidak Ada Tujuan', 'Buat buku kas Standard dulu untuk menerima transfer.');
      return;
    }
    setTransferTarget({ monthIndex, cat, amount });
    setTransferDestId(standardBooks[0].id);
    setTransferVisible(true);
  };

  const closeTransfer = () => {
    setTransferVisible(false);
    setTransferTarget(null);
    setTransferDestId('');
  };

  const onConfirmTransfer = async () => {
    if (!transferTarget) return;
    const dest = standardBooks.find(b => b.id === transferDestId);
    if (!dest) return;
    const { monthIndex, cat, amount } = transferTarget;
    const mm = String(monthIndex + 1).padStart(2, '0');
    const periodId = `${selectedYear}-${mm}`;
    const now = new Date();
    const tanggal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const base = `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      const ts = Date.now();
      await upsertTx({
        id: `${base}_out`,
        kasId,
        tanggalISO: tanggal,
        jenis: 'KELUAR',
        kategori: cat,
        deskripsi: `Transfer ke ${dest.nama}`,
        nominal: amount,
        periodikData: { memberId: `__TRANSFER__:${dest.id}`, periodId, categoryId: cat, count: 1, isTidakSetor: false },
        createdAt: ts,
        updatedAt: ts,
      });
      await upsertTx({
        id: `${base}_in`,
        kasId: dest.id,
        tanggalISO: tanggal,
        jenis: 'MASUK',
        kategori: cat,
        deskripsi: `${cat} (${MONTHS[monthIndex]} ${selectedYear})`,
        nominal: amount,
        periodikData: { memberId: `__TRANSFER_IN__:${kasId}`, periodId, categoryId: cat, count: 1, isTidakSetor: false },
        createdAt: ts,
        updatedAt: ts,
      });
      closeTransfer();
      router.push({ pathname: '/kas-detail/[id]', params: { id: dest.id, defaultYear: String(now.getFullYear()), defaultMonth: String(now.getMonth() + 1) } });
    } catch (e: any) {
      Alert.alert('Gagal Transfer', e?.message ?? 'Terjadi kesalahan.');
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor }]} edges={['top']}>
      {/* Back button */}
      <View style={[s.backRow, { borderBottomColor: borderColor }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={tintColor} />
          <ThemedText style={{ color: tintColor, fontSize: 16 }}>Kembali</ThemedText>
        </Pressable>
        <ThemedText type="defaultSemiBold" style={s.headerTitle} numberOfLines={1}>
          Laporan Keuangan
        </ThemedText>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.pageHeader}>
          <ThemedText type="defaultSemiBold" style={{ textAlign: 'center', fontSize: 18, fontWeight: '700' }}>{book?.nama ?? ''}</ThemedText>
        </View>

        <View style={s.headerPadding}>
          <ThemedView type="card" style={s.totalCard}>
            <ThemedText type="defaultSemiBold" style={s.totalCardTitle}>Total Keseluruhan Kas</ThemedText>
            <View style={s.totalCardRow}>
              <View style={s.totalCardItem}>
                <ThemedText type="small" style={{ opacity: 0.7, marginBottom: 4 }}>Saldo</ThemedText>
                <ThemedText type="defaultSemiBold" style={{ color: tintColor }}>{formatRupiah(totalSummary.saldo)}</ThemedText>
              </View>
              <View style={s.totalCardItem}>
                <ThemedText type="small" style={{ opacity: 0.7, marginBottom: 4 }}>Pemasukan</ThemedText>
                <ThemedText type="defaultSemiBold" style={{ color: successColor }}>{formatRupiah(totalSummary.masuk)}</ThemedText>
              </View>
              <View style={s.totalCardItem}>
                <ThemedText type="small" style={{ opacity: 0.7, marginBottom: 4 }}>Pengeluaran</ThemedText>
                <ThemedText type="defaultSemiBold" style={{ color: dangerColor }}>{formatRupiah(totalSummary.keluar)}</ThemedText>
              </View>
            </View>
          </ThemedView>

          <View style={[s.monthNav, { borderColor }]}>
            <Pressable onPress={() => (isPeriodikMonthly || isPeriodikWeekly) ? setSelectedYear(p => p - 1) : changeMonth(-1)} style={s.navBtn}>
              <Ionicons name="chevron-back" size={20} color={tintColor} />
            </Pressable>
            <Pressable onPress={() => setIsPickerVisible(true)} style={s.monthInfo}>
              <ThemedText type="defaultSemiBold" style={s.monthText}>
                {(isPeriodikMonthly || isPeriodikWeekly) ? `Tahun ${selectedYear}` : (selectedMonth === 'ALL' ? 'Semua Bulan' : MONTHS[selectedMonth as number]) + ` ${selectedYear}`}
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => (isPeriodikMonthly || isPeriodikWeekly) ? setSelectedYear(p => p + 1) : changeMonth(1)} style={s.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={tintColor} />
            </Pressable>
          </View>
        </View>

        <ThemedView type="card" style={s.mainCard}>
          <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>
            Ringkasan {isPeriodik ? `Tahun ${selectedYear}` : (selectedMonth === 'ALL' ? `Tahun ${selectedYear}` : `${MONTHS[selectedMonth as number]} ${selectedYear}`)}
          </ThemedText>
          <View style={s.progressContainer}>
            <View style={[s.progressBar, { backgroundColor: successColor, width: `${masukPercent}%` }]} />
            <View style={[s.progressBar, { backgroundColor: dangerColor, width: `${keluarPercent}%` }]} />
          </View>
          <View style={s.legend}>
            <View style={s.legendItem}><View style={[s.dot, { backgroundColor: successColor }]} /><ThemedText type="small">Masuk ({masukPercent.toFixed(0)}%)</ThemedText></View>
            <View style={s.legendItem}><View style={[s.dot, { backgroundColor: dangerColor }]} /><ThemedText type="small">Keluar ({keluarPercent.toFixed(0)}%)</ThemedText></View>
          </View>
          <View style={s.statsGrid}>
            <View style={s.statItem}>
              <View style={[s.iconBox, { backgroundColor: successColor + '15' }]}><Ionicons name="arrow-down" size={18} color={successColor} /></View>
              <View><ThemedText type="muted" style={{ fontSize: 12, marginBottom: 2 }}>Kas Masuk</ThemedText><ThemedText type="defaultSemiBold" style={{ color: successColor }}>{formatRupiah(summary.masuk)}</ThemedText></View>
            </View>
            <View style={s.statItem}>
              <View style={[s.iconBox, { backgroundColor: dangerColor + '15' }]}><Ionicons name="arrow-up" size={18} color={dangerColor} /></View>
              <View><ThemedText type="muted" style={{ fontSize: 12, marginBottom: 2 }}>Kas Keluar</ThemedText><ThemedText type="defaultSemiBold" style={{ color: dangerColor }}>{formatRupiah(summary.keluar)}</ThemedText></View>
            </View>
          </View>
          <View style={[s.divider, { backgroundColor: borderColor }]} />
          <View style={s.balanceRow}>
            <ThemedText type="subtitle">Saldo Akhir</ThemedText>
            <ThemedText type="subtitle" style={{ color: tintColor }}>{formatRupiah(summary.saldo)}</ThemedText>
          </View>
        </ThemedView>

        <ThemedView style={s.section}>
          <ThemedText type="defaultSemiBold" style={s.sectionTitle}>Breakdown Kategori</ThemedText>
          {isPeriodik ? (
            monthlyCategorySummary.length === 0 ? (
              <ThemedView type="card" style={s.emptyCard}><ThemedText type="muted">Belum ada data kategori</ThemedText></ThemedView>
            ) : (
              monthlyCategorySummary.map(m => (
                <View key={m.monthIndex} style={{ gap: 10 }}>
                  <ThemedText type="defaultSemiBold" style={{ opacity: 0.9 }}>{MONTHS[m.monthIndex]} {selectedYear}</ThemedText>
                  {m.categories.map(([cat, val]) => {
                    const net = val.masuk - val.keluar;
                    const alreadyTransferred = !!m.transferred?.[cat];
                    const transferredToName = m.transferredTo?.[cat] ?? '';
                    const canTransfer = isSuperAdmin && !alreadyTransferred && net > 0 && standardBooks.length > 0;
                    return (
                      <ThemedView key={`${m.monthIndex}-${cat}`} type="card" style={s.categoryCard}>
                        <View style={s.categoryInfo}>
                          <ThemedText type="defaultSemiBold">{cat}</ThemedText>
                          {alreadyTransferred && (
                            <ThemedText type="small" style={{ opacity: 0.7 }}>
                              Sudah ditransfer{transferredToName ? ` ke buku ${transferredToName}` : ''}
                            </ThemedText>
                          )}
                          <View style={s.categoryValues}>
                            {val.keluar > 0 && <ThemedText type="small" style={{ color: dangerColor }}>-{formatRupiah(val.keluar)}</ThemedText>}
                          </View>
                        </View>
                        <View style={s.categoryRight}>
                          <ThemedText type="defaultSemiBold">{formatRupiah(net)}</ThemedText>
                          {canTransfer && (
                            <Pressable
                              onPress={() => openTransfer(m.monthIndex, cat, net)}
                              style={({ pressed }) => [s.transferBtn, { borderColor: tintColor }, pressed && { opacity: 0.7 }]}>
                              <Ionicons name="swap-horizontal" size={14} color={tintColor} />
                              <ThemedText type="small" style={{ color: tintColor, fontWeight: '700' }}>Transfer</ThemedText>
                            </Pressable>
                          )}
                        </View>
                      </ThemedView>
                    );
                  })}
                  <ThemedView type="card" style={s.categoryCard}>
                    <View style={s.categoryInfo}>
                      <ThemedText type="defaultSemiBold">Total {MONTHS[m.monthIndex]}</ThemedText>
                      <View style={s.categoryValues}>
                        {m.totalKeluar > 0 && <ThemedText type="small" style={{ color: dangerColor }}>-{formatRupiah(m.totalKeluar)}</ThemedText>}
                      </View>
                    </View>
                    <ThemedText type="defaultSemiBold">{formatRupiah(m.totalMasuk - m.totalKeluar)}</ThemedText>
                  </ThemedView>
                </View>
              ))
            )
          ) : categorySummary.length === 0 ? (
            <ThemedView type="card" style={s.emptyCard}><ThemedText type="muted">Belum ada data kategori</ThemedText></ThemedView>
          ) : (
            categorySummary.map(([cat, val]) => (
              <ThemedView key={cat} type="card" style={s.categoryCard}>
                <View style={s.categoryInfo}>
                  <ThemedText type="defaultSemiBold">{cat}</ThemedText>
                  <View style={s.categoryValues}>
                    {val.keluar > 0 && <ThemedText type="small" style={{ color: dangerColor }}>-{formatRupiah(val.keluar)}</ThemedText>}
                  </View>
                </View>
                <ThemedText type="defaultSemiBold">{formatRupiah(val.masuk - val.keluar)}</ThemedText>
              </ThemedView>
            ))
          )}
        </ThemedView>

        <Modal visible={isPickerVisible} transparent animationType="fade">
          <Pressable style={s.modalOverlay} onPress={() => setIsPickerVisible(false)}>
            <ThemedView type="card" style={s.pickerModal}>
              <ThemedText type="subtitle" style={{ marginBottom: 16 }}>Pilih Periode</ThemedText>
              <ThemedText type="defaultSemiBold" style={s.pickerLabel}>Tahun</ThemedText>
              <View style={s.yearPickerNav}>
                <Pressable onPress={() => setSelectedYear(p => p - 1)} style={s.yearNavBtn}><Ionicons name="chevron-back" size={20} color={tintColor} /></Pressable>
                <ThemedText type="subtitle" style={s.yearDisplayText}>{selectedYear}</ThemedText>
                <Pressable onPress={() => setSelectedYear(p => p + 1)} style={s.yearNavBtn}><Ionicons name="chevron-forward" size={20} color={tintColor} /></Pressable>
              </View>
              {!isPeriodikMonthly && !isPeriodikWeekly && (
                <>
                  <ThemedText type="defaultSemiBold" style={[s.pickerLabel, { marginTop: 16 }]}>Bulan</ThemedText>
                  <View style={s.pickerGrid}>
                    <Pressable onPress={() => { setSelectedMonth('ALL'); setIsPickerVisible(false); }} style={[s.pickerItem, { width: '100%' }, selectedMonth === 'ALL' && { backgroundColor: tintColor, borderColor: tintColor }]}>
                      <ThemedText style={[s.pickerItemText, selectedMonth === 'ALL' && { color: 'white' }]}>Semua Bulan di Tahun {selectedYear}</ThemedText>
                    </Pressable>
                    {MONTHS.map((m, idx) => (
                      <Pressable key={m} onPress={() => { setSelectedMonth(idx); setIsPickerVisible(false); }} style={[s.pickerItem, selectedMonth === idx && { backgroundColor: tintColor, borderColor: tintColor }]}>
                        <ThemedText style={[s.pickerItemText, selectedMonth === idx && { color: 'white' }]}>{m.slice(0, 3)}</ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
              <Pressable onPress={() => setIsPickerVisible(false)} style={[s.closeBtn, { backgroundColor: tintColor }]}>
                <ThemedText style={{ color: 'white' }} type="defaultSemiBold">Selesai</ThemedText>
              </Pressable>
            </ThemedView>
          </Pressable>
        </Modal>

        <Modal visible={transferVisible} transparent animationType="fade">
          <Pressable style={s.modalOverlay} onPress={closeTransfer}>
            <ThemedView type="card" style={s.transferModal}>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>Transfer ke Buku Lain</ThemedText>
              <ThemedText type="muted">
                {transferTarget ? `${transferTarget.cat} · ${MONTHS[transferTarget.monthIndex]} ${selectedYear} · ${formatRupiah(transferTarget.amount)}` : ''}
              </ThemedText>
              <View style={s.transferList}>
                <ScrollView style={{ maxHeight: 260 }}>
                  {standardBooks.map(b => {
                    const active = b.id === transferDestId;
                    return (
                      <Pressable
                        key={b.id}
                        onPress={() => setTransferDestId(b.id)}
                        style={({ pressed }) => [
                          s.transferItem,
                          { borderColor: active ? tintColor : borderColor },
                          active && { backgroundColor: tintColor + '12' },
                          pressed && { opacity: 0.8 },
                        ]}>
                        <View style={{ flex: 1 }}>
                          <ThemedText type="defaultSemiBold" numberOfLines={1}>{b.nama}</ThemedText>
                          <ThemedText type="small" style={{ opacity: 0.65 }} numberOfLines={1}>Buku Standard</ThemedText>
                        </View>
                        {active && <Ionicons name="checkmark-circle" size={18} color={tintColor} />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={s.transferActions}>
                <Pressable onPress={closeTransfer} style={({ pressed }) => [s.transferBtnGhost, { borderColor }, pressed && { opacity: 0.8 }]}>
                  <ThemedText type="defaultSemiBold">Batal</ThemedText>
                </Pressable>
                <Pressable onPress={onConfirmTransfer} style={({ pressed }) => [s.transferBtnPrimary, { backgroundColor: tintColor }, pressed && { opacity: 0.85 }]}>
                  <ThemedText type="defaultSemiBold" style={{ color: 'white' }}>Transfer</ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          </Pressable>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  backRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 80 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16 },
  scroll: { paddingBottom: 40 },
  pageHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerPadding: { paddingHorizontal: 20, marginBottom: 20, gap: 16 },
  totalCard: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(127,127,127,0.1)' },
  totalCardTitle: { fontSize: 14, marginBottom: 12, textAlign: 'center' },
  totalCardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalCardItem: { alignItems: 'center', flex: 1 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, paddingVertical: 4 },
  navBtn: { padding: 12, borderRadius: 10 },
  monthInfo: { flex: 1, alignItems: 'center' },
  monthText: { fontSize: 16 },
  mainCard: { marginHorizontal: 20, padding: 20, borderRadius: 24, elevation: 2, gap: 16 },
  progressContainer: { height: 12, flexDirection: 'row', borderRadius: 6, overflow: 'hidden', backgroundColor: 'rgba(127,127,127,0.1)' },
  progressBar: { height: '100%' },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  divider: { height: 1, marginVertical: 4 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { marginTop: 32, paddingHorizontal: 20, gap: 12 },
  sectionTitle: { fontSize: 18, marginBottom: 4 },
  categoryCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(127,127,127,0.05)' },
  categoryInfo: { flex: 1, gap: 4 },
  categoryValues: { flexDirection: 'row', gap: 12 },
  categoryRight: { alignItems: 'flex-end', gap: 8, marginLeft: 10 },
  transferBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  emptyCard: { padding: 24, alignItems: 'center', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(127,127,127,0.3)' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerModal: { padding: 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, gap: 16 },
  transferModal: { padding: 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, gap: 14 },
  transferList: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(127,127,127,0.12)', overflow: 'hidden' },
  transferItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  transferActions: { flexDirection: 'row', gap: 12, marginTop: 6 },
  transferBtnGhost: { flex: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  transferBtnPrimary: { flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  pickerLabel: { fontSize: 14, opacity: 0.6 },
  yearPickerNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(127,127,127,0.05)', borderRadius: 12, padding: 4 },
  yearNavBtn: { padding: 10 },
  yearDisplayText: { fontSize: 20, fontWeight: 'bold' },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerItem: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(127,127,127,0.1)', minWidth: '22%', alignItems: 'center' },
  pickerItemText: { fontSize: 13 },
  closeBtn: { marginTop: 8, padding: 16, borderRadius: 16, alignItems: 'center' },
});
