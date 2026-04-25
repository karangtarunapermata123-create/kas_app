-- Tabel untuk menyimpan anggota yang aktif di absensi (berlaku global untuk semua kegiatan)
-- Jalankan di Supabase SQL Editor

create table if not exists public.absensi_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (user_id)
);

-- RLS
alter table public.absensi_members enable row level security;

-- Admin bisa baca/tulis semua
create policy "Admin full access" on public.absensi_members
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Semua user yang login bisa baca (untuk filter di halaman absensi)
create policy "Authenticated read" on public.absensi_members
  for select
  using (auth.uid() is not null);
