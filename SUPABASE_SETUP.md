# Panduan Setup Supabase untuk Buku Kas

## 1. Buat Project Supabase

1. Buka [supabase.com](https://supabase.com) dan login
2. Klik **"New project"**
3. Isi nama project, password database, pilih region **Southeast Asia (Singapore)**
4. Tunggu project selesai dibuat (~1-2 menit)

---

## 2. Jalankan SQL Setup (Copy Paste Sekali)

Buka **SQL Editor** di sidebar Supabase, copy semua SQL di bawah ini sekaligus, lalu klik **Run**:

```sql
-- =============================================
-- TABEL UTAMA
-- =============================================

create table books (
  id text primary key,
  nama text not null,
  tipe text default 'STANDARD',
  period_config jsonb,
  period_rates jsonb,
  members jsonb,
  categories jsonb,
  created_at bigint,
  updated_at bigint
);

create table txs (
  id text primary key,
  kas_id text references books(id) on delete cascade,
  tanggal_iso text,
  jenis text,
  kategori text,
  deskripsi text,
  nominal bigint,
  periodik_data jsonb,
  created_at bigint,
  updated_at bigint
);

create table meta (
  key text primary key,
  value jsonb
);

create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  role text default 'member' check (role in ('admin', 'member')),
  created_at timestamptz default now()
);

-- =============================================
-- TRIGGER AUTO-CREATE PROFILE
-- =============================================

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'member')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

alter table books enable row level security;
create policy "anyone can read books" on books for select using (true);
create policy "authenticated can write books" on books for insert with check (auth.role() = 'authenticated');
create policy "authenticated can update books" on books for update using (auth.role() = 'authenticated');
create policy "authenticated can delete books" on books for delete using (auth.role() = 'authenticated');

alter table txs enable row level security;
create policy "anyone can read txs" on txs for select using (true);
create policy "authenticated can write txs" on txs for insert with check (auth.role() = 'authenticated');
create policy "authenticated can update txs" on txs for update using (auth.role() = 'authenticated');
create policy "authenticated can delete txs" on txs for delete using (auth.role() = 'authenticated');

alter table meta enable row level security;
create policy "anyone can read meta" on meta for select using (true);
create policy "authenticated can write meta" on meta for insert with check (auth.role() = 'authenticated');
create policy "authenticated can update meta" on meta for update using (auth.role() = 'authenticated');

alter table profiles enable row level security;
create policy "authenticated can read profiles" on profiles for select using (auth.role() = 'authenticated');
create policy "admin can update profiles" on profiles for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

grant insert on public.profiles to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;
```

---

## 3. Setup Authentication

1. Di Supabase dashboard, buka **Authentication → Providers**
2. Pastikan **Email** sudah enabled
3. Buka **Authentication → Settings**, matikan **"Confirm email"** (opsional, untuk kemudahan development)

---

## 4. Buat Akun Admin Pertama

### Cara 1: Daftar lewat app, lalu set role admin via SQL

1. Buka app, daftar akun dengan email admin
2. Jalankan SQL berikut di SQL Editor:

```sql
-- Insert profile jika belum ada (untuk user yang daftar sebelum trigger dipasang)
insert into profiles (id, email, role)
select u.id, u.email, 'member'
from auth.users u
left join profiles p on p.id = u.id
where p.id is null;

-- Set role admin
update profiles set role = 'admin' where email = 'emailadmin@gmail.com';
```

### Cara 2: Buat user langsung dari Supabase Dashboard

1. Buka **Authentication → Users → Add user → Create new user**
2. Isi email dan password, centang **"Auto Confirm User"**
3. Jalankan SQL untuk set role admin (sama seperti di atas)

---

## 5. Konfigurasi App

1. Buka **Settings → API Keys** di Supabase dashboard
2. Copy **Project URL** dan **Publishable key**
3. Buat file `.env` di root project:

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx...
```

4. Restart Expo: `npx expo start --clear`

---

## 6. Menambah Admin Baru

Jalankan SQL berikut di SQL Editor:

```sql
update profiles set role = 'admin' where email = 'email_admin_baru@gmail.com';
```

## 7. Menurunkan Admin menjadi Member

```sql
update profiles set role = 'member' where email = 'email@gmail.com';
```
