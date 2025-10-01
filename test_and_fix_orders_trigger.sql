-- Test and fix the orders trigger
-- This will help us get the orders trigger working properly

-- 1. First, let's check if the trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  event_object_table
FROM information_schema.triggers 
WHERE trigger_name = 'track_order_changes'
AND event_object_table = 'orders';

-- 2. Check if the function exists
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_name = 'record_order_change'
AND routine_schema = 'public';

-- 3. Drop and recreate the trigger function with better error handling
CREATE OR REPLACE FUNCTION record_order_change()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Get current user ID from session
  user_id := auth.uid();
  
  -- If no user ID, use a fallback
  IF user_id IS NULL THEN
    user_id := '00000000-0000-0000-0000-000000000000'::UUID;
    RAISE NOTICE 'record_order_change: No user ID found, using fallback';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Track status changes
    IF COALESCE(NEW.status, '') <> COALESCE(OLD.status, '') THEN
      INSERT INTO order_changes (
        order_id,
        user_id,
        change_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        user_id,
        'status_change',
        'status',
        OLD.status,
        NEW.status
      );
      RAISE NOTICE 'record_order_change: Status change recorded for order %', NEW.id;
    END IF;

    -- Track driver changes
    IF COALESCE(NEW.driver_id, '') <> COALESCE(OLD.driver_id, '') THEN
      INSERT INTO order_changes (
        order_id,
        user_id,
        change_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        user_id,
        'driver_change',
        'driver_id',
        OLD.driver_id,
        NEW.driver_id
      );
      RAISE NOTICE 'record_order_change: Driver change recorded for order %', NEW.id;
    END IF;

    -- Track small crate changes
    IF COALESCE(NEW."crateSmall", 0) <> COALESCE(OLD."crateSmall", 0) THEN
      INSERT INTO order_changes (
        order_id,
        user_id,
        change_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        user_id,
        'crate_small_change',
        'crateSmall',
        OLD."crateSmall"::text,
        NEW."crateSmall"::text
      );
      RAISE NOTICE 'record_order_change: Crate small change recorded for order %', NEW.id;
    END IF;

    -- Track big crate changes
    IF COALESCE(NEW."crateBig", 0) <> COALESCE(OLD."crateBig", 0) THEN
      INSERT INTO order_changes (
        order_id,
        user_id,
        change_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        user_id,
        'crate_big_change',
        'crateBig',
        OLD."crateBig"::text,
        NEW."crateBig"::text
      );
      RAISE NOTICE 'record_order_change: Crate big change recorded for order %', NEW.id;
    END IF;

    -- Track small crate received changes
    IF COALESCE(NEW."crateSmallReceived", 0) <> COALESCE(OLD."crateSmallReceived", 0) THEN
      INSERT INTO order_changes (
        order_id,
        user_id,
        change_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        user_id,
        'crate_small_received_change',
        'crateSmallReceived',
        OLD."crateSmallReceived"::text,
        NEW."crateSmallReceived"::text
      );
      RAISE NOTICE 'record_order_change: Crate small received change recorded for order %', NEW.id;
    END IF;

    -- Track big crate received changes
    IF COALESCE(NEW."crateBigReceived", 0) <> COALESCE(OLD."crateBigReceived", 0) THEN
      INSERT INTO order_changes (
        order_id,
        user_id,
        change_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        user_id,
        'crate_big_received_change',
        'crateBigReceived',
        OLD."crateBigReceived"::text,
        NEW."crateBigReceived"::text
      );
      RAISE NOTICE 'record_order_change: Crate big received change recorded for order %', NEW.id;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'record_order_change: Error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Drop and recreate the trigger
DROP TRIGGER IF EXISTS track_order_changes ON orders;
CREATE TRIGGER track_order_changes
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION record_order_change();

-- 5. Test the trigger
UPDATE orders 
SET "crateSmall" = 5
WHERE id = 14225;

-- 6. Check if changes were recorded
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
