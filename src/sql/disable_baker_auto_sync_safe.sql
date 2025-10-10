-- SAFE: Disable auto-sync triggers (only if they exist)
-- This prevents errors if triggers don't exist

DO $$
BEGIN
    -- Disable triggers on orders table if they exist
    IF EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'auto_sync_baker_productions_orders_insert_update' 
        AND tgrelid = 'orders'::regclass
    ) THEN
        ALTER TABLE orders DISABLE TRIGGER auto_sync_baker_productions_orders_insert_update;
        RAISE NOTICE 'Disabled: auto_sync_baker_productions_orders_insert_update';
    ELSE
        RAISE NOTICE 'Trigger does not exist: auto_sync_baker_productions_orders_insert_update';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'auto_sync_baker_productions_orders_delete' 
        AND tgrelid = 'orders'::regclass
    ) THEN
        ALTER TABLE orders DISABLE TRIGGER auto_sync_baker_productions_orders_delete;
        RAISE NOTICE 'Disabled: auto_sync_baker_productions_orders_delete';
    ELSE
        RAISE NOTICE 'Trigger does not exist: auto_sync_baker_productions_orders_delete';
    END IF;

    -- Disable triggers on order_items table if they exist
    IF EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'auto_sync_baker_productions_order_items_insert_update' 
        AND tgrelid = 'order_items'::regclass
    ) THEN
        ALTER TABLE order_items DISABLE TRIGGER auto_sync_baker_productions_order_items_insert_update;
        RAISE NOTICE 'Disabled: auto_sync_baker_productions_order_items_insert_update';
    ELSE
        RAISE NOTICE 'Trigger does not exist: auto_sync_baker_productions_order_items_insert_update';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'auto_sync_baker_productions_order_items_delete' 
        AND tgrelid = 'order_items'::regclass
    ) THEN
        ALTER TABLE order_items DISABLE TRIGGER auto_sync_baker_productions_order_items_delete;
        RAISE NOTICE 'Disabled: auto_sync_baker_productions_order_items_delete';
    ELSE
        RAISE NOTICE 'Trigger does not exist: auto_sync_baker_productions_order_items_delete';
    END IF;

    -- Also check and disable old ROW-level triggers if they exist
    IF EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'auto_sync_baker_productions_orders' 
        AND tgrelid = 'orders'::regclass
    ) THEN
        ALTER TABLE orders DISABLE TRIGGER auto_sync_baker_productions_orders;
        RAISE NOTICE 'Disabled: auto_sync_baker_productions_orders (old)';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'auto_sync_baker_productions_order_items' 
        AND tgrelid = 'order_items'::regclass
    ) THEN
        ALTER TABLE order_items DISABLE TRIGGER auto_sync_baker_productions_order_items;
        RAISE NOTICE 'Disabled: auto_sync_baker_productions_order_items (old)';
    END IF;
END $$;

-- Check current trigger status
SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS table_name,
    tgenabled AS status,
    CASE 
        WHEN tgenabled = 'O' THEN 'Enabled'
        WHEN tgenabled = 'D' THEN 'Disabled'
        WHEN tgenabled = 'R' THEN 'Replica'
        WHEN tgenabled = 'A' THEN 'Always'
        ELSE 'Unknown'
    END AS status_description
FROM pg_trigger
WHERE tgname LIKE '%baker%'
ORDER BY tgrelid::regclass::text, tgname;

