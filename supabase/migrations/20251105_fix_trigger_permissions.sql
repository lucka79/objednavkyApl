-- Fix permissions for Telegram notification trigger
-- This ensures the trigger can call net.http_post even when invoked by regular users

-- Grant permissions on net schema to the function owner (postgres role)
GRANT USAGE ON SCHEMA net TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO postgres;

-- Drop and recreate the function with proper security context
DROP FUNCTION IF EXISTS notify_telegram_on_new_invoice() CASCADE;

CREATE OR REPLACE FUNCTION notify_telegram_on_new_invoice()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER -- Run with creator's privileges
SET search_path = public, net, pg_temp -- Add pg_temp for safety
AS $$
DECLARE
  request_id BIGINT;
BEGIN
  -- Make async HTTP call to Edge Function
  -- This runs with the function creator's permissions, not the user's
  BEGIN
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
    
    RAISE LOG 'Telegram notification triggered, request_id: %', request_id;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but don't fail the insert
      RAISE WARNING 'Failed to send Telegram notification: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_notify_telegram ON invoices_received;

CREATE TRIGGER trigger_notify_telegram
  AFTER INSERT ON invoices_received
  FOR EACH ROW
  EXECUTE FUNCTION notify_telegram_on_new_invoice();

-- Verify the fix
SELECT 
  'Trigger permissions fixed! Function will run as SECURITY DEFINER.' as status,
  proname as function_name,
  prosecdef as security_definer
FROM pg_proc 
WHERE proname = 'notify_telegram_on_new_invoice';

