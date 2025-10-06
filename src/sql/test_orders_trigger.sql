-- Test script to verify the orders trigger is working
-- This will help us debug why order status, driver, and crate changes aren't being tracked

-- First, let's check if the trigger exists
SELECT 
  trigger_name, 
  event_manipulation, 
  action_timing,
  event_object_table
FROM information_schema.triggers 
WHERE trigger_name = 'track_order_changes' 
AND event_object_table = 'orders';

-- Check if the function exists
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_name = 'record_order_change';

-- Test the trigger by manually updating an order
-- This will show us if the trigger is firing
DO $$
DECLARE
  test_order_id INTEGER := 14225; -- Use the order you're testing with
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'No authenticated user found - trigger may not work properly';
  ELSE
    RAISE NOTICE 'Current user ID: %', current_user_id;
  END IF;
  
  -- Try to update the order status to trigger the trigger
  UPDATE orders 
  SET status = 'Test Status' 
  WHERE id = test_order_id;
  
  RAISE NOTICE 'Order % updated to trigger the trigger', test_order_id;
END;
$$;

-- Check if any new changes were recorded
SELECT 
  id,
  order_id,
  change_type,
  field_name,
  old_value,
  new_value,
  created_at
FROM order_changes 
WHERE order_id = 14225 
ORDER BY created_at DESC 
LIMIT 5;

-- Check the current status of the order
SELECT 
  id,
  status,
  driver_id,
  "crateSmall",
  "crateBig",
  "crateSmallReceived",
  "crateBigReceived"
FROM orders 
WHERE id = 14225;
