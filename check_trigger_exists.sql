-- Check if the orders trigger exists and is active
-- This will help us identify why the trigger isn't working

-- 1. Check if the trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  event_object_table,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'track_order_changes'
AND event_object_table = 'orders';

-- 2. Check if the function exists
SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'record_order_change'
AND routine_schema = 'public';

-- 3. Check if there are any errors in the trigger
-- Look for any warnings or errors in the logs
SELECT 
  'Check Supabase logs for any trigger errors' as note;

-- 4. Test if we can manually call the trigger function
DO $$
DECLARE
  test_user_id UUID;
BEGIN
  test_user_id := auth.uid();
  
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'AUTH.UID() returned NULL - this is the problem!';
  ELSE
    RAISE NOTICE 'AUTH.UID() returned: %', test_user_id;
  END IF;
  
  -- Try to insert a test record manually
  BEGIN
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
      'manual_trigger_test',
      'test_field',
      'old_value',
      'new_value'
    );
    RAISE NOTICE 'Manual insert successful';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Manual insert failed: %', SQLERRM;
  END;
END;
$$;

-- 5. Check recent order_changes entries
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
