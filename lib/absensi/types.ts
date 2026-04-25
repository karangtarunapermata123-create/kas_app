export type AbsensiEvent = {
  id: string;
  nama: string;
  deskripsi?: string;
  tipe: 'SEKALI' | 'RUTIN'; // sekali = satu kali, rutin = berulang
  periodType?: 'WEEKLY' | 'MONTHLY'; // hanya untuk RUTIN
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

export type EventSession = {
  id: string;
  eventId: string;
  label: string; // misal "Januari 2025", "Minggu 1"
  tanggal: string; // YYYY-MM-DD
  createdAt: number;
};

export type Attendance = {
  id: string;
  eventId: string;
  sessionId: string; // referensi ke sesi
  userId: string;
  namaUser: string;
  waktuAbsen: number;
};
