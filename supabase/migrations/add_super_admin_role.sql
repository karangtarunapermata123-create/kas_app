-- Add super_admin role to existing user_role enum
-- Run this in Supabase SQL Editor AFTER the initial schema is created

-- Check if user_role type exists, if not create it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'member');
    ELSE
        -- Add super_admin if it doesn't exist
        BEGIN
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
        EXCEPTION
            WHEN duplicate_object THEN
                -- Value already exists, do nothing
                NULL;
        END;
    END IF;
END $$;

-- Update existing policies to include super_admin
-- Drop and recreate policies that need to include super_admin

-- Helper function to get current user's role without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role::TEXT FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Update profiles policies
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

-- Update books policies - only super admin can manage books
DROP POLICY IF EXISTS "Super admin full access books" ON public.books;
CREATE POLICY "Super admin full access books" ON public.books
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Update other policies to include super_admin where needed
DROP POLICY IF EXISTS "Admin and super admin full access txs" ON public.txs;
CREATE POLICY "Admin and super admin full access txs" ON public.txs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admin and super admin full access events" ON public.events;
CREATE POLICY "Admin and super admin full access events" ON public.events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admin and super admin full access event_sessions" ON public.event_sessions;
CREATE POLICY "Admin and super admin full access event_sessions" ON public.event_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admin and super admin full access attendances" ON public.attendances;
CREATE POLICY "Admin and super admin full access attendances" ON public.attendances
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Update undian policies if tables exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'undian_members') THEN
        DROP POLICY IF EXISTS "Admin full access undian_members" ON public.undian_members;
        CREATE POLICY "Admin full access undian_members" ON public.undian_members
          FOR ALL USING (
            EXISTS (
              SELECT 1 FROM public.profiles
              WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
            )
          );
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'undian_sessions') THEN
        DROP POLICY IF EXISTS "Admin full access undian_sessions" ON public.undian_sessions;
        CREATE POLICY "Admin full access undian_sessions" ON public.undian_sessions
          FOR ALL USING (
            EXISTS (
              SELECT 1 FROM public.profiles
              WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
            )
          );
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'undian_results') THEN
        DROP POLICY IF EXISTS "Admin full access undian_results" ON public.undian_results;
        CREATE POLICY "Admin full access undian_results" ON public.undian_results
          FOR ALL USING (
            EXISTS (
              SELECT 1 FROM public.profiles
              WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
            )
          );
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'absensi_members') THEN
        DROP POLICY IF EXISTS "Admin full access" ON public.absensi_members;
        CREATE POLICY "Admin full access" ON public.absensi_members
          FOR ALL USING (
            EXISTS (
              SELECT 1 FROM public.profiles
              WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
            )
          );
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON TYPE user_role IS 'User roles: super_admin (full access), admin (manage activities and members), member (participate only)';