# 🔔 Complete Telegram Notification Setup

## ✅ What's Already Done:
1. ✅ Telegram Bot Token: `8546165443:AAH6Hj4zOQ4HK9pBdrHVxxyLlbhrSmnvw8c`
2. ✅ Chat ID: `8587203854`
3. ✅ Secrets configured in Supabase
4. ✅ Edge Function `notify-telegram` deployed

## 🚀 Final Step: Create Database Webhook

### Option A: Via Supabase Dashboard (EASIEST)

1. **Open**: https://supabase.com/dashboard/project/vpululxkipxqqgnzycnc/database/webhooks

2. **Click**: "Create a new webhook" (or "Enable Webhooks" if first time)

3. **Fill in the form**:
   ```
   Name: notify-new-invoice-telegram
   
   Table: invoices_received
   
   Events: ☑️ INSERT (check only this)
   
   Type: HTTP Request
   
   Method: POST
   
   URL: https://vpululxkipxqqgnzycnc.supabase.co/functions/v1/notify-telegram
   
   HTTP Headers:
   Content-Type: application/json
   ```

4. **Click**: "Create webhook"

### Option B: Via SQL (Alternative)

If webhooks UI doesn't work, run this SQL in Supabase SQL Editor:

```sql
-- Enable pg_net extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the notification function
CREATE OR REPLACE FUNCTION notify_telegram_on_invoice()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the Edge Function
  PERFORM net.http_post(
    url := 'https://vpululxkipxqqgnzycnc.supabase.co/functions/v1/notify-telegram',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
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
        'items_count', COALESCE(
          (SELECT COUNT(*) FROM items_received WHERE invoice_received_id = NEW.id),
          0
        )
      )
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_notify_telegram_on_invoice ON invoices_received;
CREATE TRIGGER trigger_notify_telegram_on_invoice
  AFTER INSERT ON invoices_received
  FOR EACH ROW
  EXECUTE FUNCTION notify_telegram_on_invoice();
```

## 🧪 Test the Setup

⚠️ **IMPORTANT**: The trigger only fires on **INSERT** (new invoices). 
- You must insert a **NEW** invoice with a unique invoice_number
- Re-inserting or updating existing invoices will NOT trigger the notification

### Method 1: Test via SQL (MOST RELIABLE)

**Open SQL Editor**: https://supabase.com/dashboard/project/vpululxkipxqqgnzycnc/sql/new

**Copy and paste this**:
```sql
-- Insert a NEW test invoice (this will trigger Telegram notification)
INSERT INTO invoices_received (
  invoice_number,
  supplier_id,
  invoice_date,
  total_amount,
  created_at
) 
VALUES (
  'TELEGRAM-TEST-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS'),
  (SELECT id FROM profiles WHERE role = 'supplier' LIMIT 1),
  CURRENT_DATE,
  9999.99,
  NOW()
) RETURNING *;
```

**Click "Run"** and immediately **check your Telegram!** 📱

### Method 2: Test via NotificationSettings component
1. Go to Admin → Notification Settings in your app
2. Click "Test Notification"
3. Check your Telegram for the test message

### Method 3: Test by uploading an invoice
1. Upload a **NEW** invoice in your app (not an existing one)
2. You should receive a Telegram notification like:

```
🧾 Nová faktura přijata!

📦 Dodavatel: [Supplier Name]
📄 Číslo faktury: TEST-001
💰 Částka: 1500 Kč
📅 Datum: 2025-11-05
📊 Počet položek: 3

✅ Připraveno ke zpracování
```

## 🔍 Troubleshooting

### Check if webhook exists:
```sql
-- Run in SQL Editor
SELECT * FROM pg_stat_user_functions 
WHERE funcname LIKE '%notify%telegram%';
```

### Check Edge Function logs:
1. Go to: https://supabase.com/dashboard/project/vpululxkipxqqgnzycnc/functions/notify-telegram/logs
2. Look for any errors

### Manual test via curl (PowerShell):
```powershell
$body = @{
    type = "INSERT"
    record = @{
        table = "invoices_received"
        invoice_number = "TEST-123"
        supplier_id = "test"
        invoice_date = "2025-11-05"
        total_amount = 1000
        items_count = 5
    }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "https://vpululxkipxqqgnzycnc.supabase.co/functions/v1/notify-telegram" -Method Post -Body $body -ContentType "application/json"
```

If this works, your edge function is fine and the issue is with the webhook/trigger.

## 📋 Common Issues

1. **"Missing authorization header"**: Webhook doesn't need auth header (function is public)
2. **Logs are empty**: Webhook might not be created yet
3. **Function not triggered**: Make sure webhook is on `invoices_received` table with INSERT event

## ✅ Success Indicators

- [ ] Webhook shows in Database → Webhooks
- [ ] Edge function logs show activity
- [ ] Telegram receives notification
- [ ] Test notification works from app

