-- Fix the record_order_item_change function to handle DELETE operations correctly
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
  
  -- For AFTER triggers, we should return NULL or the appropriate record
  -- For DELETE operations, return OLD; for INSERT/UPDATE, return NEW
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
