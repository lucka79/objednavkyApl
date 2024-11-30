import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase, useAuthStore } from '@/lib/supabase';
import { InsertTables, Receipt } from '../../types';

export const fetchAllReceipts = () => {
    // const queryClient = useQueryClient();
    return useQuery({
      queryKey: ['receipts'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('receipts')
          .select(`
            *,
            receipt_items (
            *,
            product:products (*)
            )
          `)
          .order('created_at', { ascending: false });
  
        if (error) throw error;
        return data as Receipt[];
      },
    });
  };


export const useInsertReceipt = () => {
    const queryClient = useQueryClient();
    const { user } = useAuthStore.getState();
  
    return useMutation({
      async mutationFn(data: InsertTables<"receipts">) {
        const receiptData = {
          ...data,
          seller_id: data.seller_id || user?.id,
          buyer_id: data.buyer_id || null
        };
  
        const { error, data: newReceipt } = await supabase
          .from("receipts")
          .insert(receiptData)
          .select()
          .single();
  
        if (error) {
          throw new Error(error.message);
        }
        return newReceipt;
      },
      async onSuccess() {
        await queryClient.invalidateQueries({ queryKey: ["receipts"] });
      },
    });
  };

  export const useInsertReceiptItems = () => {
    // const queryClient = useQueryClient();
  
    return useMutation({
      async mutationFn(items: InsertTables<"receipt_items">[]) {
        const { error, data: newReceipt } = await supabase
          .from("receipt_items")
          .insert(items)
          .select();
         // .single();   více položek v objednávce
  
        if (error) {
          throw new Error(error.message);
        }
        return newReceipt;
      },
  
    });
  };