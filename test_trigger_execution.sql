-- Test script to verify trigger execution and order changes tracking
-- Run this in your Supabase SQL editor to test the trigger

-- 1. First, let's check if the trigger exists and is active
SELECT 
  trigger_name, 
  event_manipulation, 
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'track_order_changes' 
AND event_object_table = 'orders';

-- 2. Check if there are any recent order changes
SELECT 
  oc.*,
  p.full_name as user_name,
  p.role as user_role
FROM order_changes oc
LEFT JOIN profiles p ON oc.user_id = p.id
WHERE oc.order_id = 14225
ORDER BY oc.created_at DESC
LIMIT 10;

-- 3. Test the trigger by updating an order (this will create a test change)
-- Uncomment the line below to test:
-- UPDATE orders SET note = 'Test trigger execution - ' || now() WHERE id = 14225;

-- 4. Check the function definition
SELECT prosrc FROM pg_proc WHERE proname = 'record_order_change';

-- 5. Check for any recent errors in the database logs
-- (This might not be accessible depending on your Supabase plan)
SELECT * FROM pg_stat_user_functions WHERE funcname = 'record_order_change';
