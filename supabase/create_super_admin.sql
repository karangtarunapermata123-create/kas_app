-- Create first super admin user
-- Replace 'your-email@domain.com' and 'your-password' with your actual credentials
-- Run this in Supabase SQL Editor AFTER running the initial schema and super admin migrations

-- Method 1: If you want to create a user directly in the database
-- (Use this if you haven't registered through the app yet)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'your-email@domain.com',  -- CHANGE THIS
  crypt('your-password', gen_salt('bf')),  -- CHANGE THIS
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"nama_lengkap":"Super Admin"}',  -- CHANGE THIS
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);

-- Then update the profile role to super_admin
UPDATE public.profiles 
SET role = 'super_admin' 
WHERE email = 'your-email@domain.com';  -- CHANGE THIS

-- Method 2: If you already have a user account registered through the app
-- Just update the existing user's role to super_admin
-- UPDATE public.profiles 
-- SET role = 'super_admin' 
-- WHERE email = 'your-existing-email@domain.com';

-- Verify the super admin was created successfully
SELECT p.id, p.email, p.nama_lengkap, p.role, p.created_at
FROM public.profiles p
WHERE p.role = 'super_admin';