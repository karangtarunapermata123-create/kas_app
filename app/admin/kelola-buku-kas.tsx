import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAccentColor } from "@/hooks/use-accent-color";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useAdmin } from "@/lib/admin/admin-context";
import { useKas } from "@/lib/kas/kas-context";
import {
  clearPendingMembers,
  getPendingMembers,
} from "@/lib/kas/temp-members-store";
import type {
  KasBook,
  KasBookType,
  KolektifItem,
  PeriodType,
} from "@/lib/kas/types";
import { formatRupiah } from "@/lib/kas/types";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function useKeyboardHeight() {
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) =>
      setKbHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return kbHeight;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerRight: { width: 80 },
  headerTitle: { fontSize: 17, textAlign: "center" },
  headerSub: { fontSize: 12, marginTop: 1, textAlign: "center" },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    width: 80,
  },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  kasRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    paddingRight: 8,
    marginBottom: 10,
    backgroundColor: "rgba(127,127,127,0.02)",
  },
  kasSelect: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  kasIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 10 },
  // Modal
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  editModal: {
    width: "100%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
  },
  editModalLandscape: { width: "100%", borderRadius: 24, paddingTop: 8 },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(127,127,127,0.3)",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  modalTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  modalIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  segment: {
    flexDirection: "row",
    marginHorizontal: 24,
    marginBottom: 4,
    backgroundColor: "rgba(127,127,127,0.08)",
    borderRadius: 14,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 11,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  segmentText: { fontSize: 12, fontWeight: "600" },
  modalScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "rgba(127,127,127,0.03)",
    marginBottom: 8,
  },
  editNameRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  editNameInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
  },
  saveNameBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  memberEditInput: { flex: 1, fontSize: 14, paddingVertical: 6 },
  memberDeleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  memberPreviewCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editMembersBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  editMembersBtnIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  addRow: { flexDirection: "row", gap: 10, marginTop: 8, alignItems: "center" },
  addInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  addInputSmall: {
    width: 110,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  addActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryCard: {
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  categoryCardInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  categoryNameInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 4,
  },
  categoryNominalInput: { width: 110, fontSize: 14, textAlign: "right" },
  categoryDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  saveCategoryBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  btnText: { color: "white", fontWeight: "700", fontSize: 16 },
  typeSelector: { flexDirection: "row", gap: 8, marginBottom: 12 },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(127,127,127,0.2)",
  },
  typeBtnText: { fontSize: 13, fontWeight: "600" },
  modalCenterWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalFooterFixed: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "rgba(127,127,127,0.1)",
  },
  modalFooterFixedLandscape: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(127,127,127,0.1)",
  },
});

export default function KelolaBukuKasScreen() {
  const { isSuperAdmin } = useAdmin();
  const { accentColor } = useAccentColor();
  const {
    books,
    addKas,
    deleteKas,
    renameKas,
    addMember,
    removeMember,
    updateMember,
    updateCategories,
    updatePeriodRates,
    updateEditorIds,
    updateKolektifItems,
  } = useKas();

  const kbHeight = useKeyboardHeight();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const tintColor = useThemeColor({}, "tint");
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const mutedColor = useThemeColor({}, "muted");
  const borderColor = useThemeColor({}, "border");
  const dangerColor = useThemeColor({}, "danger");
  const successColor =
    (useThemeColor({}, "success") as string | undefined) ?? "#22c55e";

  // ── Edit Buku Kas ──
  const [editBookId, setEditBookId] = useState<string | null>(null);
  const editBook = books.find((b) => b.id === editBookId);
  const [editName, setEditName] = useState("");
  const [editTab, setEditTab] = useState<
    "name" | "members" | "rates" | "access"
  >("name");
  const [editMemberName, setEditMemberName] = useState("");
  const [ratesInput, setRatesInput] = useState<Record<string, string>>({});
  const [categoryNameEdits, setCategoryNameEdits] = useState<
    Record<string, string>
  >({});
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryNominal, setNewCategoryNominal] = useState("");
  const newCategoryNameRef = useRef<TextInput>(null);

  // ── Edit Item Kolektif ──
  const [newKolektifItemName, setNewKolektifItemName] = useState("");
  const [newKolektifItemNominal, setNewKolektifItemNominal] = useState("");
  const newKolektifItemNameRef = useRef<TextInput>(null);
  const [newBulananTahun, setNewBulananTahun] = useState("");
  const [deleteKolektifItemTarget, setDeleteKolektifItemTarget] = useState<{
    id: string;
    nama: string;
  } | null>(null);
  const [deletingKolektifItem, setDeletingKolektifItem] = useState(false);

  const onAddKolektifItem = useCallback(async () => {
    if (!editBookId || !editBook) return;
    const name = newKolektifItemName.trim();
    if (!name) return;
    const nominal = parseInt(newKolektifItemNominal.replace(/\D/g, ""), 10);
    const newItem: KolektifItem = {
      id: `item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      nama: name,
      nominal: isNaN(nominal) ? 0 : nominal,
    };
    const current = editBook.kolektifItems || [];
    await updateKolektifItems(editBookId, [...current, newItem]);
    setNewKolektifItemName("");
    setNewKolektifItemNominal("");
    setTimeout(() => newKolektifItemNameRef.current?.focus(), 50);
  }, [
    editBookId,
    editBook,
    newKolektifItemName,
    newKolektifItemNominal,
    updateKolektifItems,
  ]);

  const onRemoveKolektifItem = useCallback(async () => {
    if (!editBookId || !editBook || !deleteKolektifItemTarget) return;
    setDeletingKolektifItem(true);
    try {
      const next = (editBook.kolektifItems || []).filter(
        (i) => i.id !== deleteKolektifItemTarget.id,
      );
      await updateKolektifItems(editBookId, next);
      setDeleteKolektifItemTarget(null);
    } finally {
      setDeletingKolektifItem(false);
    }
  }, [editBookId, editBook, deleteKolektifItemTarget, updateKolektifItems]);

  // ── Editor Access ──
  const [allProfiles, setAllProfiles] = useState<
    {
      id: string;
      nama_lengkap: string | null;
      email: string | null;
      role: string;
    }[]
  >([]);
  const [profilesLoading, setProfilesLoading] = useState(false);

  // Load profiles saat modal edit dibuka ke tab access
  const loadProfiles = useCallback(async () => {
    if (allProfiles.length > 0) return; // sudah di-load
    setProfilesLoading(true);
    try {
      const { supabase } = await import("@/lib/supabase/client");
      const { data } = await supabase
        .from("profiles")
        .select("id, nama_lengkap, email, role")
        .order("nama_lengkap");
      setAllProfiles(data ?? []);
    } catch (e) {
      console.error("load profiles error:", e);
    } finally {
      setProfilesLoading(false);
    }
  }, [allProfiles.length]);

  const onToggleEditor = useCallback(
    async (userId: string) => {
      if (!editBookId || !editBook) return;
      const current = editBook.editorIds ?? [];
      const next = current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId];
      await updateEditorIds(editBookId, next);
    },
    [editBookId, editBook, updateEditorIds],
  );

  // ── Tambah Buku Kas ──
  const [addVisible, setAddVisible] = useState(false);
  const [newKasName, setNewKasName] = useState("");
  const [newKasType, setNewKasType] = useState<KasBookType>("STANDARD");
  const [newKasPeriodMode, setNewKasPeriodMode] = useState<"YEAR" | "SESSION">(
    "YEAR",
  );
  const [newKasPeriodType, setNewKasPeriodType] =
    useState<PeriodType>("MONTHLY");
  const [newKasKolektifMode, setNewKasKolektifMode] = useState<
    "STANDARD" | "BULANAN"
  >("STANDARD");
  const [newKasKolektifTahun, setNewKasKolektifTahun] = useState<string>(
    String(new Date().getFullYear()),
  );
  const [addKasTab, setAddKasTab] = useState<"name" | "members" | "rates">(
    "name",
  );
  const [newKasCats, setNewKasCats] = useState<
    { name: string; nominal: string }[]
  >([]);
  const [newKasMembers, setNewKasMembers] = useState<string[]>([]);
  const [newMemberInput, setNewMemberInput] = useState("");
  const addKasCatNameRef = useRef<TextInput>(null);
  const [addKasCatName, setAddKasCatName] = useState("");
  const [addKasCatNominal, setAddKasCatNominal] = useState("");

  // Buka modal saat kembali dari edit-kas-members
  useFocusEffect(
    useCallback(() => {
      const pending = getPendingMembers();
      if (pending !== null && pending.mode === "add") {
        clearPendingMembers();
        setNewKasMembers(pending.members);
        setAddKasTab("members");
        setAddVisible(true);
        return;
      }
      if (pending !== null && pending.mode === "edit" && pending.kasId) {
        clearPendingMembers();
        const book = books.find((b) => b.id === pending.kasId);
        if (book) {
          const currentNames = new Set((book.members || []).map((m) => m.nama));
          const newNames = new Set(pending.members);
          (book.members || []).forEach((m) => {
            if (!newNames.has(m.nama)) removeMember(pending.kasId!, m.id);
          });
          pending.members.forEach((name) => {
            if (!currentNames.has(name)) addMember(pending.kasId!, name);
          });
        }
        setEditBookId(pending.kasId);
      }
    }, [books, addMember, removeMember]),
  ); // ── Hapus Buku Kas ──
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    nama: string;
  } | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteError, setDeleteError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const openEdit = useCallback(
    (bId: string) => {
      const b = books.find((x) => x.id === bId);
      if (!b) return;
      setEditBookId(bId);
      setEditTab(b.tipe === "PERIODIK" ? "name" : "name");
      setEditName(b.nama);
      const cats = b.categories || [];
      const rates = b.periodRates || {};
      const initialRates: Record<string, string> = {};
      cats.forEach((c) => {
        initialRates[c] = String(rates[c] ?? b.periodConfig?.nominal ?? 0);
      });
      setRatesInput(initialRates);
      const initialNameEdits: Record<string, string> = {};
      cats.forEach((c) => {
        initialNameEdits[c] = c;
      });
      setCategoryNameEdits(initialNameEdits);
      setEditMemberName("");
      setNewCategoryName("");
      setNewCategoryNominal("");
      // Auto-hitung tahun berikutnya untuk kolektif bulanan
      if (b.tipe === "KOLEKTIF" && b.kolektifMode === "BULANAN") {
        const years = (b.kolektifItems || [])
          .map((item) => parseInt(item.nama, 10))
          .filter((y) => !isNaN(y));
        const nextYear =
          years.length > 0 ? Math.max(...years) + 1 : new Date().getFullYear();
        setNewBulananTahun(String(nextYear));
      }
    },
    [books],
  );

  const closeEdit = useCallback(() => setEditBookId(null), []);

  const onSaveName = useCallback(async () => {
    if (!editBookId) return;
    await renameKas(editBookId, editName);
    closeEdit();
  }, [editBookId, editName, renameKas, closeEdit]);

  const onSaveRates = useCallback(async () => {
    if (!editBookId || editBook?.tipe !== "PERIODIK") return;
    const existingCats = editBook.categories || [];
    const renameMap: Record<string, string> = {};
    const nextCategories: string[] = [];
    existingCats.forEach((oldCat) => {
      const nextName = (categoryNameEdits[oldCat] ?? oldCat).trim();
      if (!nextName || nextCategories.includes(nextName)) return;
      renameMap[oldCat] = nextName;
      nextCategories.push(nextName);
    });
    const parsedRates: Record<string, number> = {};
    Object.entries(ratesInput).forEach(([oldCat, v]) => {
      const newCat = renameMap[oldCat] ?? oldCat;
      const n = parseInt(v.replace(/\D/g, ""), 10);
      if (!isNaN(n)) parsedRates[newCat] = n;
    });
    await updateCategories(editBookId, nextCategories);
    const normalizedRates: Record<string, number> = {};
    nextCategories.forEach((c) => {
      normalizedRates[c] =
        parsedRates[c] ??
        editBook.periodRates?.[c] ??
        editBook.periodConfig?.nominal ??
        0;
    });
    await updatePeriodRates(editBookId, normalizedRates);
    closeEdit();
  }, [
    editBookId,
    editBook,
    categoryNameEdits,
    ratesInput,
    updateCategories,
    updatePeriodRates,
    closeEdit,
  ]);

  const onAddCategory = useCallback(async () => {
    if (!editBookId) return;
    const name = newCategoryName.trim();
    if (!name) return;
    const nominal = parseInt(newCategoryNominal.replace(/\D/g, ""), 10);
    const current = editBook?.categories || [];
    await updateCategories(editBookId, [...current, name]);
    setRatesInput((prev) => ({
      ...prev,
      [name]: String(isNaN(nominal) ? 0 : nominal),
    }));
    setCategoryNameEdits((prev) => ({ ...prev, [name]: name }));
    setNewCategoryName("");
    setNewCategoryNominal("");
    setTimeout(() => newCategoryNameRef.current?.focus(), 50);
  }, [
    editBookId,
    editBook,
    newCategoryName,
    newCategoryNominal,
    updateCategories,
  ]);

  const onRemoveCategory = useCallback(
    async (cat: string) => {
      if (!editBookId) return;
      const next = (editBook?.categories || []).filter((c) => c !== cat);
      await updateCategories(editBookId, next);
      setRatesInput((prev) => {
        const copy = { ...prev };
        delete copy[cat];
        return copy;
      });
      setCategoryNameEdits((prev) => {
        const copy = { ...prev };
        delete copy[cat];
        return copy;
      });
    },
    [editBookId, editBook, updateCategories],
  );

  const onAddMember = useCallback(async () => {
    if (!editBookId) return;
    const name = editMemberName.trim();
    if (!name) return;
    await addMember(editBookId, name);
    setEditMemberName("");
  }, [editBookId, editMemberName, addMember]);

  const onAddKas = useCallback(async () => {
    const name = newKasName.trim();
    if (!name) return Alert.alert("Validasi", "Nama kas tidak boleh kosong.");
    try {
      if (newKasType === "PERIODIK") {
        if (newKasPeriodMode === "SESSION") {
          // SESSION: tidak perlu kategori saat buat — kategori dikelola per sesi
          const now = Date.now();
          const defaultSessionId = `sess_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
          await addKas(
            name,
            newKasType,
            {
              tipe: "SESSION",
              nominal: 0,
              activeSessionId: defaultSessionId,
              sessions: [
                {
                  id: defaultSessionId,
                  nama: "Sesi 1",
                  order: 1,
                  putaranCount: Math.max(1, newKasMembers.length || 1),
                  createdAt: now,
                  updatedAt: now,
                },
              ],
            } as any,
            [],
            newKasMembers,
            {},
          );
        } else {
          const catsEntries = newKasCats
            .map((c) => ({
              name: c.name.trim(),
              nominal: parseInt(String(c.nominal).replace(/\D/g, ""), 10),
            }))
            .filter((c) => c.name.length > 0);
          if (catsEntries.length === 0)
            return Alert.alert("Validasi", "Tambahkan minimal satu kategori.");
          const firstNominal =
            catsEntries.find((c) => !isNaN(c.nominal) && c.nominal > 0)
              ?.nominal ?? 0;
          const categories = catsEntries.map((c) => c.name);
          const periodRates = Object.fromEntries(
            catsEntries.map((c) => [c.name, c.nominal]),
          );
          await addKas(
            name,
            newKasType,
            { tipe: newKasPeriodType, nominal: firstNominal },
            categories,
            newKasMembers,
            periodRates,
          );
        }
      } else if (newKasType === "KOLEKTIF") {
        const itemEntries = newKasCats
          .map((c) => ({
            name: c.name.trim(),
            nominal: parseInt(String(c.nominal).replace(/\D/g, ""), 10),
          }))
          .filter((c) => c.name.length > 0);
        if (itemEntries.length === 0 && newKasKolektifMode === "STANDARD")
          return Alert.alert(
            "Validasi",
            "Tambahkan minimal satu item kolektif.",
          );
        // Untuk mode STANDARD, wajib ada anggota
        if (newKasKolektifMode === "STANDARD" && newKasMembers.length === 0)
          return Alert.alert("Validasi", "Tambahkan minimal satu anggota.");
        const kolektifItems = itemEntries.map((c) => ({
          id: `item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}_${c.name.replace(/\s/g, "")}`,
          nama: c.name,
          nominal: isNaN(c.nominal) ? 0 : c.nominal,
        }));
        const kolektifTahun =
          newKasKolektifMode === "BULANAN"
            ? parseInt(newKasKolektifTahun, 10) || new Date().getFullYear()
            : undefined;
        await addKas(
          name,
          newKasType,
          undefined,
          [],
          newKasMembers,
          {},
          kolektifItems,
          newKasKolektifMode,
          kolektifTahun,
        );
      } else {
        await addKas(name, newKasType);
      }
      setNewKasName("");
      setNewKasType("STANDARD");
      setNewKasCats([]);
      setNewKasPeriodMode("YEAR");
      setNewKasKolektifMode("STANDARD");
      setNewKasKolektifTahun(String(new Date().getFullYear()));
      setNewKasMembers([]);
      setNewMemberInput("");
      setAddKasTab("name");
      setAddVisible(false);
    } catch (e: any) {
      Alert.alert("Gagal", e?.message ?? String(e));
    }
  }, [
    newKasName,
    newKasType,
    newKasPeriodMode,
    newKasPeriodType,
    newKasKolektifMode,
    newKasKolektifTahun,
    newKasCats,
    newKasMembers,
    addKas,
  ]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || isDeleting) return;
    if (deleteInput.trim().toLowerCase() !== "hapus kas ini") {
      setDeleteError(true);
      return;
    }
    setIsDeleting(true);
    try {
      await deleteKas(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteInput("");
    } catch (e: any) {
      Alert.alert("Gagal", e?.message ?? String(e));
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, deleteInput, isDeleting, deleteKas]);

  if (!isSuperAdmin) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={["top"]}>
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn]}>
            <Ionicons name="chevron-back" size={24} color={tintColor} />
            <ThemedText style={{ color: tintColor, fontSize: 16 }}>
              Kembali
            </ThemedText>
          </Pressable>
          <View style={styles.headerCenter}>
            <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
              Kelola Buku Kas
            </ThemedText>
          </View>
          <View style={styles.headerRight} />
        </View>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 40,
          }}
        >
          <Ionicons
            name="shield-outline"
            size={64}
            color={mutedColor}
            style={{ marginBottom: 16 }}
          />
          <ThemedText
            type="defaultSemiBold"
            style={{ fontSize: 18, marginBottom: 8, textAlign: "center" }}
          >
            Akses Terbatas
          </ThemedText>
          <ThemedText
            type="muted"
            style={{ textAlign: "center", lineHeight: 20 }}
          >
            Hanya Super Admin yang dapat mengelola buku kas. Hubungi
            administrator untuk mendapatkan akses.
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={24} color={tintColor} />
          <ThemedText style={{ color: tintColor, fontSize: 16 }}>
            Kembali
          </ThemedText>
        </Pressable>
        <View style={styles.headerCenter}>
          <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
            Kelola Buku Kas
          </ThemedText>
          <ThemedText type="muted" style={styles.headerSub}>
            {books.length} buku kas
          </ThemedText>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {books.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="journal-outline" size={48} color={mutedColor} />
            <ThemedText type="muted" style={{ textAlign: "center" }}>
              Belum ada buku kas.
            </ThemedText>
            <ThemedText
              type="muted"
              style={{ fontSize: 13, textAlign: "center" }}
            >
              Tekan tombol + untuk menambahkan.
            </ThemedText>
          </View>
        ) : (
          books.map((b) => (
            <View key={b.id} style={[styles.kasRow, { borderColor }]}>
              <View style={styles.kasSelect}>
                <View
                  style={[
                    styles.kasIcon,
                    { backgroundColor: borderColor + "30" },
                  ]}
                >
                  <Ionicons
                    name="journal-outline"
                    size={20}
                    color={mutedColor}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>
                    {b.nama}
                  </ThemedText>
                  <ThemedText
                    style={{ fontSize: 11, color: mutedColor, marginTop: 1 }}
                  >
                    {b.tipe === "PERIODIK"
                      ? `Periodik · ${b.periodConfig?.tipe === "WEEKLY" ? "Mingguan" : b.periodConfig?.tipe === "SESSION" ? "Per Sesi" : "Bulanan"}`
                      : b.tipe === "KOLEKTIF"
                        ? `Kolektif · ${b.kolektifItems?.length ?? 0} item · ${b.members?.length ?? 0} anggota`
                        : "Standard"}
                  </ThemedText>
                </View>
              </View>
              <Pressable
                onPress={() => openEdit(b.id)}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: tintColor + "12" },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Ionicons name="create-outline" size={18} color={tintColor} />
              </Pressable>
              <Pressable
                onPress={() => {
                  setDeleteTarget({ id: b.id, nama: b.nama });
                  setDeleteInput("");
                  setDeleteError(false);
                }}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: dangerColor + "12" },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Ionicons name="trash-outline" size={18} color={dangerColor} />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      {/* FAB Tambah */}
      <Pressable
        onPress={() => setAddVisible(true)}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: tintColor },
          pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] },
        ]}
      >
        <Ionicons name="add" size={28} color="white" />
      </Pressable>

      {/* ── Modal Edit Buku Kas ── */}
      <Modal visible={!!editBookId} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              Keyboard.dismiss();
              closeEdit();
            }}
          />
          <ThemedView
            type="card"
            style={[
              isLandscape ? styles.editModalLandscape : styles.editModal,
              {
                width: "100%",
                minHeight: 420,
                maxHeight: isLandscape
                  ? height * 0.92
                  : kbHeight > 0
                    ? height - kbHeight - 40
                    : Math.min(800, Math.round(height * 0.93)),
              },
            ]}
          >
            {!isLandscape && <View style={styles.dragHandle} />}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View
                  style={[
                    styles.modalIconBox,
                    { backgroundColor: tintColor + "18" },
                  ]}
                >
                  <Ionicons name="create" size={17} color={tintColor} />
                </View>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 17 }}>
                  Edit Buku Kas
                </ThemedText>
              </View>
              <Pressable
                onPress={closeEdit}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: "rgba(127,127,127,0.1)" },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Ionicons name="close" size={18} color={textColor} />
              </Pressable>
            </View>
            {editBook && (
              <ThemedText type="muted" style={styles.modalSubtitle}>
                {editBook.nama} ·{" "}
                {editBook.tipe === "PERIODIK"
                  ? "Periodik"
                  : editBook.tipe === "KOLEKTIF"
                    ? "Kolektif"
                    : "Standard"}
              </ThemedText>
            )}

            {/* Segment tabs */}
            <View style={styles.segment}>
              {editBook?.tipe === "PERIODIK"
                ? (
                    [
                      { key: "name", label: "Nama", icon: "text-outline" },
                      {
                        key: "members",
                        label: "Anggota",
                        icon: "people-outline",
                      },
                      {
                        key: "rates",
                        label: "Kategori",
                        icon: "pricetags-outline",
                      },
                      {
                        key: "access",
                        label: "Akses",
                        icon: "shield-checkmark-outline",
                      },
                    ] as { key: typeof editTab; label: string; icon: string }[]
                  )
                    .filter((tab) => {
                      if (
                        tab.key === "members" &&
                        editBook.periodConfig?.tipe === "SESSION"
                      )
                        return false;
                      if (
                        tab.key === "rates" &&
                        editBook.periodConfig?.tipe === "SESSION"
                      )
                        return false;
                      return true;
                    })
                    .map((tab) => {
                      const isActive = editTab === tab.key;
                      return (
                        <Pressable
                          key={tab.key}
                          onPress={() => {
                            setEditTab(tab.key);
                            if (tab.key === "access") loadProfiles();
                          }}
                          style={[
                            styles.segmentBtn,
                            isActive && { backgroundColor: tintColor },
                          ]}
                        >
                          <Ionicons
                            name={tab.icon as any}
                            size={13}
                            color={isActive ? "white" : mutedColor}
                          />
                          <ThemedText
                            style={[
                              styles.segmentText,
                              { color: isActive ? "white" : mutedColor },
                            ]}
                          >
                            {tab.label}
                          </ThemedText>
                        </Pressable>
                      );
                    })
                : editBook?.tipe === "KOLEKTIF"
                  ? (
                      [
                        { key: "name", label: "Nama", icon: "text-outline" },
                        {
                          key: "members",
                          label: "Anggota",
                          icon: "people-outline",
                        },
                        {
                          key: "rates",
                          label:
                            editBook.kolektifMode === "BULANAN"
                              ? "Tahun"
                              : "Item",
                          icon:
                            editBook.kolektifMode === "BULANAN"
                              ? "calendar-outline"
                              : "basket-outline",
                        },
                        {
                          key: "access",
                          label: "Akses",
                          icon: "shield-checkmark-outline",
                        },
                      ] as {
                        key: typeof editTab;
                        label: string;
                        icon: string;
                      }[]
                    )
                      .filter((tab) => {
                        // Untuk BULANAN: sembunyikan tab Anggota (dummy member 'Iuran')
                        if (
                          tab.key === "members" &&
                          editBook.kolektifMode === "BULANAN"
                        )
                          return false;
                        return true;
                      })
                      .map((tab) => {
                        const isActive = editTab === tab.key;
                        return (
                          <Pressable
                            key={tab.key}
                            onPress={() => {
                              setEditTab(tab.key);
                              if (tab.key === "access") loadProfiles();
                            }}
                            style={[
                              styles.segmentBtn,
                              isActive && { backgroundColor: tintColor },
                            ]}
                          >
                            <Ionicons
                              name={tab.icon as any}
                              size={13}
                              color={isActive ? "white" : mutedColor}
                            />
                            <ThemedText
                              style={[
                                styles.segmentText,
                                { color: isActive ? "white" : mutedColor },
                              ]}
                            >
                              {tab.label}
                            </ThemedText>
                          </Pressable>
                        );
                      })
                  : (
                      [
                        { key: "name", label: "Nama", icon: "text-outline" },
                        {
                          key: "access",
                          label: "Akses",
                          icon: "shield-checkmark-outline",
                        },
                      ] as {
                        key: typeof editTab;
                        label: string;
                        icon: string;
                      }[]
                    ).map((tab) => {
                      const isActive = editTab === tab.key;
                      return (
                        <Pressable
                          key={tab.key}
                          onPress={() => {
                            setEditTab(tab.key);
                            if (tab.key === "access") loadProfiles();
                          }}
                          style={[
                            styles.segmentBtn,
                            isActive && { backgroundColor: tintColor },
                          ]}
                        >
                          <Ionicons
                            name={tab.icon as any}
                            size={13}
                            color={isActive ? "white" : mutedColor}
                          />
                          <ThemedText
                            style={[
                              styles.segmentText,
                              { color: isActive ? "white" : mutedColor },
                            ]}
                          >
                            {tab.label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
            </View>

            <ScrollView
              contentContainerStyle={[
                styles.modalScrollContent,
                { paddingBottom: kbHeight > 0 ? kbHeight + 24 : 40 },
              ]}
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
            >
              {editBook && (
                <View>
                  {/* Tab Nama */}
                  {editTab === "name" && (
                    <View>
                      <ThemedText type="muted" style={styles.sectionLabel}>
                        Nama Buku
                      </ThemedText>
                      <View style={styles.editNameRow}>
                        <TextInput
                          value={editName}
                          onChangeText={setEditName}
                          placeholder="Nama buku kas..."
                          placeholderTextColor={mutedColor}
                          style={[
                            styles.editNameInput,
                            {
                              borderColor,
                              color: textColor,
                              backgroundColor: "rgba(127,127,127,0.04)",
                            },
                          ]}
                        />
                        <Pressable
                          onPress={onSaveName}
                          style={({ pressed }) => [
                            styles.saveNameBtn,
                            { backgroundColor: tintColor },
                            pressed && { opacity: 0.8 },
                          ]}
                        >
                          <Ionicons name="checkmark" size={22} color="white" />
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {/* Tab Anggota */}
                  {editBook.tipe === "PERIODIK" && editTab === "members" && (
                    <View>
                      <ThemedText type="muted" style={styles.sectionLabel}>
                        Daftar Anggota ({editBook.members?.length ?? 0})
                      </ThemedText>

                      {/* Tombol Edit Anggota dengan Checklist */}
                      <Pressable
                        onPress={() => {
                          closeEdit();
                          router.push({
                            pathname: "/admin/edit-kas-members",
                            params: {
                              selectedMembers: JSON.stringify(
                                (editBook.members || []).map((m) => m.nama),
                              ),
                              mode: "edit",
                              kasId: editBook.id,
                            },
                          });
                        }}
                        style={({ pressed }) => [
                          styles.editMembersBtn,
                          {
                            backgroundColor: tintColor + "12",
                            borderColor: tintColor,
                          },
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <View
                          style={[
                            styles.editMembersBtnIcon,
                            { backgroundColor: tintColor },
                          ]}
                        >
                          <Ionicons name="people" size={18} color="white" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText
                            type="defaultSemiBold"
                            style={{ color: tintColor, fontSize: 15 }}
                          >
                            Edit Anggota
                          </ThemedText>
                          <ThemedText type="muted" style={{ fontSize: 12 }}>
                            Pilih anggota dari daftar akun yang ada
                          </ThemedText>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color={tintColor}
                        />
                      </Pressable>

                      {/* Preview Anggota Saat Ini */}
                      {(editBook.members || []).length === 0 ? (
                        <View
                          style={{
                            alignItems: "center",
                            paddingVertical: 20,
                            gap: 8,
                          }}
                        >
                          <Ionicons
                            name="people-outline"
                            size={32}
                            color={mutedColor}
                          />
                          <ThemedText type="muted" style={{ fontSize: 13 }}>
                            Belum ada anggota
                          </ThemedText>
                          <ThemedText
                            type="muted"
                            style={{ fontSize: 12, textAlign: "center" }}
                          >
                            Gunakan tombol "Edit Anggota" di atas untuk
                            menambahkan
                          </ThemedText>
                        </View>
                      ) : (
                        <View style={{ marginTop: 16 }}>
                          <ThemedText
                            type="muted"
                            style={[styles.sectionLabel, { marginBottom: 8 }]}
                          >
                            Anggota Saat Ini
                          </ThemedText>
                          {(editBook.members || []).slice(0, 5).map((m) => (
                            <View
                              key={m.id}
                              style={[
                                styles.memberPreviewCard,
                                {
                                  borderColor,
                                  backgroundColor: "rgba(127,127,127,0.03)",
                                },
                              ]}
                            >
                              <View
                                style={[
                                  styles.memberAvatar,
                                  { backgroundColor: tintColor + "15" },
                                ]}
                              >
                                <ThemedText
                                  style={{
                                    fontSize: 13,
                                    fontWeight: "700",
                                    color: tintColor,
                                  }}
                                >
                                  {m.nama.charAt(0).toUpperCase()}
                                </ThemedText>
                              </View>
                              <ThemedText
                                style={{ color: textColor, fontSize: 14 }}
                              >
                                {m.nama}
                              </ThemedText>
                            </View>
                          ))}
                          {(editBook.members || []).length > 5 && (
                            <View
                              style={[
                                styles.memberPreviewCard,
                                {
                                  borderColor,
                                  backgroundColor: "rgba(127,127,127,0.03)",
                                },
                              ]}
                            >
                              <View
                                style={[
                                  styles.memberAvatar,
                                  { backgroundColor: mutedColor + "15" },
                                ]}
                              >
                                <ThemedText
                                  style={{
                                    fontSize: 13,
                                    fontWeight: "700",
                                    color: mutedColor,
                                  }}
                                >
                                  +{(editBook.members || []).length - 5}
                                </ThemedText>
                              </View>
                              <ThemedText
                                style={{ color: mutedColor, fontSize: 14 }}
                              >
                                dan {(editBook.members || []).length - 5}{" "}
                                anggota lainnya
                              </ThemedText>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Tab Kategori */}
                  {editBook.tipe === "PERIODIK" && editTab === "rates" && (
                    <View>
                      <ThemedText type="muted" style={styles.sectionLabel}>
                        Kategori & Nominal
                      </ThemedText>
                      {(editBook.categories || []).map((cat) => (
                        <View
                          key={cat}
                          style={[styles.categoryCard, { borderColor }]}
                        >
                          <View
                            style={[
                              styles.categoryCardInner,
                              { backgroundColor: "rgba(127,127,127,0.03)" },
                            ]}
                          >
                            <View
                              style={[
                                styles.memberAvatar,
                                {
                                  backgroundColor: tintColor + "12",
                                  marginRight: 0,
                                },
                              ]}
                            >
                              <Ionicons
                                name="pricetag"
                                size={14}
                                color={tintColor}
                              />
                            </View>
                            <TextInput
                              value={categoryNameEdits[cat] ?? cat}
                              onChangeText={(v) =>
                                setCategoryNameEdits((prev) => ({
                                  ...prev,
                                  [cat]: v,
                                }))
                              }
                              placeholder="Kategori"
                              placeholderTextColor={mutedColor}
                              style={[
                                styles.categoryNameInput,
                                { color: textColor },
                              ]}
                            />
                            <TextInput
                              value={ratesInput[cat] ?? ""}
                              onChangeText={(v) =>
                                setRatesInput((prev) => ({ ...prev, [cat]: v }))
                              }
                              placeholder="Nominal"
                              placeholderTextColor={mutedColor}
                              keyboardType="number-pad"
                              style={[
                                styles.categoryNominalInput,
                                { color: textColor },
                              ]}
                            />
                            <Pressable
                              onPress={() => onRemoveCategory(cat)}
                              style={({ pressed }) => [
                                styles.categoryDeleteBtn,
                                { backgroundColor: dangerColor + "12" },
                                pressed && { opacity: 0.6 },
                              ]}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={15}
                                color={dangerColor}
                              />
                            </Pressable>
                          </View>
                        </View>
                      ))}
                      <View style={styles.addRow}>
                        <TextInput
                          ref={newCategoryNameRef}
                          value={newCategoryName}
                          onChangeText={setNewCategoryName}
                          placeholder="Nama kategori..."
                          placeholderTextColor={mutedColor}
                          style={[
                            styles.addInput,
                            {
                              borderColor,
                              color: textColor,
                              backgroundColor: "rgba(127,127,127,0.04)",
                            },
                          ]}
                        />
                        <TextInput
                          value={newCategoryNominal}
                          onChangeText={setNewCategoryNominal}
                          placeholder="Nominal"
                          placeholderTextColor={mutedColor}
                          keyboardType="number-pad"
                          style={[
                            styles.addInputSmall,
                            {
                              borderColor,
                              color: textColor,
                              backgroundColor: "rgba(127,127,127,0.04)",
                            },
                          ]}
                        />
                        <Pressable
                          onPress={onAddCategory}
                          style={({ pressed }) => [
                            styles.addActionBtn,
                            { backgroundColor: tintColor },
                            pressed && { opacity: 0.8 },
                          ]}
                        >
                          <Ionicons name="add" size={22} color="white" />
                        </Pressable>
                      </View>
                      <Pressable
                        onPress={onSaveRates}
                        style={({ pressed }) => [
                          styles.saveCategoryBtn,
                          { backgroundColor: tintColor },
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color="white"
                        />
                        <ThemedText
                          type="defaultSemiBold"
                          style={{ color: "white" }}
                        >
                          Simpan Perubahan
                        </ThemedText>
                      </Pressable>
                    </View>
                  )}

                  {/* Tab Anggota (KOLEKTIF) */}
                  {editBook.tipe === "KOLEKTIF" && editTab === "members" && (
                    <View>
                      <ThemedText type="muted" style={styles.sectionLabel}>
                        Daftar Anggota ({editBook.members?.length ?? 0})
                      </ThemedText>
                      <Pressable
                        onPress={() => {
                          closeEdit();
                          router.push({
                            pathname: "/admin/edit-kas-members",
                            params: {
                              selectedMembers: JSON.stringify(
                                (editBook.members || []).map((m) => m.nama),
                              ),
                              mode: "edit",
                              kasId: editBook.id,
                            },
                          });
                        }}
                        style={({ pressed }) => [
                          styles.editMembersBtn,
                          {
                            backgroundColor: tintColor + "12",
                            borderColor: tintColor,
                          },
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <View
                          style={[
                            styles.editMembersBtnIcon,
                            { backgroundColor: tintColor },
                          ]}
                        >
                          <Ionicons name="people" size={18} color="white" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText
                            type="defaultSemiBold"
                            style={{ color: tintColor, fontSize: 15 }}
                          >
                            Edit Anggota
                          </ThemedText>
                          <ThemedText type="muted" style={{ fontSize: 12 }}>
                            Pilih anggota dari daftar akun
                          </ThemedText>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color={tintColor}
                        />
                      </Pressable>
                      {(editBook.members || []).length > 0 && (
                        <View style={{ marginTop: 8, gap: 6 }}>
                          {(editBook.members || []).slice(0, 4).map((m) => (
                            <View
                              key={m.id}
                              style={[
                                styles.memberPreviewCard,
                                {
                                  borderColor,
                                  backgroundColor: "rgba(127,127,127,0.03)",
                                },
                              ]}
                            >
                              <View
                                style={[
                                  styles.memberAvatar,
                                  { backgroundColor: tintColor + "15" },
                                ]}
                              >
                                <ThemedText
                                  style={{
                                    fontSize: 13,
                                    fontWeight: "700",
                                    color: tintColor,
                                  }}
                                >
                                  {m.nama.charAt(0).toUpperCase()}
                                </ThemedText>
                              </View>
                              <ThemedText
                                style={{ color: textColor, fontSize: 14 }}
                              >
                                {m.nama}
                              </ThemedText>
                            </View>
                          ))}
                          {(editBook.members || []).length > 4 && (
                            <ThemedText
                              type="muted"
                              style={{ fontSize: 12, textAlign: "center" }}
                            >
                              +{(editBook.members || []).length - 4} lainnya
                            </ThemedText>
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Tab Tahun (KOLEKTIF BULANAN) */}
                  {editBook.tipe === "KOLEKTIF" &&
                    editBook.kolektifMode === "BULANAN" &&
                    editTab === "rates" && (
                      <View>
                        <ThemedText type="muted" style={styles.sectionLabel}>
                          Daftar Tahun
                        </ThemedText>
                        {/* Tampilkan tahun yang sudah ada (nama item = angka tahun) */}
                        {(editBook.kolektifItems || [])
                          .slice()
                          .sort(
                            (a, b) =>
                              parseInt(a.nama, 10) - parseInt(b.nama, 10),
                          )
                          .map((item) => (
                            <View
                              key={item.id}
                              style={[styles.categoryCard, { borderColor }]}
                            >
                              <View
                                style={[
                                  styles.categoryCardInner,
                                  { backgroundColor: "rgba(127,127,127,0.03)" },
                                ]}
                              >
                                <View
                                  style={[
                                    styles.memberAvatar,
                                    {
                                      backgroundColor: tintColor + "12",
                                      marginRight: 0,
                                    },
                                  ]}
                                >
                                  <Ionicons
                                    name="calendar"
                                    size={14}
                                    color={tintColor}
                                  />
                                </View>
                                <ThemedText
                                  style={[
                                    styles.categoryNameInput,
                                    { color: textColor, fontWeight: "600" },
                                  ]}
                                >
                                  Tahun {item.nama}
                                </ThemedText>
                                <ThemedText
                                  type="muted"
                                  style={{ fontSize: 12 }}
                                >
                                  12 bulan
                                </ThemedText>
                                <Pressable
                                  onPress={() =>
                                    setDeleteKolektifItemTarget({
                                      id: item.id,
                                      nama: `Tahun ${item.nama}`,
                                    })
                                  }
                                  style={({ pressed }) => [
                                    styles.categoryDeleteBtn,
                                    { backgroundColor: dangerColor + "12" },
                                    pressed && { opacity: 0.6 },
                                  ]}
                                >
                                  <Ionicons
                                    name="trash-outline"
                                    size={15}
                                    color={dangerColor}
                                  />
                                </Pressable>
                              </View>
                            </View>
                          ))}
                        {(editBook.kolektifItems || []).length === 0 && (
                          <View
                            style={{
                              alignItems: "center",
                              paddingVertical: 20,
                              gap: 6,
                            }}
                          >
                            <Ionicons
                              name="calendar-outline"
                              size={32}
                              color={mutedColor}
                            />
                            <ThemedText type="muted" style={{ fontSize: 13 }}>
                              Belum ada tahun
                            </ThemedText>
                          </View>
                        )}

                        {/* Form tambah tahun */}
                        <ThemedText
                          type="muted"
                          style={[styles.sectionLabel, { marginTop: 16 }]}
                        >
                          Tambah Tahun
                        </ThemedText>
                        <View style={[styles.addRow, { alignItems: "center" }]}>
                          {/* Tombol kurang tahun */}
                          <Pressable
                            onPress={() => {
                              const y = parseInt(newBulananTahun, 10);
                              if (!isNaN(y) && y > 2000)
                                setNewBulananTahun(String(y - 1));
                            }}
                            style={({ pressed }) => [
                              styles.addActionBtn,
                              {
                                backgroundColor: "rgba(127,127,127,0.12)",
                              },
                              pressed && { opacity: 0.7 },
                            ]}
                          >
                            <Ionicons
                              name="remove"
                              size={20}
                              color={textColor}
                            />
                          </Pressable>

                          {/* Tampilan tahun */}
                          <View
                            style={[
                              styles.addInput,
                              {
                                flex: 1,
                                borderColor,
                                backgroundColor: "rgba(127,127,127,0.04)",
                                alignItems: "center",
                                justifyContent: "center",
                              },
                            ]}
                          >
                            <ThemedText
                              style={{ fontSize: 16, fontWeight: "600" }}
                            >
                              {newBulananTahun ||
                                String(new Date().getFullYear())}
                            </ThemedText>
                          </View>

                          {/* Tombol tambah tahun */}
                          <Pressable
                            onPress={() => {
                              const y = parseInt(newBulananTahun, 10);
                              if (!isNaN(y) && y < 2100)
                                setNewBulananTahun(String(y + 1));
                            }}
                            style={({ pressed }) => [
                              styles.addActionBtn,
                              {
                                backgroundColor: "rgba(127,127,127,0.12)",
                              },
                              pressed && { opacity: 0.7 },
                            ]}
                          >
                            <Ionicons name="add" size={20} color={textColor} />
                          </Pressable>

                          {/* Tombol simpan / centang */}
                          <Pressable
                            onPress={async () => {
                              if (!editBookId || !editBook) return;
                              const tahun = parseInt(newBulananTahun, 10);
                              if (isNaN(tahun) || tahun < 2000 || tahun > 2100)
                                return;
                              // Cek apakah tahun sudah ada
                              const existingYears = new Set(
                                (editBook.kolektifItems || [])
                                  .map((item) => parseInt(item.nama, 10))
                                  .filter((y) => !isNaN(y)),
                              );
                              if (existingYears.has(tahun)) return;
                              // Tambah satu item baru dengan nama = tahun
                              const newItem = {
                                id: `item_tahun_${tahun}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
                                nama: String(tahun),
                                nominal: 0,
                              };
                              await updateKolektifItems(editBookId, [
                                ...(editBook.kolektifItems || []),
                                newItem,
                              ]);
                              // Otomatis naik ke tahun berikutnya
                              setNewBulananTahun(String(tahun + 1));
                            }}
                            style={({ pressed }) => [
                              styles.addActionBtn,
                              { backgroundColor: tintColor },
                              pressed && { opacity: 0.8 },
                            ]}
                          >
                            <Ionicons
                              name="checkmark"
                              size={22}
                              color="white"
                            />
                          </Pressable>
                        </View>
                      </View>
                    )}

                  {/* Tab Item (KOLEKTIF STANDARD) */}
                  {editBook.tipe === "KOLEKTIF" &&
                    editBook.kolektifMode !== "BULANAN" &&
                    editTab === "rates" && (
                      <View>
                        <ThemedText type="muted" style={styles.sectionLabel}>
                          Item Kolektif
                        </ThemedText>

                        {/* Daftar item yang sudah ada */}
                        {(editBook.kolektifItems || []).length === 0 ? (
                          <View
                            style={{
                              alignItems: "center",
                              paddingVertical: 20,
                              gap: 6,
                            }}
                          >
                            <Ionicons
                              name="basket-outline"
                              size={32}
                              color={mutedColor}
                            />
                            <ThemedText type="muted" style={{ fontSize: 13 }}>
                              Belum ada item
                            </ThemedText>
                          </View>
                        ) : (
                          (editBook.kolektifItems || []).map((item) => (
                            <View
                              key={item.id}
                              style={[styles.categoryCard, { borderColor }]}
                            >
                              <View
                                style={[
                                  styles.categoryCardInner,
                                  { backgroundColor: "rgba(127,127,127,0.03)" },
                                ]}
                              >
                                <View
                                  style={[
                                    styles.memberAvatar,
                                    {
                                      backgroundColor: tintColor + "12",
                                      marginRight: 0,
                                    },
                                  ]}
                                >
                                  <Ionicons
                                    name="basket"
                                    size={14}
                                    color={tintColor}
                                  />
                                </View>
                                <ThemedText
                                  style={[
                                    styles.categoryNameInput,
                                    { color: textColor },
                                  ]}
                                >
                                  {item.nama}
                                </ThemedText>
                                <ThemedText
                                  style={[
                                    styles.categoryNominalInput,
                                    { color: mutedColor },
                                  ]}
                                >
                                  {formatRupiah(item.nominal)}
                                </ThemedText>
                                <Pressable
                                  onPress={() =>
                                    setDeleteKolektifItemTarget({
                                      id: item.id,
                                      nama: item.nama,
                                    })
                                  }
                                  style={({ pressed }) => [
                                    styles.categoryDeleteBtn,
                                    { backgroundColor: dangerColor + "12" },
                                    pressed && { opacity: 0.6 },
                                  ]}
                                >
                                  <Ionicons
                                    name="trash-outline"
                                    size={15}
                                    color={dangerColor}
                                  />
                                </Pressable>
                              </View>
                            </View>
                          ))
                        )}

                        {/* Form tambah item baru */}
                        <View style={styles.addRow}>
                          <TextInput
                            ref={newKolektifItemNameRef}
                            value={newKolektifItemName}
                            onChangeText={setNewKolektifItemName}
                            placeholder="Nama item..."
                            placeholderTextColor={mutedColor}
                            style={[
                              styles.addInput,
                              {
                                borderColor,
                                color: textColor,
                                backgroundColor: "rgba(127,127,127,0.04)",
                              },
                            ]}
                          />
                          <TextInput
                            value={newKolektifItemNominal}
                            onChangeText={setNewKolektifItemNominal}
                            placeholder="Nominal"
                            placeholderTextColor={mutedColor}
                            keyboardType="number-pad"
                            style={[
                              styles.addInputSmall,
                              {
                                borderColor,
                                color: textColor,
                                backgroundColor: "rgba(127,127,127,0.04)",
                              },
                            ]}
                          />
                          <Pressable
                            onPress={onAddKolektifItem}
                            style={({ pressed }) => [
                              styles.addActionBtn,
                              { backgroundColor: tintColor },
                              pressed && { opacity: 0.8 },
                            ]}
                          >
                            <Ionicons name="add" size={22} color="white" />
                          </Pressable>
                        </View>
                      </View>
                    )}

                  {/* Tab Akses */}
                  {editTab === "access" && (
                    <View>
                      <ThemedText type="muted" style={styles.sectionLabel}>
                        Izin Edit Transaksi
                      </ThemedText>
                      <View
                        style={[
                          styles.infoCard,
                          {
                            borderColor: tintColor + "40",
                            backgroundColor: tintColor + "08",
                          },
                        ]}
                      >
                        <Ionicons
                          name="information-circle-outline"
                          size={16}
                          color={tintColor}
                        />
                        <ThemedText
                          style={{
                            fontSize: 12,
                            color: tintColor,
                            flex: 1,
                            lineHeight: 18,
                          }}
                        >
                          Pilih user yang boleh tambah/edit/hapus transaksi di
                          buku kas ini. Super Admin selalu punya akses penuh.
                        </ThemedText>
                      </View>
                      {profilesLoading ? (
                        <View
                          style={{ alignItems: "center", paddingVertical: 24 }}
                        >
                          <ThemedText type="muted">
                            Memuat daftar user...
                          </ThemedText>
                        </View>
                      ) : allProfiles.length === 0 ? (
                        <View
                          style={{ alignItems: "center", paddingVertical: 24 }}
                        >
                          <Ionicons
                            name="people-outline"
                            size={32}
                            color={mutedColor}
                          />
                          <ThemedText type="muted" style={{ marginTop: 8 }}>
                            Belum ada user terdaftar
                          </ThemedText>
                        </View>
                      ) : (
                        allProfiles
                          .filter((p) => p.role !== "super_admin") // super admin tidak perlu ditampilkan
                          .map((p) => {
                            const isEditor = (
                              editBook?.editorIds ?? []
                            ).includes(p.id);
                            const nama =
                              p.nama_lengkap ?? p.email ?? "(tanpa nama)";
                            const roleLabel =
                              p.role === "admin" ? "Admin" : "Member";
                            return (
                              <Pressable
                                key={p.id}
                                onPress={() => onToggleEditor(p.id)}
                                style={({ pressed }) => [
                                  {
                                    flexDirection: "row" as const,
                                    alignItems: "center" as const,
                                    borderRadius: 14,
                                    borderWidth: 1.5,
                                    borderColor: isEditor
                                      ? tintColor
                                      : borderColor,
                                    backgroundColor: isEditor
                                      ? tintColor + "10"
                                      : "transparent",
                                    paddingHorizontal: 14,
                                    paddingVertical: 10,
                                    marginBottom: 8,
                                    gap: 12,
                                  },
                                  pressed && { opacity: 0.7 },
                                ]}
                              >
                                <View
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 10,
                                    backgroundColor: isEditor
                                      ? tintColor
                                      : borderColor + "40",
                                    justifyContent: "center",
                                    alignItems: "center",
                                  }}
                                >
                                  <ThemedText
                                    style={{
                                      fontSize: 14,
                                      fontWeight: "700",
                                      color: isEditor ? "white" : mutedColor,
                                    }}
                                  >
                                    {nama.charAt(0).toUpperCase()}
                                  </ThemedText>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <ThemedText
                                    type="defaultSemiBold"
                                    style={{ fontSize: 14 }}
                                    numberOfLines={1}
                                  >
                                    {nama}
                                  </ThemedText>
                                  <ThemedText
                                    type="muted"
                                    style={{ fontSize: 11 }}
                                  >
                                    {roleLabel} · {p.email}
                                  </ThemedText>
                                </View>
                                <View
                                  style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: 6,
                                    borderWidth: 2,
                                    borderColor: isEditor
                                      ? tintColor
                                      : borderColor,
                                    backgroundColor: isEditor
                                      ? tintColor
                                      : "transparent",
                                    justifyContent: "center",
                                    alignItems: "center",
                                  }}
                                >
                                  {isEditor && (
                                    <Ionicons
                                      name="checkmark"
                                      size={13}
                                      color="white"
                                    />
                                  )}
                                </View>
                              </Pressable>
                            );
                          })
                      )}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
            <View
              style={
                isLandscape
                  ? styles.modalFooterFixedLandscape
                  : styles.modalFooterFixed
              }
            />
          </ThemedView>
        </View>
      </Modal>

      {/* ── Modal Tambah Buku Kas ── */}
      <Modal visible={addVisible} transparent animationType="fade">
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              Keyboard.dismiss();
              setAddVisible(false);
            }}
          />
          <ThemedView
            type="card"
            style={[
              isLandscape ? styles.editModalLandscape : styles.editModal,
              {
                width: "100%",
                minHeight: 560,
                maxHeight: isLandscape
                  ? height * 0.92
                  : kbHeight > 0
                    ? height - kbHeight - 40
                    : Math.min(800, Math.round(height * 0.93)),
              },
            ]}
          >
            {!isLandscape && <View style={styles.dragHandle} />}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View
                  style={[
                    styles.modalIconBox,
                    { backgroundColor: tintColor + "18" },
                  ]}
                >
                  <Ionicons name="add" size={17} color={tintColor} />
                </View>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 17 }}>
                  Tambah Buku Kas
                </ThemedText>
              </View>
              <Pressable
                onPress={() => setAddVisible(false)}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: "rgba(127,127,127,0.1)" },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Ionicons name="close" size={18} color={textColor} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={[
                styles.modalScrollContent,
                { paddingBottom: kbHeight > 0 ? kbHeight + 24 : 40 },
              ]}
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
            >
              <View>
                {/* Tipe selector */}
                <View style={[styles.typeSelector, { flexWrap: "wrap" }]}>
                  {(["STANDARD", "PERIODIK", "KOLEKTIF"] as const).map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setNewKasType(t)}
                      style={[
                        styles.typeBtn,
                        newKasType === t && {
                          backgroundColor: tintColor,
                          borderColor: tintColor,
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.typeBtnText,
                          newKasType === t && { color: "white" },
                        ]}
                      >
                        {t === "STANDARD"
                          ? "Standard"
                          : t === "PERIODIK"
                            ? "Periodik (Iuran)"
                            : "Kolektif (Patungan)"}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>

                {/* Mode Periodik — Per Tahun / Per Sesi */}
                {newKasType === "PERIODIK" && (
                  <View style={{ marginBottom: 8 }}>
                    <View style={[styles.typeSelector, { marginBottom: 0 }]}>
                      {(["YEAR", "SESSION"] as const).map((m) => (
                        <Pressable
                          key={m}
                          onPress={() => {
                            setNewKasPeriodMode(m);
                            if (
                              m === "SESSION" &&
                              (addKasTab === "members" || addKasTab === "rates")
                            )
                              setAddKasTab("name");
                          }}
                          style={[
                            styles.typeBtn,
                            newKasPeriodMode === m && {
                              backgroundColor: tintColor,
                              borderColor: tintColor,
                            },
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.typeBtnText,
                              newKasPeriodMode === m && { color: "white" },
                            ]}
                          >
                            {m === "YEAR" ? "Per Tahun" : "Per Sesi"}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </View>
                    {newKasPeriodMode === "YEAR" && (
                      <View style={{ marginTop: 8 }}>
                        <View style={styles.typeSelector}>
                          {(["MONTHLY", "WEEKLY"] as const).map((p) => (
                            <Pressable
                              key={p}
                              onPress={() => setNewKasPeriodType(p)}
                              style={[
                                styles.typeBtn,
                                newKasPeriodType === p && {
                                  backgroundColor: tintColor,
                                  borderColor: tintColor,
                                },
                              ]}
                            >
                              <ThemedText
                                style={[
                                  styles.typeBtnText,
                                  newKasPeriodType === p && { color: "white" },
                                ]}
                              >
                                {p === "MONTHLY" ? "Bulanan" : "Mingguan"}
                              </ThemedText>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Segment tabs untuk PERIODIK */}
                {newKasType === "PERIODIK" && (
                  <View
                    style={[
                      styles.segment,
                      { marginHorizontal: 0, marginBottom: 20 },
                    ]}
                  >
                    {(
                      [
                        { key: "name", label: "Nama", icon: "text-outline" },
                        {
                          key: "members",
                          label: "Anggota",
                          icon: "people-outline",
                        },
                        {
                          key: "rates",
                          label: "Kategori",
                          icon: "pricetags-outline",
                        },
                      ] as {
                        key: typeof addKasTab;
                        label: string;
                        icon: string;
                      }[]
                    )
                      .filter((tab) => {
                        if (
                          tab.key === "members" &&
                          newKasPeriodMode === "SESSION"
                        )
                          return false;
                        if (
                          tab.key === "rates" &&
                          newKasPeriodMode === "SESSION"
                        )
                          return false;
                        return true;
                      })
                      .map((tab) => {
                        const isActive = addKasTab === tab.key;
                        return (
                          <Pressable
                            key={tab.key}
                            onPress={() => setAddKasTab(tab.key)}
                            style={[
                              styles.segmentBtn,
                              isActive && { backgroundColor: tintColor },
                            ]}
                          >
                            <Ionicons
                              name={tab.icon as any}
                              size={13}
                              color={isActive ? "white" : mutedColor}
                            />
                            <ThemedText
                              style={[
                                styles.segmentText,
                                { color: isActive ? "white" : mutedColor },
                              ]}
                            >
                              {tab.label}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                  </View>
                )}

                {/* Opsi Kolektif — Standard / Bulanan */}
                {newKasType === "KOLEKTIF" && (
                  <View style={[styles.typeSelector, { marginBottom: 8 }]}>
                    {(["STANDARD", "BULANAN"] as const).map((m) => (
                      <Pressable
                        key={m}
                        onPress={() => {
                          setNewKasKolektifMode(m);
                          if (m === "BULANAN" && addKasTab === "members")
                            setAddKasTab("name");
                        }}
                        style={[
                          styles.typeBtn,
                          newKasKolektifMode === m && {
                            backgroundColor: tintColor,
                            borderColor: tintColor,
                          },
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.typeBtnText,
                            newKasKolektifMode === m && { color: "white" },
                          ]}
                        >
                          {m === "STANDARD" ? "Standard" : "Bulanan"}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                )}

                {/* Segment tabs untuk KOLEKTIF */}
                {newKasType === "KOLEKTIF" && (
                  <View
                    style={[
                      styles.segment,
                      { marginHorizontal: 0, marginBottom: 20 },
                    ]}
                  >
                    {(
                      [
                        { key: "name", label: "Nama", icon: "text-outline" },
                        {
                          key: "members",
                          label: "Anggota",
                          icon: "people-outline",
                        },
                        {
                          key: "rates",
                          label:
                            newKasKolektifMode === "BULANAN" ? "Tahun" : "Item",
                          icon:
                            newKasKolektifMode === "BULANAN"
                              ? "calendar-outline"
                              : "basket-outline",
                        },
                      ] as {
                        key: typeof addKasTab;
                        label: string;
                        icon: string;
                      }[]
                    )
                      .filter((tab) => {
                        // Sembunyikan tab Anggota untuk mode BULANAN (bulan otomatis)
                        if (
                          tab.key === "members" &&
                          newKasKolektifMode === "BULANAN"
                        )
                          return false;
                        return true;
                      })
                      .map((tab) => {
                        const isActive = addKasTab === tab.key;
                        return (
                          <Pressable
                            key={tab.key}
                            onPress={() => setAddKasTab(tab.key)}
                            style={[
                              styles.segmentBtn,
                              isActive && { backgroundColor: tintColor },
                            ]}
                          >
                            <Ionicons
                              name={tab.icon as any}
                              size={13}
                              color={isActive ? "white" : mutedColor}
                            />
                            <ThemedText
                              style={[
                                styles.segmentText,
                                { color: isActive ? "white" : mutedColor },
                              ]}
                            >
                              {tab.label}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                  </View>
                )}

                {/* Tab Nama */}
                {(newKasType === "STANDARD" || addKasTab === "name") && (
                  <View>
                    <ThemedText type="muted" style={styles.sectionLabel}>
                      Nama Buku
                    </ThemedText>
                    <TextInput
                      value={newKasName}
                      onChangeText={setNewKasName}
                      placeholder="Nama kas baru..."
                      placeholderTextColor={mutedColor}
                      style={[styles.input, { borderColor, color: textColor }]}
                    />
                  </View>
                )}

                {/* Tab Anggota (PERIODIK) */}
                {newKasType === "PERIODIK" && addKasTab === "members" && (
                  <View>
                    <ThemedText type="muted" style={styles.sectionLabel}>
                      Daftar Anggota ({newKasMembers.length})
                    </ThemedText>

                    {/* Tombol Edit Anggota dengan Checklist */}
                    <Pressable
                      onPress={() => {
                        setAddVisible(false);
                        router.push({
                          pathname: "/admin/edit-kas-members",
                          params: {
                            selectedMembers: JSON.stringify(newKasMembers),
                            mode: "add",
                          },
                        });
                      }}
                      style={({ pressed }) => [
                        styles.editMembersBtn,
                        {
                          backgroundColor: tintColor + "12",
                          borderColor: tintColor,
                        },
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <View
                        style={[
                          styles.editMembersBtnIcon,
                          { backgroundColor: tintColor },
                        ]}
                      >
                        <Ionicons name="people" size={18} color="white" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText
                          type="defaultSemiBold"
                          style={{ color: tintColor, fontSize: 15 }}
                        >
                          Edit Anggota
                        </ThemedText>
                        <ThemedText type="muted" style={{ fontSize: 12 }}>
                          Pilih anggota dari daftar akun yang ada
                        </ThemedText>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={tintColor}
                      />
                    </Pressable>

                    {/* Preview Anggota Saat Ini */}
                    {newKasMembers.length === 0 ? (
                      <View
                        style={{
                          alignItems: "center",
                          paddingVertical: 20,
                          gap: 8,
                        }}
                      >
                        <Ionicons
                          name="people-outline"
                          size={32}
                          color={mutedColor}
                        />
                        <ThemedText type="muted" style={{ fontSize: 13 }}>
                          Belum ada anggota
                        </ThemedText>
                        <ThemedText
                          type="muted"
                          style={{ fontSize: 12, textAlign: "center" }}
                        >
                          Gunakan tombol "Edit Anggota" di atas untuk
                          menambahkan
                        </ThemedText>
                      </View>
                    ) : (
                      <View style={{ marginTop: 16 }}>
                        <ThemedText
                          type="muted"
                          style={[styles.sectionLabel, { marginBottom: 8 }]}
                        >
                          Anggota Saat Ini
                        </ThemedText>
                        {newKasMembers.slice(0, 5).map((memberName, i) => (
                          <View
                            key={i}
                            style={[
                              styles.memberPreviewCard,
                              {
                                borderColor,
                                backgroundColor: "rgba(127,127,127,0.03)",
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.memberAvatar,
                                { backgroundColor: tintColor + "15" },
                              ]}
                            >
                              <ThemedText
                                style={{
                                  fontSize: 13,
                                  fontWeight: "700",
                                  color: tintColor,
                                }}
                              >
                                {memberName.charAt(0).toUpperCase()}
                              </ThemedText>
                            </View>
                            <ThemedText
                              style={{ color: textColor, fontSize: 14 }}
                            >
                              {memberName}
                            </ThemedText>
                          </View>
                        ))}
                        {newKasMembers.length > 5 && (
                          <View
                            style={[
                              styles.memberPreviewCard,
                              {
                                borderColor,
                                backgroundColor: "rgba(127,127,127,0.03)",
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.memberAvatar,
                                { backgroundColor: mutedColor + "15" },
                              ]}
                            >
                              <ThemedText
                                style={{
                                  fontSize: 13,
                                  fontWeight: "700",
                                  color: mutedColor,
                                }}
                              >
                                +{newKasMembers.length - 5}
                              </ThemedText>
                            </View>
                            <ThemedText
                              style={{ color: mutedColor, fontSize: 14 }}
                            >
                              dan {newKasMembers.length - 5} anggota lainnya
                            </ThemedText>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* Tab Kategori (PERIODIK) */}
                {newKasType === "PERIODIK" && addKasTab === "rates" && (
                  <View>
                    <ThemedText type="muted" style={styles.sectionLabel}>
                      Kategori & Nominal
                    </ThemedText>
                    {newKasCats.map((cat, i) => (
                      <View
                        key={i}
                        style={[styles.categoryCard, { borderColor }]}
                      >
                        <View
                          style={[
                            styles.categoryCardInner,
                            { backgroundColor: "rgba(127,127,127,0.03)" },
                          ]}
                        >
                          <View
                            style={[
                              styles.memberAvatar,
                              {
                                backgroundColor: tintColor + "12",
                                marginRight: 0,
                              },
                            ]}
                          >
                            <Ionicons
                              name="pricetag"
                              size={14}
                              color={tintColor}
                            />
                          </View>
                          <ThemedText
                            style={[
                              styles.categoryNameInput,
                              { color: textColor },
                            ]}
                          >
                            {cat.name}
                          </ThemedText>
                          <ThemedText
                            style={[
                              styles.categoryNominalInput,
                              { color: mutedColor },
                            ]}
                          >
                            {cat.nominal}
                          </ThemedText>
                          <Pressable
                            onPress={() =>
                              setNewKasCats((prev) =>
                                prev.filter((_, idx) => idx !== i),
                              )
                            }
                            style={({ pressed }) => [
                              styles.categoryDeleteBtn,
                              { backgroundColor: dangerColor + "12" },
                              pressed && { opacity: 0.6 },
                            ]}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={15}
                              color={dangerColor}
                            />
                          </Pressable>
                        </View>
                      </View>
                    ))}
                    <View style={styles.addRow}>
                      <TextInput
                        ref={addKasCatNameRef}
                        value={addKasCatName}
                        onChangeText={setAddKasCatName}
                        placeholder="Nama kategori..."
                        placeholderTextColor={mutedColor}
                        style={[
                          styles.addInput,
                          {
                            borderColor,
                            color: textColor,
                            backgroundColor: "rgba(127,127,127,0.04)",
                          },
                        ]}
                      />
                      <TextInput
                        value={addKasCatNominal}
                        onChangeText={setAddKasCatNominal}
                        placeholder="Nominal"
                        placeholderTextColor={mutedColor}
                        keyboardType="number-pad"
                        style={[
                          styles.addInputSmall,
                          {
                            borderColor,
                            color: textColor,
                            backgroundColor: "rgba(127,127,127,0.04)",
                          },
                        ]}
                      />
                      <Pressable
                        onPress={() => {
                          if (!addKasCatName.trim()) return;
                          setNewKasCats((prev) => [
                            ...prev,
                            {
                              name: addKasCatName.trim(),
                              nominal: addKasCatNominal,
                            },
                          ]);
                          setAddKasCatName("");
                          setAddKasCatNominal("");
                          setTimeout(
                            () => addKasCatNameRef.current?.focus(),
                            50,
                          );
                        }}
                        style={({ pressed }) => [
                          styles.addActionBtn,
                          { backgroundColor: tintColor },
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <Ionicons name="add" size={22} color="white" />
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* Tab Anggota (KOLEKTIF) */}
                {newKasType === "KOLEKTIF" && addKasTab === "members" && (
                  <View>
                    <ThemedText type="muted" style={styles.sectionLabel}>
                      Daftar Anggota ({newKasMembers.length})
                    </ThemedText>
                    <Pressable
                      onPress={() => {
                        setAddVisible(false);
                        router.push({
                          pathname: "/admin/edit-kas-members",
                          params: {
                            selectedMembers: JSON.stringify(newKasMembers),
                            mode: "add",
                          },
                        });
                      }}
                      style={({ pressed }) => [
                        styles.editMembersBtn,
                        {
                          backgroundColor: tintColor + "12",
                          borderColor: tintColor,
                        },
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <View
                        style={[
                          styles.editMembersBtnIcon,
                          { backgroundColor: tintColor },
                        ]}
                      >
                        <Ionicons name="people" size={18} color="white" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText
                          type="defaultSemiBold"
                          style={{ color: tintColor, fontSize: 15 }}
                        >
                          Edit Anggota
                        </ThemedText>
                        <ThemedText type="muted" style={{ fontSize: 12 }}>
                          Pilih dari daftar akun
                        </ThemedText>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={tintColor}
                      />
                    </Pressable>
                    {newKasMembers.length > 0 && (
                      <View style={{ marginTop: 8, gap: 6 }}>
                        {newKasMembers.slice(0, 4).map((n, i) => (
                          <View
                            key={i}
                            style={[
                              styles.memberPreviewCard,
                              {
                                borderColor,
                                backgroundColor: "rgba(127,127,127,0.03)",
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.memberAvatar,
                                { backgroundColor: tintColor + "15" },
                              ]}
                            >
                              <ThemedText
                                style={{
                                  fontSize: 13,
                                  fontWeight: "700",
                                  color: tintColor,
                                }}
                              >
                                {n.charAt(0).toUpperCase()}
                              </ThemedText>
                            </View>
                            <ThemedText
                              style={{ color: textColor, fontSize: 14 }}
                            >
                              {n}
                            </ThemedText>
                          </View>
                        ))}
                        {newKasMembers.length > 4 && (
                          <ThemedText
                            type="muted"
                            style={{ fontSize: 12, textAlign: "center" }}
                          >
                            +{newKasMembers.length - 4} lainnya
                          </ThemedText>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* Tab Tahun / Item (KOLEKTIF) */}
                {newKasType === "KOLEKTIF" &&
                  addKasTab === "rates" &&
                  newKasKolektifMode === "BULANAN" && (
                    <View>
                      <ThemedText type="muted" style={styles.sectionLabel}>
                        Tahun
                      </ThemedText>
                      {/* Stepper tahun — tidak perlu ketik manual */}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        <Pressable
                          onPress={() => {
                            const y = parseInt(newKasKolektifTahun, 10);
                            if (!isNaN(y) && y > 2000)
                              setNewKasKolektifTahun(String(y - 1));
                          }}
                          style={({ pressed }) => [
                            styles.addActionBtn,
                            { backgroundColor: "rgba(127,127,127,0.12)" },
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Ionicons name="remove" size={20} color={textColor} />
                        </Pressable>

                        <View
                          style={[
                            styles.input,
                            {
                              flex: 1,
                              borderColor,
                              alignItems: "center",
                              justifyContent: "center",
                              marginBottom: 0,
                            },
                          ]}
                        >
                          <ThemedText
                            style={{ fontSize: 18, fontWeight: "700" }}
                          >
                            {newKasKolektifTahun}
                          </ThemedText>
                        </View>

                        <Pressable
                          onPress={() => {
                            const y = parseInt(newKasKolektifTahun, 10);
                            if (!isNaN(y) && y < 2100)
                              setNewKasKolektifTahun(String(y + 1));
                          }}
                          style={({ pressed }) => [
                            styles.addActionBtn,
                            { backgroundColor: "rgba(127,127,127,0.12)" },
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Ionicons name="add" size={20} color={textColor} />
                        </Pressable>
                      </View>
                      <View
                        style={[
                          styles.infoCard,
                          {
                            borderColor: tintColor + "40",
                            backgroundColor: tintColor + "08",
                          },
                        ]}
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={16}
                          color={tintColor}
                        />
                        <ThemedText
                          style={{
                            fontSize: 12,
                            color: tintColor,
                            flex: 1,
                            lineHeight: 18,
                          }}
                        >
                          Mode bulanan: bulan Januari - Desember otomatis
                          digunakan sebagai "pembayar". Cocok untuk kas kolektif
                          per bulan (misal: iuran listrik bulanan).
                        </ThemedText>
                      </View>
                    </View>
                  )}

                {newKasType === "KOLEKTIF" &&
                  addKasTab === "rates" &&
                  newKasKolektifMode === "STANDARD" && (
                    <View>
                      <ThemedText type="muted" style={styles.sectionLabel}>
                        Item Kolektif
                      </ThemedText>
                      <View
                        style={[
                          styles.infoCard,
                          {
                            borderColor: tintColor + "40",
                            backgroundColor: tintColor + "08",
                          },
                        ]}
                      >
                        <Ionicons
                          name="information-circle-outline"
                          size={16}
                          color={tintColor}
                        />
                        <ThemedText
                          style={{
                            fontSize: 12,
                            color: tintColor,
                            flex: 1,
                            lineHeight: 18,
                          }}
                        >
                          Tambahkan item yang akan dikolektifkan beserta nominal
                          per anggota. Contoh: Kaos Hitam - Rp75.000
                        </ThemedText>
                      </View>
                      {newKasCats.map((cat, i) => (
                        <View
                          key={i}
                          style={[styles.categoryCard, { borderColor }]}
                        >
                          <View
                            style={[
                              styles.categoryCardInner,
                              { backgroundColor: "rgba(127,127,127,0.03)" },
                            ]}
                          >
                            <View
                              style={[
                                styles.memberAvatar,
                                {
                                  backgroundColor: tintColor + "12",
                                  marginRight: 0,
                                },
                              ]}
                            >
                              <Ionicons
                                name="basket"
                                size={14}
                                color={tintColor}
                              />
                            </View>
                            <ThemedText
                              style={[
                                styles.categoryNameInput,
                                { color: textColor },
                              ]}
                            >
                              {cat.name}
                            </ThemedText>
                            <ThemedText
                              style={[
                                styles.categoryNominalInput,
                                { color: mutedColor },
                              ]}
                            >
                              {formatRupiah(
                                parseInt(
                                  String(cat.nominal).replace(/\D/g, "") || "0",
                                  10,
                                ),
                              )}
                            </ThemedText>
                            <Pressable
                              onPress={() =>
                                setNewKasCats((prev) =>
                                  prev.filter((_, idx) => idx !== i),
                                )
                              }
                              style={({ pressed }) => [
                                styles.categoryDeleteBtn,
                                { backgroundColor: dangerColor + "12" },
                                pressed && { opacity: 0.6 },
                              ]}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={15}
                                color={dangerColor}
                              />
                            </Pressable>
                          </View>
                        </View>
                      ))}
                      <View style={styles.addRow}>
                        <TextInput
                          value={addKasCatName}
                          onChangeText={setAddKasCatName}
                          placeholder="Nama item (e.g. Kaos)..."
                          placeholderTextColor={mutedColor}
                          style={[
                            styles.addInput,
                            {
                              borderColor,
                              color: textColor,
                              backgroundColor: "rgba(127,127,127,0.04)",
                            },
                          ]}
                        />
                        <TextInput
                          value={addKasCatNominal}
                          onChangeText={setAddKasCatNominal}
                          placeholder="Nominal"
                          placeholderTextColor={mutedColor}
                          keyboardType="number-pad"
                          style={[
                            styles.addInputSmall,
                            {
                              borderColor,
                              color: textColor,
                              backgroundColor: "rgba(127,127,127,0.04)",
                            },
                          ]}
                        />
                        <Pressable
                          onPress={() => {
                            if (!addKasCatName.trim()) return;
                            setNewKasCats((prev) => [
                              ...prev,
                              {
                                name: addKasCatName.trim(),
                                nominal: addKasCatNominal,
                              },
                            ]);
                            setAddKasCatName("");
                            setAddKasCatNominal("");
                          }}
                          style={({ pressed }) => [
                            styles.addActionBtn,
                            { backgroundColor: tintColor },
                            pressed && { opacity: 0.8 },
                          ]}
                        >
                          <Ionicons name="add" size={22} color="white" />
                        </Pressable>
                      </View>
                    </View>
                  )}
              </View>
            </ScrollView>
            {/* Footer sticky — tombol simpan */}
            <View
              style={[
                isLandscape
                  ? styles.modalFooterFixedLandscape
                  : styles.modalFooterFixed,
                { borderTopColor: borderColor },
              ]}
            >
              <Pressable
                onPress={onAddKas}
                style={({ pressed }) => [
                  styles.btn,
                  { backgroundColor: tintColor },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="checkmark-circle" size={18} color="white" />
                <ThemedText type="defaultSemiBold" style={styles.btnText}>
                  Simpan Buku Kas
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* ── Modal Konfirmasi Hapus Buku Kas ── */}
      <Modal visible={!!deleteTarget} transparent animationType="fade">
        <View style={styles.modalCenterWrap}>
          <Pressable
            style={[styles.modalOverlay, { position: "absolute" }]}
            onPress={() => {
              if (!isDeleting) setDeleteTarget(null);
            }}
          />
          <ThemedView
            type="card"
            style={{
              width: isLandscape ? "70%" : "92%",
              padding: 24,
              borderRadius: 28,
            }}
          >
            <View style={{ alignItems: "center", marginBottom: 20 }}>
              <View
                style={[
                  styles.modalIconBox,
                  {
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: dangerColor + "15",
                    marginBottom: 16,
                  },
                ]}
              >
                <Ionicons name="trash-outline" size={32} color={dangerColor} />
              </View>
              <ThemedText
                type="defaultSemiBold"
                style={{ fontSize: 20, marginBottom: 8 }}
              >
                Hapus Buku Kas?
              </ThemedText>
              <ThemedText
                type="muted"
                style={{ textAlign: "center", fontSize: 14, lineHeight: 22 }}
              >
                Hapus{" "}
                <ThemedText type="defaultSemiBold">
                  "{deleteTarget?.nama}"
                </ThemedText>
                ? Seluruh data transaksi di dalamnya akan dihapus permanen.
              </ThemedText>
            </View>

            <ThemedText
              type="defaultSemiBold"
              style={[
                styles.sectionLabel,
                { textAlign: "center", marginBottom: 8, fontSize: 11 },
              ]}
            >
              Tulis "hapus kas ini" untuk konfirmasi:
            </ThemedText>
            <TextInput
              value={deleteInput}
              onChangeText={(txt) => {
                setDeleteInput(txt);
                if (deleteError) setDeleteError(false);
              }}
              placeholder="hapus kas ini"
              placeholderTextColor={mutedColor}
              autoCapitalize="none"
              style={[
                styles.input,
                {
                  borderColor: deleteError ? dangerColor : borderColor,
                  textAlign: "center",
                  backgroundColor: "rgba(127,127,127,0.04)",
                },
              ]}
            />
            {deleteError && (
              <ThemedText
                style={{
                  color: dangerColor,
                  fontSize: 12,
                  textAlign: "center",
                  marginTop: 4,
                  fontWeight: "600",
                }}
              >
                Teks konfirmasi tidak sesuai
              </ThemedText>
            )}

            <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
              <Pressable
                onPress={() => setDeleteTarget(null)}
                disabled={isDeleting}
                style={({ pressed }) => [
                  styles.btn,
                  {
                    flex: 1,
                    borderWidth: 1,
                    borderColor,
                    backgroundColor: "transparent",
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <ThemedText type="defaultSemiBold" style={{ color: textColor }}>
                  Batal
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={confirmDelete}
                disabled={
                  isDeleting ||
                  deleteInput.trim().toLowerCase() !== "hapus kas ini"
                }
                style={({ pressed }) => [
                  styles.btn,
                  {
                    flex: 1,
                    backgroundColor:
                      deleteInput.trim().toLowerCase() === "hapus kas ini"
                        ? dangerColor
                        : mutedColor + "40",
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <ThemedText type="defaultSemiBold" style={styles.btnText}>
                    Hapus
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* ── Modal Konfirmasi Hapus Item Kolektif ── */}
      <Modal
        visible={!!deleteKolektifItemTarget}
        transparent
        animationType="fade"
      >
        <View style={styles.modalCenterWrap}>
          <Pressable
            style={[styles.modalOverlay, { position: "absolute" }]}
            onPress={() => setDeleteKolektifItemTarget(null)}
          />
          <ThemedView
            type="card"
            style={{
              width: isLandscape ? "70%" : "92%",
              padding: 24,
              borderRadius: 28,
            }}
          >
            <View style={{ alignItems: "center", marginBottom: 20 }}>
              <View
                style={[
                  styles.modalIconBox,
                  {
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: dangerColor + "15",
                    marginBottom: 16,
                  },
                ]}
              >
                <Ionicons name="trash-outline" size={32} color={dangerColor} />
              </View>
              <ThemedText
                type="defaultSemiBold"
                style={{ fontSize: 18, marginBottom: 8, textAlign: "center" }}
              >
                Hapus Item?
              </ThemedText>
              <ThemedText
                type="muted"
                style={{ textAlign: "center", fontSize: 14, lineHeight: 20 }}
              >
                Item{" "}
                <ThemedText type="defaultSemiBold">
                  "{deleteKolektifItemTarget?.nama}"
                </ThemedText>{" "}
                akan dihapus beserta semua data setoran anggota untuk item ini.
              </ThemedText>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => setDeleteKolektifItemTarget(null)}
                disabled={deletingKolektifItem}
                style={({ pressed }) => [
                  styles.btn,
                  {
                    flex: 1,
                    borderWidth: 1,
                    borderColor,
                    backgroundColor: "transparent",
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <ThemedText type="defaultSemiBold" style={{ color: textColor }}>
                  Batal
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={onRemoveKolektifItem}
                disabled={deletingKolektifItem}
                style={({ pressed }) => [
                  styles.btn,
                  {
                    flex: 1,
                    backgroundColor: dangerColor,
                    opacity: pressed || deletingKolektifItem ? 0.7 : 1,
                  },
                ]}
              >
                <ThemedText type="defaultSemiBold" style={styles.btnText}>
                  {deletingKolektifItem ? "Menghapus..." : "Hapus"}
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
