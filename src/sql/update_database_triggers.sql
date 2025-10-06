-- Update the record_order_change function to use specific crate change types
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

    -- Record crate changes
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

-- Update the record_order_item_change function to include price tracking
CREATE OR REPLACE FUNCTION record_order_item_change()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Get current user ID from session
  user_id := auth.uid();
  
  IF TG_OP = 'UPDATE' THEN
    -- Record quantity changes
    IF NEW.quantity <> OLD.quantity THEN
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
    END IF;

    -- Record price changes
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
  ELSIF TG_OP = 'DELETE' THEN
    -- Record deleted items
    INSERT INTO order_changes (
      order_id,
      user_id,
      change_type,
      field_name,
      old_value,
      new_value,
      item_id
    ) VALUES (
      OLD.order_id,
      user_id,
      'item_removed',
      'items',
      json_build_object(
        'product_id', OLD.product_id,
        'quantity', OLD.quantity
      )::text,
      NULL,
      OLD.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
