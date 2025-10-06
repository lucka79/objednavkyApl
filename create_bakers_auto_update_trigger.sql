-- Create function to automatically update bakers production based on orders changes
-- This trigger will run when orders or order_items are modified
-- Timezone: Europe/Prague (UTC+1/UTC+2)

CREATE OR REPLACE FUNCTION update_bakers_from_orders()
RETURNS TRIGGER AS $$
DECLARE
    order_date DATE;
    order_user_id UUID;
    product_categories RECORD;
    baker_production RECORD;
    recipe_id_found INTEGER;
    baker_id_found INTEGER;
    baker_item RECORD;
BEGIN
    -- Determine the order date and user_id from the trigger context
    IF TG_TABLE_NAME = 'orders' THEN
        order_date := COALESCE(NEW.date, OLD.date);
        order_user_id := COALESCE(NEW.user_id, OLD.user_id);
    ELSIF TG_TABLE_NAME = 'order_items' THEN
        -- Get order details from the order_items context
        SELECT o.date, o.user_id INTO order_date, order_user_id
        FROM orders o
        WHERE o.id = COALESCE(NEW.order_id, OLD.order_id);
    END IF;

    -- Only process if we have valid date and user_id
    IF order_date IS NULL OR order_user_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Convert to Prague timezone (Europe/Prague)
    order_date := (order_date AT TIME ZONE 'Europe/Prague')::DATE;

    -- Get all product categories that have orders for this date and user
    FOR product_categories IN
        SELECT DISTINCT 
            p.category_id,
            c.name as category_name,
            SUM(oi.quantity) as total_quantity
        FROM order_items oi, products p, categories c, orders o
        WHERE oi.product_id = p.id
        AND p.category_id = c.id
        AND oi.order_id = o.id
        AND o.date = order_date 
        AND o.user_id = order_user_id
        AND o.status = 'completed'
        GROUP BY p.category_id, c.name
    LOOP
        -- Find a recipe for this category
        SELECT r.id INTO recipe_id_found
        FROM recipes r
        WHERE r.category_id = product_categories.category_id
        AND r.baker = true
        LIMIT 1;

        -- If no recipe found, skip this category
        IF recipe_id_found IS NULL THEN
            CONTINUE;
        END IF;

        -- Check if baker production already exists for this date, user, and recipe
        SELECT id INTO baker_id_found
        FROM bakers
        WHERE date = order_date
        AND user_id = order_user_id
        AND recipe_id = recipe_id_found;

        IF baker_id_found IS NULL THEN
            -- Create new baker production
            INSERT INTO bakers (date, user_id, recipe_id, status, notes, created_at, updated_at)
            VALUES (
                order_date,
                order_user_id,
                recipe_id_found,
                'planned',
                'Automaticky vytvořené z objednávek pro kategorii: ' || product_categories.category_name,
                NOW() AT TIME ZONE 'Europe/Prague',
                NOW() AT TIME ZONE 'Europe/Prague'
            )
            RETURNING id INTO baker_id_found;
        ELSE
            -- Update existing baker production
            UPDATE bakers
            SET 
                status = 'planned',
                notes = 'Automaticky aktualizováno z objednávek pro kategorii: ' || product_categories.category_name,
                updated_at = NOW() AT TIME ZONE 'Europe/Prague'
            WHERE id = baker_id_found;
        END IF;

        -- Delete existing baker_items for this baker
        DELETE FROM baker_items WHERE production_id = baker_id_found;

        -- Create new baker_items based on current orders
        FOR baker_item IN
            SELECT 
                p.id as product_id,
                SUM(oi.quantity) as planned_quantity
            FROM order_items oi, products p, orders o
            WHERE oi.product_id = p.id
            AND oi.order_id = o.id
            AND o.date = order_date 
            AND o.user_id = order_user_id
            AND o.status = 'completed'
            AND p.category_id = product_categories.category_id
            GROUP BY p.id
        LOOP
            INSERT INTO baker_items (
                production_id,
                product_id,
                planned_quantity,
                recipe_quantity,
                created_at,
                updated_at
            )
            VALUES (
                baker_id_found,
                baker_item.product_id,
                baker_item.planned_quantity,
                baker_item.planned_quantity,
                NOW() AT TIME ZONE 'Europe/Prague',
                NOW() AT TIME ZONE 'Europe/Prague'
            );
        END LOOP;
    END LOOP;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for orders table
DROP TRIGGER IF EXISTS trigger_update_bakers_on_order_change ON orders;
CREATE TRIGGER trigger_update_bakers_on_order_change
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_bakers_from_orders();

-- Create triggers for order_items table
DROP TRIGGER IF EXISTS trigger_update_bakers_on_order_item_change ON order_items;
CREATE TRIGGER trigger_update_bakers_on_order_item_change
    AFTER INSERT OR UPDATE OR DELETE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_bakers_from_orders();

-- Create function to manually sync bakers for a specific date and user
CREATE OR REPLACE FUNCTION sync_bakers_for_date(
    target_date DATE,
    target_user_id UUID
)
RETURNS TABLE(
    baker_id INTEGER,
    category_name TEXT,
    total_products INTEGER,
    total_quantity NUMERIC
) AS $$
DECLARE
    baker_record RECORD;
BEGIN
    -- Convert to Prague timezone
    target_date := (target_date AT TIME ZONE 'Europe/Prague')::DATE;
    
    -- Call the main update function
    PERFORM update_bakers_from_orders();
    
    -- Return summary of created/updated bakers
    FOR baker_record IN
        SELECT 
            b.id,
            c.name as category_name,
            COUNT(bi.id) as total_products,
            SUM(bi.planned_quantity) as total_quantity
        FROM bakers b
        JOIN recipes r ON r.id = b.recipe_id
        JOIN categories c ON c.id = r.category_id
        LEFT JOIN baker_items bi ON bi.production_id = b.id
        WHERE b.date = target_date
        AND b.user_id = target_user_id
        GROUP BY b.id, c.name
    LOOP
        baker_id := baker_record.id;
        category_name := baker_record.category_name;
        total_products := baker_record.total_products;
        total_quantity := baker_record.total_quantity;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to sync all bakers for a date range
CREATE OR REPLACE FUNCTION sync_bakers_for_date_range(
    start_date DATE,
    end_date DATE,
    target_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
    date_processed DATE,
    bakers_created INTEGER,
    bakers_updated INTEGER
) AS $$
DECLARE
    current_date_var DATE;
    baker_count INTEGER;
    updated_count INTEGER;
BEGIN
    current_date_var := start_date;
    
    WHILE current_date_var <= end_date LOOP
        -- Count existing bakers for this date
        SELECT COUNT(*) INTO baker_count
        FROM bakers
        WHERE date = current_date_var
        AND (target_user_id IS NULL OR user_id = target_user_id);
        
        -- Sync bakers for this date
        IF target_user_id IS NULL THEN
            -- Sync for all users
            PERFORM update_bakers_from_orders();
        ELSE
            -- Sync for specific user
            PERFORM sync_bakers_for_date(current_date_var, target_user_id);
        END IF;
        
        -- Count updated bakers
        SELECT COUNT(*) INTO updated_count
        FROM bakers
        WHERE date = current_date_var
        AND (target_user_id IS NULL OR user_id = target_user_id);
        
        date_processed := current_date_var;
        bakers_created := GREATEST(0, updated_count - baker_count);
        bakers_updated := baker_count;
        RETURN NEXT;
        
        current_date_var := current_date_var + INTERVAL '1 day';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_bakers_from_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION sync_bakers_for_date(DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_bakers_for_date_range(DATE, DATE, UUID) TO authenticated;

-- Add comments
COMMENT ON FUNCTION update_bakers_from_orders() IS 'Automatically updates baker productions when orders change. Handles Prague timezone.';
COMMENT ON FUNCTION sync_bakers_for_date(DATE, UUID) IS 'Manually sync bakers for specific date and user. Returns summary.';
COMMENT ON FUNCTION sync_bakers_for_date_range(DATE, DATE, UUID) IS 'Sync bakers for date range. If user_id is NULL, syncs for all users.';
