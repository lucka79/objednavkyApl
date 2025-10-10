-- Fixed Auto-sync baker productions trigger
-- This trigger automatically syncs baker productions when future orders are changed
-- FIXED: Correctly calculates recipe_quantity as total dough weight needed

-- Function to sync baker productions for a specific date
CREATE OR REPLACE FUNCTION sync_baker_productions_for_date(target_date DATE)
RETURNS TABLE (
    created_count INTEGER,
    updated_count INTEGER
) AS $$
DECLARE
    created_productions INTEGER := 0;
    updated_productions INTEGER := 0;
    recipe_record RECORD;
    production_record RECORD;
    product_record RECORD;
    recipe_total_quantity NUMERIC;
BEGIN
    -- Only process future dates (today and beyond)
    IF target_date < CURRENT_DATE THEN
        RETURN QUERY SELECT 0, 0;
        RETURN;
    END IF;

    -- Loop through all recipes that have orders for the target date
    FOR recipe_record IN
        WITH recipe_quantities AS (
            SELECT 
                pp.recipe_id,
                r.name as recipe_name,
                -- Calculate total recipe kg needed (sum of product quantities × recipe amount per product)
                SUM(pp.quantity * oi.quantity) as total_recipe_kg_needed
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN product_parts pp ON oi.product_id = pp.product_id
            JOIN recipes r ON pp.recipe_id = r.id
            WHERE o.date = target_date
            AND pp.recipe_id IS NOT NULL
            GROUP BY pp.recipe_id, r.name
            HAVING SUM(pp.quantity * oi.quantity) > 0
        )
        SELECT recipe_id, recipe_name, total_recipe_kg_needed
        FROM recipe_quantities
    LOOP
        recipe_total_quantity := recipe_record.total_recipe_kg_needed;
        
        -- Check if production already exists for this recipe and date
        SELECT id INTO production_record
        FROM bakers 
        WHERE recipe_id = recipe_record.recipe_id 
        AND date = target_date;

        IF production_record.id IS NOT NULL THEN
            -- Update existing production
            UPDATE bakers 
            SET updated_at = NOW(),
                notes = COALESCE(notes, '') || ' [Auto-updated: ' || NOW()::TEXT || ']'
            WHERE id = production_record.id;
            
            -- Update baker_items for this production
            FOR product_record IN
                SELECT 
                    oi.product_id,
                    SUM(oi.quantity) as total_product_quantity,
                    -- FIXED: Calculate total recipe kg needed for this product
                    SUM(pp.quantity * oi.quantity) as total_recipe_kg_for_product
                FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                JOIN product_parts pp ON oi.product_id = pp.product_id
                WHERE o.date = target_date
                AND pp.recipe_id = recipe_record.recipe_id
                GROUP BY oi.product_id
            LOOP
                -- Update or insert baker_items
                INSERT INTO baker_items (
                    production_id,
                    product_id,
                    planned_quantity,
                    recipe_quantity,  -- This is now the total kg of dough needed
                    created_at,
                    updated_at
                ) VALUES (
                    production_record.id,
                    product_record.product_id,
                    product_record.total_product_quantity,
                    product_record.total_recipe_kg_for_product,  -- FIXED: Total dough weight
                    NOW(),
                    NOW()
                )
                ON CONFLICT (production_id, product_id) 
                DO UPDATE SET
                    planned_quantity = EXCLUDED.planned_quantity,
                    recipe_quantity = EXCLUDED.recipe_quantity,
                    updated_at = NOW();
            END LOOP;
            
            updated_productions := updated_productions + 1;
        ELSE
            -- Create new production
            INSERT INTO bakers (
                recipe_id,
                date,
                user_id,
                status,
                notes,
                created_at,
                updated_at
            ) VALUES (
                recipe_record.recipe_id,
                target_date,
                auth.uid(),
                'pending',
                'Auto-created from order sync: ' || NOW()::TEXT,
                NOW(),
                NOW()
            ) RETURNING id INTO production_record;

            -- Create baker_items for this production
            FOR product_record IN
                SELECT 
                    oi.product_id,
                    SUM(oi.quantity) as total_product_quantity,
                    -- FIXED: Calculate total recipe kg needed for this product
                    SUM(pp.quantity * oi.quantity) as total_recipe_kg_for_product
                FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                JOIN product_parts pp ON oi.product_id = pp.product_id
                WHERE o.date = target_date
                AND pp.recipe_id = recipe_record.recipe_id
                GROUP BY oi.product_id
            LOOP
                INSERT INTO baker_items (
                    production_id,
                    product_id,
                    planned_quantity,
                    recipe_quantity,  -- This is now the total kg of dough needed
                    created_at,
                    updated_at
                ) VALUES (
                    production_record.id,
                    product_record.product_id,
                    product_record.total_product_quantity,
                    product_record.total_recipe_kg_for_product,  -- FIXED: Total dough weight
                    NOW(),
                    NOW()
                );
            END LOOP;
            
            created_productions := created_productions + 1;
        END IF;
    END LOOP;

    -- Clean up baker_items that no longer have corresponding orders
    DELETE FROM baker_items bi
    WHERE bi.production_id IN (
        SELECT b.id 
        FROM bakers b 
        WHERE b.date = target_date
    )
    AND NOT EXISTS (
        SELECT 1 
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN product_parts pp ON oi.product_id = pp.product_id
        JOIN bakers b ON pp.recipe_id = b.recipe_id
        WHERE o.date = target_date
        AND b.id = bi.production_id
        AND oi.product_id = bi.product_id
    );

    -- Clean up empty productions (productions with no baker_items)
    DELETE FROM bakers b
    WHERE b.date = target_date
    AND NOT EXISTS (
        SELECT 1 FROM baker_items bi WHERE bi.production_id = b.id
    );

    RETURN QUERY SELECT created_productions, updated_productions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for orders table
CREATE OR REPLACE FUNCTION trigger_sync_baker_productions_orders()
RETURNS TRIGGER AS $$
DECLARE
    target_date DATE;
    sync_result RECORD;
BEGIN
    -- Determine the date to sync based on the operation
    IF TG_OP = 'DELETE' THEN
        target_date := OLD.date::DATE;
    ELSE
        target_date := NEW.date::DATE;
    END IF;

    -- Only sync for future dates
    IF target_date >= CURRENT_DATE THEN
        -- Call the sync function
        SELECT * INTO sync_result FROM sync_baker_productions_for_date(target_date);
        
        -- Log the sync operation (optional - you can remove this if you don't want logging)
        RAISE NOTICE 'Auto-synced baker productions for date %: created %, updated %', 
            target_date, sync_result.created_count, sync_result.updated_count;
    END IF;

    -- Return appropriate record based on operation
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for order_items table
CREATE OR REPLACE FUNCTION trigger_sync_baker_productions_order_items()
RETURNS TRIGGER AS $$
DECLARE
    target_date DATE;
    sync_result RECORD;
BEGIN
    -- Get the order date
    IF TG_OP = 'DELETE' THEN
        SELECT date INTO target_date FROM orders WHERE id = OLD.order_id;
    ELSE
        SELECT date INTO target_date FROM orders WHERE id = NEW.order_id;
    END IF;

    -- Only sync for future dates
    IF target_date >= CURRENT_DATE THEN
        -- Call the sync function
        SELECT * INTO sync_result FROM sync_baker_productions_for_date(target_date);
        
        -- Log the sync operation (optional)
        RAISE NOTICE 'Auto-synced baker productions for date %: created %, updated %', 
            target_date, sync_result.created_count, sync_result.updated_count;
    END IF;

    -- Return appropriate record based on operation
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers on orders table
DROP TRIGGER IF EXISTS auto_sync_baker_productions_orders ON orders;
CREATE TRIGGER auto_sync_baker_productions_orders
    AFTER INSERT OR UPDATE OF date OR DELETE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION trigger_sync_baker_productions_orders();

-- Create triggers on order_items table
DROP TRIGGER IF EXISTS auto_sync_baker_productions_order_items ON order_items;
CREATE TRIGGER auto_sync_baker_productions_order_items
    AFTER INSERT OR UPDATE OF quantity, product_id OR DELETE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION trigger_sync_baker_productions_order_items();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION sync_baker_productions_for_date(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_sync_baker_productions_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_sync_baker_productions_order_items() TO authenticated;

-- Create a manual sync function that can be called from the app
CREATE OR REPLACE FUNCTION manual_sync_baker_productions(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
    created_count INTEGER,
    updated_count INTEGER,
    message TEXT
) AS $$
DECLARE
    sync_result RECORD;
BEGIN
    -- Call the main sync function
    SELECT * INTO sync_result FROM sync_baker_productions_for_date(target_date);
    
    RETURN QUERY SELECT 
        sync_result.created_count,
        sync_result.updated_count,
        'Successfully synced baker productions for ' || target_date::TEXT || 
        ': created ' || sync_result.created_count || ', updated ' || sync_result.updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION manual_sync_baker_productions(DATE) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION sync_baker_productions_for_date(DATE) IS 'Core function to sync baker productions for a specific date based on orders. Calculates recipe_quantity as total dough weight needed.';
COMMENT ON FUNCTION trigger_sync_baker_productions_orders() IS 'Trigger function for orders table changes';
COMMENT ON FUNCTION trigger_sync_baker_productions_order_items() IS 'Trigger function for order_items table changes';
COMMENT ON FUNCTION manual_sync_baker_productions(DATE) IS 'Manual sync function that can be called from the application';

-- Example usage:
-- To manually sync a specific date:
-- SELECT * FROM manual_sync_baker_productions('2025-10-08');

-- To check what would be synced without executing:
-- SELECT 
--     pp.recipe_id,
--     r.name as recipe_name,
--     oi.product_id,
--     p.name as product_name,
--     SUM(oi.quantity) as total_product_quantity,
--     SUM(pp.quantity * oi.quantity) as total_recipe_kg_needed
-- FROM orders o
-- JOIN order_items oi ON o.id = oi.order_id
-- JOIN product_parts pp ON oi.product_id = pp.product_id
-- JOIN recipes r ON pp.recipe_id = r.id
-- JOIN products p ON oi.product_id = p.id
-- WHERE o.date = '2025-10-08'
-- AND pp.recipe_id IS NOT NULL
-- GROUP BY pp.recipe_id, r.name, oi.product_id, p.name
-- ORDER BY pp.recipe_id, oi.product_id;
