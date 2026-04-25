import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAdmin } from '@/lib/admin/admin-context';
import { useKas } from '@/lib/kas/kas-context';
import type { KasTx, KasTxType } from '@/lib/kas/types';
import { normalizeTanggalISO } from '@/lib/kas/types';
import { SafeAreaView } from 'react-native-safe-area-context';

function makeId() {
  return `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function TransactionFormScreen() {
  const { id, defaultYear, defaultMonth } = useLocalSearchParams<{ 
    id?: string; 
    defaultYear?: string; 
    defaultMonth?: string;
  }>();
  const { txsAll, activeKasId, upsertTx, deleteTx, books, updateCategories } = useKas();
  const { isAdmin } = useAdmin();
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'muted');
  const borderColor = useThemeColor({}, 'border');
  const dangerColor = useThemeColor({}, 'danger');
  const successColor = useThemeColor({}, 'success');

  const existing = useMemo(() => (id ? txsAll.find((t) => t.id === id) : undefined), [id, txsAll]);
  const activeBook = useMemo(() => books.find(b => b.id === activeKasId), [books, activeKasId]);
  const isTransferIn = useMemo(
    () => !!existing?.periodikData?.memberId?.startsWith('__TRANSFER_IN__:') && existing.jenis === 'MASUK',
    [existing],
  );
  const transferFromKasId = useMemo(() => {
    if (!isTransferIn) return '';
    const raw = existing?.periodikData?.memberId ?? '';
    const parts = raw.split(':');
    return parts[1] ?? '';
  }, [existing, isTransferIn]);
  const transferFromBook = useMemo(() => books.find(b => b.id === transferFromKasId), [books, transferFromKasId]);
  const categories = useMemo(() => activeBook?.categories || ['Iuran', 'Konsumsi', 'Kegiatan', 'Lain-lain'], [activeBook]);

  const defaultDate = useMemo(() => {
    if (existing) return existing.tanggalISO;
    
    const d = new Date();
    const yyyy = defaultYear || String(d.getFullYear());
    const mm = defaultMonth || String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    
    return `${yyyy}-${mm}-${dd}`;
  }, [existing, defaultYear, defaultMonth]);

  const [tanggalISO, setTanggalISO] = useState(defaultDate);
  const [jenis, setJenis] = useState<KasTxType>(existing?.jenis ?? 'MASUK');
  const [kategori, setKategori] = useState(existing?.kategori ?? '');
  const [deskripsi, setDeskripsi] = useState(existing?.deskripsi ?? '');
  const [nominal, setNominal] = useState(existing?.nominal?.toString() ?? '');

  // Modal Visibility States
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [isCategoryPickerVisible, setIsCategoryPickerVisible] = useState(false);
  const [isEditCategoriesMode, setIsEditCategoriesMode] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [returnConfirmVisible, setReturnConfirmVisible] = useState(false);

  // Date Picker Temporary States
  const initialDate = useMemo(() => {
    const [y, m, d] = tanggalISO.split('-').map(Number);
    return { y, m: m - 1, d };
  }, [tanggalISO]);
  const [pickerYear, setPickerYear] = useState(initialDate.y);
  const [pickerMonth, setPickerMonth] = useState(initialDate.m);

  const isEdit = !!existing;

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

  const onSelectDate = (d: number) => {
    const yyyy = pickerYear;
    const mm = String(pickerMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    setTanggalISO(`${yyyy}-${mm}-${dd}`);
    setIsDatePickerVisible(false);
  };

  const onSetToday = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setTanggalISO(`${yyyy}-${mm}-${dd}`);
    setPickerYear(yyyy);
    setPickerMonth(d.getMonth());
    setIsDatePickerVisible(false);
  };

  const onAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (categories.includes(name)) {
      Alert.alert('Gagal', 'Kategori sudah ada.');
      return;
    }
    const next = [...categories, name];
    await updateCategories(activeKasId, next);
    setNewCategoryName('');
  };

  const onDeleteCategory = async (name: string) => {
    Alert.alert('Hapus Kategori', `Hapus kategori "${name}"?`, [
      { text: 'Batal', style: 'cancel' },
      { 
        text: 'Hapus', 
        style: 'destructive', 
        onPress: async () => {
          const next = categories.filter(c => c !== name);
          await updateCategories(activeKasId, next);
        }
      }
    ]);
  };

  const onSave = async () => {
    const n = Math.round(Number(String(nominal).replace(/[^\d]/g, '')));
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert('Validasi', 'Nominal harus angka > 0.');
      return;
    }
    const now = Date.now();
    const tx: KasTx = {
      id: existing?.id ?? makeId(),
      kasId: existing?.kasId ?? activeKasId,
      tanggalISO: normalizeTanggalISO(tanggalISO),
      jenis,
      kategori: kategori.trim(),
      deskripsi: deskripsi.trim(),
      nominal: n,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      await upsertTx(tx);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Gagal menyimpan transaksi');
    }
  };

  const onDelete = async () => {
    if (!existing) return;
    setDeleteConfirmVisible(true);
  };

  const confirmDelete = async () => {
    if (!existing) return;
    try {
      await deleteTx(existing.id);
      setDeleteConfirmVisible(false);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Gagal menghapus transaksi');
    }
  };

  const onReturnTransfer = async () => {
    if (!existing) return;
    if (!isTransferIn) return;
    if (!transferFromKasId) {
      Alert.alert('Gagal', 'Data asal transfer tidak ditemukan.');
      return;
    }
    const fromBook = transferFromBook;
    if (!fromBook) {
      Alert.alert('Gagal', 'Buku kas asal tidak ditemukan.');
      return;
    }
    setReturnConfirmVisible(true);
  };

  const confirmReturnTransfer = async () => {
    if (!existing || !isTransferIn || !transferFromKasId) return;
    const periodId = existing.periodikData?.periodId ?? '';
    const categoryId = existing.periodikData?.categoryId ?? existing.kategori;
    try {
      const outTx = txsAll
        .filter(t =>
          t.kasId === transferFromKasId &&
          t.jenis === 'KELUAR' &&
          typeof t.periodikData?.memberId === 'string' &&
          t.periodikData.memberId.startsWith('__TRANSFER__') &&
          (t.periodikData?.periodId ?? '') === periodId &&
          ((t.periodikData?.categoryId ?? t.kategori) === categoryId) &&
          t.nominal === existing.nominal,
        )
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];

      await deleteTx(existing.id);
      if (outTx) await deleteTx(outTx.id);
      setReturnConfirmVisible(false);
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Gagal mengembalikan transfer');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={['top']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ThemedView style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={textColor} />
          </Pressable>
          <ThemedText type="subtitle">{isEdit ? 'Edit Transaksi' : 'Tambah Transaksi'}</ThemedText>
          <View style={{ width: 40 }} />
        </ThemedView>

        <ScrollView 
          contentContainerStyle={[styles.scroll, { paddingBottom: 260 }]} 
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          <ThemedView style={styles.formContainer}>
            <Field label="Jenis Transaksi">
              <View style={[styles.seg, { borderColor }]}>
                <SegBtn
                  active={jenis === 'MASUK'}
                  label="MASUK"
                  onPress={() => setJenis('MASUK')}
                  activeColor={successColor}
                />
                <SegBtn
                  active={jenis === 'KELUAR'}
                  label="KELUAR"
                  onPress={() => setJenis('KELUAR')}
                  activeColor={dangerColor}
                />
              </View>
            </Field>

            <Field label="Tanggal">
              <Pressable 
                onPress={() => setIsDatePickerVisible(true)}
                style={[styles.input, { borderColor, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <ThemedText style={!tanggalISO ? { color: mutedColor } : { color: textColor }}>
                  {tanggalISO || 'Pilih Tanggal'}
                </ThemedText>
                <Ionicons name="calendar-outline" size={20} color={tintColor} />
              </Pressable>
            </Field>

            <Field label="Kategori">
              <Pressable 
                onPress={() => setIsCategoryPickerVisible(true)}
                style={[styles.input, { borderColor, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <ThemedText style={!kategori ? { color: mutedColor } : { color: textColor }}>
                  {kategori || 'Pilih Kategori'}
                </ThemedText>
                <Ionicons name="chevron-down" size={20} color={tintColor} />
              </Pressable>
            </Field>

            <Field label="Deskripsi">
              <TextInput
                value={deskripsi}
                onChangeText={setDeskripsi}
                placeholder="Catatan singkat"
                placeholderTextColor={mutedColor}
                multiline
                numberOfLines={3}
                style={[styles.input, styles.textArea, { color: textColor, borderColor }]}
              />
            </Field>

            <Field label="Nominal (Rp)">
              <TextInput
                value={nominal}
                onChangeText={setNominal}
                placeholder="10000"
                placeholderTextColor={mutedColor}
                keyboardType="number-pad"
                style={[styles.input, styles.nominalInput, { color: textColor, borderColor }]}
              />
            </Field>

            <View style={styles.actions}>
              <Pressable
                onPress={onSave}
                style={({ pressed }) => [styles.btn, styles.btnPrimary, { backgroundColor: tintColor }, pressed && { opacity: 0.8 }]}>
                <ThemedText type="defaultSemiBold" style={styles.btnPrimaryText}>
                  {isEdit ? 'Simpan Perubahan' : 'Tambah Transaksi'}
                </ThemedText>
              </Pressable>

              {isEdit && isTransferIn && (
                <Pressable
                  onPress={onReturnTransfer}
                  style={({ pressed }) => [styles.btn, styles.btnDanger, { borderColor: tintColor }, pressed && { opacity: 0.8 }]}>
                  <Ionicons name="return-down-back-outline" size={20} color={tintColor} />
                  <ThemedText type="defaultSemiBold" style={{ color: tintColor }}>
                    Balikin ke Kas Asal
                  </ThemedText>
                </Pressable>
              )}

              {isEdit && (
                <Pressable
                  onPress={onDelete}
                  style={({ pressed }) => [styles.btn, styles.btnDanger, { borderColor: dangerColor }, pressed && { opacity: 0.8 }]}>
                  <Ionicons name="trash-outline" size={20} color={dangerColor} />
                  <ThemedText type="defaultSemiBold" style={{ color: dangerColor }}>
                    Hapus Transaksi
                  </ThemedText>
                </Pressable>
              )}
            </View>
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal Date Picker */}
      <Modal visible={isDatePickerVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setIsDatePickerVisible(false)}>
          <ThemedView type="card" style={styles.pickerModal}>
            <ThemedText type="subtitle" style={{ marginBottom: 16 }}>Pilih Tanggal</ThemedText>
            
            <View style={styles.yearPickerNav}>
              <Pressable onPress={() => setPickerYear(prev => prev - 1)} style={styles.yearNavBtn}>
                <Ionicons name="chevron-back" size={20} color={tintColor} />
              </Pressable>
              <ThemedText type="subtitle" style={styles.yearDisplayText}>{pickerYear}</ThemedText>
              <Pressable onPress={() => setPickerYear(prev => prev + 1)} style={styles.yearNavBtn}>
                <Ionicons name="chevron-forward" size={20} color={tintColor} />
              </Pressable>
            </View>

            <View style={[styles.yearPickerNav, { marginTop: 8 }]}>
              <Pressable 
                onPress={() => setPickerMonth(prev => prev === 0 ? 11 : prev - 1)} 
                style={styles.yearNavBtn}>
                <Ionicons name="chevron-back" size={20} color={tintColor} />
              </Pressable>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 18 }}>{MONTHS[pickerMonth]}</ThemedText>
              <Pressable 
                onPress={() => setPickerMonth(prev => prev === 11 ? 0 : prev + 1)} 
                style={styles.yearNavBtn}>
                <Ionicons name="chevron-forward" size={20} color={tintColor} />
              </Pressable>
            </View>

            <View style={styles.daysGrid}>
              {Array.from({ length: daysInMonth(pickerYear, pickerMonth) }).map((_, i) => {
                const day = i + 1;
                const isSelected = initialDate.y === pickerYear && initialDate.m === pickerMonth && initialDate.d === day;
                return (
                  <Pressable 
                    key={day} 
                    onPress={() => onSelectDate(day)}
                    style={[styles.dayItem, isSelected && { backgroundColor: tintColor, borderColor: tintColor }]}>
                    <ThemedText style={[styles.dayText, isSelected && { color: 'white' }]}>{day}</ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <Pressable 
              onPress={onSetToday}
              style={[styles.closeBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: tintColor, marginBottom: 8 }]}>
              <ThemedText style={{ color: tintColor }} type="defaultSemiBold">Hari Ini</ThemedText>
            </Pressable>

            <Pressable 
              onPress={() => setIsDatePickerVisible(false)}
              style={[styles.closeBtn, { backgroundColor: tintColor }]}>
              <ThemedText style={{ color: 'white' }} type="defaultSemiBold">Batal</ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      </Modal>

      {/* Modal Category Picker */}
      <Modal visible={isCategoryPickerVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setIsCategoryPickerVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <ThemedView type="card" style={styles.pickerModal}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <ThemedText type="subtitle">
                  {isEditCategoriesMode ? 'Setting Kategori' : 'Pilih Kategori'}
                </ThemedText>
                <Pressable onPress={() => setIsEditCategoriesMode(!isEditCategoriesMode)}>
                  <Ionicons name={isEditCategoriesMode ? 'checkmark-circle' : 'settings-outline'} size={24} color={tintColor} />
                </Pressable>
              </View>

              <ScrollView style={styles.pickerScroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true} contentContainerStyle={{ paddingBottom: 20 }}>
                <View style={styles.categoryGrid}>
                  {categories.map(cat => (
                    <View key={cat} style={[styles.categoryItemWrapper, isEditCategoriesMode && { paddingRight: 40 }]}>
                      <Pressable
                        onPress={() => {
                          if (isEditCategoriesMode) return;
                          setKategori(cat);
                          setIsCategoryPickerVisible(false);
                        }}
                        style={[
                          styles.categoryItem,
                          kategori === cat && !isEditCategoriesMode && { backgroundColor: tintColor, borderColor: tintColor }
                        ]}>
                        <ThemedText style={[styles.categoryText, kategori === cat && !isEditCategoriesMode && { color: 'white' }]}>
                          {cat}
                        </ThemedText>
                      </Pressable>
                      {isEditCategoriesMode && (
                        <Pressable
                          onPress={() => onDeleteCategory(cat)}
                          style={styles.deleteCategoryBtn}>
                          <Ionicons name="close-circle" size={20} color={dangerColor} />
                        </Pressable>
                      )}
                    </View>
                  ))}
                </View>
              </ScrollView>

              {isEditCategoriesMode && (
                <View style={styles.addCategoryContainer}>
                  <TextInput
                    value={newCategoryName}
                    onChangeText={setNewCategoryName}
                    placeholder="Kategori baru..."
                    placeholderTextColor={mutedColor}
                    style={[styles.input, { flex: 1, marginBottom: 0, borderColor, color: textColor }]}
                  />
                  <Pressable
                    onPress={onAddCategory}
                    style={[styles.addBtnSmall, { backgroundColor: tintColor }]}>
                    <Ionicons name="add" size={24} color="white" />
                  </Pressable>
                </View>
              )}

              <Pressable
                onPress={() => setIsCategoryPickerVisible(false)}
                style={[styles.closeBtn, { backgroundColor: tintColor, marginTop: 16 }]}>
                <ThemedText style={{ color: 'white' }} type="defaultSemiBold">Tutup</ThemedText>
              </Pressable>
            </ThemedView>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Modal Konfirmasi Hapus */}
      <Modal visible={deleteConfirmVisible} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <Pressable style={styles.modalOverlayAbsolute} onPress={() => setDeleteConfirmVisible(false)} />
          <ThemedView type="card" style={styles.confirmModal}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={[styles.iconBoxLarge, { backgroundColor: dangerColor + '15' }]}>
                <Ionicons name="trash-outline" size={32} color={dangerColor} />
              </View>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 20, marginBottom: 8 }}>Hapus Transaksi</ThemedText>
              <ThemedText type="muted" style={styles.confirmText}>
                Apakah Anda yakin ingin menghapus transaksi ini? Data yang dihapus tidak dapat dikembalikan.
              </ThemedText>
            </View>
            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => setDeleteConfirmVisible(false)}
                style={({ pressed }) => [styles.confirmBtn, { borderWidth: 1, borderColor }, pressed && { opacity: 0.7 }]}>
                <ThemedText type="defaultSemiBold">Batal</ThemedText>
              </Pressable>
              <Pressable
                onPress={confirmDelete}
                style={({ pressed }) => [styles.confirmBtn, { backgroundColor: dangerColor }, pressed && { opacity: 0.85 }]}>
                <ThemedText type="defaultSemiBold" style={{ color: 'white' }}>Hapus</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* Modal Konfirmasi Balikin Transfer */}
      <Modal visible={returnConfirmVisible} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <Pressable style={styles.modalOverlayAbsolute} onPress={() => setReturnConfirmVisible(false)} />
          <ThemedView type="card" style={styles.confirmModal}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={[styles.iconBoxLarge, { backgroundColor: tintColor + '15' }]}>
                <Ionicons name="return-down-back-outline" size={32} color={tintColor} />
              </View>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 20, marginBottom: 8, textAlign: 'center' }}>Kembalikan Transfer</ThemedText>
              <ThemedText type="muted" style={styles.confirmText}>
                Balikkan transfer ini ke "{transferFromBook?.nama}"? Data di buku "{activeBook?.nama}" akan dihapus.
              </ThemedText>
            </View>
            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => setReturnConfirmVisible(false)}
                style={({ pressed }) => [styles.confirmBtn, { borderWidth: 1, borderColor }, pressed && { opacity: 0.7 }]}>
                <ThemedText type="defaultSemiBold">Batal</ThemedText>
              </Pressable>
              <Pressable
                onPress={confirmReturnTransfer}
                style={({ pressed }) => [styles.confirmBtn, { backgroundColor: tintColor }, pressed && { opacity: 0.85 }]}>
                <ThemedText type="defaultSemiBold" style={{ color: 'white' }}>Kembalikan</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="defaultSemiBold" style={styles.label}>
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

function SegBtn({ label, active, onPress, activeColor }: { label: string; active: boolean; onPress: () => void; activeColor: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.segBtn,
        active && { backgroundColor: activeColor + '15' },
        active && { borderBottomWidth: 2, borderBottomColor: activeColor }
      ]}>
      <ThemedText
        type="defaultSemiBold"
        style={[styles.segText, active ? { color: activeColor } : { opacity: 0.5 }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingBottom: 40,
  },
  formContainer: {
    padding: 20,
    gap: 24,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    opacity: 0.8,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'rgba(127,127,127,0.03)',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  nominalInput: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  seg: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(127,127,127,0.03)',
  },
  segBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segText: {
    fontSize: 13,
    letterSpacing: 0.5,
  },
  actions: {
    gap: 12,
    marginTop: 12,
  },
  btn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  btnPrimary: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  btnPrimaryText: {
    color: 'white',
    fontSize: 16,
  },
  btnDanger: {
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerModal: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    padding: 24,
    borderRadius: 24,
    gap: 12,
  },
  pickerScroll: {
    flex: 1,
  },
  yearPickerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(127,127,127,0.05)',
    borderRadius: 12,
    padding: 4,
  },
  yearNavBtn: {
    padding: 10,
  },
  yearDisplayText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
    justifyContent: 'center',
  },
  dayItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 14,
  },
  categoryGrid: {
    gap: 10,
  },
  categoryItemWrapper: {
    position: 'relative',
  },
  categoryItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.1)',
    backgroundColor: 'rgba(127,127,127,0.02)',
  },
  categoryText: {
    fontSize: 15,
  },
  deleteCategoryBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCategoryContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  addBtnSmall: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalOverlayAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  confirmModal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 28,
    padding: 24,
  },
  iconBoxLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmText: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 0,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
