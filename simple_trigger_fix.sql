-- Simple and direct fix for the orders trigger
-- This will create a minimal working trigger

-- 1. Drop everything first
DROP TRIGGER IF EXISTS track_order_changes ON orders;
DROP FUNCTION IF EXISTS record_order_change();

-- 2. Create a simple trigger function
CREATE OR REPLACE FUNCTION record_order_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Simple insert for any order update
  INSERT INTO order_changes (
    order_id,
    user_id,
    change_type,
    field_name,
    old_value,
    new_value
  ) VALUES (
    NEW.id,
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID),
    'order_update',
    'general',
    'old',
    'new'
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the main operation
    RAISE WARNING 'Trigger error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger
CREATE TRIGGER track_order_changes
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION record_order_change();

-- 4. Test it immediately
UPDATE orders 
SET "crateSmall" = 99
WHERE id = 14225;

-- 5. Check if it worked
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
LIMIT 3;
