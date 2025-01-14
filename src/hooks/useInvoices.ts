import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

interface Invoice {
  id: number;
  created_at: string;
  user_id: string;
  start_date: string;
  end_date: string;
  total: number;
  invoice_number: string;
  order_ids: number[];
}

export const useInvoices = (userId?: string) => {
  return useQuery({
    queryKey: ["invoices", userId],
    queryFn: async () => {
      console.log('Fetching invoices...');
      // First get the invoices
      const query = supabase
        .from("invoices")
        .select(`
          *,
          profiles (
            full_name,
            email,
            address,
            company,
            ico,
            dic
          )
        `)
        .order("created_at", { ascending: false });

      if (userId) {
        query.eq("user_id", userId);
      }

      const { data: invoices, error } = await query;

      if (error) {
        console.error('Error fetching invoices:', error);
        throw error;
      }

      console.log('Fetched invoices:', invoices);

      // Then for each invoice, get the orders and their items
      const invoicesWithDetails = await Promise.all(
        invoices.map(async (invoice) => {
          console.log(`Fetching orders for invoice ${invoice.invoice_number}...`);
          // Get orders
          const { data: orders, error: ordersError } = await supabase
            .from("orders")
            .select(`
              id,
              date,
              total,
              user:profiles!orders_user_id_fkey (
                full_name
              )
            `)
            .in("id", invoice.order_ids)
            .order("date", { ascending: true });

          if (ordersError) {
            console.error('Error fetching orders:', ordersError);
            throw ordersError;
          }

          console.log(`Fetched orders for invoice ${invoice.invoice_number}:`, orders);

          console.log(`Fetching order items for invoice ${invoice.invoice_number}...`);
          // Get order items
          const { data: items, error: itemsError } = await supabase
            .from("order_items")
            .select(`
              id,
              order_id,
              quantity,
              price,
              products (
                name
              )
            `)
            .in("order_id", invoice.order_ids);

          if (itemsError) {
            console.error('Error fetching order items:', itemsError);
            throw itemsError;
          }

          console.log(`Fetched order items for invoice ${invoice.invoice_number}:`, items);

          return {
            ...invoice,
            orders: orders || [],
            items: items || [],
          };
        })
      );

      console.log('Final invoices with details:', invoicesWithDetails);
      return invoicesWithDetails as Invoice[];
    },
    enabled: true,
  });
};

export const useInvoice = (invoiceId: number) => {
  return useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();

      if (error) throw error;
      return data as Invoice;
    },
    enabled: !!invoiceId,
  });
};

export const useIsOrderInvoiced = () => {
  return useQuery({
    queryKey: ["invoiced-orders"],
    queryFn: async () => {
      const { data: invoices, error } = await supabase
        .from("invoices")
        .select("order_ids");

      if (error) throw error;

      // Create a Set of all order IDs that are in any invoice
      const invoicedOrderIds = new Set(
        invoices?.flatMap((invoice) => invoice.order_ids) ?? []
      );

      return invoicedOrderIds;
    },
  });
};
