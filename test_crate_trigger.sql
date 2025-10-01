-- Test if the orders trigger is firing for crate changes
-- This will help us debug why crate changes aren't being tracked

-- First, let's check the current state
SELECT 
  id,
  "crateSmall",
  "crateBig",
  "crateSmallReceived", 
  "crateBigReceived"
FROM orders 
WHERE id = 14225;

-- Test updating crate values to trigger the trigger
DO $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'AUTH.UID() returned NULL - this might be why crate changes are not tracked';
  ELSE
    RAISE NOTICE 'Current user ID: %', current_user_id;
  END IF;
  
  -- Try to update crate values
  UPDATE orders 
  SET "crateSmall" = 10
  WHERE id = 14225;
  
  RAISE NOTICE 'Updated crateSmall to 10 for order 14225';
  
  -- Wait a moment
  PERFORM pg_sleep(1);
  
  -- Update again
  UPDATE orders 
  SET "crateSmall" = 15
  WHERE id = 14225;
  
  RAISE NOTICE 'Updated crateSmall to 15 for order 14225';
  
  -- Update big crates
  UPDATE orders 
  SET "crateBig" = 3
  WHERE id = 14225;
  
  RAISE NOTICE 'Updated crateBig to 3 for order 14225';
  
  -- Update received crates
  UPDATE orders 
  SET "crateSmallReceived" = 2
  WHERE id = 14225;
  
  RAISE NOTICE 'Updated crateSmallReceived to 2 for order 14225';
  
  RAISE NOTICE 'Crate update test completed - check order_changes table for new entries';
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
  created_at,
  user_id
FROM order_changes 
WHERE order_id = 14225 
ORDER BY created_at DESC 
LIMIT 5;
