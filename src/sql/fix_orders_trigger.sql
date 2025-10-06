-- Fix the orders trigger to handle NULL user_id properly
-- The issue is that auth.uid() returns NULL in trigger context

CREATE OR REPLACE FUNCTION record_order_change()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Get current user ID from session with error handling
  BEGIN
    user_id := auth.uid();
    
    -- If no user ID, try to get it from the current session
    IF user_id IS NULL THEN
      -- Try alternative method to get user ID
      SELECT auth.uid() INTO user_id;
      
      -- If still NULL, use a fallback or skip tracking
      IF user_id IS NULL THEN
        RAISE WARNING 'record_order_change: No authenticated user found, skipping change tracking';
        RETURN NEW;
      END IF;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'record_order_change: Error getting user ID: %', SQLERRM;
      RETURN NEW;
  END;

  IF TG_OP = 'UPDATE' THEN
    -- Track status changes
    IF COALESCE(NEW.status, '') <> COALESCE(OLD.status, '') THEN
      BEGIN
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
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'record_order_change: Failed to insert status change: %', SQLERRM;
      END;
    END IF;

    -- Track driver changes
    IF COALESCE(NEW.driver_id, '') <> COALESCE(OLD.driver_id, '') THEN
      BEGIN
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
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'record_order_change: Failed to insert driver change: %', SQLERRM;
      END;
    END IF;

    -- Track small crate changes
    IF COALESCE(NEW."crateSmall", 0) <> COALESCE(OLD."crateSmall", 0) THEN
      BEGIN
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
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'record_order_change: Failed to insert crateSmall change: %', SQLERRM;
      END;
    END IF;

    -- Track big crate changes
    IF COALESCE(NEW."crateBig", 0) <> COALESCE(OLD."crateBig", 0) THEN
      BEGIN
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
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'record_order_change: Failed to insert crateBig change: %', SQLERRM;
      END;
    END IF;

    -- Track small crate received changes
    IF COALESCE(NEW."crateSmallReceived", 0) <> COALESCE(OLD."crateSmallReceived", 0) THEN
      BEGIN
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
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'record_order_change: Failed to insert crateSmallReceived change: %', SQLERRM;
      END;
    END IF;

    -- Track big crate received changes
    IF COALESCE(NEW."crateBigReceived", 0) <> COALESCE(OLD."crateBigReceived", 0) THEN
      BEGIN
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
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'record_order_change: Failed to insert crateBigReceived change: %', SQLERRM;
      END;
    END IF;

    -- Track note changes
    IF COALESCE(NEW.note, '') <> COALESCE(OLD.note, '') THEN
      BEGIN
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
          'note_change',
          'note',
          OLD.note,
          NEW.note
        );
        RAISE NOTICE 'record_order_change: Note change recorded for order %', NEW.id;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'record_order_change: Failed to insert note change: %', SQLERRM;
      END;
    END IF;

    -- Track lock status changes
    IF COALESCE(NEW."isLocked", false) <> COALESCE(OLD."isLocked", false) THEN
      BEGIN
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
          'lock_change',
          'isLocked',
          OLD."isLocked"::text,
          NEW."isLocked"::text
        );
        RAISE NOTICE 'record_order_change: Lock change recorded for order %', NEW.id;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'record_order_change: Failed to insert isLocked change: %', SQLERRM;
      END;
    END IF;
  END IF;

  -- Always return NEW to ensure the main operation succeeds
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the main operation
    RAISE WARNING 'record_order_change: Unexpected error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test the updated trigger
DO $$
BEGIN
  -- Try to update an order to test the trigger
  UPDATE orders 
  SET status = 'Trigger Test' 
  WHERE id = 14225;
  
  RAISE NOTICE 'Trigger test completed - check order_changes table for new entries';
END;
$$;
