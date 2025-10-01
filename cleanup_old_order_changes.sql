-- Create a function to clean up old order changes (older than 1 week)
CREATE OR REPLACE FUNCTION cleanup_old_order_changes()
RETURNS void AS $$
BEGIN
  -- Delete order_changes entries older than 1 week
  DELETE FROM order_changes 
  WHERE created_at < NOW() - INTERVAL '1 week';
  
  -- Log the cleanup operation
  RAISE NOTICE 'Cleanup completed: Deleted order_changes entries older than 1 week';
END;
$$ LANGUAGE plpgsql;

-- Create a function that will be called by the trigger
CREATE OR REPLACE FUNCTION trigger_cleanup_old_order_changes()
RETURNS trigger AS $$
BEGIN
  -- Call the cleanup function
  PERFORM cleanup_old_order_changes();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger that runs the cleanup function
-- This trigger will run after any INSERT on order_changes table
CREATE OR REPLACE TRIGGER cleanup_old_order_changes_trigger
  AFTER INSERT ON order_changes
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_cleanup_old_order_changes();

-- Also create a scheduled cleanup (optional - requires pg_cron extension)
-- Uncomment the following lines if you have pg_cron extension installed:
-- SELECT cron.schedule('cleanup-old-order-changes', '0 2 * * *', 'SELECT cleanup_old_order_changes();');

-- Test the cleanup function manually
SELECT cleanup_old_order_changes();

-- Show current count of order_changes entries
SELECT 
  COUNT(*) as total_entries,
  MIN(created_at) as oldest_entry,
  MAX(created_at) as newest_entry
FROM order_changes;
