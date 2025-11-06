-- Fix permissions for pg_net extension
-- This allows the trigger to make HTTP calls to the Edge Function

-- Grant permissions on net schema
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;

-- Grant execute on net.http_post function
GRANT EXECUTE ON FUNCTION net.http_post(
  url text,
  headers jsonb,
  body jsonb,
  timeout_milliseconds integer
) TO postgres, anon, authenticated, service_role;

-- Alternative: Grant all on net schema functions
DO $$
BEGIN
  EXECUTE (
    SELECT 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO postgres, anon, authenticated, service_role;'
  );
END $$;

-- Recreate the notification function with proper security
DROP FUNCTION IF EXISTS notify_telegram_on_new_invoice() CASCADE;

CREATE OR REPLACE FUNCTION notify_telegram_on_new_invoice()
RETURNS TRIGGER 
SECURITY DEFINER -- This runs with the permissions of the function creator
SET search_path = public, net
AS $$
DECLARE
  request_id BIGINT;
BEGIN
  -- Make async HTTP call to Edge Function
  SELECT net.http_post(
    url := 'https://vpululxkipxqqgnzycnc.supabase.co/functions/v1/notify-telegram',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'type', 'INSERT',
      'record', jsonb_build_object(
        'table', 'invoices_received',
        'id', NEW.id,
        'invoice_number', NEW.invoice_number,
        'supplier_id', NEW.supplier_id::text,
        'invoice_date', NEW.invoice_date,
        'total_amount', NEW.total_amount,
        'items_count', COALESCE(
          (SELECT COUNT(*)::integer FROM items_received WHERE invoice_received_id = NEW.id),
          0
        )
      )
    )
  ) INTO request_id;
  
  -- Log success (optional)
  RAISE LOG 'Telegram notification triggered, request_id: %', request_id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Failed to send Telegram notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_notify_telegram ON invoices_received;

CREATE TRIGGER trigger_notify_telegram
  AFTER INSERT ON invoices_received
  FOR EACH ROW
  EXECUTE FUNCTION notify_telegram_on_new_invoice();

-- Verify setup
SELECT 'Telegram notification permissions fixed!' as status;

