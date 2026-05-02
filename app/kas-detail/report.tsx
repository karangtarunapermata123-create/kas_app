import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState, useCallback, useRef } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useAdmin } from "@/lib/admin/admin-context";
import { useKas } from "@/lib/kas/kas-context";
import { computeSaldo, formatRupiah } from "@/lib/kas/types";

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export default function KasDetailReportScreen() {
  const { kasId } = useLocalSearchParams<{ kasId: string }>();
  const { books, txsAll, upsertTx, deleteTx } = useKas();
  const { isSuperAdmin } = useAdmin();

  const tintColor = useThemeColor({}, "tint");
  const backgroundColor = useThemeColor({}, "background");
  const mutedColor = useThemeColor({}, "muted");
  const successColor = useThemeColor({}, "success");
  const dangerColor = useThemeColor({}, "danger");
  const borderColor = useThemeColor({}, "border");

  const book = useMemo(() => books.find((b) => b.id === kasId), [books, kasId]);
  const txsActive = useMemo(
    () => txsAll.filter((t) => t.kasId === kasId),
    [txsAll, kasId],
  );

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number | "ALL">(
    now.getMonth(),
  );
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [isPickerVisible, setIsPickerVisible] = useState(false);

  const isPeriodik = book?.tipe === "PERIODIK";
  const isPeriodikMonthly =
    isPeriodik && book?.periodConfig?.tipe === "MONTHLY";
  const isPeriodikWeekly = isPeriodik && book?.periodConfig?.tipe === "WEEKLY";
  const isPeriodikSession =
    isPeriodik && book?.periodConfig?.tipe === "SESSION";
  const standardBooks = useMemo(
    () =>
      books.filter(
        (b) => (b.tipe ?? "STANDARD") !== "PERIODIK" && b.id !== kasId,
      ),
    [books, kasId],
  );
  const [transferVisible, setTransferVisible] = useState(false);
  const [transferTarget, setTransferTarget] = useState<{ monthIndex?: number; roundIndex?: number; cat: string; amount: number } | null>(null);
  const [transferDestId, setTransferDestId] = useState('');
  const [transferMode, setTransferMode] = useState<'book' | 'member'>('book');
  const [selectedAnggota, setSelectedAnggota] = useState<Set<string>>(new Set());

  // Success modal
  const [successVisible, setSuccessVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Info modal — klik nominal yang sudah ditransfer
  const [infoVisible, setInfoVisible] = useState(false);
  const [infoTarget, setInfoTarget] = useState<{
    cat: string; amount: number; dest: string; isMember: boolean;
    periodId: string; monthIndex?: number; roundIndex?: number;
    members?: string[];
  } | null>(null);

  // ── SESSION: state navigasi sesi (harus sebelum filteredTxs) ──
  const sessions = useMemo(() => {
    if (!isPeriodikSession)
      return [] as Array<{ id: string; nama: string; order: number }>;
    const raw = book?.periodConfig?.sessions ?? [];
    return [...raw].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  }, [book?.periodConfig?.sessions, isPeriodikSession]);

  const [selectedSessionIdx, setSelectedSessionIdx] = useState(0);
  const selectedSession = sessions[selectedSessionIdx] ?? sessions[0] ?? null;

  const isTransferTx = (tx: any) =>
    typeof tx?.periodikData?.memberId === "string" &&
    tx.periodikData.memberId.startsWith("__TRANSFER");

  const filteredTxs = useMemo(() => {
    if (isPeriodikSession) {
      // Hanya txs untuk sesi yang dipilih (periodId = S:{sessionId}:...)
      if (!selectedSession) return txsActive;
      return txsActive.filter((tx) => {
        const pid = tx.periodikData?.periodId ?? "";
        return pid.startsWith(`S:${selectedSession.id}:`);
      });
    }
    const selYear = Number(selectedYear);
    const selMonth = selectedMonth === "ALL" ? "ALL" : Number(selectedMonth);
    return txsActive.filter((tx) => {
      let txYear: number, txMonth: number;
      if (tx.periodikData?.periodId) {
        const pid = tx.periodikData.periodId;
        if (pid.startsWith("S:")) return true;
        txYear = parseInt(pid.substring(0, 4));
        const monthPart = pid.split("-")[1];
        txMonth = monthPart ? parseInt(monthPart.replace("W", "")) : 1;
      } else {
        const [y, m] = tx.tanggalISO.split("-").map(Number);
        txYear = y;
        txMonth = m;
      }
      if (txYear !== selYear) return false;
      if (isPeriodik) return true;
      return selMonth === "ALL" || txMonth === (selMonth as number) + 1;
    });
  }, [
    isPeriodik,
    isPeriodikSession,
    selectedMonth,
    selectedYear,
    selectedSession,
    txsActive,
  ]);

  const filteredTxsNoTransfer = useMemo(() => {
    if (!isPeriodik) return filteredTxs;
    return filteredTxs.filter((tx) => !isTransferTx(tx));
  }, [filteredTxs, isPeriodik]);

  // Ringkasan tetap mengikuti transaksi yang benar-benar tercatat (termasuk transfer),
  // supaya Pengeluaran pada card tidak jadi 0 setelah transfer.
  const summary = useMemo(() => computeSaldo(filteredTxs), [filteredTxs]);
  const totalSummary = useMemo(() => computeSaldo(txsActive), [txsActive]);

  const changeMonth = (delta: number) => {
    if (selectedMonth === "ALL") {
      setSelectedYear((p) => p + delta);
      return;
    }
    let next = (selectedMonth as number) + delta;
    let yr = selectedYear;
    if (next > 11) {
      next = 0;
      yr += 1;
    } else if (next < 0) {
      next = 11;
      yr -= 1;
    }
    setSelectedMonth(next);
    setSelectedYear(yr);
  };

  const categorySummary = useMemo(() => {
    const cats: Record<string, { masuk: number; keluar: number }> = {};
    filteredTxsNoTransfer.forEach((tx) => {
      const cat = tx.kategori || "Tanpa Kategori";
      if (!cats[cat]) cats[cat] = { masuk: 0, keluar: 0 };
      if (tx.jenis === "MASUK") cats[cat].masuk += tx.nominal;
      else cats[cat].keluar += tx.nominal;
    });
    return Object.entries(cats).sort(
      (a, b) => b[1].masuk + b[1].keluar - (a[1].masuk + a[1].keluar),
    );
  }, [filteredTxsNoTransfer]);

  const monthlyCategorySummary = useMemo(() => {
    if (!isPeriodik || isPeriodikSession)
      return [] as Array<{
        monthIndex: number;
        totalMasuk: number;
        totalKeluar: number;
        categories: Array<[string, { masuk: number; keluar: number }]>;
        transferred: Record<string, boolean>;
        transferredTo: Record<string, string>;
      }>;
    const buckets: Array<Record<string, { masuk: number; keluar: number }>> =
      Array.from({ length: 12 }, () => ({}));
    const totals: Array<{ masuk: number; keluar: number }> = Array.from(
      { length: 12 },
      () => ({ masuk: 0, keluar: 0 }),
    );
    const transferred: Array<Record<string, boolean>> = Array.from(
      { length: 12 },
      () => ({}),
    );
    const transferredTo: Array<Record<string, string>> = Array.from(
      { length: 12 },
      () => ({}),
    );

    filteredTxsNoTransfer.forEach((tx) => {
      let mi: number | null = null;
      if (tx.periodikData?.periodId) {
        const mp = tx.periodikData.periodId.split("-")[1];
        if (mp && !mp.startsWith("W")) {
          const m = Number(mp);
          if (!isNaN(m) && m >= 1 && m <= 12) mi = m - 1;
        }
      }
      if (mi === null) {
        const p = tx.tanggalISO?.split("-");
        if (p?.length >= 2) {
          const m = Number(p[1]);
          if (!isNaN(m) && m >= 1 && m <= 12) mi = m - 1;
        }
      }
      if (mi === null) return;
      const cat = tx.kategori || "Tanpa Kategori";
      if (!buckets[mi][cat]) buckets[mi][cat] = { masuk: 0, keluar: 0 };
      if (tx.jenis === "MASUK") {
        buckets[mi][cat].masuk += tx.nominal;
        totals[mi].masuk += tx.nominal;
      } else {
        buckets[mi][cat].keluar += tx.nominal;
        totals[mi].keluar += tx.nominal;
      }
    });

    const transferCount: Array<
      Record<string, { out: number; ret: number; to?: string; toMember?: boolean }>
    > = Array.from({ length: 12 }, () => ({}));
    const bookNameById = new Map(books.map((b) => [b.id, b.nama]));
    filteredTxs.forEach((tx) => {
      const pd = tx.periodikData;
      if (!pd?.periodId) return;
      const mp = pd.periodId.split("-")[1];
      if (!mp || mp.startsWith("W")) return;
      const monthNum = Number(mp);
      if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) return;
      const mi = monthNum - 1;
      const cat = tx.kategori || pd.categoryId || "Tanpa Kategori";
      const rec = transferCount[mi][cat] ?? { out: 0, ret: 0 };
      if (
        tx.jenis === "KELUAR" &&
        typeof pd.memberId === "string" &&
        pd.memberId.startsWith("__TRANSFER__")
      ) {
        rec.out++;
        if (!rec.to) {
          const parts = pd.memberId.split(":");
          if (parts.length >= 2) {
            if (parts[1] === 'member') {
              rec.to = 'Anggota';
              rec.toMember = true;
            } else {
              const nm = bookNameById.get(parts[1]);
              if (nm) rec.to = nm;
            }
          }
          if (!rec.to && typeof tx.deskripsi === "string") {
            const m = /^Transfer ke (.+)$/i.exec(tx.deskripsi.trim());
            if (m?.[1]) rec.to = m[1].trim();
          }
        }
      }
      if (
        tx.jenis === "MASUK" &&
        typeof pd.memberId === "string" &&
        pd.memberId.startsWith("__TRANSFER_RETURN_IN__")
      )
        rec.ret++;
      transferCount[mi][cat] = rec;
    });
    const transferredToMember: Array<Record<string, boolean>> = Array.from(
      { length: 12 },
      () => ({}),
    );
    transferCount.forEach((mrec, mi) => {
      Object.entries(mrec).forEach(([cat, v]) => {
        if (v.out > v.ret) {
          transferred[mi][cat] = true;
          if (v.to) transferredTo[mi][cat] = v.to;
          if (v.toMember) transferredToMember[mi][cat] = true;
        }
      });
    });

    return buckets
      .map((b, i) => ({
        monthIndex: i,
        totalMasuk: totals[i].masuk,
        totalKeluar: totals[i].keluar,
        categories: Object.entries(b).sort(
          (a, b) => b[1].masuk + b[1].keluar - (a[1].masuk + a[1].keluar),
        ),
        transferred: transferred[i],
        transferredTo: transferredTo[i],
        transferredToMember: transferredToMember[i],
      }))
      .filter((m) => m.categories.length > 0);
  }, [
    books,
    filteredTxs,
    filteredTxsNoTransfer,
    isPeriodik,
    isPeriodikSession,
  ]);

  // Pivot: kategori jadi kolom, bulan jadi baris
  const pivotData = useMemo(() => {
    if (!isPeriodik || monthlyCategorySummary.length === 0) return null;
    // Kumpulkan semua kategori unik (urut berdasarkan total terbesar)
    const catTotals: Record<string, number> = {};
    monthlyCategorySummary.forEach((m) => {
      m.categories.forEach(([cat, val]) => {
        catTotals[cat] = (catTotals[cat] ?? 0) + val.masuk;
      });
    });
    const allCats = Object.keys(catTotals).sort(
      (a, b) => catTotals[b] - catTotals[a],
    );
    // Baris = bulan yang ada data
    const rows = monthlyCategorySummary.map((m) => {
      const bycat: Record<
        string,
        { masuk: number; transferred: boolean; transferredTo: string }
      > = {};
      m.categories.forEach(([cat, val]) => {
        bycat[cat] = {
          masuk: val.masuk,
          transferred: !!m.transferred?.[cat],
          transferredTo: m.transferredTo?.[cat] ?? "",
          transferredToMember: !!m.transferredToMember?.[cat],
        };
      });
      // totalMasuk hanya dari kategori yang belum ditransfer
      const totalMasukAktif = m.categories.reduce((sum, [cat, val]) => {
        return sum + (m.transferred?.[cat] ? 0 : val.masuk);
      }, 0);
      return { monthIndex: m.monthIndex, totalMasuk: totalMasukAktif, bycat };
    });
    return { allCats, rows };
  }, [isPeriodik, monthlyCategorySummary]);

  const sessionPivotData = useMemo(() => {
    if (!isPeriodikSession || !selectedSession) return null;
    const sessByCat: Record<string, { masuk: number; keluar: number }> = {};
    const putaranCount = (selectedSession as any).putaranCount || 1;

    // Data per putaran: [putaranIndex][category] = nominal
    const roundRows: Array<Record<string, number>> = Array.from(
      { length: putaranCount },
      () => ({}),
    );
    const roundTotals: number[] = Array.from({ length: putaranCount }, () => 0);
    const roundTransferred: Array<Record<string, boolean>> = Array.from(
      { length: putaranCount },
      () => ({}),
    );
    const roundTransferredTo: Array<Record<string, string>> = Array.from(
      { length: putaranCount },
      () => ({}),
    );
    const roundTransferredToMember: Array<Record<string, boolean>> = Array.from(
      { length: putaranCount },
      () => ({}),
    );
    // Track members yang sudah ditransfer per round per category
    const roundTransferredMembers: Array<Record<string, string[]>> = Array.from(
      { length: putaranCount },
      () => ({}),
    );

    filteredTxsNoTransfer.forEach((tx) => {
      const pid = tx.periodikData?.periodId ?? "";
      if (!pid.startsWith("S:")) return;
      const parts = pid.split(":"); // ['S', sessionId, 'R1']
      if (parts[1] !== selectedSession.id) return;

      const cat = tx.kategori || "Tanpa Kategori";
      if (!sessByCat[cat]) sessByCat[cat] = { masuk: 0, keluar: 0 };

      if (tx.jenis === "MASUK") {
        sessByCat[cat].masuk += tx.nominal;

        // Extract round number
        const rPart = parts[2]; // 'R1'
        if (rPart && rPart.startsWith("R")) {
          const rNum = parseInt(rPart.substring(1), 10);
          if (!isNaN(rNum) && rNum >= 1 && rNum <= putaranCount) {
            const rIdx = rNum - 1;
            roundRows[rIdx][cat] = (roundRows[rIdx][cat] ?? 0) + tx.nominal;
            roundTotals[rIdx] += tx.nominal;
          }
        }
      } else sessByCat[cat].keluar += tx.nominal;
    });

    // Hitung transfer untuk sesi ini
    const bookNameById = new Map(books.map((b) => [b.id, b.nama]));
    filteredTxs.forEach((tx) => {
      const pd = tx.periodikData;
      if (!pd?.periodId?.startsWith("S:")) return;
      const parts = pd.periodId.split(":");
      if (parts[1] !== selectedSession.id) return;
      const rPart = parts[2]; // 'R1'
      if (!rPart || !rPart.startsWith("R")) return;
      const rNum = parseInt(rPart.substring(1), 10);
      if (isNaN(rNum) || rNum < 1 || rNum > putaranCount) return;
      const rIdx = rNum - 1;

      const cat = tx.kategori || pd.categoryId || 'Tanpa Kategori';
      if (tx.jenis === 'KELUAR' && typeof pd.memberId === 'string' && pd.memberId.startsWith('__TRANSFER__')) {
        roundTransferred[rIdx][cat] = true;
        const partsM = pd.memberId.split(':');
        if (partsM.length >= 2) {
          if (partsM[1] === 'member') {
            roundTransferredTo[rIdx][cat] = 'Anggota';
            roundTransferredToMember[rIdx][cat] = true;
            // Cari tx MASUK yang terkait untuk dapat nama anggota
            filteredTxs.forEach((mTx) => {
              const mPd = mTx.periodikData;
              if (mTx.jenis === 'MASUK' && mPd?.periodId === pd.periodId && mPd?.categoryId === cat && typeof mPd.memberId === 'string' && mPd.memberId.startsWith('__TRANSFER_MEMBER__:')) {
                const memberName = mPd.memberId.replace('__TRANSFER_MEMBER__:', '');
                if (!roundTransferredMembers[rIdx][cat]) roundTransferredMembers[rIdx][cat] = [];
                if (!roundTransferredMembers[rIdx][cat].includes(memberName)) {
                  roundTransferredMembers[rIdx][cat].push(memberName);
                }
              }
            });
          } else {
            const nm = bookNameById.get(partsM[1]);
            if (nm) roundTransferredTo[rIdx][cat] = nm;
          }
        }
      }
    });

    const allCats = Object.keys(sessByCat).sort(
      (a, b) => sessByCat[b].masuk - sessByCat[a].masuk,
    );
    if (allCats.length === 0) return null;

    const bycat: Record<string, { masuk: number }> = {};
    allCats.forEach((cat) => {
      bycat[cat] = { masuk: sessByCat[cat].masuk };
    });
    const totalMasuk = allCats.reduce(
      (sum, cat) => sum + sessByCat[cat].masuk,
      0,
    );

    return {
      allCats,
      bycat,
      totalMasuk,
      roundRows,
      roundTotals,
      roundTransferred,
      roundTransferredTo,
      roundTransferredToMember,
      roundTransferredMembers,
      putaranCount,
    };
  }, [
    books,
    isPeriodikSession,
    selectedSession,
    filteredTxs,
    filteredTxsNoTransfer,
  ]);

  const totalVolume = summary.masuk + summary.keluar;
  const masukPercent =
    totalVolume > 0 ? (summary.masuk / totalVolume) * 100 : 0;
  const keluarPercent =
    totalVolume > 0 ? (summary.keluar / totalVolume) * 100 : 0;

  // Total per kategori untuk card ringkasan — reuse data dari pivot/categorySummary
  const ringkasanKategori = useMemo(() => {
    if (isPeriodikSession && sessionPivotData) {
      return sessionPivotData.allCats
        .map((cat) => ({
          cat,
          total: sessionPivotData.bycat[cat]?.masuk ?? 0,
        }))
        .filter((x) => x.total > 0);
    }
    if (isPeriodik && pivotData) {
      return pivotData.allCats
        .map((cat) => ({
          cat,
          total: pivotData.rows.reduce(
            (sum, r) =>
              sum +
              (r.bycat[cat] && !r.bycat[cat].transferred
                ? r.bycat[cat].masuk
                : 0),
            0,
          ),
        }))
        .filter((x) => x.total > 0);
    }
    return categorySummary
      .map(([cat, val]) => ({ cat, total: val.masuk }))
      .filter((x) => x.total > 0);
  }, [
    isPeriodik,
    isPeriodikSession,
    pivotData,
    sessionPivotData,
    categorySummary,
  ]);

  // Lebar area scroll pivot (diukur saat render)
  const STICKY_COL_W = 46;
  const MIN_COL_W = 100; // lebar minimum per kolom agar nominal tidak terpotong
  const [pivotScrollWidth, setPivotScrollWidth] = useState(0);
  const onPivotLayout = useCallback((e: any) => {
    setPivotScrollWidth(e.nativeEvent.layout.width - STICKY_COL_W);
  }, []);

  // Hitung lebar kolom: isi penuh kalau muat, pakai minWidth kalau tidak
  const pivotColWidth = useMemo(() => {
    const activePivotData = isPeriodikSession ? sessionPivotData : pivotData;
    if (!activePivotData || pivotScrollWidth <= 0) return MIN_COL_W;
    const totalCols = activePivotData.allCats.length + 1; // +1 untuk kolom Total
    const natural = Math.floor(pivotScrollWidth / totalCols);
    return Math.max(natural, MIN_COL_W);
  }, [isPeriodikSession, sessionPivotData, pivotData, pivotScrollWidth]);

  // Sync scroll vertical antara kolom sticky dan data scrollable
  const leftVerticalScrollRef = useRef<ScrollView>(null);
  const rightVerticalScrollRef = useRef<ScrollView>(null);
  const isSyncingVertical = useRef(false);

  const onVerticalScroll = useCallback((e: any, source: "left" | "right") => {
    if (isSyncingVertical.current) return;
    isSyncingVertical.current = true;
    const y = e.nativeEvent.contentOffset.y;
    if (source === "left") {
      rightVerticalScrollRef.current?.scrollTo({ y, animated: false });
    } else {
      leftVerticalScrollRef.current?.scrollTo({ y, animated: false });
    }
    isSyncingVertical.current = false;
  }, []);

  const openTransfer = (
    monthIndex: number | undefined,
    roundIndex: number | undefined,
    cat: string,
    amount: number,
  ) => {
    if (!isSuperAdmin) return;
    if (!isPeriodik) return;
    if (amount <= 0) return;
    if (standardBooks.length === 0) {
      Alert.alert('Tidak Ada Tujuan', 'Buat buku kas Standard dulu untuk menerima transfer.');
      return;
    }
    setTransferTarget({ monthIndex, roundIndex, cat, amount });
    setTransferDestId(standardBooks[0].id);
    setTransferVisible(true);
  };

  const closeTransfer = () => {
    setTransferVisible(false);
    setTransferTarget(null);
    setTransferDestId('');
    setTransferMode('book');
    setSelectedAnggota(new Set());
  };

  const openInfo = (
    cat: string, amount: number, dest: string, isMember: boolean,
    monthIndex?: number, roundIndex?: number, members?: string[],
  ) => {
    let periodId = '';
    if (isPeriodikSession && selectedSession && roundIndex !== undefined) {
      periodId = `S:${selectedSession.id}:R${roundIndex + 1}`;
    } else if (monthIndex !== undefined) {
      periodId = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    }
    setInfoTarget({ cat, amount, dest, isMember, periodId, monthIndex, roundIndex, members });
    setInfoVisible(true);
  };

  const onReturnMemberTransfer = async () => {
    if (!infoTarget) return;
    const { cat, amount, periodId } = infoTarget;
    try {
      // Cari tx KELUAR __TRANSFER__:member
      const outTx = txsActive.find(t =>
        t.jenis === 'KELUAR' &&
        t.kategori === cat &&
        t.nominal === amount &&
        t.periodikData?.periodId === periodId &&
        typeof t.periodikData?.memberId === 'string' &&
        t.periodikData.memberId === '__TRANSFER__:member',
      );
      // Cari semua tx catatan anggota __TRANSFER_MEMBER__
      const memberTxs = txsActive.filter(t =>
        t.periodikData?.periodId === periodId &&
        t.periodikData?.categoryId === cat &&
        typeof t.periodikData?.memberId === 'string' &&
        t.periodikData.memberId.startsWith('__TRANSFER_MEMBER__'),
      );

      if (outTx) await deleteTx(outTx.id);
      for (const tx of memberTxs) await deleteTx(tx.id);

      // Reset flag transferred
      const now = new Date();
      const tanggal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const base = `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const ts = Date.now();
      await upsertTx({
        id: `${base}_ret_in`,
        kasId,
        tanggalISO: tanggal,
        jenis: 'MASUK',
        kategori: cat,
        deskripsi: 'Dana dikembalikan dari anggota',
        nominal: 0,
        periodikData: {
          memberId: `__TRANSFER_RETURN_IN__:member`,
          periodId,
          categoryId: cat,
          count: 1,
          isTidakSetor: false,
        },
        createdAt: ts,
        updatedAt: ts,
      });

      setInfoVisible(false);
      setInfoTarget(null);
      setSuccessMessage('Transfer ke anggota berhasil dibatalkan.');
      setSuccessVisible(true);
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Terjadi kesalahan.');
    }
  };

  const onConfirmTransfer = async () => {
    if (!transferTarget) return;
    const { monthIndex, roundIndex, cat, amount } = transferTarget;

    let periodId = "";
    let deskripsiBase = "";
    if (isPeriodikSession && selectedSession && roundIndex !== undefined) {
      periodId = `S:${selectedSession.id}:R${roundIndex + 1}`;
      deskripsiBase = `${cat} (${selectedSession.nama} · P${roundIndex + 1})`;
    } else if (monthIndex !== undefined) {
      const mm = String(monthIndex + 1).padStart(2, "0");
      periodId = `${selectedYear}-${mm}`;
      deskripsiBase = `${cat} (${MONTHS[monthIndex]} ${selectedYear})`;
    }

    const now = new Date();
    const tanggal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const base = `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      const ts = Date.now();

      if (transferMode === 'member') {
        // ── Mode anggota: bagi rata ke anggota yang dipilih ──
        const anggotaList = Array.from(selectedAnggota);
        if (anggotaList.length === 0) {
          Alert.alert('Pilih Anggota', 'Pilih minimal satu anggota.');
          return;
        }
        const perAnggota = Math.floor(amount / anggotaList.length);
        const sisa = amount - perAnggota * anggotaList.length;

        // Tx KELUAR di kas periodik (satu tx untuk total)
        await upsertTx({
          id: `${base}_out`,
          kasId,
          tanggalISO: tanggal,
          jenis: 'KELUAR',
          kategori: cat,
          deskripsi: `Transfer ke ${anggotaList.length} anggota`,
          nominal: amount,
          periodikData: {
            memberId: `__TRANSFER__:member`,
            periodId,
            categoryId: cat,
            count: 1,
            isTidakSetor: false,
          },
          createdAt: ts,
          updatedAt: ts,
        });

        // Tx MASUK per anggota di kas standard tujuan (jika ada) atau catat sebagai catatan
        for (let i = 0; i < anggotaList.length; i++) {
          const nama = anggotaList[i];
          const nominal = perAnggota + (i === 0 ? sisa : 0); // sisa ke anggota pertama
          await upsertTx({
            id: `${base}_in_${i}`,
            kasId,
            tanggalISO: tanggal,
            jenis: 'MASUK',
            kategori: cat,
            deskripsi: `Bagian ${nama}: ${formatRupiah(nominal)}`,
            nominal: 0, // nominal 0 agar saldo tidak berubah, hanya catatan
            periodikData: {
              memberId: `__TRANSFER_MEMBER__:${nama}`,
              periodId,
              categoryId: cat,
              count: 1,
              isTidakSetor: false,
            },
            createdAt: ts + i,
            updatedAt: ts + i,
          });
        }

        closeTransfer();
        setSuccessMessage(
          `${formatRupiah(amount)} berhasil dibagi ke ${anggotaList.length} anggota\n(${formatRupiah(perAnggota)}/orang${sisa > 0 ? `, sisa ${formatRupiah(sisa)} ke ${anggotaList[0]}` : ''})`,
        );
        setSuccessVisible(true);
      } else {
        // ── Mode buku standard ──
        const dest = standardBooks.find((b) => b.id === transferDestId);
        if (!dest) return;

        await upsertTx({
          id: `${base}_out`,
          kasId,
          tanggalISO: tanggal,
          jenis: "KELUAR",
          kategori: cat,
          deskripsi: `Transfer ke ${dest.nama}`,
          nominal: amount,
          periodikData: {
            memberId: `__TRANSFER__:${dest.id}`,
            periodId,
            categoryId: cat,
            count: 1,
            isTidakSetor: false,
          },
          createdAt: ts,
          updatedAt: ts,
        });
        await upsertTx({
          id: `${base}_in`,
          kasId: dest.id,
          tanggalISO: tanggal,
          jenis: "MASUK",
          kategori: cat,
          deskripsi: deskripsiBase,
          nominal: amount,
          periodikData: {
            memberId: `__TRANSFER_IN__:${kasId}`,
            periodId,
            categoryId: cat,
            count: 1,
            isTidakSetor: false,
          },
          createdAt: ts,
          updatedAt: ts,
        });
        closeTransfer();
        router.push({
          pathname: "/kas-detail/[id]",
          params: {
            id: dest.id,
            defaultYear: String(now.getFullYear()),
            defaultMonth: String(now.getMonth() + 1),
          },
        });
      }
    } catch (e: any) {
      Alert.alert("Gagal Transfer", e?.message ?? "Terjadi kesalahan.");
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor }]} edges={["top"]}>
      {/* Back button */}
      <View style={[s.backRow, { borderBottomColor: borderColor }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={tintColor} />
          <ThemedText style={{ color: tintColor, fontSize: 16 }}>
            Kembali
          </ThemedText>
        </Pressable>
        <ThemedText
          type="defaultSemiBold"
          style={s.headerTitle}
          numberOfLines={1}
        >
          Laporan Keuangan
        </ThemedText>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.pageHeader}>
          <ThemedText
            type="defaultSemiBold"
            style={{ textAlign: "center", fontSize: 18, fontWeight: "700" }}
          >
            {book?.nama ?? ""}
          </ThemedText>
        </View>

        <View style={s.headerPadding}>
          <ThemedView type="card" style={s.totalCard}>
            <ThemedText type="defaultSemiBold" style={s.totalCardTitle}>
              {isPeriodikSession
                ? "Total Semua Sesi"
                : "Total Keseluruhan Semua Tahun"}
            </ThemedText>
            <View style={s.totalCardRow}>
              <View style={s.totalCardItem}>
                <ThemedText
                  type="small"
                  style={{ opacity: 0.7, marginBottom: 4 }}
                >
                  Saldo
                </ThemedText>
                <ThemedText type="defaultSemiBold" style={{ color: tintColor }}>
                  {formatRupiah(totalSummary.saldo)}
                </ThemedText>
              </View>
              <View style={s.totalCardItem}>
                <ThemedText
                  type="small"
                  style={{ opacity: 0.7, marginBottom: 4 }}
                >
                  Pemasukan
                </ThemedText>
                <ThemedText
                  type="defaultSemiBold"
                  style={{ color: successColor }}
                >
                  {formatRupiah(totalSummary.masuk)}
                </ThemedText>
              </View>
              <View style={s.totalCardItem}>
                <ThemedText
                  type="small"
                  style={{ opacity: 0.7, marginBottom: 4 }}
                >
                  Pengeluaran
                </ThemedText>
                <ThemedText
                  type="defaultSemiBold"
                  style={{ color: dangerColor }}
                >
                  {formatRupiah(totalSummary.keluar)}
                </ThemedText>
              </View>
            </View>
          </ThemedView>

          {isPeriodikSession ? (
            <View style={[s.monthNav, { borderColor }]}>
              <Pressable
                onPress={() => setSelectedSessionIdx((i) => Math.max(0, i - 1))}
                style={[s.navBtn, selectedSessionIdx <= 0 && { opacity: 0.3 }]}
                disabled={selectedSessionIdx <= 0}
              >
                <Ionicons name="chevron-back" size={20} color={tintColor} />
              </Pressable>
              <View style={s.monthInfo}>
                <ThemedText type="defaultSemiBold" style={s.monthText}>
                  {selectedSession?.nama ?? "Pilih Sesi"}
                </ThemedText>
              </View>
              <Pressable
                onPress={() =>
                  setSelectedSessionIdx((i) =>
                    Math.min(sessions.length - 1, i + 1),
                  )
                }
                style={[
                  s.navBtn,
                  selectedSessionIdx >= sessions.length - 1 && { opacity: 0.3 },
                ]}
                disabled={selectedSessionIdx >= sessions.length - 1}
              >
                <Ionicons name="chevron-forward" size={20} color={tintColor} />
              </Pressable>
            </View>
          ) : (
            !isPeriodikSession && (
              <View style={[s.monthNav, { borderColor }]}>
                <Pressable
                  onPress={() =>
                    isPeriodikMonthly || isPeriodikWeekly
                      ? setSelectedYear((p) => p - 1)
                      : changeMonth(-1)
                  }
                  style={s.navBtn}
                >
                  <Ionicons name="chevron-back" size={20} color={tintColor} />
                </Pressable>
                <Pressable
                  onPress={() => setIsPickerVisible(true)}
                  style={s.monthInfo}
                >
                  <ThemedText type="defaultSemiBold" style={s.monthText}>
                    {isPeriodikMonthly || isPeriodikWeekly
                      ? `Tahun ${selectedYear}`
                      : (selectedMonth === "ALL"
                          ? "Semua Bulan"
                          : MONTHS[selectedMonth as number]) +
                        ` ${selectedYear}`}
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() =>
                    isPeriodikMonthly || isPeriodikWeekly
                      ? setSelectedYear((p) => p + 1)
                      : changeMonth(1)
                  }
                  style={s.navBtn}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={tintColor}
                  />
                </Pressable>
              </View>
            )
          )}
        </View>

        <ThemedView type="card" style={s.mainCard}>
          <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>
            Ringkasan{" "}
            {isPeriodikSession
              ? (selectedSession?.nama ?? "Sesi")
              : isPeriodik
                ? `Tahun ${selectedYear}`
                : selectedMonth === "ALL"
                  ? `Tahun ${selectedYear}`
                  : `${MONTHS[selectedMonth as number]} ${selectedYear}`}
          </ThemedText>
          <View style={s.progressContainer}>
            <View
              style={[
                s.progressBar,
                { backgroundColor: successColor, width: `${masukPercent}%` },
              ]}
            />
            <View
              style={[
                s.progressBar,
                { backgroundColor: dangerColor, width: `${keluarPercent}%` },
              ]}
            />
          </View>
          <View style={s.legend}>
            <View style={s.legendItem}>
              <View style={[s.dot, { backgroundColor: successColor }]} />
              <ThemedText type="small">
                Masuk ({masukPercent.toFixed(0)}%)
              </ThemedText>
            </View>
            <View style={s.legendItem}>
              <View style={[s.dot, { backgroundColor: dangerColor }]} />
              <ThemedText type="small">
                Keluar ({keluarPercent.toFixed(0)}%)
              </ThemedText>
            </View>
          </View>
          <View style={[s.divider, { backgroundColor: borderColor }]} />
          {ringkasanKategori.length > 0 && (
            <>
              {ringkasanKategori.map(({ cat, total }) => (
                <View key={cat} style={s.balanceRow}>
                  <ThemedText type="small" style={{ opacity: 0.8 }}>
                    {cat}
                  </ThemedText>
                  <ThemedText
                    type="defaultSemiBold"
                    style={{ color: successColor, fontSize: 13 }}
                  >
                    {formatRupiah(total)}
                  </ThemedText>
                </View>
              ))}
              <View style={[s.divider, { backgroundColor: borderColor }]} />
            </>
          )}
          <View style={s.balanceRow}>
            <ThemedText type="small" style={{ opacity: 0.8 }}>
              Total Kas Masuk
            </ThemedText>
            <ThemedText type="defaultSemiBold" style={{ color: successColor }}>
              {formatRupiah(summary.masuk)}
            </ThemedText>
          </View>
          <View style={s.balanceRow}>
            <ThemedText type="small" style={{ opacity: 0.8 }}>
              Total Pengeluaran
            </ThemedText>
            <ThemedText type="defaultSemiBold" style={{ color: dangerColor }}>
              {formatRupiah(summary.keluar)}
            </ThemedText>
          </View>
          <View style={[s.divider, { backgroundColor: borderColor }]} />
          <View style={s.balanceRow}>
            <ThemedText type="subtitle">Saldo Akhir</ThemedText>
            <ThemedText type="subtitle" style={{ color: successColor }}>
              {formatRupiah(summary.masuk - summary.keluar)}
            </ThemedText>
          </View>
        </ThemedView>

        <ThemedView style={s.section}>
          <ThemedText type="defaultSemiBold" style={s.sectionTitle}>
            Tabel Detail
          </ThemedText>

          {isPeriodikSession ? (
            !sessionPivotData ? (
              <ThemedView type="card" style={s.emptyCard}>
                <ThemedText type="muted">
                  Belum ada data untuk sesi ini
                </ThemedText>
              </ThemedView>
            ) : (
              <ThemedView
                type="card"
                style={[s.pivotCard, { flexDirection: "row" }]}
              >
                <View
                  onLayout={onPivotLayout}
                  style={{ flex: 1, flexDirection: "row" }}
                >
                  {/* Left Column (Sticky) */}
                  <View
                    style={{
                      width: STICKY_COL_W,
                      borderRightWidth: 1.5,
                      borderRightColor: borderColor,
                    }}
                  >
                    {/* Header Corner */}
                    <View
                      style={{
                        height: 44,
                        borderBottomWidth: 1,
                        borderBottomColor: borderColor,
                        backgroundColor: "rgba(127,127,127,0.05)",
                      }}
                    />
                    {/* Body Left (Vertical Scroll) */}
                    <ScrollView
                      ref={leftVerticalScrollRef}
                      scrollEnabled={false}
                      showsVerticalScrollIndicator={false}
                      style={{ flex: 1 }}
                    >
                      {sessionPivotData.roundRows.map((_, idx) => (
                        <View
                          key={idx}
                          style={{
                            height: 52,
                            justifyContent: "center",
                            alignItems: "center",
                            borderBottomWidth:
                              idx < sessionPivotData.roundRows.length - 1
                                ? 1
                                : 0,
                            borderBottomColor: borderColor,
                            backgroundColor:
                              idx % 2 === 0
                                ? "rgba(127,127,127,0.04)"
                                : "transparent",
                          }}
                        >
                          <ThemedText
                            type="defaultSemiBold"
                            style={s.pivotMonthText}
                          >
                            P{idx + 1}
                          </ThemedText>
                        </View>
                      ))}
                      {/* Footer Left Corner */}
                      <View
                        style={{
                          height: 44,
                          borderTopWidth: 2,
                          borderTopColor: borderColor,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <ThemedText
                          type="defaultSemiBold"
                          style={[s.pivotMonthText, { fontSize: 10 }]}
                        >
                          TOTAL
                        </ThemedText>
                      </View>
                    </ScrollView>
                  </View>

                  {/* Right Side (Horizontal Scroll) */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={true}
                    style={{ flex: 1 }}
                  >
                    <View>
                      {/* Right Header Row */}
                      <View
                        style={{
                          flexDirection: "row",
                          height: 44,
                          borderBottomWidth: 1,
                          borderBottomColor: borderColor,
                          backgroundColor: "rgba(127,127,127,0.05)",
                        }}
                      >
                        {sessionPivotData.allCats.map((cat) => (
                          <View
                            key={cat}
                            style={[
                              s.pivotColCat,
                              s.pivotHeaderCell,
                              { width: pivotColWidth },
                            ]}
                          >
                            <ThemedText
                              numberOfLines={2}
                              style={[s.pivotHeaderText, { color: mutedColor }]}
                            >
                              {cat}
                            </ThemedText>
                          </View>
                        ))}
                        <View
                          style={[
                            s.pivotColTotal,
                            s.pivotHeaderCell,
                            {
                              borderLeftColor: borderColor,
                              width: pivotColWidth,
                            },
                          ]}
                        >
                          <ThemedText
                            style={[s.pivotHeaderText, { color: mutedColor }]}
                          >
                            Total
                          </ThemedText>
                        </View>
                      </View>

                      {/* Right Body Rows (Vertical Scroll) */}
                      <ScrollView
                        ref={rightVerticalScrollRef}
                        onScroll={(e) => onVerticalScroll(e, "right")}
                        scrollEventThrottle={16}
                        showsVerticalScrollIndicator={true}
                        style={{ flex: 1 }}
                      >
                        {sessionPivotData.roundRows.map((row, idx) => (
                          <View
                            key={idx}
                            style={{
                              flexDirection: "row",
                              height: 52,
                              borderBottomWidth:
                                idx < sessionPivotData.roundRows.length - 1
                                  ? 1
                                  : 0,
                              borderBottomColor: borderColor,
                              backgroundColor:
                                idx % 2 === 0
                                  ? "rgba(127,127,127,0.04)"
                                  : "transparent",
                            }}
                          >
                            {sessionPivotData.allCats.map((cat) => {
                              const masuk = row[cat] ?? 0;
                              const alreadyTransferred =
                                sessionPivotData.roundTransferred[idx][cat];
                              const isMemberTransfer =
                                sessionPivotData.roundTransferredToMember?.[idx]?.[cat] ?? false;
                              const transferDest =
                                sessionPivotData.roundTransferredTo[idx][cat] ?? '';
                              const transferredMembers =
                                sessionPivotData.roundTransferredMembers?.[idx]?.[cat] ?? [];
                              const canTransfer =
                                isSuperAdmin &&
                                !alreadyTransferred &&
                                masuk > 0 &&
                                standardBooks.length > 0;
                              return (
                                <View
                                  key={cat}
                                  style={[
                                    s.pivotColCat,
                                    s.pivotCellContent,
                                    { width: pivotColWidth },
                                  ]}
                                >
                                  {masuk > 0 ? (
                                    <View
                                      style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 4,
                                      }}
                                    >
                                      <Pressable
                                        onPress={() => alreadyTransferred
                                          ? openInfo(cat, masuk, transferDest, isMemberTransfer, undefined, idx, transferredMembers)
                                          : undefined}
                                        disabled={!alreadyTransferred}
                                      >
                                        <ThemedText
                                          style={[
                                            s.pivotCellText,
                                            {
                                              color: alreadyTransferred
                                                ? mutedColor
                                                : successColor,
                                            },
                                            alreadyTransferred && {
                                              textDecorationLine: "line-through",
                                            },
                                          ]}
                                        >
                                          {formatRupiah(masuk)}
                                        </ThemedText>
                                      </Pressable>
                                      {alreadyTransferred && (
                                        <Ionicons
                                          name="checkmark-circle"
                                          size={14}
                                          color={successColor}
                                        />
                                      )}
                                      {canTransfer && (
                                        <Pressable
                                          onPress={() =>
                                            openTransfer(
                                              undefined,
                                              idx,
                                              cat,
                                              masuk,
                                            )
                                          }
                                          style={({ pressed }) => [
                                            s.pivotTransferBtn,
                                            { borderColor: tintColor },
                                            pressed && { opacity: 0.7 },
                                          ]}
                                        >
                                          <Ionicons
                                            name="swap-horizontal"
                                            size={11}
                                            color={tintColor}
                                          />
                                        </Pressable>
                                      )}
                                    </View>
                                  ) : (
                                    <ThemedText
                                      style={[
                                        s.pivotCellText,
                                        { color: mutedColor },
                                      ]}
                                    >
                                      -
                                    </ThemedText>
                                  )}
                                </View>
                              );
                            })}
                            <View
                              style={[
                                s.pivotColTotal,
                                s.pivotCellContent,
                                {
                                  borderLeftColor: borderColor,
                                  width: pivotColWidth,
                                },
                              ]}
                            >
                              <ThemedText
                                type="defaultSemiBold"
                                style={[s.pivotCellText, { color: tintColor }]}
                              >
                                {formatRupiah(
                                  sessionPivotData.roundTotals[idx],
                                )}
                              </ThemedText>
                            </View>
                          </View>
                        ))}

                        {/* Right Footer Row */}
                        <View
                          style={{
                            flexDirection: "row",
                            height: 44,
                            borderTopWidth: 2,
                            borderTopColor: borderColor,
                          }}
                        >
                          {sessionPivotData.allCats.map((cat) => {
                            const total =
                              sessionPivotData.bycat[cat]?.masuk ?? 0;
                            return (
                              <View
                                key={cat}
                                style={[
                                  s.pivotColCat,
                                  s.pivotCellContent,
                                  { width: pivotColWidth },
                                ]}
                              >
                                <ThemedText
                                  type="defaultSemiBold"
                                  style={[
                                    s.pivotCellText,
                                    {
                                      color:
                                        total > 0 ? successColor : mutedColor,
                                    },
                                  ]}
                                >
                                  {total > 0 ? formatRupiah(total) : "-"}
                                </ThemedText>
                              </View>
                            );
                          })}
                          <View
                            style={[
                              s.pivotColTotal,
                              s.pivotCellContent,
                              {
                                borderLeftColor: borderColor,
                                width: pivotColWidth,
                              },
                            ]}
                          >
                            <ThemedText
                              type="defaultSemiBold"
                              style={[s.pivotCellText, { color: tintColor }]}
                            >
                              {formatRupiah(sessionPivotData.totalMasuk)}
                            </ThemedText>
                          </View>
                        </View>
                      </ScrollView>
                    </View>
                  </ScrollView>
                </View>
              </ThemedView>
            )
          ) : isPeriodik ? (
            !pivotData || pivotData.rows.length === 0 ? (
              <ThemedView type="card" style={s.emptyCard}>
                <ThemedText type="muted">Belum ada data kategori</ThemedText>
              </ThemedView>
            ) : (
              <ThemedView
                key={`yearly-pivot-${filteredTxs.length}`}
                type="card"
                style={[s.pivotCard, { flexDirection: "row" }]}
              >
                <View
                  onLayout={onPivotLayout}
                  style={{ flex: 1, flexDirection: "row" }}
                >
                  {/* Left Column (Sticky) */}
                  <View
                    style={{
                      width: STICKY_COL_W,
                      borderRightWidth: 1.5,
                      borderRightColor: borderColor,
                    }}
                  >
                    <View
                      style={{
                        height: 44,
                        borderBottomWidth: 1,
                        borderBottomColor: borderColor,
                        backgroundColor: "rgba(127,127,127,0.05)",
                      }}
                    />
                    <ScrollView
                      ref={leftVerticalScrollRef}
                      scrollEnabled={false}
                      showsVerticalScrollIndicator={false}
                      style={{ flex: 1 }}
                    >
                      {pivotData.rows.map((row, idx) => (
                        <View
                          key={row.monthIndex}
                          style={{
                            height: 52,
                            justifyContent: "center",
                            alignItems: "center",
                            borderBottomWidth:
                              idx < pivotData.rows.length - 1 ? 1 : 0,
                            borderBottomColor: borderColor,
                            backgroundColor:
                              idx % 2 === 0
                                ? "rgba(127,127,127,0.04)"
                                : "transparent",
                          }}
                        >
                          <ThemedText
                            type="defaultSemiBold"
                            style={s.pivotMonthText}
                          >
                            {MONTHS[row.monthIndex].toUpperCase().slice(0, 3)}
                          </ThemedText>
                        </View>
                      ))}
                      <View
                        style={{
                          height: 44,
                          borderTopWidth: 2,
                          borderTopColor: borderColor,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <ThemedText
                          type="defaultSemiBold"
                          style={[s.pivotMonthText, { fontSize: 10 }]}
                        >
                          TOTAL
                        </ThemedText>
                      </View>
                    </ScrollView>
                  </View>

                  {/* Right Side (Horizontal Scroll) */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={true}
                    style={{ flex: 1 }}
                  >
                    <View>
                      {/* Right Header Row */}
                      <View
                        style={{
                          flexDirection: "row",
                          height: 44,
                          borderBottomWidth: 1,
                          borderBottomColor: borderColor,
                          backgroundColor: "rgba(127,127,127,0.05)",
                        }}
                      >
                        {pivotData.allCats.map((cat) => (
                          <View
                            key={cat}
                            style={[
                              s.pivotColCat,
                              s.pivotHeaderCell,
                              { width: pivotColWidth },
                            ]}
                          >
                            <ThemedText
                              numberOfLines={2}
                              style={[s.pivotHeaderText, { color: mutedColor }]}
                            >
                              {cat}
                            </ThemedText>
                          </View>
                        ))}
                        <View
                          style={[
                            s.pivotColTotal,
                            s.pivotHeaderCell,
                            {
                              borderLeftColor: borderColor,
                              width: pivotColWidth,
                            },
                          ]}
                        >
                          <ThemedText
                            style={[s.pivotHeaderText, { color: mutedColor }]}
                          >
                            Total
                          </ThemedText>
                        </View>
                      </View>

                      {/* Right Body Rows (Vertical Scroll) */}
                      <ScrollView
                        ref={rightVerticalScrollRef}
                        onScroll={(e) => onVerticalScroll(e, "right")}
                        scrollEventThrottle={16}
                        showsVerticalScrollIndicator={true}
                        style={{ flex: 1 }}
                      >
                        {pivotData.rows.map((row, idx) => (
                          <View
                            key={row.monthIndex}
                            style={{
                              flexDirection: "row",
                              height: 52,
                              borderBottomWidth:
                                idx < pivotData.rows.length - 1 ? 1 : 0,
                              borderBottomColor: borderColor,
                              backgroundColor:
                                idx % 2 === 0
                                  ? "rgba(127,127,127,0.04)"
                                  : "transparent",
                            }}
                          >
                            {pivotData.allCats.map((cat) => {
                              const cell = row.bycat[cat];
                              const masuk = cell?.masuk ?? 0;
                              const alreadyTransferred =
                                cell?.transferred ?? false;
                              const isMemberTransfer =
                                cell?.transferredToMember ?? false;
                              const transferDest = cell?.transferredTo ?? '';
                              const canTransfer =
                                isSuperAdmin &&
                                !alreadyTransferred &&
                                masuk > 0 &&
                                standardBooks.length > 0;
                              return (
                                <View
                                  key={cat}
                                  style={[
                                    s.pivotColCat,
                                    s.pivotCellContent,
                                    { width: pivotColWidth },
                                  ]}
                                >
                                  {masuk > 0 ? (
                                    <View
                                      style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 4,
                                      }}
                                    >
                                      <Pressable
                                        onPress={() => alreadyTransferred
                                          ? openInfo(cat, masuk, transferDest, isMemberTransfer, row.monthIndex, undefined)
                                          : undefined}
                                        disabled={!alreadyTransferred}
                                      >
                                        <ThemedText
                                          style={[
                                            s.pivotCellText,
                                            {
                                              color: alreadyTransferred
                                                ? mutedColor
                                                : successColor,
                                            },
                                            alreadyTransferred && {
                                              textDecorationLine: "line-through",
                                            },
                                          ]}
                                        >
                                          {formatRupiah(masuk)}
                                        </ThemedText>
                                      </Pressable>
                                      {alreadyTransferred && (
                                        <Ionicons
                                          name="checkmark-circle"
                                          size={14}
                                          color={successColor}
                                        />
                                      )}
                                      {canTransfer && (
                                        <Pressable
                                          onPress={() =>
                                            openTransfer(
                                              row.monthIndex,
                                              undefined,
                                              cat,
                                              masuk,
                                            )
                                          }
                                          style={({ pressed }) => [
                                            s.pivotTransferBtn,
                                            { borderColor: tintColor },
                                            pressed && { opacity: 0.7 },
                                          ]}
                                        >
                                          <Ionicons
                                            name="swap-horizontal"
                                            size={11}
                                            color={tintColor}
                                          />
                                        </Pressable>
                                      )}
                                    </View>
                                  ) : (
                                    <ThemedText
                                      style={[
                                        s.pivotCellText,
                                        { color: mutedColor },
                                      ]}
                                    >
                                      -
                                    </ThemedText>
                                  )}
                                </View>
                              );
                            })}
                            <View
                              style={[
                                s.pivotColTotal,
                                s.pivotCellContent,
                                {
                                  borderLeftColor: borderColor,
                                  width: pivotColWidth,
                                },
                              ]}
                            >
                              <ThemedText
                                type="defaultSemiBold"
                                style={[s.pivotCellText, { color: tintColor }]}
                              >
                                {formatRupiah(row.totalMasuk)}
                              </ThemedText>
                            </View>
                          </View>
                        ))}

                        {/* Right Footer Row */}
                        <View
                          style={{
                            flexDirection: "row",
                            height: 44,
                            borderTopWidth: 2,
                            borderTopColor: borderColor,
                          }}
                        >
                          {pivotData.allCats.map((cat) => {
                            const total = pivotData.rows.reduce(
                              (sum, r) =>
                                sum +
                                (r.bycat[cat] && !r.bycat[cat].transferred
                                  ? r.bycat[cat].masuk
                                  : 0),
                              0,
                            );
                            return (
                              <View
                                key={cat}
                                style={[
                                  s.pivotColCat,
                                  s.pivotCellContent,
                                  { width: pivotColWidth },
                                ]}
                              >
                                <ThemedText
                                  type="defaultSemiBold"
                                  style={[
                                    s.pivotCellText,
                                    {
                                      color:
                                        total > 0 ? successColor : mutedColor,
                                    },
                                  ]}
                                >
                                  {total > 0 ? formatRupiah(total) : "-"}
                                </ThemedText>
                              </View>
                            );
                          })}
                          <View
                            style={[
                              s.pivotColTotal,
                              s.pivotCellContent,
                              {
                                borderLeftColor: borderColor,
                                width: pivotColWidth,
                              },
                            ]}
                          >
                            <ThemedText
                              type="defaultSemiBold"
                              style={[s.pivotCellText, { color: tintColor }]}
                            >
                              {formatRupiah(
                                pivotData.rows.reduce(
                                  (sum, r) => sum + r.totalMasuk,
                                  0,
                                ),
                              )}
                            </ThemedText>
                          </View>
                        </View>
                      </ScrollView>
                    </View>
                  </ScrollView>
                </View>
              </ThemedView>
            )
          ) : categorySummary.length === 0 ? (
            <ThemedView type="card" style={s.emptyCard}>
              <ThemedText type="muted">Belum ada data kategori</ThemedText>
            </ThemedView>
          ) : (
            <ThemedView type="card" style={s.tableCard}>
              {/* Header tabel */}
              <View
                style={[
                  s.tableRow,
                  s.tableHeader,
                  { borderBottomColor: borderColor },
                ]}
              >
                <ThemedText
                  type="small"
                  style={[s.colKategori, s.tableHeaderText]}
                >
                  Kategori
                </ThemedText>
                <ThemedText
                  type="small"
                  style={[s.colMasuk, s.tableHeaderText]}
                >
                  Masuk
                </ThemedText>
                <ThemedText
                  type="small"
                  style={[s.colKeluar, s.tableHeaderText]}
                >
                  Keluar
                </ThemedText>
                <ThemedText type="small" style={[s.colNet, s.tableHeaderText]}>
                  Net
                </ThemedText>
              </View>
              {categorySummary.map(([cat, val], idx) => {
                const net = val.masuk - val.keluar;
                const isEven = idx % 2 === 0;
                return (
                  <View
                    key={cat}
                    style={[
                      s.tableRow,
                      {
                        backgroundColor: isEven
                          ? "rgba(127,127,127,0.03)"
                          : "transparent",
                      },
                    ]}
                  >
                    <ThemedText
                      numberOfLines={2}
                      style={[s.colKategori, { fontSize: 13 }]}
                    >
                      {cat}
                    </ThemedText>
                    <ThemedText
                      style={[
                        s.colMasuk,
                        {
                          fontSize: 13,
                          color: val.masuk > 0 ? successColor : mutedColor,
                        },
                      ]}
                    >
                      {val.masuk > 0 ? formatRupiah(val.masuk) : "-"}
                    </ThemedText>
                    <ThemedText
                      style={[
                        s.colKeluar,
                        {
                          fontSize: 13,
                          color: val.keluar > 0 ? dangerColor : mutedColor,
                        },
                      ]}
                    >
                      {val.keluar > 0 ? formatRupiah(val.keluar) : "-"}
                    </ThemedText>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[
                        s.colNet,
                        {
                          fontSize: 13,
                          color: net >= 0 ? tintColor : dangerColor,
                        },
                      ]}
                    >
                      {formatRupiah(net)}
                    </ThemedText>
                  </View>
                );
              })}
              {(() => {
                const totalMasuk = categorySummary.reduce(
                  (s, [, v]) => s + v.masuk,
                  0,
                );
                const totalKeluar = categorySummary.reduce(
                  (s, [, v]) => s + v.keluar,
                  0,
                );
                return (
                  <View
                    style={[
                      s.tableRow,
                      s.tableFooter,
                      { borderTopColor: borderColor },
                    ]}
                  >
                    <ThemedText
                      type="defaultSemiBold"
                      style={[s.colKategori, { fontSize: 13 }]}
                    >
                      Total
                    </ThemedText>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[
                        s.colMasuk,
                        { fontSize: 13, color: successColor },
                      ]}
                    >
                      {formatRupiah(totalMasuk)}
                    </ThemedText>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[
                        s.colKeluar,
                        { fontSize: 13, color: dangerColor },
                      ]}
                    >
                      {totalKeluar > 0 ? formatRupiah(totalKeluar) : "-"}
                    </ThemedText>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[s.colNet, { fontSize: 13, color: tintColor }]}
                    >
                      {formatRupiah(totalMasuk - totalKeluar)}
                    </ThemedText>
                  </View>
                );
              })()}
            </ThemedView>
          )}
        </ThemedView>

        <Modal visible={isPickerVisible} transparent animationType="fade">
          <Pressable
            style={s.modalOverlay}
            onPress={() => setIsPickerVisible(false)}
          >
            <ThemedView type="card" style={s.pickerModal}>
              <ThemedText type="subtitle" style={{ marginBottom: 16 }}>
                Pilih Periode
              </ThemedText>
              <ThemedText type="defaultSemiBold" style={s.pickerLabel}>
                Tahun
              </ThemedText>
              <View style={s.yearPickerNav}>
                <Pressable
                  onPress={() => setSelectedYear((p) => p - 1)}
                  style={s.yearNavBtn}
                >
                  <Ionicons name="chevron-back" size={20} color={tintColor} />
                </Pressable>
                <ThemedText type="subtitle" style={s.yearDisplayText}>
                  {selectedYear}
                </ThemedText>
                <Pressable
                  onPress={() => setSelectedYear((p) => p + 1)}
                  style={s.yearNavBtn}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={tintColor}
                  />
                </Pressable>
              </View>
              {!isPeriodikMonthly && !isPeriodikWeekly && (
                <>
                  <ThemedText
                    type="defaultSemiBold"
                    style={[s.pickerLabel, { marginTop: 16 }]}
                  >
                    Bulan
                  </ThemedText>
                  <View style={s.pickerGrid}>
                    <Pressable
                      onPress={() => {
                        setSelectedMonth("ALL");
                        setIsPickerVisible(false);
                      }}
                      style={[
                        s.pickerItem,
                        { width: "100%" },
                        selectedMonth === "ALL" && {
                          backgroundColor: tintColor,
                          borderColor: tintColor,
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          s.pickerItemText,
                          selectedMonth === "ALL" && { color: "white" },
                        ]}
                      >
                        Semua Bulan di Tahun {selectedYear}
                      </ThemedText>
                    </Pressable>
                    {MONTHS.map((m, idx) => (
                      <Pressable
                        key={m}
                        onPress={() => {
                          setSelectedMonth(idx);
                          setIsPickerVisible(false);
                        }}
                        style={[
                          s.pickerItem,
                          selectedMonth === idx && {
                            backgroundColor: tintColor,
                            borderColor: tintColor,
                          },
                        ]}
                      >
                        <ThemedText
                          style={[
                            s.pickerItemText,
                            selectedMonth === idx && { color: "white" },
                          ]}
                        >
                          {m.slice(0, 3)}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
              <Pressable
                onPress={() => setIsPickerVisible(false)}
                style={[s.closeBtn, { backgroundColor: tintColor }]}
              >
                <ThemedText style={{ color: "white" }} type="defaultSemiBold">
                  Selesai
                </ThemedText>
              </Pressable>
            </ThemedView>
          </Pressable>
        </Modal>

        {/* Info Modal — klik nominal yang sudah ditransfer */}
        <Modal visible={infoVisible} transparent animationType="fade">
          <Pressable style={s.modalOverlay} onPress={() => { setInfoVisible(false); setInfoTarget(null); }}>
            <ThemedView type="card" style={[s.transferModal, { gap: 16 }]}>
              <Pressable onPress={() => {}} style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tintColor + '18', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="swap-horizontal" size={18} color={tintColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>Info Transfer</ThemedText>
                    <ThemedText type="muted" style={{ fontSize: 12 }}>{infoTarget?.cat}</ThemedText>
                  </View>
                </View>

                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ThemedText type="muted" style={{ fontSize: 13 }}>Jumlah</ThemedText>
                    <ThemedText type="defaultSemiBold" style={{ fontSize: 13, color: tintColor }}>
                      {infoTarget ? formatRupiah(infoTarget.amount) : '-'}
                    </ThemedText>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ThemedText type="muted" style={{ fontSize: 13 }}>Ditransfer ke</ThemedText>
                    <ThemedText type="defaultSemiBold" style={{ fontSize: 13 }}>
                      {infoTarget?.dest || '-'}
                    </ThemedText>
                  </View>
                  {infoTarget?.isMember && infoTarget.members && infoTarget.members.length > 0 && (
                    <View style={{ marginTop: 4 }}>
                      <ThemedText type="muted" style={{ fontSize: 13, marginBottom: 6 }}>
                        Diterima oleh:
                      </ThemedText>
                      <View style={{ gap: 4 }}>
                        {infoTarget.members.map((m, mi) => (
                          <View key={mi} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: tintColor + '08', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                            <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: tintColor + '20', alignItems: 'center', justifyContent: 'center' }}>
                              <Ionicons name="person" size={14} color={tintColor} />
                            </View>
                            <ThemedText style={{ fontSize: 13, flex: 1 }}>{m}</ThemedText>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                <View style={s.transferActions}>
                  <Pressable
                    onPress={() => { setInfoVisible(false); setInfoTarget(null); }}
                    style={({ pressed }) => [s.transferBtnGhost, { borderColor }, pressed && { opacity: 0.8 }]}>
                    <ThemedText type="defaultSemiBold">Tutup</ThemedText>
                  </Pressable>
                  {!!(infoTarget?.isMember && isSuperAdmin) && (
                    <Pressable
                      onPress={onReturnMemberTransfer}
                      style={({ pressed }) => [s.transferBtnGhost, { borderColor: dangerColor }, pressed && { opacity: 0.8 }]}>
                      <Ionicons name="return-down-back-outline" size={16} color={dangerColor} />
                      <ThemedText type="defaultSemiBold" style={{ color: dangerColor }}>Kembalikan</ThemedText>
                    </Pressable>
                  )}
                </View>
              </Pressable>
            </ThemedView>
          </Pressable>
        </Modal>

        <Modal visible={transferVisible} transparent animationType="fade">
          <Pressable style={s.modalOverlay} onPress={closeTransfer}>
            <ThemedView type="card" style={s.transferModal}>
              <Pressable onPress={() => {}} style={{ gap: 12 }}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>Transfer Dana</ThemedText>
                <ThemedText type="muted" style={{ fontSize: 13 }}>
                  {transferTarget ? `${transferTarget.cat} · ${formatRupiah(transferTarget.amount)}` : ''}
                </ThemedText>

                {/* Mode selector */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  {(['book', 'member'] as const).map(m => (
                    <Pressable
                      key={m}
                      onPress={() => setTransferMode(m)}
                      style={[
                        s.transferModeBtn,
                        { borderColor: transferMode === m ? tintColor : borderColor },
                        transferMode === m && { backgroundColor: tintColor + '12' },
                      ]}>
                      <Ionicons
                        name={m === 'book' ? 'journal-outline' : 'people-outline'}
                        size={14}
                        color={transferMode === m ? tintColor : mutedColor}
                      />
                      <ThemedText style={[{ fontSize: 13, fontWeight: '600' }, { color: transferMode === m ? tintColor : mutedColor }]}>
                        {m === 'book' ? 'Ke Buku Kas' : 'Ke Anggota'}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>

                {transferMode === 'book' ? (
                  <View style={s.transferList}>
                    <ScrollView style={{ maxHeight: 220 }}>
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
                              <ThemedText type="small" style={{ opacity: 0.65 }}>Buku Standard</ThemedText>
                            </View>
                            {active && <Ionicons name="checkmark-circle" size={18} color={tintColor} />}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : (
                  <View style={s.transferList}>
                    {/* Info bagi rata */}
                    {selectedAnggota.size > 0 && transferTarget && (
                      <View style={[s.splitInfo, { backgroundColor: tintColor + '10', borderColor: tintColor + '30' }]}>
                        <Ionicons name="calculator-outline" size={13} color={tintColor} />
                        <ThemedText style={{ fontSize: 12, color: tintColor, flex: 1 }}>
                          {`${formatRupiah(transferTarget.amount)} ÷ ${selectedAnggota.size} = ${formatRupiah(Math.floor(transferTarget.amount / selectedAnggota.size))}/orang${transferTarget.amount % selectedAnggota.size > 0 ? ` (sisa ${formatRupiah(transferTarget.amount % selectedAnggota.size)})` : ''}`}
                        </ThemedText>
                      </View>
                    )}
                    <ScrollView style={{ maxHeight: 220 }}>
                      {(() => {
                        // Ambil members: untuk SESSION pakai activeSession.members, fallback ke book.members
                        const sessionMembers = isPeriodikSession
                          ? ((selectedSession as any)?.members ?? book?.members ?? [])
                          : (book?.members ?? []);
                        // Cari anggota yang sudah pernah ditransfer di buku kas ini (semua putaran/bulan)
                        const alreadyTransferredMembers = new Set<string>();
                        if (transferTarget) {
                          const cat = transferTarget.cat;
                          txsActive.forEach((tx) => {
                            const pd = tx.periodikData;
                            if (!pd?.periodId) return;
                            // Untuk SESSION: filter berdasarkan sesi aktif; untuk YEAR: filter berdasarkan tahun aktif
                            if (isPeriodikSession && selectedSession && !pd.periodId.startsWith(`S:${selectedSession.id}:`)) return;
                            if (!isPeriodikSession && !pd.periodId.startsWith(`${selectedYear}-`)) return;
                            if (tx.jenis === 'MASUK' && typeof pd.memberId === 'string' && pd.memberId.startsWith('__TRANSFER_MEMBER__:') && (pd.categoryId === cat || tx.kategori === cat)) {
                              const memberName = pd.memberId.replace('__TRANSFER_MEMBER__:', '');
                              alreadyTransferredMembers.add(memberName);
                            }
                          });
                        }
                        if (sessionMembers.length === 0) {
                          return (
                            <View style={{ padding: 20, alignItems: 'center' }}>
                              <ThemedText type="muted" style={{ fontSize: 13 }}>Belum ada anggota</ThemedText>
                            </View>
                          );
                        }
                        return sessionMembers.map((m: { id: string; nama: string }) => {
                          const checked = selectedAnggota.has(m.nama);
                          const alreadyTransferred = alreadyTransferredMembers.has(m.nama);
                          return (
                            <Pressable
                              key={m.id}
                              onPress={() => {
                                if (alreadyTransferred) return;
                                setSelectedAnggota(prev => {
                                  const next = new Set(prev);
                                  if (next.has(m.nama)) next.delete(m.nama);
                                  else next.add(m.nama);
                                  return next;
                                });
                              }}
                              disabled={alreadyTransferred}
                              style={({ pressed }) => [
                                s.transferItem,
                                { borderColor: alreadyTransferred ? dangerColor + '30' : checked ? tintColor : borderColor },
                                checked && { backgroundColor: tintColor + '12' },
                                alreadyTransferred && { backgroundColor: dangerColor + '06', opacity: 0.5 },
                                pressed && { opacity: alreadyTransferred ? 0.5 : 0.8 },
                              ]}>
                              <View style={[s.memberAvatar, { backgroundColor: alreadyTransferred ? dangerColor + '15' : tintColor + '18' }]}>
                                <Ionicons name={alreadyTransferred ? 'ban' : 'person'} size={14} color={alreadyTransferred ? dangerColor : tintColor} />
                              </View>
                              <ThemedText type="defaultSemiBold" style={{ flex: 1 }} numberOfLines={1}>{m.nama}</ThemedText>
                              {alreadyTransferred ? (
                                <ThemedText type="muted" style={{ fontSize: 10, color: dangerColor }}>Sudah</ThemedText>
                              ) : checked ? (
                                <Ionicons name="checkmark-circle" size={18} color={tintColor} />
                              ) : null}
                            </Pressable>
                          );
                        });
                      })()}
                    </ScrollView>
                  </View>
                )}

                <View style={s.transferActions}>
                  <Pressable
                    onPress={closeTransfer}
                    style={({ pressed }) => [s.transferBtnGhost, { borderColor }, pressed && { opacity: 0.8 }]}>
                    <ThemedText type="defaultSemiBold">Batal</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={onConfirmTransfer}
                    style={({ pressed }) => [s.transferBtnPrimary, { backgroundColor: tintColor }, pressed && { opacity: 0.85 }]}>
                    <ThemedText type="defaultSemiBold" style={{ color: 'white' }}>
                      {transferMode === 'member' ? `Bagi ke ${selectedAnggota.size || '...'} Anggota` : 'Transfer'}
                    </ThemedText>
                  </Pressable>
                </View>
              </Pressable>
            </ThemedView>
          </Pressable>
        </Modal>

        {/* Modal Transfer Berhasil */}
        <Modal visible={successVisible} transparent animationType="fade">
          <Pressable style={s.modalOverlay} onPress={() => setSuccessVisible(false)}>
            <ThemedView type="card" style={s.successModal}>
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: successColor + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Ionicons name="checkmark-circle" size={32} color={successColor} />
                </View>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 18, textAlign: 'center' }}>
                  Transfer Berhasil
                </ThemedText>
              </View>
              <ThemedText type="muted" style={{ fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 22 }}>
                {successMessage}
              </ThemedText>
              <Pressable
                onPress={() => setSuccessVisible(false)}
                style={({ pressed }) => [{ backgroundColor: tintColor, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }, pressed && { opacity: 0.85 }]}
              >
                <ThemedText type="defaultSemiBold" style={{ color: 'white' }}>
                  Selesai
                </ThemedText>
              </Pressable>
            </ThemedView>
          </Pressable>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, width: 80 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16 },
  scroll: { paddingBottom: 40 },
  pageHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerPadding: { paddingHorizontal: 20, marginBottom: 20, gap: 16 },
  totalCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(127,127,127,0.1)",
  },
  totalCardTitle: { fontSize: 14, marginBottom: 12, textAlign: "center" },
  totalCardRow: { flexDirection: "row", justifyContent: "space-between" },
  totalCardItem: { alignItems: "center", flex: 1 },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 4,
  },
  navBtn: { padding: 12, borderRadius: 10 },
  monthInfo: { flex: 1, alignItems: "center" },
  monthText: { fontSize: 16 },
  mainCard: {
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 24,
    elevation: 2,
    gap: 16,
  },
  progressContainer: {
    height: 12,
    flexDirection: "row",
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "rgba(127,127,127,0.1)",
  },
  progressBar: { height: "100%" },
  legend: { flexDirection: "row", gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  statItem: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  divider: { height: 1, marginVertical: 4 },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  section: { marginTop: 32, gap: 12 },
  sectionTitle: { fontSize: 18, marginBottom: 4, paddingHorizontal: 20 },
  // Table styles (non-periodik)
  tableCard: {
    borderRadius: 16,
    overflow: "hidden",
    padding: 0,
    marginHorizontal: 20,
  },
  tableMonthTitle: {
    fontSize: 14,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    opacity: 0.9,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  tableHeader: { borderBottomWidth: 1, paddingVertical: 8 },
  tableHeaderText: {
    fontWeight: "700",
    opacity: 0.55,
    fontSize: 11,
    textTransform: "uppercase",
  },
  tableFooter: { borderTopWidth: 1, paddingVertical: 10 },
  colKategori: { flex: 2.2 },
  colMasuk: { flex: 1.8, textAlign: "right" },
  colKeluar: { flex: 1.8, textAlign: "right" },
  colNet: { flex: 1.8, textAlign: "right" },
  colAction: { width: 32, alignItems: "center" },
  transferBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
  },
  // Pivot table styles (periodik)
  pivotCard: {
    borderRadius: 16,
    overflow: "hidden",
    padding: 0,
    marginHorizontal: 20,
  },
  pivotBaris: { flexDirection: "row", alignItems: "stretch" },
  pivotFooterBaris: { borderTopWidth: 2 },
  pivotRow: { flexDirection: "row", alignItems: "center" },
  pivotHeaderRow: { borderBottomWidth: 1, paddingVertical: 10 },
  pivotFooterRow: { borderTopWidth: 2, paddingVertical: 10 },
  // Kolom bulan sticky (fixed kiri)
  pivotStickyCol: { width: 46, borderRightWidth: 1.5 },
  pivotStickyHeader: { height: 44, borderBottomWidth: 1 },
  pivotStickyCell: {
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  pivotStickyFooter: { borderTopWidth: 2, height: 44 },
  // Kolom kategori (scroll horizontal)
  pivotColCat: {
    paddingHorizontal: 6,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(127,127,127,0.1)",
  },
  pivotColTotal: { paddingHorizontal: 6, borderLeftWidth: 1.5 },
  pivotHeaderCell: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pivotHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    textAlign: "center",
  },
  pivotMonthText: { fontSize: 11, fontWeight: "700", textAlign: "center" },
  pivotCellContent: {
    paddingVertical: 10,
    alignItems: "center",
    gap: 3,
    justifyContent: "center",
  },
  pivotCellText: { fontSize: 12, textAlign: "center" },
  pivotTransferredLabel: { fontSize: 9, opacity: 0.55, textAlign: "center" },
  pivotTransferBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1,
  },
  emptyCard: {
    padding: 24,
    alignItems: "center",
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "rgba(127,127,127,0.3)",
    marginHorizontal: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  pickerModal: {
    padding: 24,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    gap: 16,
  },
  transferModal: {
    padding: 24,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    gap: 14,
  },
  transferList: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(127,127,127,0.12)",
    overflow: "hidden",
  },
  transferItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  transferActions: { flexDirection: "row", gap: 12, marginTop: 6 },
  transferModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  splitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 4,
  },
  memberAvatar: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transferBtnGhost: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  transferBtnPrimary: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  successModal: {
    padding: 24,
    borderRadius: 28,
    marginHorizontal: 20,
    alignSelf: 'center',
    width: '85%',
  },
  pickerLabel: { fontSize: 14, opacity: 0.6 },
  yearPickerNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(127,127,127,0.05)",
    borderRadius: 12,
    padding: 4,
  },
  yearNavBtn: { padding: 10 },
  yearDisplayText: { fontSize: 20, fontWeight: "bold" },
  pickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pickerItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(127,127,127,0.1)",
    minWidth: "22%",
    alignItems: "center",
  },
  pickerItemText: { fontSize: 13 },
  closeBtn: {
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },
});
