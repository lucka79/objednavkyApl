import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface ReceivedInvoice {
  id: string;
  invoice_number: string;
  supplier_id: string | null;
  receiver_id: string | null;
  invoice_date: string | null;
  total_amount: number | null;
  processing_status: string | null;
  supplier_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  supplier?: {
    id: string;
    full_name: string;
  };
  receiver?: {
    id: string;
    full_name: string;
  };
  items: ReceivedItem[];
}

export interface ReceivedItem {
  id: string;
  invoice_received_id: string | null;
  matched_ingredient_id: number | null;
  quantity: number | null;
  unit_price: number | null;
  line_total: number | null;
  unit_of_measure: string | null;
  created_at: string | null;
  updated_at: string | null;
  ingredient?: {
    id: number;
    name: string;
    unit: string;
  };
}

export const useReceivedInvoices = () => {
  return useQuery({
    queryKey: ["receivedInvoices"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("invoices_received")
          .select(`
            *,
            supplier:profiles!invoices_received_supplier_id_fkey(id, full_name),
            receiver:profiles!invoices_received_receiver_id_fkey(id, full_name),
            items:items_received(
              *,
              ingredient:ingredients!items_received_matched_ingredient_id_fkey(
                id, 
                name, 
                unit,
                ingredient_supplier_codes(
                  supplier_id,
                  supplier_ingredient_name
                )
              )
            )
          `)
          .order("invoice_date", { ascending: false });

        if (error) {
          console.error("Error fetching received invoices:", error);
          // Return empty array if tables don't exist yet
          if (error.code === "PGRST116" || error.message.includes("relation") || error.message.includes("does not exist")) {
            return [];
          }
          throw error;
        }
        return data as ReceivedInvoice[];
      } catch (error) {
        console.error("Failed to fetch received invoices:", error);
        // Return empty array as fallback
        return [];
      }
    },
  });
};

export const useCreateReceivedInvoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      invoice_number: string;
      supplier_id: string;
      received_date: string;
      status: string;
      notes?: string;
      items: {
        ingredient_id: number;
        quantity: number;
        unit_price: number;
        total_price: number;
      }[];
    }) => {
      try {
        // Calculate total amount
        const total_amount = data.items.reduce((sum, item) => sum + item.total_price, 0);

        // Insert invoice
        const { data: invoice, error: invoiceError } = await supabase
          .from("invoices_received")
          .insert({
            invoice_number: data.invoice_number,
            supplier_id: data.supplier_id,
            invoice_date: data.received_date,
            total_amount,
            processing_status: data.status,
            supplier_name: null, // Will be populated from supplier lookup
          })
          .select()
          .single();

        if (invoiceError) {
          console.error("Error creating invoice:", invoiceError);
          throw new Error(`Failed to create invoice: ${invoiceError.message}`);
        }

        // Insert items
        if (data.items.length > 0) {
          const itemsData = data.items.map((item) => ({
            invoice_received_id: invoice.id,
            matched_ingredient_id: item.ingredient_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.total_price,
            unit_of_measure: null, // Will be populated from ingredient
            manual_match: true, // Mark as manually created
          }));

          const { error: itemsError } = await supabase
            .from("items_received")
            .insert(itemsData);

          if (itemsError) {
            console.error("Error creating invoice items:", itemsError);
            throw new Error(`Failed to create invoice items: ${itemsError.message}`);
          }
        }

        return invoice;
      } catch (error) {
        console.error("Failed to create received invoice:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receivedInvoices"] });
    },
  });
};

export const useUpdateReceivedInvoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      receiver_id,
    }: {
      id: string;
      receiver_id?: string;
    }) => {
      const updateData: any = {};
      
      if (receiver_id !== undefined) {
        updateData.receiver_id = receiver_id || null;
      }

      console.log("Updating invoice:", { id, updateData });

      const { data: invoice, error } = await supabase
        .from("invoices_received")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating invoice:", error);
        throw error;
      }
      
      console.log("Invoice updated successfully:", invoice);
      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receivedInvoices"] });
    },
  });
};

export const useDeleteReceivedInvoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        // First delete all items
        const { error: itemsError } = await supabase
          .from("items_received")
          .delete()
          .eq("invoice_received_id", id);

        if (itemsError) {
          console.error("Error deleting invoice items:", itemsError);
          throw new Error(`Failed to delete invoice items: ${itemsError.message}`);
        }

        // Then delete the invoice
        const { error: invoiceError } = await supabase
          .from("invoices_received")
          .delete()
          .eq("id", id);

        if (invoiceError) {
          console.error("Error deleting invoice:", invoiceError);
          throw new Error(`Failed to delete invoice: ${invoiceError.message}`);
        }
      } catch (error) {
        console.error("Failed to delete received invoice:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receivedInvoices"] });
    },
  });
};
