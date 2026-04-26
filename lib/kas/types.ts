export type KasTxType = 'MASUK' | 'KELUAR';

export type KasBookType = 'STANDARD' | 'PERIODIK' | 'KOLEKTIF';
export type PeriodType = 'MONTHLY' | 'WEEKLY';

export type KasMember = {
  id: string;
  nama: string;
};

export type KolektifItem = {
  id: string;       // unique id item
  nama: string;     // nama item, e.g. "Kaos Hitam"
  nominal: number;  // target setor per anggota
};

export type KasBook = {
  id: string;
  nama: string;
  tipe?: KasBookType;
  periodConfig?: {
    tipe: PeriodType;
    nominal: number;
  };
  periodRates?: Record<string, number>;
  members?: KasMember[];
  categories?: string[];
  kolektifItems?: KolektifItem[]; // item-item untuk buku kolektif
  editorIds?: string[];
  createdAt: number;
  updatedAt: number;
};

export type KasTx = {
  id: string;
  kasId: string;
  tanggalISO: string; // YYYY-MM-DD
  jenis: KasTxType;
  kategori: string;
  deskripsi: string;
  nominal: number; // integer rupiah
  periodikData?: {
    memberId: string;
    periodId: string; // e.g., '2023-10' for Oct 2023, or '2023-W40' for week 40
    categoryId?: string;
    count?: number;
    isTidakSetor?: boolean;
  };
  createdAt: number;
  updatedAt: number;
};

export type KasState = {
  version: 2;
  activeKasId: string;
  books: KasBook[];
  txs: KasTx[];
};

export function formatRupiah(value: number): string {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    // Fallback for environments missing Intl
    return `Rp ${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  }
}

export function normalizeTanggalISO(input: string): string {
  // Accepts YYYY-MM-DD; otherwise returns today's date in that format.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function computeSaldo(txs: KasTx[]): { masuk: number; keluar: number; saldo: number } {
  let masuk = 0;
  let keluar = 0;
  for (const t of txs) {
    if (t.jenis === 'MASUK') masuk += t.nominal;
    else keluar += t.nominal;
  }
  return { masuk, keluar, saldo: masuk - keluar };
}
