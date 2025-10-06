-- Check the order_changes table structure and policies
-- Run this in your Supabase SQL editor to verify everything is set up correctly

-- 1. Check table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'order_changes' 
ORDER BY ordinal_position;

-- 2. Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'order_changes';

-- 3. Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'order_changes';

-- 4. Test inserting a record (this will show if there are any permission issues)
-- Uncomment the lines below to test:
/*
INSERT INTO order_changes (
  order_id,
  user_id,
  change_type,
  field_name,
  old_value,
  new_value
) VALUES (
  14225,
  auth.uid(),
  'test_change',
  'test_field',
  'old_value',
  'new_value'
);
*/

-- 5. Check recent order changes
SELECT 
  oc.*,
  p.full_name as user_name,
  p.role as user_role
FROM order_changes oc
LEFT JOIN profiles p ON oc.user_id = p.id
WHERE oc.order_id = 14225
ORDER BY oc.created_at DESC
LIMIT 5;
