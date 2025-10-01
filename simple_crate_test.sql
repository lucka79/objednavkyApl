-- Simple test to check if crate changes are being tracked
-- This will help us debug the crate changes issue

-- Check current crate values
SELECT 
  id,
  "crateSmall",
  "crateBig",
  "crateSmallReceived", 
  "crateBigReceived"
FROM orders 
WHERE id = 14225;

-- Update crate values to test the trigger
UPDATE orders 
SET "crateSmall" = 5
WHERE id = 14225;

-- Update again to test change detection
UPDATE orders 
SET "crateSmall" = 10
WHERE id = 14225;

-- Check if changes were recorded
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
