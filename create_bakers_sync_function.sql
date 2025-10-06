-- Clean baker sync function without status filters
-- This function will sync bakers for ALL orders on a given date

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
    product_categories RECORD;
    baker_item RECORD;
    baker_id_found INTEGER;
    recipe_id_found INTEGER;
BEGIN
    -- Convert to Prague timezone
    target_date := (target_date AT TIME ZONE 'Europe/Prague')::DATE;
    
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
        AND o.date = target_date 
        AND o.user_id = target_user_id
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
        WHERE date = target_date
        AND user_id = target_user_id
        AND recipe_id = recipe_id_found;

        IF baker_id_found IS NULL THEN
            -- Create new baker production
            INSERT INTO bakers (date, user_id, recipe_id, status, notes, created_at, updated_at)
            VALUES (
                target_date,
                target_user_id,
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
            AND o.date = target_date 
            AND o.user_id = target_user_id
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

        -- Return summary for this baker
        baker_id := baker_id_found;
        category_name := product_categories.category_name;
        total_products := (SELECT COUNT(*) FROM baker_items WHERE production_id = baker_id_found);
        total_quantity := (SELECT SUM(planned_quantity) FROM baker_items WHERE production_id = baker_id_found);
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION sync_bakers_for_date(DATE, UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION sync_bakers_for_date(DATE, UUID) IS 'Sync bakers for specific date and user. Processes ALL orders regardless of status.';
