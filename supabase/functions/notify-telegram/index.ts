import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      throw new Error("Telegram credentials not configured");
    }

    const body = await req.json();
    const { type, record } = body;

    console.log("Notification triggered:", { type, record });

    let message = "";

    if (type === "INSERT" && record.table === "invoices_received") {
      // New invoice received
      const supplierName = record.supplier_name || "Neznámý";

      message = `🧾 *Nová faktura přijata!*\n\n`;
      message += `📦 Dodavatel: ${supplierName}\n`;
      message += `📄 Číslo faktury: ${record.invoice_number || "N/A"}\n`;
      message += `💰 Částka: ${record.total_amount ? `${record.total_amount} Kč` : "N/A"}\n`;
      message += `📅 Datum: ${record.invoice_date || "N/A"}\n`;
      message += `📊 Počet položek: ${record.items_count || 0}\n`;
      message += `\n✅ Připraveno ke zpracování`;
    } else {
      message = `📬 Nová notifikace z objednávkového systému`;
    }

    // Send to Telegram
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Telegram API error: ${error}`);
    }

    console.log("Notification sent successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Notification sent" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending notification:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

