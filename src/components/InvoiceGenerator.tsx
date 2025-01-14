import { useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { DatePicker } from "./ui/date-picker";
import { toast } from "@/hooks/use-toast";
import { PostgrestResponse } from "@supabase/supabase-js";
import { generatePDF } from "./InvoicePdf";

interface InvoiceGeneratorProps {
  userId: string;
}

interface OrderItem {
  id: number;
  quantity: number;
  price: number;
  products: {
    name: string;
  };
}

interface Order {
  id: number;
  date: string;
  total: number;
  order_items: OrderItem[];
  profiles: {
    full_name: string;
    email: string;
    address: string;
    company: string;
    ico: string;
    dic: string;
  };
}

// interface Invoice {
//   id: number;
//   created_at: string;
//   user_id: string;
//   start_date: string;
//   end_date: string;
//   total: number;
//   invoice_number: string;
//   order_ids: number[];
// }

export const InvoiceGenerator = ({ userId }: InvoiceGeneratorProps) => {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  const generateInvoice = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Chyba",
        description: "Vyberte prosím datum od a do",
        variant: "destructive",
      });
      return;
    }

    try {
      // 1. Fetch orders for the user within date range
      const { data: orders, error: ordersError } = (await supabase
        .from("orders")
        .select(
          `
          id,
          date,
          total,
          order_items (
            id,
            quantity,
            price,
            products (
              name
            )
          ),
          profiles!orders_user_id_fkey (
            full_name,
            email,
            address,
            company,
            ico,
            dic
          )
        `
        )
        .eq("user_id", userId)
        .gte("date", startDate.toISOString())
        .lte("date", endDate.toISOString())
        .order("date", {
          ascending: true,
        })) as unknown as PostgrestResponse<Order>;

      if (ordersError) throw ordersError;

      if (!orders?.length) {
        toast({
          title: "Žádné objednávky",
          description: "Pro vybrané období nebyly nalezeny žádné objednávky",
          variant: "destructive",
        });
        return;
      }

      // 2. Group items by product and calculate totals
      const itemSummary = orders.reduce(
        (acc, order) => {
          order.order_items?.forEach((item: OrderItem) => {
            const key = `${item.products.name}-${item.price}`;
            if (!acc[key]) {
              acc[key] = {
                name: item.products.name,
                price: item.price,
                quantity: 0,
                total: 0,
              };
            }
            acc[key].quantity += item.quantity;
            acc[key].total += item.quantity * item.price;
          });
          return acc;
        },
        {} as Record<
          string,
          { name: string; price: number; quantity: number; total: number }
        >
      );

      // 3. Calculate invoice total
      const invoiceTotal = orders.reduce((sum, order) => sum + order.total, 0);

      // Generate invoice number (you might want to customize this format)
      const invoiceNumber = `FAV${new Date().getFullYear()}-${uuidv4().slice(0, 8)}`;

      // Save invoice to database
      const { error: saveError } = await supabase
        .from("invoices")
        .insert({
          user_id: userId,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          total: invoiceTotal,
          invoice_number: invoiceNumber,
          order_ids: orders.map((o) => o.id),
        })
        .select()
        .single();

      if (saveError) throw saveError;

      // Prepare invoice data for PDF generation
      const invoiceData = {
        invoiceNumber,
        customerInfo: orders[0]?.profiles,
        dateRange: { start: startDate, end: endDate },
        items: Object.values(itemSummary),
        total: invoiceTotal,
        orders: orders.map((o) => ({
          id: o.id.toString(),
          date: new Date(o.date),
          total: o.total,
        })),
      };

      // Generate PDF
      await generatePDF(invoiceData);

      toast({
        title: "Úspěch",
        description: `Faktura ${invoiceNumber} byla úspěšně vygenerována`,
      });
    } catch (error) {
      console.error("Failed to generate invoice:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se vygenerovat fakturu",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <DatePicker
          selected={startDate}
          onSelect={setStartDate}
          placeholder="Od data..."
        />
        <DatePicker
          selected={endDate}
          onSelect={setEndDate}
          placeholder="Do data..."
        />
      </div>
      <Button
        variant="outline"
        onClick={generateInvoice}
        disabled={!startDate || !endDate}
      >
        Generovat fakturu
      </Button>
    </div>
  );
};

// Update the generatePDF function to include invoice numbe
