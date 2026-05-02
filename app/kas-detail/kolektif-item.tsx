import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useAdmin } from "@/lib/admin/admin-context";
import { useKas } from "@/lib/kas/kas-context";
import type { KasTx, KolektifItem } from "@/lib/kas/types";
import { formatRupiah } from "@/lib/kas/types";

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function KolektifItemScreen() {
  const { kasId, itemId } = useLocalSearchParams<{
    kasId: string;
    itemId: string;
  }>();
  const { books, txsAll, upsertTx, deleteTx } = useKas();
  const { isSuperAdmin, session } = useAdmin();

  const tintColor = useThemeColor({}, "tint");
  const backgroundColor = useThemeColor({}, "background");
  const borderColor = useThemeColor({}, "border");
  const textColor = useThemeColor({}, "text");
  const mutedColor = useThemeColor({}, "muted");
  const successColor = useThemeColor({}, "success") as string;
  const dangerColor = useThemeColor({}, "danger") as string;

  const book = useMemo(() => books.find((b) => b.id === kasId), [books, kasId]);
  const item: KolektifItem | undefined = useMemo(
    () => book?.kolektifItems?.find((i) => i.id === itemId),
    [book, itemId],
  );
  const members = book?.members ?? [];
  const txs = useMemo(
    () => txsAll.filter((t) => t.kasId === kasId),
    [txsAll, kasId],
  );

  const canEdit = useMemo(() => {
    if (isSuperAdmin) return true;
    if (!session?.user?.id || !book?.editorIds?.length) return false;
    return book.editorIds.includes(session.user.id);
  }, [isSuperAdmin, session?.user?.id, book?.editorIds]);

  // Payment map untuk item ini saja
  const paymentMap = useMemo(() => {
    const map = new Map<string, KasTx>();
    txs.forEach((tx) => {
      const pd = tx.periodikData;
      if (pd?.memberId && pd?.categoryId === itemId) {
        map.set(pd.memberId, tx);
      }
    });
    return map;
  }, [txs, itemId]);

  // Statistik ringkasan
  const stats = useMemo(() => {
    if (!item)
      return {
        totalPaid: 0,
        totalTransferred: 0,
        saldo: 0,
        paidCount: 0,
        skipCount: 0,
        unpaidCount: 0,
        pct: 0,
      };
    let totalPaid = 0,
      paidCount = 0,
      skipCount = 0;
    members.forEach((m) => {
      const tx = paymentMap.get(m.id);
      if (!tx) return;
      if (tx.periodikData?.isTidakSetor) {
        skipCount++;
        return;
      }
      totalPaid += tx.nominal;
      if (tx.nominal >= item.nominal && (item.nominal > 0 || tx.nominal > 0))
        paidCount++;
    });
    // Total yang sudah ditransfer keluar untuk item ini
    let totalTransferred = 0;
    txs.forEach((t) => {
      const pd = t.periodikData;
      if (
        t.jenis === "KELUAR" &&
        pd?.categoryId === item.id &&
        pd?.memberId?.startsWith("__TRANSFER__")
      ) {
        totalTransferred += t.nominal;
      }
    });
    const saldo = totalPaid - totalTransferred;
    const target = item.nominal * members.length;
    const isBulananMode = book?.kolektifMode === "BULANAN";
    const pct = isBulananMode
      ? members.length > 0
        ? paidCount / members.length
        : 0
      : target > 0
        ? Math.min(1, totalPaid / target)
        : 0;
    const unpaidCount = members.length - paidCount - skipCount;
    return {
      totalPaid,
      totalTransferred,
      saldo,
      paidCount,
      skipCount,
      unpaidCount,
      pct,
    };
  }, [item, members, paymentMap, book, txs]);

  // Buku tujuan transfer (semua buku non-PERIODIK selain buku ini)
  const standardBooks = useMemo(
    () =>
      books.filter(
        (b) => b.id !== kasId && (b.tipe ?? "STANDARD") !== "PERIODIK",
      ),
    [books, kasId],
  );

  // Set berisi memberId (bulan) yang sudah ditransfer untuk item ini
  const transferredSet = useMemo(() => {
    const set = new Set<string>();
    txs.forEach((t) => {
      const pd = t.periodikData;
      // Transfer tx untuk item ini: categoryId === item.id, memberId diawali __TRANSFER__
      // dan periodId = m.id (bukan "kolektif")
      if (
        pd?.categoryId === itemId &&
        pd?.memberId?.startsWith("__TRANSFER__") &&
        pd?.periodId &&
        pd.periodId !== "kolektif"
      ) {
        set.add(pd.periodId); // periodId = memberId bulan yang ditransfer
      }
    });
    return set;
  }, [txs, itemId]);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [transferVisible, setTransferVisible] = useState(false);
  const [transferTarget, setTransferTarget] = useState<{
    memberId: string;
    memberName: string;
    amount: number;
  } | null>(null);
  const [transferDestId, setTransferDestId] = useState("");
  const [transferSaving, setTransferSaving] = useState(false);
  const [modalTarget, setModalTarget] = useState<{
    memberId: string;
    memberName: string;
    existing: KasTx | null;
  } | null>(null);
  const [modalNominal, setModalNominal] = useState("");
  const [modalSkip, setModalSkip] = useState(false);

  const openModal = (memberId: string, memberName: string) => {
    if (!canEdit || !item) return;
    const existing = paymentMap.get(memberId) ?? null;
    setModalTarget({ memberId, memberName, existing });
    setModalNominal(
      existing && !existing.periodikData?.isTidakSetor
        ? String(existing.nominal)
        : String(item.nominal),
    );
    setModalSkip(existing?.periodikData?.isTidakSetor ?? false);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setModalTarget(null);
    setModalSaving(false);
  };

  const onSave = async () => {
    if (!modalTarget || !item || modalSaving) return;
    setModalSaving(true);
    const { memberId, memberName, existing } = modalTarget;
    try {
      const txId =
        existing?.id ??
        `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const createdAt = existing?.createdAt ?? Date.now();
      if (modalSkip) {
        await upsertTx({
          id: txId,
          kasId: kasId,
          tanggalISO: getToday(),
          jenis: "KELUAR",
          kategori: item.nama,
          deskripsi: `Tidak setor - ${memberName}`,
          nominal: 0,
          periodikData: {
            memberId,
            periodId: "kolektif",
            categoryId: item.id,
            isTidakSetor: true,
          },
          createdAt,
          updatedAt: Date.now(),
        });
      } else {
        const n = parseInt(modalNominal.replace(/\D/g, ""), 10);
        if (!n || n <= 0) {
          Alert.alert("Validasi", "Nominal harus > 0");
          setModalSaving(false);
          return;
        }
        await upsertTx({
          id: txId,
          kasId: kasId,
          tanggalISO: getToday(),
          jenis: "MASUK",
          kategori: item.nama,
          deskripsi: `Setor ${item.nama} - ${memberName}`,
          nominal: n,
          periodikData: {
            memberId,
            periodId: "kolektif",
            categoryId: item.id,
            isTidakSetor: false,
          },
          createdAt,
          updatedAt: Date.now(),
        });
      }
      closeModal();
    } catch (e: any) {
      Alert.alert("Gagal", e?.message ?? "Gagal menyimpan");
    } finally {
      setModalSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!modalTarget?.existing) return;
    await deleteTx(modalTarget.existing.id);
    setDeleteConfirmVisible(false);
    closeModal();
  };

  const onTransfer = (memberId: string, memberName: string, amount: number) => {
    if (!canEdit) return;
    if (amount <= 0) return;
    if (standardBooks.length === 0) {
      Alert.alert(
        "Tidak Ada Tujuan",
        "Buat buku kas Standard dulu untuk menerima transfer.",
      );
      return;
    }
    setTransferTarget({ memberId, memberName, amount });
    setTransferDestId(standardBooks[0].id);
    setTransferVisible(true);
  };

  const onConfirmTransfer = async () => {
    if (!transferTarget || !item || !kasId) return;
    const dest = standardBooks.find((b) => b.id === transferDestId);
    if (!dest) return;
    const { memberId, memberName, amount } = transferTarget;
    setTransferSaving(true);
    try {
      const tanggal = getToday();
      const base = `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const ts = Date.now();
      // Tx KELUAR dari buku ini
      await upsertTx({
        id: `${base}_out`,
        kasId,
        tanggalISO: tanggal,
        jenis: "KELUAR",
        kategori: item.nama,
        deskripsi: `Transfer ${memberName} ke ${dest.nama}`,
        nominal: amount,
        periodikData: {
          memberId: `__TRANSFER__:${dest.id}`,
          periodId: memberId, // pakai memberId bulan sebagai periodId (bukan "kolektif")
          categoryId: itemId!,
          count: 1,
          isTidakSetor: false,
        },
        createdAt: ts,
        updatedAt: ts,
      });
      // Tx MASUK ke buku tujuan
      await upsertTx({
        id: `${base}_in`,
        kasId: dest.id,
        tanggalISO: tanggal,
        jenis: "MASUK",
        kategori: item.nama,
        deskripsi: `${memberName} · Tahun ${item.nama} dari ${book!.nama}`,
        nominal: amount,
        periodikData: {
          memberId: `__TRANSFER_IN__:${kasId}`,
          periodId: memberId,
          categoryId: itemId!,
          count: 1,
          isTidakSetor: false,
        },
        createdAt: ts,
        updatedAt: ts,
      });
      setTransferVisible(false);
      setTransferTarget(null);
    } catch (e: any) {
      Alert.alert("Gagal Transfer", e?.message ?? "Terjadi kesalahan.");
    } finally {
      setTransferSaving(false);
    }
  };

  if (!book || !item) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor }} edges={["top"]}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 16,
            gap: 8,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Ionicons name="chevron-back" size={24} color={tintColor} />
            <ThemedText style={{ color: tintColor, fontSize: 16 }}>
              Kembali
            </ThemedText>
          </Pressable>
        </View>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ThemedText type="muted">Item tidak ditemukan.</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            width: 80,
          }}
        >
          <Ionicons name="chevron-back" size={24} color={tintColor} />
          <ThemedText style={{ color: tintColor, fontSize: 16 }}>
            Kembali
          </ThemedText>
        </Pressable>
        <ThemedText
          type="defaultSemiBold"
          style={{ flex: 1, textAlign: "center", fontSize: 16 }}
          numberOfLines={1}
        >
          {item.nama}
        </ThemedText>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Ringkasan */}
        <ThemedView
          type="card"
          style={{ borderRadius: 16, padding: 16, marginBottom: 16, gap: 12 }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>
              {book?.kolektifMode === "BULANAN"
                ? "Total Saldo"
                : "Target per orang"}
            </ThemedText>
            <View style={{ alignItems: "flex-end", gap: 2 }}>
              <ThemedText
                type="defaultSemiBold"
                style={{ fontSize: 15, color: tintColor }}
              >
                {book?.kolektifMode === "BULANAN"
                  ? formatRupiah(stats.saldo)
                  : formatRupiah(item.nominal)}
              </ThemedText>
              {book?.kolektifMode === "BULANAN" &&
                stats.totalTransferred > 0 && (
                  <ThemedText
                    type="muted"
                    style={{
                      fontSize: 11,
                      textDecorationLine: "line-through",
                    }}
                  >
                    {formatRupiah(stats.totalPaid)}
                  </ThemedText>
                )}
            </View>
          </View>

          {/* Progress bar */}
          <View>
            <View
              style={{
                height: 8,
                backgroundColor: borderColor,
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: 8,
                  width: `${Math.round(stats.pct * 100)}%`,
                  backgroundColor: stats.pct >= 1 ? successColor : tintColor,
                  borderRadius: 4,
                }}
              />
            </View>
            <ThemedText type="muted" style={{ fontSize: 11, marginTop: 4 }}>
              {formatRupiah(stats.totalPaid)} terkumpul dari{" "}
              {formatRupiah(item.nominal * members.length)}
            </ThemedText>
          </View>

          {/* Stat chips */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View
              style={{
                flex: 1,
                backgroundColor: successColor + "15",
                borderRadius: 10,
                padding: 10,
                alignItems: "center",
              }}
            >
              <ThemedText
                style={{ fontSize: 18, fontWeight: "800", color: successColor }}
              >
                {stats.paidCount}
              </ThemedText>
              <ThemedText
                style={{ fontSize: 11, color: successColor, fontWeight: "600" }}
              >
                Lunas
              </ThemedText>
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: tintColor + "12",
                borderRadius: 10,
                padding: 10,
                alignItems: "center",
              }}
            >
              <ThemedText
                style={{ fontSize: 18, fontWeight: "800", color: tintColor }}
              >
                {stats.unpaidCount}
              </ThemedText>
              <ThemedText
                style={{ fontSize: 11, color: tintColor, fontWeight: "600" }}
              >
                Belum
              </ThemedText>
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: dangerColor + "12",
                borderRadius: 10,
                padding: 10,
                alignItems: "center",
              }}
            >
              <ThemedText
                style={{ fontSize: 18, fontWeight: "800", color: dangerColor }}
              >
                {stats.skipCount}
              </ThemedText>
              <ThemedText
                style={{ fontSize: 11, color: dangerColor, fontWeight: "600" }}
              >
                Tidak Setor
              </ThemedText>
            </View>
          </View>
        </ThemedView>

        {/* Daftar anggota / bulan */}
        <ThemedText
          type="defaultSemiBold"
          style={{ fontSize: 14, marginBottom: 10 }}
        >
          {book?.kolektifMode === "BULANAN"
            ? `Daftar Bulan (${members.length})`
            : `Daftar Anggota (${members.length})`}
        </ThemedText>

        <View style={{ gap: 8 }}>
          {members.map((m, idx) => {
            const tx = paymentMap.get(m.id);
            const isSkip = tx?.periodikData?.isTidakSetor ?? false;
            const paid = tx && !isSkip ? tx.nominal : 0;
            const isLunas = item.nominal > 0 ? paid >= item.nominal : paid > 0;
            const isPartial = paid > 0 && !isLunas;

            let statusColor = mutedColor;
            let statusLabel = "Belum setor";
            let rowBg = "transparent";

            if (isSkip) {
              statusColor = dangerColor;
              statusLabel = "Tidak setor";
              rowBg = dangerColor + "08";
            } else if (isLunas) {
              statusColor = successColor;
              statusLabel = formatRupiah(paid);
              rowBg = successColor + "08";
            } else if (isPartial) {
              statusColor = tintColor;
              statusLabel = formatRupiah(paid);
              rowBg = tintColor + "08";
            }

            const isTransferred =
              book.kolektifMode === "BULANAN" && transferredSet.has(m.id);

            // Tidak bisa diedit jika sudah ditransfer
            const editDisabled = !canEdit || isTransferred;

            // Nominal bisa diklik untuk transfer (BULANAN, paid > 0, canEdit, belum transfer)
            const canTriggerTransfer =
              book.kolektifMode === "BULANAN" && canEdit && paid > 0;

            return (
              <Pressable
                key={m.id}
                onPress={() => {
                  if (editDisabled) return;
                  openModal(m.id, m.nama);
                }}
                disabled={editDisabled}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: isTransferred ? "transparent" : rowBg,
                  borderWidth: 1,
                  borderColor: isTransferred ? tintColor + "40" : borderColor,
                  borderRadius: 12,
                  padding: 12,
                  gap: 12,
                  opacity: pressed && !editDisabled ? 0.7 : 1,
                })}
              >
                {/* Avatar */}
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: isTransferred
                      ? mutedColor + "15"
                      : statusColor + "20",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <ThemedText
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: isTransferred ? mutedColor : statusColor,
                    }}
                  >
                    {m.nama.charAt(0).toUpperCase()}
                  </ThemedText>
                </View>

                {/* Nama + ikon lock jika sudah ditransfer */}
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <ThemedText
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: isTransferred ? mutedColor : textColor,
                    }}
                    numberOfLines={1}
                  >
                    {m.nama}
                  </ThemedText>
                  {isTransferred && (
                    <Ionicons name="lock-closed" size={11} color={mutedColor} />
                  )}
                </View>

                {/* Nominal — klik untuk transfer (BULANAN) */}
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    if (canTriggerTransfer && !isTransferred)
                      onTransfer(m.id, m.nama, paid);
                  }}
                  disabled={!canTriggerTransfer}
                  hitSlop={8}
                >
                  <ThemedText
                    style={{
                      fontSize: 13,
                      color: isTransferred ? mutedColor : statusColor,
                      fontWeight: "600",
                      textDecorationLine: isTransferred
                        ? "line-through"
                        : "none",
                    }}
                  >
                    {statusLabel}
                  </ThemedText>
                </Pressable>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Modal Input Setor */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <Pressable
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            onPress={closeModal}
          />
          <ThemedView
            type="card"
            style={{
              width: "100%",
              maxWidth: 360,
              borderRadius: 24,
              padding: 24,
              gap: 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>
                  {modalTarget?.memberName}
                </ThemedText>
                <ThemedText type="muted" style={{ fontSize: 12 }}>
                  {item.nama} · Target {formatRupiah(item.nominal)}
                </ThemedText>
              </View>
              <Pressable onPress={closeModal} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color={mutedColor} />
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setModalSkip(false)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: "center",
                  borderWidth: 1.5,
                  borderColor: !modalSkip ? successColor : borderColor,
                  backgroundColor: !modalSkip
                    ? successColor + "15"
                    : "transparent",
                }}
              >
                <ThemedText
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: !modalSkip ? successColor : mutedColor,
                  }}
                >
                  Setor
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setModalSkip(true)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: "center",
                  borderWidth: 1.5,
                  borderColor: modalSkip ? dangerColor : borderColor,
                  backgroundColor: modalSkip
                    ? dangerColor + "15"
                    : "transparent",
                }}
              >
                <ThemedText
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: modalSkip ? dangerColor : mutedColor,
                  }}
                >
                  Tidak Setor
                </ThemedText>
              </Pressable>
            </View>

            {!modalSkip && (
              <View style={{ gap: 6 }}>
                <ThemedText type="muted" style={{ fontSize: 12 }}>
                  Nominal Setor (Rp)
                </ThemedText>
                <TextInput
                  value={modalNominal}
                  onChangeText={setModalNominal}
                  keyboardType="number-pad"
                  placeholder={String(item.nominal)}
                  placeholderTextColor={mutedColor}
                  style={{
                    borderWidth: 1.5,
                    borderColor,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 18,
                    fontWeight: "700",
                    color: textColor,
                    backgroundColor: "rgba(127,127,127,0.04)",
                  }}
                />
                <Pressable
                  onPress={() => setModalNominal(String(item.nominal))}
                  style={{ alignSelf: "flex-start" }}
                >
                  <ThemedText style={{ fontSize: 12, color: tintColor }}>
                    Isi target ({formatRupiah(item.nominal)})
                  </ThemedText>
                </Pressable>
              </View>
            )}

            <View style={{ gap: 8 }}>
              <Pressable
                onPress={onSave}
                disabled={modalSaving}
                style={({ pressed }) => [
                  {
                    paddingVertical: 14,
                    borderRadius: 14,
                    alignItems: "center",
                    backgroundColor: tintColor,
                    opacity: pressed || modalSaving ? 0.75 : 1,
                  },
                ]}
              >
                <ThemedText style={{ color: "white", fontWeight: "700" }}>
                  {modalSaving ? "Menyimpan..." : "Simpan"}
                </ThemedText>
              </Pressable>
              {modalTarget?.existing && (
                <Pressable
                  onPress={() => setDeleteConfirmVisible(true)}
                  style={({ pressed }) => [
                    {
                      paddingVertical: 12,
                      borderRadius: 14,
                      alignItems: "center",
                      borderWidth: 1.5,
                      borderColor: dangerColor,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <ThemedText style={{ color: dangerColor, fontWeight: "600" }}>
                    Hapus Data
                  </ThemedText>
                </Pressable>
              )}
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* Modal Transfer ke Buku Lain */}
      <Modal visible={transferVisible} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <Pressable
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            onPress={() => {
              if (!transferSaving) {
                setTransferVisible(false);
                setTransferTarget(null);
              }
            }}
          />
          <ThemedView
            type="card"
            style={{ width: "100%", borderRadius: 24, padding: 24, gap: 16 }}
          >
            {/* Header */}
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: tintColor + "18",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Ionicons name="swap-horizontal" size={20} color={tintColor} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>
                  Transfer ke Buku Lain
                </ThemedText>
                <ThemedText type="muted" style={{ fontSize: 12 }}>
                  {transferTarget
                    ? `${transferTarget.memberName} · Tahun ${item.nama} · ${formatRupiah(transferTarget.amount)}`
                    : ""}
                </ThemedText>
              </View>
            </View>

            {/* Daftar buku tujuan */}
            <ScrollView
              style={{ maxHeight: 220 }}
              showsVerticalScrollIndicator={false}
            >
              {standardBooks.map((b) => {
                const active = b.id === transferDestId;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => setTransferDestId(b.id)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      borderWidth: 1,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      marginBottom: 8,
                      borderColor: active ? tintColor : borderColor,
                      backgroundColor: active
                        ? tintColor + "12"
                        : "transparent",
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText type="defaultSemiBold" numberOfLines={1}>
                        {b.nama}
                      </ThemedText>
                      <ThemedText
                        type="muted"
                        style={{ fontSize: 12 }}
                        numberOfLines={1}
                      >
                        {b.tipe ?? "Standard"}
                      </ThemedText>
                    </View>
                    {active && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={tintColor}
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Tombol */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                disabled={transferSaving}
                onPress={() => {
                  setTransferVisible(false);
                  setTransferTarget(null);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor,
                  backgroundColor: "transparent",
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <ThemedText style={{ fontWeight: "600" }}>Batal</ThemedText>
              </Pressable>
              <Pressable
                disabled={transferSaving || !transferDestId}
                onPress={onConfirmTransfer}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: transferSaving
                    ? tintColor + "80"
                    : tintColor,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <ThemedText style={{ color: "white", fontWeight: "700" }}>
                  {transferSaving ? "Memproses..." : "Transfer"}
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* Konfirmasi Hapus */}
      <Modal visible={deleteConfirmVisible} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <Pressable
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            onPress={() => setDeleteConfirmVisible(false)}
          />
          <ThemedView
            type="card"
            style={{
              width: "100%",
              maxWidth: 320,
              borderRadius: 24,
              padding: 24,
              gap: 16,
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: dangerColor + "15",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="trash-outline" size={28} color={dangerColor} />
            </View>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 17 }}>
              Hapus Data Setor?
            </ThemedText>
            <ThemedText
              type="muted"
              style={{ textAlign: "center", fontSize: 13 }}
            >
              Data setor {modalTarget?.memberName} untuk {item.nama} akan
              dihapus.
            </ThemedText>
            <View style={{ flexDirection: "row", gap: 10, width: "100%" }}>
              <Pressable
                onPress={() => setDeleteConfirmVisible(false)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    paddingVertical: 13,
                    borderRadius: 12,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <ThemedText type="defaultSemiBold">Batal</ThemedText>
              </Pressable>
              <Pressable
                onPress={confirmDelete}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    paddingVertical: 13,
                    borderRadius: 12,
                    alignItems: "center",
                    backgroundColor: dangerColor,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <ThemedText style={{ color: "white", fontWeight: "700" }}>
                  Hapus
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
