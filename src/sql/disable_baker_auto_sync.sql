-- TEMPORARY FIX: Disable auto-sync triggers to prevent timeout during checkout
-- You can manually sync baker productions after checkout using manual_sync_baker_productions()

-- Disable all auto-sync triggers
ALTER TABLE orders DISABLE TRIGGER auto_sync_baker_productions_orders_insert_update;
ALTER TABLE orders DISABLE TRIGGER auto_sync_baker_productions_orders_delete;
ALTER TABLE order_items DISABLE TRIGGER auto_sync_baker_productions_order_items_insert_update;
ALTER TABLE order_items DISABLE TRIGGER auto_sync_baker_productions_order_items_delete;

-- To re-enable later (if needed):
-- ALTER TABLE orders ENABLE TRIGGER auto_sync_baker_productions_orders_insert_update;
-- ALTER TABLE orders ENABLE TRIGGER auto_sync_baker_productions_orders_delete;
-- ALTER TABLE order_items ENABLE TRIGGER auto_sync_baker_productions_order_items_insert_update;
-- ALTER TABLE order_items ENABLE TRIGGER auto_sync_baker_productions_order_items_delete;

COMMENT ON TABLE orders IS 'Auto-sync triggers disabled for performance. Use manual_sync_baker_productions() to sync.';

