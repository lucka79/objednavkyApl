-- Fix all foreign key constraints to use appropriate CASCADE DELETE behavior
-- This allows parent records to be deleted along with their child records

-- 1. order_items -> orders (CASCADE)
-- When an order is deleted, delete all its order_items
ALTER TABLE order_items 
DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;

ALTER TABLE order_items 
ADD CONSTRAINT order_items_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES orders(id) 
ON DELETE CASCADE;

COMMENT ON CONSTRAINT order_items_order_id_fkey ON order_items IS 
'CASCADE DELETE - deleting an order automatically deletes all its order_items';

-- 2. baker_items -> bakers (CASCADE)
-- When a baker production is deleted, delete all its baker_items
ALTER TABLE baker_items 
DROP CONSTRAINT IF EXISTS baker_items_production_id_fkey;

ALTER TABLE baker_items 
ADD CONSTRAINT baker_items_production_id_fkey 
FOREIGN KEY (production_id) 
REFERENCES bakers(id) 
ON DELETE CASCADE;

COMMENT ON CONSTRAINT baker_items_production_id_fkey ON baker_items IS 
'CASCADE DELETE - deleting a baker production automatically deletes all its baker_items';

-- 3. daily_ingredient_consumption -> ingredients (CASCADE)
-- When an ingredient is deleted, delete all its consumption records
ALTER TABLE daily_ingredient_consumption 
DROP CONSTRAINT IF EXISTS daily_ingredient_consumption_ingredient_id_fkey;

ALTER TABLE daily_ingredient_consumption 
ADD CONSTRAINT daily_ingredient_consumption_ingredient_id_fkey 
FOREIGN KEY (ingredient_id) 
REFERENCES ingredients(id) 
ON DELETE CASCADE;

COMMENT ON CONSTRAINT daily_ingredient_consumption_ingredient_id_fkey ON daily_ingredient_consumption IS 
'CASCADE DELETE - deleting an ingredient automatically deletes all its consumption records';

-- 4. daily_ingredient_consumption -> products (CASCADE)
-- When a product is deleted, delete all its consumption records
ALTER TABLE daily_ingredient_consumption 
DROP CONSTRAINT IF EXISTS daily_ingredient_consumption_product_id_fkey;

ALTER TABLE daily_ingredient_consumption 
ADD CONSTRAINT daily_ingredient_consumption_product_id_fkey 
FOREIGN KEY (product_id) 
REFERENCES products(id) 
ON DELETE CASCADE;

COMMENT ON CONSTRAINT daily_ingredient_consumption_product_id_fkey ON daily_ingredient_consumption IS 
'CASCADE DELETE - deleting a product automatically deletes all its consumption records';

-- Verify all constraints were created correctly
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table,
    CASE confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
    END AS delete_action
FROM pg_constraint
WHERE conname IN (
    'order_items_order_id_fkey',
    'baker_items_production_id_fkey',
    'daily_ingredient_consumption_ingredient_id_fkey',
    'daily_ingredient_consumption_product_id_fkey'
)
ORDER BY conrelid::regclass::text, conname;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Successfully updated foreign key constraints to use CASCADE DELETE';
    RAISE NOTICE 'Now you can delete orders, baker productions, ingredients, and products without foreign key errors';
END $$;
