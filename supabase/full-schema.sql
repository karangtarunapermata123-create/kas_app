-- =====================================================
-- FULL SCHEMA SQL UNTUK MIGRASI SUPABASE
-- =====================================================
-- File ini berisi semua tabel, RLS policies, dan konfigurasi
-- yang diperlukan untuk migrasi ke akun Supabase baru
-- 
-- Jalankan script ini di SQL Editor Supabase yang baru
-- =====================================================

-- =====================================================
-- 1. TABEL PROFILES (User profiles)
-- =====================================================

-- Tabel untuk menyimpan profil user
create table if not exists public.profiles (
  id uuid not null references auth.users(id) on delete cascade,
  email text,
  nama_lengkap text,
  role text default 'member' check (role in ('admin', 'member')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  primary key (id)
);

-- RLS untuk profiles
alter table public.profiles enable row level security;

-- Admin bisa baca/tulis semua profiles
create policy "Admin full access profiles" on public.profiles
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- User bisa baca semua profiles (untuk dropdown, list anggota, dll)
create policy "Authenticated read profiles" on public.profiles
  for select
  using (auth.uid() is not null);

-- User bisa update profil sendiri
create policy "Users can update own profile" on public.profiles
  for update
  using (auth.uid() = id);

-- =====================================================
-- 2. TABEL EVENTS (Kegiatan absensi)
-- =====================================================

-- Tabel untuk menyimpan kegiatan/event absensi
create table if not exists public.events (
  id text not null primary key,
  nama text not null,
  tipe text not null check (tipe in ('BULANAN', 'MINGGUAN', 'SEKALI')),
  created_at bigint not null
);

-- RLS untuk events
alter table public.events enable row level security;

-- Admin bisa baca/tulis semua events
create policy "Admin full access events" on public.events
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Semua user yang login bisa baca events
create policy "Authenticated read events" on public.events
  for select
  using (auth.uid() is not null);

-- =====================================================
-- 3. TABEL EVENT_SESSIONS (Sesi dalam event)
-- =====================================================

-- Tabel untuk menyimpan sesi dalam setiap event
create table if not exists public.event_sessions (
  id text not null primary key,
  event_id text not null references public.events(id) on delete cascade,
  label text not null,
  tanggal text not null,
  created_at bigint not null
);

-- RLS untuk event_sessions
alter table public.event_sessions enable row level security;

-- Admin bisa baca/tulis semua event_sessions
create policy "Admin full access event_sessions" on public.event_sessions
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Semua user yang login bisa baca event_sessions
create policy "Authenticated read event_sessions" on public.event_sessions
  for select
  using (auth.uid() is not null);

-- =====================================================
-- 4. TABEL ATTENDANCES (Kehadiran)
-- =====================================================

-- Tabel untuk menyimpan data kehadiran
create table if not exists public.attendances (
  id text not null primary key,
  event_id text not null references public.events(id) on delete cascade,
  session_id text not null references public.event_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nama_user text not null,
  waktu_absen bigint not null,
  unique(session_id, user_id)
);

-- RLS untuk attendances
alter table public.attendances enable row level security;

-- Admin bisa baca/tulis semua attendances
create policy "Admin full access attendances" on public.attendances
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Semua user yang login bisa baca attendances
create policy "Authenticated read attendances" on public.attendances
  for select
  using (auth.uid() is not null);

-- User bisa insert attendance untuk diri sendiri (jika ada fitur self-checkin)
create policy "Users can insert own attendance" on public.attendances
  for insert
  with check (auth.uid() = user_id);

-- =====================================================
-- 5. TABEL ABSENSI_MEMBERS (Anggota aktif absensi)
-- =====================================================

-- Tabel untuk menyimpan anggota yang aktif di absensi (berlaku global untuk semua kegiatan)
create table if not exists public.absensi_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (user_id)
);

-- RLS untuk absensi_members
alter table public.absensi_members enable row level security;

-- Admin bisa baca/tulis semua
create policy "Admin full access absensi_members" on public.absensi_members
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Semua user yang login bisa baca (untuk filter di halaman absensi)
create policy "Authenticated read absensi_members" on public.absensi_members
  for select
  using (auth.uid() is not null);

-- =====================================================
-- 6. TABEL UNDIAN_SESSIONS (Sesi undian)
-- =====================================================

-- Tabel untuk sesi undian
create table if not exists public.undian_sessions (
  id text not null primary key,
  label text not null,
  tanggal text not null,
  created_at bigint not null
);

-- RLS untuk undian_sessions
alter table public.undian_sessions enable row level security;

-- Admin bisa baca/tulis semua undian_sessions
create policy "Admin full access undian_sessions" on public.undian_sessions
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Semua user yang login bisa baca undian_sessions
create policy "Authenticated read undian_sessions" on public.undian_sessions
  for select
  using (auth.uid() is not null);

-- =====================================================
-- 7. TABEL UNDIAN_MEMBERS (Anggota undian)
-- =====================================================

-- Tabel untuk anggota undian arisan
create table if not exists public.undian_members (
  id text not null primary key,
  session_id text not null references public.undian_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at bigint not null,
  unique(session_id, user_id)
);

-- RLS untuk undian_members
alter table public.undian_members enable row level security;

-- Admin bisa baca/tulis semua undian_members
create policy "Admin full access undian_members" on public.undian_members
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Semua user yang login bisa baca undian_members
create policy "Authenticated read undian_members" on public.undian_members
  for select
  using (auth.uid() is not null);

-- =====================================================
-- 8. TABEL UNDIAN_RESULTS (Hasil undian)
-- =====================================================

-- Tabel untuk hasil undian
create table if not exists public.undian_results (
  id text not null primary key,
  session_id text not null references public.undian_sessions(id) on delete cascade,
  winner_id uuid not null references auth.users(id) on delete cascade,
  winner_name text not null,
  drawn_at bigint not null
);

-- RLS untuk undian_results
alter table public.undian_results enable row level security;

-- Admin bisa baca/tulis semua undian_results
create policy "Admin full access undian_results" on public.undian_results
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Semua user yang login bisa baca undian_results
create policy "Authenticated read undian_results" on public.undian_results
  for select
  using (auth.uid() is not null);

-- =====================================================
-- 9. TABEL BOOKS (Buku Kas)
-- =====================================================

-- Tabel untuk menyimpan buku kas (STANDARD dan PERIODIK)
create table if not exists public.books (
  id text not null primary key,
  nama text not null,
  tipe text default 'STANDARD' check (tipe in ('STANDARD', 'PERIODIK')),
  period_config jsonb,
  period_rates jsonb,
  members jsonb,
  categories jsonb,
  created_at bigint not null,
  updated_at bigint not null
);

-- RLS untuk books
alter table public.books enable row level security;

-- Admin bisa baca/tulis semua books
create policy "Admin full access books" on public.books
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Semua user yang login bisa baca books
create policy "Authenticated read books" on public.books
  for select
  using (auth.uid() is not null);

-- =====================================================
-- 10. TABEL TXS (Transaksi Kas)
-- =====================================================

-- Tabel untuk menyimpan transaksi kas
create table if not exists public.txs (
  id text not null primary key,
  kas_id text not null references public.books(id) on delete cascade,
  tanggal_iso text not null,
  jenis text not null check (jenis in ('MASUK', 'KELUAR')),
  kategori text not null,
  deskripsi text not null,
  nominal bigint not null,
  periodik_data jsonb,
  created_at bigint not null,
  updated_at bigint not null
);

-- RLS untuk txs
alter table public.txs enable row level security;

-- Admin bisa baca/tulis semua txs
create policy "Admin full access txs" on public.txs
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Semua user yang login bisa baca txs
create policy "Authenticated read txs" on public.txs
  for select
  using (auth.uid() is not null);

-- =====================================================
-- 11. TABEL META (Metadata Aplikasi)
-- =====================================================

-- Tabel untuk menyimpan metadata aplikasi seperti activeKasId
create table if not exists public.meta (
  key text not null primary key,
  value text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- RLS untuk meta
alter table public.meta enable row level security;

-- Admin bisa baca/tulis semua meta
create policy "Admin full access meta" on public.meta
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Semua user yang login bisa baca meta
create policy "Authenticated read meta" on public.meta
  for select
  using (auth.uid() is not null);

-- =====================================================
-- 12. INDEXES UNTUK PERFORMA
-- =====================================================

-- Index untuk performa query yang sering digunakan
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(email);

create index if not exists idx_events_tipe on public.events(tipe);
create index if not exists idx_events_created_at on public.events(created_at);

create index if not exists idx_event_sessions_event_id on public.event_sessions(event_id);
create index if not exists idx_event_sessions_tanggal on public.event_sessions(tanggal);

create index if not exists idx_attendances_event_id on public.attendances(event_id);
create index if not exists idx_attendances_session_id on public.attendances(session_id);
create index if not exists idx_attendances_user_id on public.attendances(user_id);

create index if not exists idx_undian_members_session_id on public.undian_members(session_id);
create index if not exists idx_undian_members_user_id on public.undian_members(user_id);

create index if not exists idx_undian_results_session_id on public.undian_results(session_id);

create index if not exists idx_books_tipe on public.books(tipe);
create index if not exists idx_books_created_at on public.books(created_at);

create index if not exists idx_txs_kas_id on public.txs(kas_id);
create index if not exists idx_txs_tanggal_iso on public.txs(tanggal_iso);
create index if not exists idx_txs_jenis on public.txs(jenis);

create index if not exists idx_meta_key on public.meta(key);

-- =====================================================
-- 13. FUNCTIONS & TRIGGERS (Opsional)
-- =====================================================

-- Function untuk auto-update updated_at pada profiles dan meta
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger untuk auto-update updated_at pada profiles
drop trigger if exists on_profiles_updated on public.profiles;
create trigger on_profiles_updated
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- Trigger untuk auto-update updated_at pada meta
drop trigger if exists on_meta_updated on public.meta;
create trigger on_meta_updated
  before update on public.meta
  for each row execute procedure public.handle_updated_at();

-- =====================================================
-- 14. REALTIME SUBSCRIPTIONS
-- =====================================================

-- Enable realtime untuk tabel yang memerlukan update real-time
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.event_sessions;
alter publication supabase_realtime add table public.attendances;
alter publication supabase_realtime add table public.absensi_members;
alter publication supabase_realtime add table public.undian_sessions;
alter publication supabase_realtime add table public.undian_members;
alter publication supabase_realtime add table public.undian_results;
alter publication supabase_realtime add table public.books;
alter publication supabase_realtime add table public.txs;
alter publication supabase_realtime add table public.meta;

-- =====================================================
-- SELESAI
-- =====================================================

-- Schema lengkap sudah dibuat!
-- 
-- LANGKAH SELANJUTNYA:
-- 1. Jalankan script ini di SQL Editor Supabase baru
-- 2. Buat user admin pertama melalui Authentication > Users
-- 3. Update role user admin di tabel profiles menjadi 'admin'
-- 4. Export data dari Supabase lama dan import ke yang baru
-- 5. Update environment variables (.env) dengan URL dan keys yang baru
-- 
-- CATATAN PENTING:
-- - Pastikan semua environment variables sudah diupdate
-- - Test semua fitur setelah migrasi
-- - Backup data lama sebelum migrasi