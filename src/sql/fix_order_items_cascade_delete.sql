-- Fix foreign key constraint on order_items to allow CASCADE DELETE
-- When an order is deleted, automatically delete all its order_items

-- Drop the existing foreign key constraint
ALTER TABLE order_items 
DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;

-- Recreate the foreign key with ON DELETE CASCADE
ALTER TABLE order_items 
ADD CONSTRAINT order_items_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES orders(id) 
ON DELETE CASCADE;

-- Verify the constraint was created correctly
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table,
    confdeltype AS delete_action,
    CASE confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
    END AS delete_action_description
FROM pg_constraint
WHERE conname = 'order_items_order_id_fkey';

COMMENT ON CONSTRAINT order_items_order_id_fkey ON order_items IS 
'Foreign key with CASCADE DELETE - deleting an order automatically deletes all its order_items';
