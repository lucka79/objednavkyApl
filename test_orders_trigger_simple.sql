-- Simple test to verify the orders trigger is working
-- This will help us confirm if the trigger is firing

-- Check current status
SELECT 
  id,
  status,
  "crateSmall",
  "crateBig"
FROM orders 
WHERE id = 14225;

-- Test 1: Update status (this should work)
UPDATE orders 
SET status = 'Test Status 2'
WHERE id = 14225;

-- Test 2: Update crates (this should trigger crate changes)
UPDATE orders 
SET "crateSmall" = 3
WHERE id = 14225;

-- Test 3: Update crates again
UPDATE orders 
SET "crateSmall" = 7
WHERE id = 14225;

-- Check if any changes were recorded
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
LIMIT 10;
