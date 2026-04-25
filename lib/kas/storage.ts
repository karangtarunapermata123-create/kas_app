import { supabase } from '@/lib/supabase/client';
import type { KasBook, KasState, KasTx } from './types';

export function emptyKasStateV2(): KasState {
  return { version: 2, activeKasId: '', books: [], txs: [] };
}

export async function loadKasState(): Promise<KasState> {
  try {
    const [booksRes, txsRes, metaRes] = await Promise.all([
      supabase.from('books').select('*'),
      supabase.from('txs').select('*'),
      supabase.from('meta').select('*').eq('key', 'activeKasId').single(),
    ]);

    const books: KasBook[] = (booksRes.data ?? []).map(rowToBook);
    const txs: KasTx[] = (txsRes.data ?? []).map(rowToTx);
    const activeKasId: string = metaRes.data?.value ?? '';

    return { version: 2, activeKasId, books, txs };
  } catch (e) {
    console.error('loadKasState error:', e);
    return emptyKasStateV2();
  }
}

export async function saveKasState(state: KasState): Promise<void> {
  try {
    const [booksRes, txsRes, metaRes] = await Promise.all([
      state.books.length > 0
        ? supabase.from('books').upsert(state.books.map(bookToRow))
        : Promise.resolve({ error: null }),
      state.txs.length > 0
        ? supabase.from('txs').upsert(state.txs.map(txToRow))
        : Promise.resolve({ error: null }),
      supabase.from('meta').upsert({ key: 'activeKasId', value: state.activeKasId }),
    ]);
    if (booksRes.error) console.error('books upsert error:', JSON.stringify(booksRes.error));
    if (txsRes.error) console.error('txs upsert error:', JSON.stringify(txsRes.error));
    if (metaRes.error) console.error('meta upsert error:', JSON.stringify(metaRes.error));
  } catch (e) {
    console.error('saveKasState error:', e);
    throw e;
  }
}

export async function deleteBookFromDB(bookId: string): Promise<void> {
  await supabase.from('books').delete().eq('id', bookId);
}

export async function deleteTxFromDB(txId: string): Promise<void> {
  await supabase.from('txs').delete().eq('id', txId);
}

export function sortTxsDesc(txs: KasTx[]): KasTx[] {
  return [...txs].sort((a, b) => {
    if (a.tanggalISO !== b.tanggalISO) return a.tanggalISO < b.tanggalISO ? 1 : -1;
    return b.updatedAt - a.updatedAt;
  });
}

// ── Mappers ──────────────────────────────────────────────

export function bookToRow(b: KasBook) {
  return {
    id: b.id,
    nama: b.nama,
    tipe: b.tipe ?? 'STANDARD',
    period_config: b.periodConfig ?? null,
    period_rates: b.periodRates ?? null,
    members: b.members ?? null,
    categories: b.categories ?? null,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
  };
}

export function rowToBook(row: any): KasBook {
  return {
    id: row.id,
    nama: row.nama,
    tipe: row.tipe,
    periodConfig: row.period_config,
    periodRates: row.period_rates,
    members: row.members,
    categories: row.categories,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function txToRow(t: KasTx) {
  return {
    id: t.id,
    kas_id: t.kasId,
    tanggal_iso: t.tanggalISO,
    jenis: t.jenis,
    kategori: t.kategori,
    deskripsi: t.deskripsi,
    nominal: t.nominal,
    periodik_data: t.periodikData ?? null,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
}

export function rowToTx(row: any): KasTx {
  return {
    id: row.id,
    kasId: row.kas_id,
    tanggalISO: row.tanggal_iso,
    jenis: row.jenis,
    kategori: row.kategori,
    deskripsi: row.deskripsi,
    nominal: row.nominal,
    periodikData: row.periodik_data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
