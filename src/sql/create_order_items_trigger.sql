-- Create trigger for order_items table to track changes
-- This will track changes made in UpdateCart component

CREATE OR REPLACE FUNCTION record_order_item_change()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Get current user ID from session with error handling
  BEGIN
    user_id := auth.uid();
    
    -- If no user ID, log the issue but don't fail the trigger
    IF user_id IS NULL THEN
      RAISE WARNING 'record_order_item_change: No authenticated user found for order item change tracking';
      RETURN NEW;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'record_order_item_change: Error getting user ID: %', SQLERRM;
      RETURN NEW;
  END;

  IF TG_OP = 'UPDATE' THEN
    -- Track quantity changes
    IF COALESCE(NEW.quantity, 0) <> COALESCE(OLD.quantity, 0) THEN
      BEGIN
        INSERT INTO order_changes (
          order_id,
          user_id,
          change_type,
          field_name,
          old_value,
          new_value,
          item_id
        ) VALUES (
          NEW.order_id,
          user_id,
          'quantity_update',
          'quantity',
          OLD.quantity::text,
          NEW.quantity::text,
          NEW.id
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'record_order_item_change: Failed to insert quantity change: %', SQLERRM;
      END;
    END IF;

    -- Track price changes
    IF COALESCE(NEW.price, 0) <> COALESCE(OLD.price, 0) THEN
      BEGIN
        INSERT INTO order_changes (
          order_id,
          user_id,
          change_type,
          field_name,
          old_value,
          new_value,
          item_id
        ) VALUES (
          NEW.order_id,
          user_id,
          'price_update',
          'price',
          OLD.price::text,
          NEW.price::text,
          NEW.id
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'record_order_item_change: Failed to insert price change: %', SQLERRM;
      END;
    END IF;

    -- Track checked status changes
    IF COALESCE(NEW.checked, false) <> COALESCE(OLD.checked, false) THEN
      BEGIN
        INSERT INTO order_changes (
          order_id,
          user_id,
          change_type,
          field_name,
          old_value,
          new_value,
          item_id
        ) VALUES (
          NEW.order_id,
          user_id,
          'checked_update',
          'checked',
          OLD.checked::text,
          NEW.checked::text,
          NEW.id
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'record_order_item_change: Failed to insert checked change: %', SQLERRM;
      END;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    -- Record new items
    INSERT INTO order_changes (
      order_id,
      user_id,
      change_type,
      field_name,
      old_value,
      new_value,
      item_id
    ) VALUES (
      NEW.order_id,
      user_id,
      'item_added',
      'items',
      NULL,
      json_build_object(
        'product_id', NEW.product_id,
        'quantity', NEW.quantity
      )::text,
      NEW.id
    );
  END IF;
  
  -- For AFTER triggers, return the appropriate record
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safely create the trigger for order_items table
-- First, check if the trigger exists and create it safely
DO $$
BEGIN
  -- Drop the trigger only if it exists to avoid errors
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'track_order_item_changes' 
    AND tgrelid = 'order_items'::regclass
  ) THEN
    DROP TRIGGER track_order_item_changes ON order_items;
  END IF;
  
  -- Create the new trigger
  CREATE TRIGGER track_order_item_changes
    AFTER INSERT OR UPDATE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION record_order_item_change();
    
  RAISE NOTICE 'Trigger track_order_item_changes has been successfully created';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create trigger track_order_item_changes: %', SQLERRM;
    -- Don't fail the entire script if trigger creation fails
END;
$$;

-- Verify the trigger was created
SELECT 
  trigger_name, 
  event_manipulation, 
  action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'track_order_item_changes' 
AND event_object_table = 'order_items';
