-- Update the record_order_change function to track changes from UpdateCart.tsx
-- This includes status, driver, and crate changes

CREATE OR REPLACE FUNCTION record_order_change()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Get current user ID from session with error handling
  BEGIN
    user_id := auth.uid();
    
    -- If no user ID, log the issue but don't fail the trigger
    IF user_id IS NULL THEN
      RAISE WARNING 'record_order_change: No authenticated user found for order change tracking';
      RETURN NEW;
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

-- Safely update the trigger to handle all order changes
-- First, check if the trigger exists and create it safely
DO $$
BEGIN
  -- Drop the trigger only if it exists to avoid errors
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'track_order_changes' 
    AND tgrelid = 'orders'::regclass
  ) THEN
    DROP TRIGGER track_order_changes ON orders;
  END IF;
  
  -- Create the new trigger
  CREATE TRIGGER track_order_changes
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION record_order_change();
    
  RAISE NOTICE 'Trigger track_order_changes has been successfully updated';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to update trigger track_order_changes: %', SQLERRM;
    -- Don't fail the entire script if trigger update fails
END;
$$;
