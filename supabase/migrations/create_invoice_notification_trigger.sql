-- Create a function that calls the Edge Function when a new invoice is inserted
CREATE OR REPLACE FUNCTION notify_new_invoice()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
BEGIN
  -- Get the Edge Function URL from your Supabase project
  -- Replace with your actual Edge Function URL
  webhook_url := current_setting('app.settings.telegram_webhook_url', true);
  
  IF webhook_url IS NOT NULL THEN
    -- Call the Edge Function using pg_net extension
    PERFORM net.http_post(
      url := webhook_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'record', jsonb_build_object(
          'table', 'invoices_received',
          'id', NEW.id,
          'invoice_number', NEW.invoice_number,
          'supplier_id', NEW.supplier_id,
          'invoice_date', NEW.invoice_date,
          'total_amount', NEW.total_amount,
          'items_count', (
            SELECT COUNT(*) 
            FROM items_received 
            WHERE invoice_received_id = NEW.id
          )
        )
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on invoices_received table
DROP TRIGGER IF EXISTS trigger_notify_new_invoice ON invoices_received;
CREATE TRIGGER trigger_notify_new_invoice
  AFTER INSERT ON invoices_received
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_invoice();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION net.http_post TO postgres, anon, authenticated, service_role;

