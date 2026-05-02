import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { KasBook, KasTx } from "@/lib/kas/types";
import { formatRupiah } from "@/lib/kas/types";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";

export function KolektifTable({
  book,
  txs,
  canEdit,
}: {
  book: KasBook;
  txs: KasTx[];
  canEdit: boolean;
}) {
  const tintColor = useThemeColor({}, "tint");
  const borderColor = useThemeColor({}, "border");
  const mutedColor = useThemeColor({}, "muted");
  const successColor = useThemeColor({}, "success") as string;
  const dangerColor = useThemeColor({}, "danger") as string;

  const members = book.members ?? [];
  const items = book.kolektifItems ?? [];
  const isBulanan = book.kolektifMode === "BULANAN";

  // Payment map: memberId_itemId → KasTx
  const paymentMap = useMemo(() => {
    const map = new Map<string, KasTx>();
    txs.forEach((tx) => {
      const pd = tx.periodikData;
      if (pd?.memberId && pd?.categoryId) {
        map.set(`${pd.memberId}_${pd.categoryId}`, tx);
      }
    });
    return map;
  }, [txs]);

  // Statistik per item
  const itemStats = useMemo(() => {
    return items.map((item) => {
      let totalPaid = 0;
      let paidCount = 0;
      let skipCount = 0;
      members.forEach((m) => {
        const tx = paymentMap.get(`${m.id}_${item.id}`);
        if (!tx) return;
        if (tx.periodikData?.isTidakSetor) {
          skipCount++;
          return;
        }
        totalPaid += tx.nominal;
        if (tx.nominal >= item.nominal && (item.nominal > 0 || tx.nominal > 0))
          paidCount++;
      });
      const target = item.nominal * members.length;
      // Untuk BULANAN: pct = bulan yang sudah bayar / total bulan
      const pct = isBulanan
        ? members.length > 0
          ? paidCount / members.length
          : 0
        : target > 0
          ? Math.min(1, totalPaid / target)
          : 0;
      return { totalPaid, paidCount, skipCount, target, pct };
    });
  }, [items, members, paymentMap]);

  if (members.length === 0 || items.length === 0) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 48, gap: 8 }}>
        <Ionicons name="basket-outline" size={48} color={mutedColor} />
        <ThemedText type="muted" style={{ textAlign: "center" }}>
          {members.length === 0
            ? isBulanan
              ? "Belum ada data bulan."
              : "Belum ada anggota."
            : "Belum ada item kolektif."}
        </ThemedText>
        <ThemedText type="muted" style={{ fontSize: 12, textAlign: "center" }}>
          Tambahkan lewat menu Kelola Buku Kas.
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 10 }}
      showsVerticalScrollIndicator={false}
    >
      {items.map((item, i) => {
        const stat = itemStats[i];
        const unpaidCount = members.length - stat.paidCount - stat.skipCount;

        return (
          <Pressable
            key={item.id}
            onPress={() =>
              router.push({
                pathname: "/kas-detail/kolektif-item",
                params: { kasId: book.id, itemId: item.id },
              })
            }
            style={({ pressed }) => [
              {
                borderWidth: 1,
                borderColor,
                borderRadius: 16,
                padding: 14,
                gap: 10,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            {/* Baris atas: nama + chevron */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <ThemedText
                type="defaultSemiBold"
                style={{ fontSize: 15, flex: 1 }}
                numberOfLines={1}
              >
                {isBulanan ? `Tahun ${item.nama}` : item.nama}
              </ThemedText>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                {!isBulanan && (
                  <ThemedText type="muted" style={{ fontSize: 12 }}>
                    {formatRupiah(item.nominal)}/orang
                  </ThemedText>
                )}
                <Ionicons name="chevron-forward" size={16} color={mutedColor} />
              </View>
            </View>

            {/* Progress bar */}
            <View
              style={{
                height: 6,
                backgroundColor: borderColor,
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: 6,
                  width: `${Math.round(stat.pct * 100)}%`,
                  backgroundColor: stat.pct >= 1 ? successColor : tintColor,
                  borderRadius: 3,
                }}
              />
            </View>

            {/* Stat chips */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              {/* Chip: lunas */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: successColor + "15",
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                }}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={12}
                  color={successColor}
                />
                <ThemedText
                  style={{
                    fontSize: 11,
                    color: successColor,
                    fontWeight: "700",
                  }}
                >
                  {isBulanan
                    ? `${stat.paidCount} bulan lunas`
                    : `${stat.paidCount} lunas`}
                </ThemedText>
              </View>
              {/* Chip: belum */}
              {unpaidCount > 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor: tintColor + "12",
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 8,
                  }}
                >
                  <Ionicons name="time-outline" size={12} color={tintColor} />
                  <ThemedText
                    style={{
                      fontSize: 11,
                      color: tintColor,
                      fontWeight: "700",
                    }}
                  >
                    {isBulanan
                      ? `${unpaidCount} bulan belum`
                      : `${unpaidCount} belum`}
                  </ThemedText>
                </View>
              )}
              {/* Chip: tidak setor */}
              {stat.skipCount > 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor: dangerColor + "12",
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 8,
                  }}
                >
                  <Ionicons name="close-circle" size={12} color={dangerColor} />
                  <ThemedText
                    style={{
                      fontSize: 11,
                      color: dangerColor,
                      fontWeight: "700",
                    }}
                  >
                    {stat.skipCount} tidak setor
                  </ThemedText>
                </View>
              )}
              <View style={{ flex: 1 }} />
              <ThemedText type="muted" style={{ fontSize: 11 }}>
                {Math.round(stat.pct * 100)}%
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
