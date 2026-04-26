-- Verification queries to check if database setup is complete
-- Run these in Supabase SQL Editor to verify everything is working

-- 1. Check if user_role enum exists and has correct values
SELECT unnest(enum_range(NULL::user_role)) as available_roles;

-- 2. Check if all required tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'books', 'txs', 'events', 'event_sessions', 'attendances')
ORDER BY table_name;

-- 3. Check profiles table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Check if there are any super admin users
SELECT id, email, nama_lengkap, role, created_at
FROM public.profiles
WHERE role = 'super_admin';

-- 5. Check RLS policies for profiles table
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles';

-- 6. Check if the user registration trigger exists
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public' AND event_object_table = 'users';

-- 7. Test role hierarchy (should return true for super_admin)
SELECT 
  'super_admin'::user_role = 'super_admin' as is_super_admin,
  'admin'::user_role = 'admin' as is_admin,
  'member'::user_role = 'member' as is_member;