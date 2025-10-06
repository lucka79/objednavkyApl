-- Updated trigger function that only tracks crates, driver, and status changes
-- Does NOT track item quantity changes (uses existing order_items_history table)

-- Update the record_order_change function to only track order-level changes
CREATE OR REPLACE FUNCTION record_order_change()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Get current user ID from session
  user_id := auth.uid();
  
  IF TG_OP = 'UPDATE' THEN
    -- Record status changes
    IF NEW.status <> OLD.status THEN
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
    END IF;
    
    -- Record driver changes
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
        OLD.driver_id::text,
        NEW.driver_id::text
      );
    END IF;

    -- Record crate changes with specific types
    IF COALESCE(NEW.crate_small, 0) <> COALESCE(OLD.crate_small, 0) THEN
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
        'crate_small',
        OLD.crate_small::text,
        NEW.crate_small::text
      );
    END IF;

    IF COALESCE(NEW.crate_big, 0) <> COALESCE(OLD.crate_big, 0) THEN
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
        'crate_big',
        OLD.crate_big::text,
        NEW.crate_big::text
      );
    END IF;

    -- Record note changes
    IF COALESCE(NEW.note, '') <> COALESCE(OLD.note, '') THEN
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
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Simplified record_order_item_change function that only tracks price changes
-- and item additions/removals, NOT quantity changes
CREATE OR REPLACE FUNCTION record_order_item_change()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Get current user ID from session
  user_id := auth.uid();
  
  IF TG_OP = 'UPDATE' THEN
    -- Only record price changes (quantity changes are handled by order_items_history)
    IF COALESCE(NEW.price, 0) <> COALESCE(OLD.price, 0) THEN
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
    END IF;

    -- Record checked status changes
    IF COALESCE(NEW.checked, false) <> COALESCE(OLD.checked, false) THEN
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

-- Safely update the trigger to only handle INSERT and UPDATE operations
-- First, check if the trigger exists and what it does
-- You can run this query to see current triggers:
-- SELECT trigger_name, event_manipulation, action_timing 
-- FROM information_schema.triggers 
-- WHERE trigger_name = 'track_order_item_changes';

-- Only drop and recreate if you're sure you want to change the trigger behavior
-- Uncomment the lines below when you're ready to apply the changes:

-- DROP TRIGGER IF EXISTS track_order_item_changes ON order_items;
-- CREATE TRIGGER track_order_item_changes
--   AFTER INSERT OR UPDATE ON order_items
--   FOR EACH ROW
--   EXECUTE FUNCTION record_order_item_change();
