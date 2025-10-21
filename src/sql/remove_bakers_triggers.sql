-- Remove bakers triggers and functions since they are not used
-- This will prevent the user_id column error

-- Drop all triggers first
DROP TRIGGER IF EXISTS trigger_update_bakers_from_orders ON order_items;
DROP TRIGGER IF EXISTS trigger_update_bakers_on_order_change ON orders;
DROP TRIGGER IF EXISTS trigger_update_bakers_on_order_item_change ON order_items;
DROP TRIGGER IF EXISTS trigger_sync_baker_productions_orders ON orders;
DROP TRIGGER IF EXISTS trigger_sync_baker_productions_order_items ON order_items;

-- Drop the trigger functions with CASCADE to remove all dependencies
DROP FUNCTION IF EXISTS update_bakers_from_orders() CASCADE;
DROP FUNCTION IF EXISTS trigger_sync_baker_productions_orders() CASCADE;
DROP FUNCTION IF EXISTS trigger_sync_baker_productions_order_items() CASCADE;

-- Drop the old sync functions (if they exist)
DROP FUNCTION IF EXISTS sync_bakers_for_date(DATE) CASCADE;
DROP FUNCTION IF EXISTS sync_bakers_for_date_range(DATE, DATE) CASCADE;
