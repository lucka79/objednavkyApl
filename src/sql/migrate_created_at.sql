-- SQL script to add created_at column to profiles table and copy data from auth.users
-- Run this in your Supabase SQL editor

-- Step 1: Add created_at column to profiles table (if it doesn't exist)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE;

-- Step 2: Copy created_at data from auth.users to profiles table
UPDATE profiles 
SET created_at = auth.users.created_at
FROM auth.users 
WHERE profiles.id = auth.users.id;

-- Step 3: Set a default value for any profiles that don't have a created_at
-- (in case some profiles don't have corresponding auth.users records)
UPDATE profiles 
SET created_at = NOW() 
WHERE created_at IS NULL;

-- Step 4: Make the created_at column NOT NULL (optional)
-- ALTER TABLE profiles ALTER COLUMN created_at SET NOT NULL;

-- Step 5: Add an index for better performance (optional)
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);

-- Verify the data was copied correctly
SELECT 
    p.id,
    p.full_name,
    p.created_at as profile_created_at,
    au.created_at as auth_created_at
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id
ORDER BY p.created_at DESC
LIMIT 10; 