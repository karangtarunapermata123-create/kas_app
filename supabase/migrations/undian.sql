-- Tabel untuk anggota undian arisan
-- Jalankan di Supabase SQL Editor

-- Drop and recreate tables to ensure correct structure
drop table if exists public.undian_results cascade;
drop table if exists public.undian_sessions cascade;
drop table if exists public.undian_members cascade;

create table public.undian_members (
  id text not null primary key,
  session_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at bigint not null,
  unique(session_id, user_id)
);

-- Tabel untuk sesi undian
create table public.undian_sessions (
  id text not null primary key,
  label text not null,
  tanggal text not null,
  created_at bigint not null
);

-- Tabel untuk hasil undian
create table public.undian_results (
  id text not null primary key,
  session_id text not null references public.undian_sessions(id) on delete cascade,
  winner_id uuid not null,
  winner_name text not null,
  drawn_at bigint not null
);

-- RLS undian_members
alter table public.undian_members enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Admin full access undian_members" on public.undian_members;
drop policy if exists "Authenticated read undian_members" on public.undian_members;

create policy "Admin full access undian_members" on public.undian_members
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Authenticated read undian_members" on public.undian_members
  for select
  using (auth.uid() is not null);

-- RLS undian_sessions
alter table public.undian_sessions enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Admin full access undian_sessions" on public.undian_sessions;
drop policy if exists "Authenticated read undian_sessions" on public.undian_sessions;

create policy "Admin full access undian_sessions" on public.undian_sessions
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Authenticated read undian_sessions" on public.undian_sessions
  for select
  using (auth.uid() is not null);

-- RLS undian_results
alter table public.undian_results enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Admin full access undian_results" on public.undian_results;
drop policy if exists "Authenticated read undian_results" on public.undian_results;

create policy "Admin full access undian_results" on public.undian_results
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Authenticated read undian_results" on public.undian_results
  for select
  using (auth.uid() is not null);
