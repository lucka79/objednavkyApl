import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { DatePicker } from "./ui/date-picker";
import { toast } from "@/hooks/use-toast";
import { PostgrestResponse } from "@supabase/supabase-js";

interface InvoiceGeneratorProps {
  userId: string;
}

interface OrderItem {
  id: number;
  quantity: number;
  price: number;
  product: {
    name: string;
  };
}

interface Order {
  id: number;
  date: string;
  total: number;
  order_items: OrderItem[];
  user: {
    full_name: string;
    email: string;
    address: string;
    company: string;
    ico: string;
    dic: string;
  };
}

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
            product (
              name
            )
          ),
          user (
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
            const key = `${item.product.name}-${item.price}`;
            if (!acc[key]) {
              acc[key] = {
                name: item.product.name,
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

      // 4. Generate PDF using a library like jsPDF or react-pdf
      const invoiceData = {
        customerInfo: orders[0]?.user,
        dateRange: { start: startDate, end: endDate },
        items: Object.values(itemSummary),
        total: invoiceTotal,
        orderIds: orders.map((o) => o.id),
      };

      await generatePDF(invoiceData);
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
      <Button onClick={generateInvoice} disabled={!startDate || !endDate}>
        Generovat fakturu
      </Button>
    </div>
  );
};

// Separate function for PDF generation
// @ts-ignore
const generatePDF = async (data: {
  customerInfo: any;
  dateRange: { start: Date; end: Date };
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    total: number;
  }>;
  total: number;
  orderIds: number[];
}) => {
  // Implement PDF generation using your preferred library
  // Example using jsPDF:
  // const doc = new jsPDF();
  // doc.text(`Faktura pro ${data.customerInfo.full_name}`, 20, 20);
  // ... add more content ...
  // doc.save('invoice.pdf');
};
