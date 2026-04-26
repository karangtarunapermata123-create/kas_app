import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useKas } from '@/lib/kas/kas-context';
import type { KasBook, KasTx, KolektifItem } from '@/lib/kas/types';
import { formatRupiah } from '@/lib/kas/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
    Alert,
    Modal,
    Pressable,
    ScrollView,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';

// ── Tipe internal ──────────────────────────────────────────────────────────────

type PaymentStatus = 'paid' | 'partial' | 'unpaid' | 'skip';

interface MemberItemStatus {
  memberId: string;
  memberName: string;
  itemId: string;
  itemName: string;
  target: number;
  paid: number;
  status: PaymentStatus;
  tx: KasTx | null;
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── KolektifTable ──────────────────────────────────────────────────────────────

export function KolektifTable({
  book,
  txs,
  canEdit,
}: {
  book: KasBook;
  txs: KasTx[];
  canEdit: boolean;
}) {
  const { upsertTx, deleteTx } = useKas();
  const { width: windowWidth } = useWindowDimensions();

  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({}, 'border');
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'muted');
  const successColor = useThemeColor({}, 'success') as string;
  const dangerColor = useThemeColor({}, 'danger') as string;

  const members = book.members ?? [];
  const items: KolektifItem[] = book.kolektifItems ?? [];

  // ── Payment map: memberId_itemId → KasTx ──────────────────────────────────
  const paymentMap = useMemo(() => {
    const map = new Map<string, KasTx>();
    txs.forEach(tx => {
      const pd = tx.periodikData;
      if (pd?.memberId && pd?.categoryId) {
        map.set(`${pd.memberId}_${pd.categoryId}`, tx);
      }
    });
    return map;
  }, [txs]);

  // ── Statistik per item ─────────────────────────────────────────────────────
  const itemStats = useMemo(() => {
    return items.map(item => {
      let totalPaid = 0;
      let paidCount = 0;
      let skipCount = 0;
      members.forEach(m => {
        const tx = paymentMap.get(`${m.id}_${item.id}`);
        if (!tx) return;
        if (tx.periodikData?.isTidakSetor) { skipCount++; return; }
        totalPaid += tx.nominal;
        if (tx.nominal >= item.nominal) paidCount++;
      });
      const target = item.nominal * members.length;
      return { itemId: item.id, totalPaid, paidCount, skipCount, target };
    });
  }, [items, members, paymentMap]);

  // ── Modal state ────────────────────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [modalTarget, setModalTarget] = useState<{
    memberId: string;
    memberName: string;
    item: KolektifItem;
    existing: KasTx | null;
  } | null>(null);
  const [modalNominal, setModalNominal] = useState('');
  const [modalSkip, setModalSkip] = useState(false);

  const openModal = (memberId: string, memberName: string, item: KolektifItem) => {
    if (!canEdit) return;
    const existing = paymentMap.get(`${memberId}_${item.id}`) ?? null;
    setModalTarget({ memberId, memberName, item, existing });
    setModalNominal(existing && !existing.periodikData?.isTidakSetor ? String(existing.nominal) : String(item.nominal));
    setModalSkip(existing?.periodikData?.isTidakSetor ?? false);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setModalTarget(null);
    setModalSaving(false);
  };

  const onSave = async () => {
    if (!modalTarget || modalSaving) return;
    setModalSaving(true);
    const { memberId, memberName, item, existing } = modalTarget;
    try {
      const txId = existing?.id ?? `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const createdAt = existing?.createdAt ?? Date.now();
      if (modalSkip) {
        await upsertTx({
          id: txId,
          kasId: book.id,
          tanggalISO: getToday(),
          jenis: 'KELUAR',
          kategori: item.nama,
          deskripsi: `Tidak setor - ${memberName}`,
          nominal: 0,
          periodikData: { memberId, periodId: 'kolektif', categoryId: item.id, isTidakSetor: true },
          createdAt,
          updatedAt: Date.now(),
        });
      } else {
        const n = parseInt(modalNominal.replace(/\D/g, ''), 10);
        if (!n || n <= 0) { Alert.alert('Validasi', 'Nominal harus > 0'); setModalSaving(false); return; }
        await upsertTx({
          id: txId,
          kasId: book.id,
          tanggalISO: getToday(),
          jenis: 'MASUK',
          kategori: item.nama,
          deskripsi: `Setor ${item.nama} - ${memberName}`,
          nominal: n,
          periodikData: { memberId, periodId: 'kolektif', categoryId: item.id, isTidakSetor: false },
          createdAt,
          updatedAt: Date.now(),
        });
      }
      closeModal();
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Gagal menyimpan');
    } finally {
      setModalSaving(false);
    }
  };

  const onDelete = async () => {
    if (!modalTarget?.existing) return;
    setDeleteConfirmVisible(true);
  };

  const confirmDelete = async () => {
    if (!modalTarget?.existing) return;
    await deleteTx(modalTarget.existing.id);
    setDeleteConfirmVisible(false);
    closeModal();
  };

  if (members.length === 0 || items.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 48, gap: 8 }}>
        <Ionicons name="basket-outline" size={48} color={mutedColor} />
        <ThemedText type="muted" style={{ textAlign: 'center' }}>
          {members.length === 0 ? 'Belum ada anggota.' : 'Belum ada item kolektif.'}
        </ThemedText>
        <ThemedText type="muted" style={{ fontSize: 12, textAlign: 'center' }}>
          Tambahkan lewat menu Kelola Buku Kas.
        </ThemedText>
      </View>
    );
  }

  // ── Layout ─────────────────────────────────────────────────────────────────
  // Tabel full width layar, panel kiri dihapus
  const nameColW = 80;
  const itemColW = Math.max(56, Math.floor((windowWidth - nameColW) / Math.min(items.length, 4)));

  return (
    <View style={{ flex: 1 }}>

      {/* ── Ringkasan item: horizontal scroll di atas ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 72, marginBottom: 8 }}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}
      >
        {items.map((item, i) => {
          const stat = itemStats[i];
          const pct = stat.target > 0 ? Math.min(1, stat.totalPaid / stat.target) : 0;
          return (
            <View key={item.id} style={{
              borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
              borderWidth: 1, borderColor,
              backgroundColor: tintColor + '08',
              minWidth: 100, gap: 3,
            }}>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 11 }} numberOfLines={1}>{item.nama}</ThemedText>
              <View style={{ height: 3, backgroundColor: borderColor, borderRadius: 2 }}>
                <View style={{ height: 3, width: `${Math.round(pct * 100)}%`, backgroundColor: pct >= 1 ? successColor : tintColor, borderRadius: 2 }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <ThemedText style={{ fontSize: 9, color: successColor, fontWeight: '700' }}>{stat.paidCount}/{members.length} lunas</ThemedText>
                <ThemedText style={{ fontSize: 9, color: tintColor, fontWeight: '600' }}>{Math.round(pct * 100)}%</ThemedText>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* ── Tabel full width ── */}
      <View style={{ flex: 1, borderWidth: 1, borderColor, borderRadius: 12, overflow: 'hidden' }}>
        {/* Header tabel */}
        <View style={{ flexDirection: 'row', backgroundColor: tintColor + '12', borderBottomWidth: 1, borderBottomColor: borderColor }}>
          <View style={{ width: nameColW, padding: 7, borderRightWidth: 1, borderRightColor: borderColor, justifyContent: 'center' }}>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 10 }}>Anggota</ThemedText>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row' }}>
              {items.map((item, i) => (
                <View key={item.id} style={{
                  width: itemColW, padding: 7, alignItems: 'center',
                  borderRightWidth: i < items.length - 1 ? 1 : 0, borderRightColor: borderColor,
                }}>
                  <ThemedText type="defaultSemiBold" style={{ fontSize: 10, textAlign: 'center' }} numberOfLines={2}>{item.nama}</ThemedText>
                  <ThemedText type="muted" style={{ fontSize: 8 }}>{formatRupiah(item.nominal)}</ThemedText>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Body tabel */}
        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {members.map((m, mIdx) => (
            <View key={m.id} style={{
              flexDirection: 'row',
              backgroundColor: mIdx % 2 === 0 ? 'transparent' : 'rgba(127,127,127,0.03)',
              borderBottomWidth: mIdx < members.length - 1 ? 1 : 0,
              borderBottomColor: borderColor,
            }}>
              <View style={{ width: nameColW, paddingHorizontal: 7, paddingVertical: 9, justifyContent: 'center', borderRightWidth: 1, borderRightColor: borderColor }}>
                <ThemedText style={{ fontSize: 11, color: textColor }} numberOfLines={2}>{m.nama}</ThemedText>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row' }}>
                  {items.map((item, iIdx) => {
                    const tx = paymentMap.get(`${m.id}_${item.id}`);
                    const isSkip = tx?.periodikData?.isTidakSetor ?? false;
                    const paid = tx && !isSkip ? tx.nominal : 0;
                    const isLunas = paid >= item.nominal;
                    const isPartial = paid > 0 && paid < item.nominal;

                    let bgColor = 'transparent';
                    let iconName: any = null;
                    let iconColor = mutedColor;
                    let labelText = '';

                    if (isSkip) { bgColor = dangerColor + '18'; iconName = 'close'; iconColor = dangerColor; }
                    else if (isLunas) { bgColor = successColor + '18'; iconName = 'checkmark'; iconColor = successColor; }
                    else if (isPartial) { bgColor = tintColor + '15'; iconName = 'ellipsis-horizontal'; iconColor = tintColor; labelText = formatRupiah(paid); }

                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => openModal(m.id, m.nama, item)}
                        disabled={!canEdit}
                        style={({ pressed }) => [{
                          width: itemColW, height: 42,
                          alignItems: 'center', justifyContent: 'center',
                          backgroundColor: bgColor,
                          borderRightWidth: iIdx < items.length - 1 ? 1 : 0,
                          borderRightColor: borderColor,
                        }, pressed && canEdit && { opacity: 0.65 }]}
                      >
                        {iconName ? (
                          <View style={{ alignItems: 'center', gap: 1 }}>
                            <Ionicons name={iconName} size={14} color={iconColor} />
                            {labelText ? <ThemedText style={{ fontSize: 7, color: iconColor, fontWeight: '700' }}>{labelText}</ThemedText> : null}
                          </View>
                        ) : (
                          canEdit ? <Ionicons name="add-circle-outline" size={16} color={mutedColor} /> : null
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* ── Modal Input Setor ── */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Pressable style={{ position: 'absolute', inset: 0 } as any} onPress={closeModal} />
          <ThemedView type="card" style={{ width: '100%', maxWidth: 360, borderRadius: 24, padding: 24, gap: 16 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>{modalTarget?.memberName}</ThemedText>
                <ThemedText type="muted" style={{ fontSize: 12 }}>{modalTarget?.item.nama} · Target {formatRupiah(modalTarget?.item.nominal ?? 0)}</ThemedText>
              </View>
              <Pressable onPress={closeModal} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color={mutedColor} />
              </Pressable>
            </View>

            {/* Toggle Setor / Tidak Setor */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => setModalSkip(false)}
                style={[{
                  flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
                  borderWidth: 1.5, borderColor: !modalSkip ? successColor : borderColor,
                  backgroundColor: !modalSkip ? successColor + '15' : 'transparent',
                }]}>
                <ThemedText style={{ fontSize: 13, fontWeight: '600', color: !modalSkip ? successColor : mutedColor }}>Setor</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setModalSkip(true)}
                style={[{
                  flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
                  borderWidth: 1.5, borderColor: modalSkip ? dangerColor : borderColor,
                  backgroundColor: modalSkip ? dangerColor + '15' : 'transparent',
                }]}>
                <ThemedText style={{ fontSize: 13, fontWeight: '600', color: modalSkip ? dangerColor : mutedColor }}>Tidak Setor</ThemedText>
              </Pressable>
            </View>

            {/* Input nominal */}
            {!modalSkip && (
              <View style={{ gap: 6 }}>
                <ThemedText type="muted" style={{ fontSize: 12 }}>Nominal Setor (Rp)</ThemedText>
                <TextInput
                  value={modalNominal}
                  onChangeText={setModalNominal}
                  keyboardType="number-pad"
                  placeholder={String(modalTarget?.item.nominal ?? 0)}
                  placeholderTextColor={mutedColor}
                  style={{
                    borderWidth: 1.5, borderColor, borderRadius: 12,
                    paddingHorizontal: 14, paddingVertical: 12,
                    fontSize: 18, fontWeight: '700', color: textColor,
                    backgroundColor: 'rgba(127,127,127,0.04)',
                  }}
                />
                {/* Shortcut lunas */}
                <Pressable
                  onPress={() => setModalNominal(String(modalTarget?.item.nominal ?? 0))}
                  style={{ alignSelf: 'flex-start' }}>
                  <ThemedText style={{ fontSize: 12, color: tintColor }}>
                    Isi target ({formatRupiah(modalTarget?.item.nominal ?? 0)})
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {/* Tombol aksi */}
            <View style={{ gap: 8 }}>
              <Pressable
                onPress={onSave}
                disabled={modalSaving}
                style={({ pressed }) => [{
                  paddingVertical: 14, borderRadius: 14, alignItems: 'center',
                  backgroundColor: tintColor, opacity: (pressed || modalSaving) ? 0.75 : 1,
                }]}>
                <ThemedText style={{ color: 'white', fontWeight: '700' }}>
                  {modalSaving ? 'Menyimpan...' : 'Simpan'}
                </ThemedText>
              </Pressable>
              {modalTarget?.existing && (
                <Pressable
                  onPress={onDelete}
                  style={({ pressed }) => [{
                    paddingVertical: 12, borderRadius: 14, alignItems: 'center',
                    borderWidth: 1.5, borderColor: dangerColor, opacity: pressed ? 0.7 : 1,
                  }]}>
                  <ThemedText style={{ color: dangerColor, fontWeight: '600' }}>Hapus Data</ThemedText>
                </Pressable>
              )}
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* ── Konfirmasi Hapus ── */}
      <Modal visible={deleteConfirmVisible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Pressable style={{ position: 'absolute', inset: 0 } as any} onPress={() => setDeleteConfirmVisible(false)} />
          <ThemedView type="card" style={{ width: '100%', maxWidth: 320, borderRadius: 24, padding: 24, gap: 16, alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: dangerColor + '15', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="trash-outline" size={28} color={dangerColor} />
            </View>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 17 }}>Hapus Data Setor?</ThemedText>
            <ThemedText type="muted" style={{ textAlign: 'center', fontSize: 13 }}>
              Data setor {modalTarget?.memberName} untuk {modalTarget?.item.nama} akan dihapus.
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <Pressable
                onPress={() => setDeleteConfirmVisible(false)}
                style={({ pressed }) => [{ flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor, opacity: pressed ? 0.7 : 1 }]}>
                <ThemedText type="defaultSemiBold">Batal</ThemedText>
              </Pressable>
              <Pressable
                onPress={confirmDelete}
                style={({ pressed }) => [{ flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: dangerColor, opacity: pressed ? 0.8 : 1 }]}>
                <ThemedText style={{ color: 'white', fontWeight: '700' }}>Hapus</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </View>
  );
}
