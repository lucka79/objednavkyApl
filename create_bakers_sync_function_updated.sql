-- Updated baker sync function using product_parts table
-- This function will sync bakers based on actual product-recipe relationships

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
    recipe_data RECORD;
    baker_item RECORD;
    baker_id_found INTEGER;
    recipe_id_found INTEGER;
BEGIN
    -- Convert to Prague timezone
    target_date := (target_date AT TIME ZONE 'Europe/Prague')::DATE;
    
    -- Get all recipes that have products with orders for this date and user
    FOR recipe_data IN
        SELECT DISTINCT 
            COALESCE(pp.recipe_id, 0) as recipe_id,
            COALESCE(r.name, 'Bez receptu') as recipe_name,
            c.name as category_name,
            SUM(oi.quantity) as total_quantity
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        JOIN orders o ON oi.order_id = o.id
        LEFT JOIN product_parts pp ON p.id = pp.product_id
        LEFT JOIN recipes r ON pp.recipe_id = r.id
        WHERE o.date = target_date 
        AND o.user_id = target_user_id
        GROUP BY COALESCE(pp.recipe_id, 0), COALESCE(r.name, 'Bez receptu'), c.name
    LOOP
        recipe_id_found := recipe_data.recipe_id;

        -- Check if baker production already exists for this date, user, and recipe
        SELECT id INTO baker_id_found
        FROM bakers
        WHERE date = target_date
        AND user_id = target_user_id
        AND recipe_id = recipe_id_found;

        IF baker_id_found IS NULL THEN
            -- Handle "Bez receptu" case (recipe_id = 0)
            IF recipe_id_found = 0 THEN
                -- Create or find a special "Bez receptu" recipe
                INSERT INTO recipes (name, baker, category_id, quantity, price, created_at, updated_at)
                VALUES (
                    'Bez receptu',
                    true,
                    (SELECT id FROM categories LIMIT 1), -- Use first category as fallback
                    1,
                    0,
                    NOW() AT TIME ZONE 'Europe/Prague',
                    NOW() AT TIME ZONE 'Europe/Prague'
                )
                ON CONFLICT (name) DO NOTHING
                RETURNING id INTO recipe_id_found;
                
                -- If no conflict, get the ID
                IF recipe_id_found IS NULL THEN
                    SELECT id INTO recipe_id_found FROM recipes WHERE name = 'Bez receptu';
                END IF;
            END IF;
            
            -- Create new baker production
            INSERT INTO bakers (date, user_id, recipe_id, status,  created_at, updated_at)
            VALUES (
                target_date,
                target_user_id,
                recipe_id_found,
                'planned',
                'Automaticky vytvořené z objednávek pro recept: ' || recipe_data.recipe_name,
                NOW() AT TIME ZONE 'Europe/Prague',
                NOW() AT TIME ZONE 'Europe/Prague'
            )
            RETURNING id INTO baker_id_found;
        ELSE
            -- Update existing baker production
            UPDATE bakers
            SET 
                status = 'planned',
               
                updated_at = NOW() AT TIME ZONE 'Europe/Prague'
            WHERE id = baker_id_found;
        END IF;

        -- Delete existing baker_items for this baker
        DELETE FROM baker_items WHERE production_id = baker_id_found;

        -- Insert baker_items for each product in this recipe
        FOR baker_item IN
            SELECT 
                oi.product_id,
                SUM(oi.quantity) as total_ordered,
                COALESCE(pp.quantity, 1.0) as part_quantity,
                SUM(oi.quantity * COALESCE(pp.quantity, 1.0)) as total_ingredient_needed
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN orders o ON oi.order_id = o.id
            LEFT JOIN product_parts pp ON p.id = pp.product_id AND pp.recipe_id = recipe_id_found
            WHERE o.date = target_date 
            AND o.user_id = target_user_id
            AND (
                (recipe_id_found = 0 AND pp.recipe_id IS NULL) OR 
                (recipe_id_found > 0 AND pp.recipe_id = recipe_id_found)
            )
            GROUP BY oi.product_id, COALESCE(pp.quantity, 1.0)
            HAVING SUM(oi.quantity) > 0
        LOOP
            -- Insert baker_item for this product
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
                GREATEST(1, CEIL(baker_item.total_ingredient_needed)),
                GREATEST(1, CEIL(baker_item.total_ingredient_needed)),
                NOW() AT TIME ZONE 'Europe/Prague',
                NOW() AT TIME ZONE 'Europe/Prague'
            );
        END LOOP;

        -- Return summary for this baker
        baker_id := baker_id_found;
        category_name := recipe_data.recipe_name;
        total_products := (SELECT COUNT(*) FROM baker_items WHERE production_id = baker_id_found);
        total_quantity := (SELECT SUM(planned_quantity) FROM baker_items WHERE production_id = baker_id_found);
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION sync_bakers_for_date(DATE, UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION sync_bakers_for_date(DATE, UUID) IS 'Sync bakers for specific date and user using product_parts table for accurate recipe assignment.';
