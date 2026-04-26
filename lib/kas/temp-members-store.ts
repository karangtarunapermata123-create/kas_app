// Simple in-memory store untuk pass data anggota antar halaman

type PendingData = {
  members: string[];
  mode: 'add' | 'edit'; // add = tambah buku kas baru, edit = edit buku kas existing
  kasId?: string;       // hanya untuk mode edit
};

let _pending: PendingData | null = null;

export function setPendingMembers(members: string[], mode: 'add' | 'edit', kasId?: string) {
  _pending = { members, mode, kasId };
}

export function getPendingMembers(): PendingData | null {
  return _pending;
}

export function clearPendingMembers() {
  _pending = null;
}
