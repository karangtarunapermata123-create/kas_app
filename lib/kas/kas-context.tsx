import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAdmin } from "@/lib/admin/admin-context";
import { supabase } from "@/lib/supabase/client";
import {
  deleteBookFromDB,
  deleteTxFromDB,
  emptyKasStateV2,
  loadKasState,
  rowToBook,
  rowToTx,
  saveKasState,
  sortTxsDesc,
  upsertTxToDB,
} from "./storage";
import type {
  KasBook,
  KasBookType,
  KasMember,
  KasState,
  KasTx,
  KolektifItem,
  PeriodType,
} from "./types";

type KasContextValue = {
  ready: boolean;
  books: KasBook[];
  activeKasId: string;
  setActiveKasId: (id: string) => Promise<void>;
  addKas: (
    nama: string,
    tipe?: KasBookType,
    periodConfig?: KasBook["periodConfig"],
    categories?: string[],
    members?: string[],
    periodRates?: Record<string, number>,
    kolektifItems?: KolektifItem[],
    kolektifMode?: "STANDARD" | "BULANAN",
    kolektifTahun?: number,
  ) => Promise<KasBook>;
  renameKas: (id: string, nama: string) => Promise<void>;
  deleteKas: (id: string) => Promise<void>;

  // Member management for PERIODIK kas
  addMember: (kasId: string, nama: string) => Promise<void>;
  removeMember: (kasId: string, memberId: string) => Promise<void>;
  updateMember: (
    kasId: string,
    memberId: string,
    nama: string,
  ) => Promise<void>;

  txsAll: KasTx[];
  txsActive: KasTx[];
  upsertTx: (tx: Omit<KasTx, "kasId"> & { kasId?: string }) => Promise<void>;
  deleteTx: (id: string) => Promise<void>;
  clearAll: (scope?: "active" | "all") => Promise<void>;
  updateCategories: (kasId: string, categories: string[]) => Promise<void>;
  updatePeriodConfig: (
    kasId: string,
    periodConfig: KasBook["periodConfig"] | undefined,
  ) => Promise<void>;
  updatePeriodRates: (
    kasId: string,
    rates: Record<string, number>,
  ) => Promise<void>;
  updateEditorIds: (kasId: string, editorIds: string[]) => Promise<void>;
  updateKolektifItems: (kasId: string, items: KolektifItem[]) => Promise<void>;
};

const KasContext = createContext<KasContextValue | null>(null);

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function KasProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAdmin(); // Add dependency on session
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<KasState>(() => emptyKasStateV2());
  const stateRef = useRef(state);
  stateRef.current = state;

  const refreshKas = useCallback(async () => {
    console.log("refreshKas called");
    const loaded = await loadKasState();
    setState({ ...loaded, books: loaded.books, txs: sortTxsDesc(loaded.txs) });
  }, []);

  const setupRealtime = useCallback(() => {
    const booksSub = supabase
      .channel("books-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "books" },
        (payload) => {
          setState((prev) => {
            if (
              payload.eventType === "INSERT" ||
              payload.eventType === "UPDATE"
            ) {
              const updated = rowToBook(payload.new);
              const exists = prev.books.some((b) => b.id === updated.id);
              return {
                ...prev,
                books: exists
                  ? prev.books.map((b) => (b.id === updated.id ? updated : b))
                  : [...prev.books, updated],
              };
            }
            if (payload.eventType === "DELETE") {
              return {
                ...prev,
                books: prev.books.filter(
                  (b) => b.id !== (payload.old as any).id,
                ),
              };
            }
            return prev;
          });
        },
      )
      .subscribe((status) => {
        console.log("books realtime:", status);
      });

    const txsSub = supabase
      .channel("txs-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "txs" },
        (payload) => {
          setState((prev) => {
            if (
              payload.eventType === "INSERT" ||
              payload.eventType === "UPDATE"
            ) {
              const updated = rowToTx(payload.new);
              const exists = prev.txs.some((t) => t.id === updated.id);
              const next = exists
                ? prev.txs.map((t) => (t.id === updated.id ? updated : t))
                : [...prev.txs, updated];
              return { ...prev, txs: sortTxsDesc(next) };
            }
            if (payload.eventType === "DELETE") {
              return {
                ...prev,
                txs: prev.txs.filter((t) => t.id !== (payload.old as any).id),
              };
            }
            return prev;
          });
        },
      )
      .subscribe((status) => {
        console.log("txs realtime:", status);
      });

    return { booksSub, txsSub };
  }, []);

  // Refresh data saat tab aktif kembali
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisible = async () => {
      if (document.visibilityState === "visible" && session) {
        console.log("Document visible, refreshing kas data");
        await refreshKas();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshKas, session]);

  // Reset and reload data when session changes
  useEffect(() => {
    console.log("Session changed in KasProvider:", !!session);

    if (!session) {
      // No session - reset to empty state
      setState(emptyKasStateV2());
      setReady(true);
      return;
    }

    // Session exists - load data
    let mounted = true;
    let realtimeCleanup: (() => void) | null = null;

    (async () => {
      try {
        setReady(false);
        console.log("Loading kas data for session...");

        // Cleanup channel lama dulu sebelum subscribe baru
        await supabase.removeAllChannels();

        const loaded = await loadKasState();
        if (!mounted) return;

        console.log("Kas data loaded:", {
          booksCount: loaded.books.length,
          txsCount: loaded.txs.length,
        });
        setState({
          ...loaded,
          books: loaded.books,
          txs: sortTxsDesc(loaded.txs),
        });
        setReady(true);

        const subs = setupRealtime();
        realtimeCleanup = () => {
          supabase.removeChannel(subs.booksSub);
          supabase.removeChannel(subs.txsSub);
        };
      } catch (error) {
        console.error("KasContext initialization error:", error);
        if (mounted) setReady(true);
      }
    })();

    const handleOnline = async () => {
      if (mounted && realtimeCleanup && session) {
        realtimeCleanup();
        const subs = setupRealtime();
        realtimeCleanup = () => {
          supabase.removeChannel(subs.booksSub);
          supabase.removeChannel(subs.txsSub);
        };
      }
    };

    if (typeof document !== "undefined") {
      window.addEventListener("online", handleOnline);
    }

    return () => {
      mounted = false;
      if (realtimeCleanup) realtimeCleanup();
      if (typeof document !== "undefined") {
        window.removeEventListener("online", handleOnline);
      }
    };
  }, [session, setupRealtime]); // Add session as dependency

  const persist = useCallback(async (next: KasState) => {
    setState(next);
    await saveKasState(next);
  }, []);

  const setActiveKasId = useCallback(
    async (id: string) => {
      if (!state.books.some((b) => b.id === id)) return;
      await persist({ ...state, activeKasId: id });
    },
    [persist, state],
  );

  const upsertTx = useCallback(
    async (tx: Omit<KasTx, "kasId"> & { kasId?: string }) => {
      const cur = stateRef.current;
      const kasId = tx.kasId ?? cur.activeKasId;
      const nominal = typeof tx.nominal === 'number' && !isNaN(tx.nominal) ? tx.nominal : 0;
      const nextTx: KasTx = { ...tx, kasId, nominal } as KasTx;
      // Update state optimistically
      const filtered = cur.txs.filter((t) => t.id !== nextTx.id);
      setState({ ...cur, txs: sortTxsDesc([nextTx, ...filtered]) });
      // Save only this single tx to DB
      await upsertTxToDB(nextTx);
    },
    [],
  );

  const deleteTx = useCallback(async (id: string) => {
    const cur = stateRef.current;
    // Update state optimistically
    setState({ ...cur, txs: cur.txs.filter((t) => t.id !== id) });
    // Delete from DB
    await deleteTxFromDB(id);
  }, []);

  const clearAll = useCallback(
    async (scope: "active" | "all" = "active") => {
      if (scope === "all") {
        await persist({ ...state, txs: [] });
        return;
      }
      await persist({
        ...state,
        txs: state.txs.filter((t) => t.kasId !== state.activeKasId),
      });
    },
    [persist, state],
  );

  const addKas = useCallback(
    async (
      nama: string,
      tipe: KasBookType = "STANDARD",
      periodConfig?: KasBook["periodConfig"],
      categories?: string[],
      members?: string[],
      periodRates?: Record<string, number>,
      kolektifItems?: KolektifItem[],
      kolektifMode?: "STANDARD" | "BULANAN",
      kolektifTahun?: number,
    ) => {
      const now = Date.now();
      const BULAN_NAMES = [
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

      let finalMembers: string[];
      let finalKolektifItems: KolektifItem[];

      if (tipe === "KOLEKTIF" && kolektifMode === "BULANAN") {
        const tahun = kolektifTahun || new Date().getFullYear();
        // Bulan sebagai members (baris), tahun sebagai item (kartu)
        finalMembers = BULAN_NAMES;
        finalKolektifItems = [
          {
            id: `item_tahun_${tahun}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
            nama: String(tahun),
            nominal: 0,
          },
        ];
      } else {
        finalMembers = members || [];
        finalKolektifItems = kolektifItems || [];
      }

      const book: KasBook = {
        id: makeId("kas"),
        nama: nama.trim() || "Kas Baru",
        tipe,
        periodConfig,
        periodRates:
          tipe === "PERIODIK" && categories && periodConfig
            ? periodRates ||
              Object.fromEntries(
                (categories.length ? categories : ["Iuran"]).map((c) => [
                  c,
                  periodConfig.nominal,
                ]),
              )
            : undefined,
        members:
          tipe === "PERIODIK" || tipe === "KOLEKTIF"
            ? finalMembers.map((m) => ({ id: makeId("mem"), nama: m }))
            : undefined,
        categories:
          tipe === "PERIODIK"
            ? categories || []
            : categories && categories.length > 0
              ? categories
              : ["Iuran", "Konsumsi", "Kegiatan", "Lain-lain"],
        kolektifItems: tipe === "KOLEKTIF" ? finalKolektifItems : undefined,
        kolektifMode:
          tipe === "KOLEKTIF" ? (kolektifMode ?? "STANDARD") : undefined,
        kolektifTahun:
          tipe === "KOLEKTIF" && kolektifMode === "BULANAN"
            ? kolektifTahun
            : undefined,
        createdAt: now,
        updatedAt: now,
      };
      const next: KasState = {
        ...state,
        books: [...state.books, book],
        activeKasId: book.id,
      };
      await persist(next);
      return book;
    },
    [persist, state],
  );

  const addMember = useCallback(
    async (kasId: string, nama: string) => {
      const nextBooks = state.books.map((b) => {
        if (b.id === kasId && b.tipe === "PERIODIK") {
          const newMember: KasMember = { id: makeId("mem"), nama: nama.trim() };
          return {
            ...b,
            members: [...(b.members || []), newMember],
            updatedAt: Date.now(),
          };
        }
        return b;
      });
      await persist({ ...state, books: nextBooks });
    },
    [persist, state],
  );

  const removeMember = useCallback(
    async (kasId: string, memberId: string) => {
      const nextBooks = state.books.map((b) => {
        if (b.id === kasId && b.tipe === "PERIODIK") {
          return {
            ...b,
            members: (b.members || []).filter((m) => m.id !== memberId),
            updatedAt: Date.now(),
          };
        }
        return b;
      });
      await persist({ ...state, books: nextBooks });
    },
    [persist, state],
  );

  const updateMember = useCallback(
    async (kasId: string, memberId: string, nama: string) => {
      const nextBooks = state.books.map((b) => {
        if (b.id === kasId && b.tipe === "PERIODIK") {
          return {
            ...b,
            members: (b.members || []).map((m) =>
              m.id === memberId ? { ...m, nama: nama.trim() } : m,
            ),
            updatedAt: Date.now(),
          };
        }
        return b;
      });
      await persist({ ...state, books: nextBooks });
    },
    [persist, state],
  );

  const renameKas = useCallback(
    async (id: string, nama: string) => {
      const nextName = nama.trim();
      if (!nextName) return;
      const nextBooks = state.books.map((b) =>
        b.id === id ? { ...b, nama: nextName, updatedAt: Date.now() } : b,
      );
      await persist({ ...state, books: nextBooks });
    },
    [persist, state],
  );

  const deleteKas = useCallback(
    async (id: string) => {
      const nextBooks = state.books.filter((b) => b.id !== id);
      const deletedTxs = state.txs.filter((t) => t.kasId === id);
      const nextTxs = state.txs.filter((t) => t.kasId !== id);
      const nextActive =
        state.activeKasId === id ? (nextBooks[0]?.id ?? "") : state.activeKasId;
      await deleteBookFromDB(id);
      await Promise.all(deletedTxs.map((t) => deleteTxFromDB(t.id)));
      await persist({
        ...state,
        books: nextBooks,
        txs: nextTxs,
        activeKasId: nextActive,
      });
    },
    [persist, state],
  );

  const updateCategories = useCallback(
    async (kasId: string, categories: string[]) => {
      const cur = stateRef.current;
      const nextBooks = cur.books.map((b) =>
        b.id === kasId ? { ...b, categories, updatedAt: Date.now() } : b,
      );
      await persist({ ...cur, books: nextBooks });
    },
    [persist],
  );

  const updatePeriodConfig = useCallback(
    async (
      kasId: string,
      periodConfig: KasBook["periodConfig"] | undefined,
    ) => {
      const cur = stateRef.current;
      const nextBooks = cur.books.map((b) =>
        b.id === kasId ? { ...b, periodConfig, updatedAt: Date.now() } : b,
      );
      await persist({ ...cur, books: nextBooks });
    },
    [persist],
  );

  const updatePeriodRates = useCallback(
    async (kasId: string, rates: Record<string, number>) => {
      const cur = stateRef.current;
      const nextBooks = cur.books.map((b) =>
        b.id === kasId
          ? { ...b, periodRates: rates, updatedAt: Date.now() }
          : b,
      );
      await persist({ ...cur, books: nextBooks });
    },
    [persist],
  );

  const updateEditorIds = useCallback(
    async (kasId: string, editorIds: string[]) => {
      const cur = stateRef.current;
      const nextBooks = cur.books.map((b) =>
        b.id === kasId ? { ...b, editorIds, updatedAt: Date.now() } : b,
      );
      await persist({ ...cur, books: nextBooks });
    },
    [persist],
  );

  const updateKolektifItems = useCallback(
    async (kasId: string, items: KolektifItem[]) => {
      const cur = stateRef.current;
      const nextBooks = cur.books.map((b) =>
        b.id === kasId
          ? { ...b, kolektifItems: items, updatedAt: Date.now() }
          : b,
      );
      await persist({ ...cur, books: nextBooks });
    },
    [persist],
  );

  const txsActive = useMemo(
    () => state.txs.filter((t) => t.kasId === state.activeKasId),
    [state],
  );

  const value = useMemo<KasContextValue>(
    () => ({
      ready,
      books: state.books,
      activeKasId: state.activeKasId,
      setActiveKasId,
      addKas,
      renameKas,
      deleteKas,
      addMember,
      removeMember,
      updateMember,
      txsAll: state.txs,
      txsActive,
      upsertTx,
      deleteTx,
      clearAll,
      updateCategories,
      updatePeriodConfig,
      updatePeriodRates,
      updateEditorIds,
      updateKolektifItems,
    }),
    [
      addKas,
      addMember,
      clearAll,
      deleteKas,
      deleteTx,
      ready,
      removeMember,
      renameKas,
      setActiveKasId,
      state,
      txsActive,
      updateCategories,
      updatePeriodConfig,
      updatePeriodRates,
      updateEditorIds,
      updateKolektifItems,
      updateMember,
      upsertTx,
    ],
  );

  return <KasContext.Provider value={value}>{children}</KasContext.Provider>;
}

export function useKas() {
  const ctx = useContext(KasContext);
  if (!ctx) throw new Error("useKas must be used within KasProvider");
  return ctx;
}
