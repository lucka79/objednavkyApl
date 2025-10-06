-- Check if crate changes are being recorded in order_changes table
-- This will help us debug why crate changes aren't showing in the dialog

-- Check recent changes for order 14225
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

-- Check if there are any crate-related changes
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
AND (
  change_type LIKE '%crate%' 
  OR field_name LIKE '%crate%'
  OR field_name IN ('crateSmall', 'crateBig', 'crateSmallReceived', 'crateBigReceived')
)
ORDER BY created_at DESC;

-- Check the current crate values for order 14225
SELECT 
  id,
  status,
  "crateSmall",
  "crateBig", 
  "crateSmallReceived",
  "crateBigReceived"
FROM orders 
WHERE id = 14225;

-- Test if we can manually insert a crate change
DO $$
DECLARE
  test_user_id UUID;
BEGIN
  test_user_id := auth.uid();
  
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'No user ID available for manual test';
  ELSE
    -- Try to insert a test crate change
    INSERT INTO order_changes (
      order_id,
      user_id,
      change_type,
      field_name,
      old_value,
      new_value
    ) VALUES (
      14225,
      test_user_id,
      'crate_small_change',
      'crateSmall',
      '0',
      '5'
    );
    RAISE NOTICE 'Manual crate change inserted successfully';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Manual crate change failed: %', SQLERRM;
END;
$$;
