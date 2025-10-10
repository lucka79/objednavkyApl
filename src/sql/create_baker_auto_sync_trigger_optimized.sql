-- OPTIMIZED Auto-sync baker productions trigger
-- Uses STATEMENT-level triggers instead of ROW-level for better performance during bulk inserts

-- Function to sync baker productions for a specific date
-- (Keep the same function as before)
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
                SUM(pp.quantity * oi.quantity) as total_quantity
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN product_parts pp ON oi.product_id = pp.product_id
            JOIN recipes r ON pp.recipe_id = r.id
            WHERE o.date = target_date
            AND pp.recipe_id IS NOT NULL
            GROUP BY pp.recipe_id, r.name
            HAVING SUM(pp.quantity * oi.quantity) > 0
        )
        SELECT recipe_id, recipe_name, total_quantity
        FROM recipe_quantities
    LOOP
        recipe_total_quantity := recipe_record.total_quantity;
        
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
                    SUM(pp.quantity * oi.quantity) as total_recipe_kg_for_product
                FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                JOIN product_parts pp ON oi.product_id = pp.product_id
                WHERE o.date = target_date
                AND pp.recipe_id = recipe_record.recipe_id
                GROUP BY oi.product_id
                HAVING SUM(oi.quantity) > 0
            LOOP
                -- Use UPSERT with ON CONFLICT to handle existing baker_items
                INSERT INTO baker_items (
                    production_id,
                    product_id,
                    planned_quantity,
                    recipe_quantity,
                    created_at,
                    updated_at
                ) VALUES (
                    production_record.id,
                    product_record.product_id,
                    product_record.total_product_quantity,
                    product_record.total_recipe_kg_for_product,
                    NOW(),
                    NOW()
                )
                ON CONFLICT (production_id, product_id) 
                DO UPDATE SET
                    planned_quantity = EXCLUDED.planned_quantity,
                    recipe_quantity = EXCLUDED.recipe_quantity,
                    updated_at = NOW()
                WHERE EXCLUDED.planned_quantity > 0;
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
                    SUM(pp.quantity * oi.quantity) as total_recipe_kg_for_product
                FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                JOIN product_parts pp ON oi.product_id = pp.product_id
                WHERE o.date = target_date
                AND pp.recipe_id = recipe_record.recipe_id
                GROUP BY oi.product_id
                HAVING SUM(oi.quantity) > 0
            LOOP
                INSERT INTO baker_items (
                    production_id,
                    product_id,
                    planned_quantity,
                    recipe_quantity,
                    created_at,
                    updated_at
                ) VALUES (
                    production_record.id,
                    product_record.product_id,
                    product_record.total_product_quantity,
                    product_record.total_recipe_kg_for_product,
                    NOW(),
                    NOW()
                );
            END LOOP;
            
            created_productions := created_productions + 1;
        END IF;
    END LOOP;

    -- Clean up baker_items with zero or negative quantities
    DELETE FROM baker_items bi
    WHERE bi.production_id IN (
        SELECT b.id 
        FROM bakers b 
        WHERE b.date = target_date
    )
    AND (bi.planned_quantity <= 0 OR bi.planned_quantity IS NULL);

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
        AND oi.quantity > 0
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

-- OPTIMIZED: STATEMENT-level trigger for orders table
-- Runs once per INSERT/UPDATE/DELETE statement, not once per row
CREATE OR REPLACE FUNCTION trigger_sync_baker_productions_orders_statement()
RETURNS TRIGGER AS $$
DECLARE
    affected_dates DATE[];
    target_date DATE;
    sync_result RECORD;
BEGIN
    -- Get all affected dates from the operation
    IF TG_OP = 'DELETE' THEN
        -- For DELETE, get dates from OLD TABLE
        SELECT ARRAY_AGG(DISTINCT date::DATE) INTO affected_dates
        FROM old_table
        WHERE date >= CURRENT_DATE;
    ELSE
        -- For INSERT/UPDATE, get dates from NEW TABLE
        SELECT ARRAY_AGG(DISTINCT date::DATE) INTO affected_dates
        FROM new_table
        WHERE date >= CURRENT_DATE;
    END IF;

    -- Sync each affected date
    IF affected_dates IS NOT NULL THEN
        FOREACH target_date IN ARRAY affected_dates
        LOOP
            SELECT * INTO sync_result FROM sync_baker_productions_for_date(target_date);
            RAISE NOTICE 'Auto-synced baker productions for date %: created %, updated %', 
                target_date, sync_result.created_count, sync_result.updated_count;
        END LOOP;
    END IF;

    RETURN NULL; -- AFTER trigger, return value doesn't matter
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- OPTIMIZED: STATEMENT-level trigger for order_items table
-- Runs once per INSERT/UPDATE/DELETE statement, not once per row
CREATE OR REPLACE FUNCTION trigger_sync_baker_productions_order_items_statement()
RETURNS TRIGGER AS $$
DECLARE
    affected_dates DATE[];
    target_date DATE;
    sync_result RECORD;
BEGIN
    -- Get order dates for affected order_items
    IF TG_OP = 'DELETE' THEN
        -- For DELETE, get dates from orders linked to old_table
        SELECT ARRAY_AGG(DISTINCT o.date::DATE) INTO affected_dates
        FROM old_table ot
        JOIN orders o ON ot.order_id = o.id
        WHERE o.date >= CURRENT_DATE;
    ELSE
        -- For INSERT/UPDATE, get dates from orders linked to new_table
        SELECT ARRAY_AGG(DISTINCT o.date::DATE) INTO affected_dates
        FROM new_table nt
        JOIN orders o ON nt.order_id = o.id
        WHERE o.date >= CURRENT_DATE;
    END IF;

    -- Sync each affected date
    IF affected_dates IS NOT NULL THEN
        FOREACH target_date IN ARRAY affected_dates
        LOOP
            SELECT * INTO sync_result FROM sync_baker_productions_for_date(target_date);
            RAISE NOTICE 'Auto-synced baker productions for date %: created %, updated %', 
                target_date, sync_result.created_count, sync_result.updated_count;
        END LOOP;
    END IF;

    RETURN NULL; -- AFTER trigger, return value doesn't matter
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old ROW-level triggers
DROP TRIGGER IF EXISTS auto_sync_baker_productions_orders ON orders;
DROP TRIGGER IF EXISTS auto_sync_baker_productions_order_items ON order_items;
DROP TRIGGER IF EXISTS auto_sync_baker_productions_orders_insert_update ON orders;
DROP TRIGGER IF EXISTS auto_sync_baker_productions_orders_delete ON orders;
DROP TRIGGER IF EXISTS auto_sync_baker_productions_order_items_insert_update ON order_items;
DROP TRIGGER IF EXISTS auto_sync_baker_productions_order_items_delete ON order_items;

-- Create STATEMENT-level triggers on orders table (separate for INSERT/UPDATE and DELETE)
-- Trigger for INSERT and UPDATE operations
CREATE TRIGGER auto_sync_baker_productions_orders_insert_update
    AFTER INSERT OR UPDATE OF date ON orders
    REFERENCING NEW TABLE AS new_table
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_sync_baker_productions_orders_statement();

-- Trigger for DELETE operations
CREATE TRIGGER auto_sync_baker_productions_orders_delete
    AFTER DELETE ON orders
    REFERENCING OLD TABLE AS old_table
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_sync_baker_productions_orders_statement();

-- Create STATEMENT-level triggers on order_items table (separate for INSERT/UPDATE and DELETE)
-- Trigger for INSERT and UPDATE operations
CREATE TRIGGER auto_sync_baker_productions_order_items_insert_update
    AFTER INSERT OR UPDATE OF quantity, product_id ON order_items
    REFERENCING NEW TABLE AS new_table
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_sync_baker_productions_order_items_statement();

-- Trigger for DELETE operations
CREATE TRIGGER auto_sync_baker_productions_order_items_delete
    AFTER DELETE ON order_items
    REFERENCING OLD TABLE AS old_table
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_sync_baker_productions_order_items_statement();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION sync_baker_productions_for_date(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_sync_baker_productions_orders_statement() TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_sync_baker_productions_order_items_statement() TO authenticated;

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
    SELECT * INTO sync_result FROM sync_baker_productions_for_date(target_date);
    
    RETURN QUERY SELECT 
        sync_result.created_count,
        sync_result.updated_count,
        'Successfully synced baker productions for ' || target_date::TEXT || 
        ': created ' || sync_result.created_count || ', updated ' || sync_result.updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION manual_sync_baker_productions(DATE) TO authenticated;

-- Add comments
COMMENT ON FUNCTION trigger_sync_baker_productions_orders_statement() IS 'STATEMENT-level trigger for orders table - runs once per statement instead of per row for better performance';
COMMENT ON FUNCTION trigger_sync_baker_productions_order_items_statement() IS 'STATEMENT-level trigger for order_items table - runs once per statement instead of per row for better performance';

