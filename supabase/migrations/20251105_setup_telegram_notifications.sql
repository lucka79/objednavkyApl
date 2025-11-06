-- Enable pg_net extension for HTTP calls from database
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to notify Telegram via Edge Function
CREATE OR REPLACE FUNCTION notify_telegram_on_new_invoice()
RETURNS TRIGGER AS $$
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
  
  -- Log the request (optional, for debugging)
  RAISE NOTICE 'Telegram notification triggered, request_id: %', request_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_notify_telegram ON invoices_received;

-- Create trigger that fires after INSERT
CREATE TRIGGER trigger_notify_telegram
  AFTER INSERT ON invoices_received
  FOR EACH ROW
  EXECUTE FUNCTION notify_telegram_on_new_invoice();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA net TO postgres, anon, authenticated, service_role;

-- Verify setup
SELECT 'Telegram notifications setup complete!' as status;

