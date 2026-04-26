-- Initial database schema for Kas IRB App
-- Run this in Supabase SQL Editor
-- This script is idempotent - safe to run multiple times

-- Create user role enum (skip if already exists)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'member');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  nama_lengkap TEXT,
  role user_role DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role without triggering RLS recursion
-- SECURITY DEFINER runs as function owner, bypassing RLS on profiles
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role::TEXT FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles policies (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can manage member profiles" ON public.profiles;

CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Use get_my_role() to avoid infinite recursion
CREATE POLICY "Super admin can manage all profiles" ON public.profiles
  FOR ALL USING (public.get_my_role() = 'super_admin');

CREATE POLICY "Admin can manage member profiles" ON public.profiles
  FOR ALL USING (
    public.get_my_role() IN ('admin', 'super_admin')
    AND (role::TEXT = 'member' OR id = auth.uid())
  );

-- Create meta table (for app-wide key-value state like activeKasId)
CREATE TABLE IF NOT EXISTS public.meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Enable RLS on meta
ALTER TABLE public.meta ENABLE ROW LEVEL SECURITY;

-- Meta policies
DROP POLICY IF EXISTS "Authenticated users can read meta" ON public.meta;
DROP POLICY IF EXISTS "Admin can manage meta" ON public.meta;

CREATE POLICY "Authenticated users can read meta" ON public.meta
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage meta" ON public.meta
  FOR ALL USING (
    public.get_my_role() IN ('super_admin', 'admin')
  );

-- Create books table
CREATE TABLE IF NOT EXISTS public.books (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  tipe TEXT DEFAULT 'STANDARD',
  period_config JSONB,
  period_rates JSONB,
  members JSONB,
  categories TEXT[],
  created_by UUID REFERENCES auth.users(id),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- Enable RLS on books
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

-- Books policies
DROP POLICY IF EXISTS "Super admin full access books" ON public.books;
DROP POLICY IF EXISTS "All authenticated users can read books" ON public.books;

CREATE POLICY "Super admin full access books" ON public.books
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "All authenticated users can read books" ON public.books
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.txs (
  id TEXT PRIMARY KEY,
  kas_id TEXT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  tanggal_iso TEXT NOT NULL,
  jenis TEXT NOT NULL,
  kategori TEXT NOT NULL,
  deskripsi TEXT NOT NULL,
  nominal BIGINT NOT NULL,
  periodik_data JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- Enable RLS on txs
ALTER TABLE public.txs ENABLE ROW LEVEL SECURITY;

-- Transactions policies
DROP POLICY IF EXISTS "Admin and super admin full access txs" ON public.txs;
DROP POLICY IF EXISTS "Super admin full access txs" ON public.txs;
DROP POLICY IF EXISTS "All authenticated users can read txs" ON public.txs;

-- Hanya super admin yang bisa tambah/edit/hapus transaksi
CREATE POLICY "Super admin full access txs" ON public.txs
  FOR ALL USING (
    public.get_my_role() = 'super_admin'
  );

CREATE POLICY "All authenticated users can read txs" ON public.txs
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Create events table (for absensi)
CREATE TABLE IF NOT EXISTS public.events (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  deskripsi TEXT,
  tipe TEXT DEFAULT 'SEKALI',
  period_type TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- Enable RLS on events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Events policies
DROP POLICY IF EXISTS "Admin and super admin full access events" ON public.events;
DROP POLICY IF EXISTS "All authenticated users can read events" ON public.events;

CREATE POLICY "Admin and super admin full access events" ON public.events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "All authenticated users can read events" ON public.events
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Create event_sessions table
CREATE TABLE IF NOT EXISTS public.event_sessions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  tanggal TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

-- Enable RLS on event_sessions
ALTER TABLE public.event_sessions ENABLE ROW LEVEL SECURITY;

-- Event sessions policies
DROP POLICY IF EXISTS "Admin and super admin full access event_sessions" ON public.event_sessions;
DROP POLICY IF EXISTS "All authenticated users can read event_sessions" ON public.event_sessions;

CREATE POLICY "Admin and super admin full access event_sessions" ON public.event_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "All authenticated users can read event_sessions" ON public.event_sessions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Create attendances table
CREATE TABLE IF NOT EXISTS public.attendances (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES public.event_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nama_user TEXT NOT NULL,
  waktu_absen BIGINT NOT NULL,
  UNIQUE(session_id, user_id)
);

-- Enable RLS on attendances
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

-- Attendances policies
DROP POLICY IF EXISTS "Admin and super admin full access attendances" ON public.attendances;
DROP POLICY IF EXISTS "Users can create own attendance" ON public.attendances;
DROP POLICY IF EXISTS "All authenticated users can read attendances" ON public.attendances;

CREATE POLICY "Admin and super admin full access attendances" ON public.attendances
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can create own attendance" ON public.attendances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "All authenticated users can read attendances" ON public.attendances
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nama_lengkap, role)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'nama_lengkap', 'member');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Comment for documentation
COMMENT ON TYPE user_role IS 'User roles: super_admin (full access), admin (manage activities and members), member (participate only)';
