# 🚀 Quick Telegram Setup (5 Minutes)

The **absolute fastest** way to get mobile notifications working.

## Step 1: Create Telegram Bot (2 minutes)

1. **Open Telegram** on your phone
2. **Search for:** `@BotFather`
3. **Send command:** `/newbot`
4. **Choose name:** "Objednávky Bot" (or whatever you want)
5. **Choose username:** Something like `objednavky_bot` (must end with 'bot')
6. **Copy the token** you receive (looks like: `6789012345:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw`)

## Step 2: Get Your Chat ID (1 minute)

1. **Start chat** with your new bot (click the link BotFather sent)
2. **Send any message** to the bot (e.g., "Hello")
3. **Open this URL in browser** (replace `YOUR_BOT_TOKEN`):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
4. **Find your chat_id** in the response (will be a number like `987654321`)

Example response:
```json
{
  "ok": true,
  "result": [{
    "message": {
      "chat": {
        "id": 987654321,  ← THIS IS YOUR CHAT_ID
        "first_name": "Your Name"
      }
    }
  }]
}
```

## Step 3: Deploy Edge Function (1 minute)

```bash
# Navigate to your project
cd your-project-folder

# Deploy the function
supabase functions deploy notify-telegram

# Set your secrets
supabase secrets set TELEGRAM_BOT_TOKEN=6789012345:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
supabase secrets set TELEGRAM_CHAT_ID=987654321
```

## Step 4: Create Webhook in Supabase UI (1 minute)

1. **Go to:** Supabase Dashboard → Database → Webhooks
2. **Click:** "Create a new webhook"
3. **Fill in:**
   - **Name:** `notify-new-invoice`
   - **Table:** `invoices_received`
   - **Events:** ✅ INSERT
   - **Type:** HTTP Request
   - **Method:** POST
   - **URL:** `https://YOUR_PROJECT_ID.supabase.co/functions/v1/notify-telegram`
     - Replace `YOUR_PROJECT_ID` with your actual project ID
   - **HTTP Headers:** Add these two headers:
     ```
     Content-Type: application/json
     Authorization: Bearer YOUR_ANON_KEY
     ```
     - Get `YOUR_ANON_KEY` from Settings → API → Project API keys → `anon` `public`

4. **Click:** "Create webhook"

## Step 5: Test! 🎉

Upload a new invoice and check your Telegram! You should get a message like:

```
🧾 Nová faktura přijata!

📦 Dodavatel: MAKRO
📄 Číslo faktury: FAK-2025-001
💰 Částka: 15,420 Kč
📅 Datum: 2025-11-05
📊 Počet položek: 8

✅ Připraveno ke zpracování
```

---

## 🔧 Troubleshooting

### Not receiving notifications?

**Check 1:** Edge Function is deployed
```bash
supabase functions list
```
Should show `notify-telegram`

**Check 2:** Secrets are set
```bash
supabase secrets list
```
Should show `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`

**Check 3:** Check Edge Function logs
```bash
supabase functions logs notify-telegram --tail
```

**Check 4:** Manually test the function
```bash
supabase functions invoke notify-telegram --method POST --body '{
  "type": "INSERT",
  "record": {
    "table": "invoices_received",
    "invoice_number": "TEST-001",
    "supplier_id": "test",
    "total_amount": 1500,
    "invoice_date": "2025-11-05",
    "items_count": 3
  }
}'
```

### Wrong chat ID?

If you see "chat not found" error, your chat ID might be wrong. 

**Make sure:**
1. You sent a message to the bot FIRST
2. The chat ID is just the number (no quotes)
3. You're using the correct bot token

### Bot token invalid?

Double-check you copied the entire token from BotFather. It should be in format:
```
1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

---

## 📱 Bonus: Add More Recipients

Want multiple people to receive notifications?

### Option 1: Create Telegram Group
1. Create a new Telegram group
2. Add your bot to the group
3. Make bot an admin
4. Send a message in the group
5. Get the group chat ID (same way as before)
6. Update your `TELEGRAM_CHAT_ID` secret with the group ID (will be negative, like `-1001234567890`)

### Option 2: Multiple Bots
Create a separate bot for each person and deploy multiple Edge Functions.

---

## 🎨 Customize the Message

Edit `supabase/functions/notify-telegram/index.ts` to change the message format:

```typescript
message = `🧾 *Nová faktura!*\n\n`;
message += `📦 ${supplier?.full_name}\n`;
message += `💰 ${record.total_amount} Kč\n`;
// Add more fields or change formatting
```

Telegram supports **Markdown** formatting:
- `*bold*` for **bold**
- `_italic_` for _italic_
- `` `code` `` for `code`
- `[link](url)` for links

---

## 🚀 Next Steps

Once Telegram notifications work, you can also set up:

1. **Browser notifications** (for when you're at your computer)
2. **Email notifications** (for formal records)
3. **SMS notifications** (for critical alerts)

See `NOTIFICATION_SETUP.md` for more options!

---

## ✅ That's It!

You now have instant mobile notifications for new invoices! 📱

Every time a new invoice is uploaded, you'll get a Telegram message within seconds.

