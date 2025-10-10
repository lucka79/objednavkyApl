-- Auto-sync baker productions trigger (FIXED v2)
-- This trigger automatically syncs baker productions when future orders are changed
-- FIX: Only insert/update baker_items when planned_quantity > 0

-- First, clean up any existing duplicates and add unique constraint
-- This will help with performance and data integrity
DO $$ 
BEGIN
    -- Check if the constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'baker_items_production_product_unique'
    ) THEN
        -- First, check for duplicates and log them
        DECLARE
            duplicate_count INTEGER;
            total_before INTEGER;
            total_after INTEGER;
        BEGIN
            -- Count total items before cleanup
            SELECT COUNT(*) INTO total_before FROM baker_items;
            
            -- Count duplicates
            SELECT COUNT(*) INTO duplicate_count 
            FROM (
                SELECT production_id, product_id, COUNT(*) as cnt
                FROM baker_items 
                GROUP BY production_id, product_id 
                HAVING COUNT(*) > 1
            ) duplicates;
            
            IF duplicate_count > 0 THEN
                RAISE NOTICE 'Found % duplicate production-product combinations in baker_items', duplicate_count;
                
                -- Remove duplicate baker_items, keeping the one with the highest quantities
                -- This ensures we keep the most complete/recent data
                WITH ranked_items AS (
                    SELECT id,
                           production_id,
                           product_id,
                           ROW_NUMBER() OVER (
                               PARTITION BY production_id, product_id 
                               ORDER BY 
                                   COALESCE(actual_quantity, 0) DESC,
                                   COALESCE(planned_quantity, 0) DESC,
                                   COALESCE(updated_at, created_at) DESC NULLS LAST,
                                   id DESC
                           ) as rn
                    FROM baker_items
                )
                DELETE FROM baker_items 
                WHERE id IN (
                    SELECT id FROM ranked_items WHERE rn > 1
                );
                
                -- Count items after cleanup
                SELECT COUNT(*) INTO total_after FROM baker_items;
                
                RAISE NOTICE 'Removed % duplicate baker_items (% -> % total items)', 
                    (total_before - total_after), total_before, total_after;
            ELSE
                RAISE NOTICE 'No duplicate baker_items found';
            END IF;
            
            -- Now add unique constraint on (production_id, product_id)
            ALTER TABLE baker_items 
            ADD CONSTRAINT baker_items_production_product_unique 
            UNIQUE (production_id, product_id);
            
            RAISE NOTICE 'Successfully added unique constraint baker_items_production_product_unique';
        END;
    ELSE
        RAISE NOTICE 'Unique constraint baker_items_production_product_unique already exists';
    END IF;
END $$;

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
                HAVING SUM(oi.quantity) > 0  -- FIX: Only include items with quantity > 0
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
                WHERE EXCLUDED.planned_quantity > 0;  -- FIX: Only update if quantity > 0
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
                HAVING SUM(oi.quantity) > 0  -- FIX: Only include items with quantity > 0
            LOOP
                -- For new productions, insert only if quantity > 0
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
        AND oi.quantity > 0  -- FIX: Only consider active orders with quantity > 0
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
COMMENT ON FUNCTION sync_baker_productions_for_date(DATE) IS 'Core function to sync baker productions for a specific date based on orders. Uses UPSERT to prevent duplicate baker_items. Only processes items with planned_quantity > 0.';
COMMENT ON FUNCTION trigger_sync_baker_productions_orders() IS 'Trigger function for orders table changes';
COMMENT ON FUNCTION trigger_sync_baker_productions_order_items() IS 'Trigger function for order_items table changes';
COMMENT ON FUNCTION manual_sync_baker_productions(DATE) IS 'Manual sync function that can be called from the application';
COMMENT ON CONSTRAINT baker_items_production_product_unique ON baker_items IS 'Prevents duplicate baker_items for the same production and product combination';

