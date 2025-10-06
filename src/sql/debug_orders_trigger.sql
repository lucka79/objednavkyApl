-- Debug script to check the orders trigger
-- This will help us identify why the trigger isn't working

-- 1. Check if the trigger exists and is active
SELECT 
  t.trigger_name,
  t.event_manipulation,
  t.action_timing,
  t.event_object_table,
  t.action_statement,
  t.action_orientation,
  t.action_timing
FROM information_schema.triggers t
WHERE t.trigger_name = 'track_order_changes'
AND t.event_object_table = 'orders';

-- 2. Check the trigger function definition
SELECT 
  p.proname as function_name,
  p.prosrc as function_source,
  p.prolang as language,
  p.prosecdef as security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'record_order_change'
AND n.nspname = 'public';

-- 3. Check if there are any errors in the trigger
-- Look for any warnings or errors in the logs
SELECT 
  'Check Supabase logs for any trigger errors' as note;

-- 4. Test if we can manually call the trigger function
-- This will help us see if the function works
DO $$
DECLARE
  test_user_id UUID;
BEGIN
  test_user_id := auth.uid();
  
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'AUTH.UID() returned NULL - this is likely the problem!';
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
      'manual_test',
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
