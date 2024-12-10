import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { InsertTables, Return } from '../../types';


interface DbReturnItem {
  quantity: number;
  product: {
    price: number;
    priceMobil: number;
  };
}

export const fetchAllReturns = (userId?: string, userRole?: string) => {
  return useQuery({
    queryKey: ['returns', userId, userRole],
    queryFn: async () => {
      let query = supabase
        .from('returns')
        .select(`
          *,
          user:profiles (id, full_name, role),
          return_items (
            *,
            product:products (*)
          )
        `)
        .order('created_at', { ascending: false });

      // Filter returns if user is not admin
      if (userRole && userRole !== 'admin' && userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Return[];
    },
  });
};

  export const fetchReturnsBySellerId = (sellerId?: string) => { // Add sellerId parameter
    // const queryClient = useQueryClient();
    return useQuery({
      queryKey: ['returns', sellerId], // Include sellerId in the query key
      queryFn: async () => {
        const { data, error } = await supabase
          .from('returns')
          .select(`
            *,
            return_items (
            *,
            product:products (*)
            )
          `)
          .order('created_at', { ascending: false })
          .filter('seller_id', 'eq', sellerId); // Filter by seller_id
  
        if (error) throw error;
        return data as Return[];
      },
    });
  };

  // order by id
export const useFetchReturnById = (returnId: number | null) => {
  return useQuery({
    queryKey: ['return', returnId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('returns')
        .select(`
          *,
          user:profiles!returns_user_id_fkey(id, full_name, role),
          return_items(*, product:products(*))
        `)
        .eq('id', returnId)
        .single();

      if (error) throw error;
      return [data];
    },
    enabled: !!returnId
  });
};

  export const useFetchReturnItems = async (returnId: number) => {
    const { data, error } = await supabase
      .from('return_items')
      .select(`
        *,
        product:products(*)
      `)
      .eq('return_id', returnId);
  
    if (error) throw error;
    return data;
  };



export const useInsertReturn = () => {
    const queryClient = useQueryClient();
    // const { user } = useAuthStore.getState();
  
    return useMutation({
      async mutationFn(data: InsertTables<"returns">) {
        const returnData = {
          ...data,
        //   seller_id: data.seller_id || user?.id,
        //   buyer_id: data.buyer_id || null
        };
  
        const { error, data: newReturn } = await supabase
          .from("returns")
          .insert(returnData)
          .select()
          .single();
  
        if (error) {
          throw new Error(error.message);
        }
            return newReturn;
      },
      async onSuccess() {
        await queryClient.invalidateQueries({ queryKey: ["returns"] });
      },
    });
  };

  export const useInsertReturnItems = () => {
    // const queryClient = useQueryClient();
  
    return useMutation({
      async mutationFn(items: InsertTables<"return_items">[]) {
        const { error, data: newReturnItems } = await supabase
          .from("return_items")
          .insert(items)
          .select();
         // .single();   více položek v objednávce
  
        if (error) {
          throw new Error(error.message);
        }
        return newReturnItems;
      },
  
    });
  };

export const useUpdateStoredItems = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    async mutationFn({ userId, items }: { 
      userId: string, 
      items: { product_id: number, quantity: number }[] 
    }) {
      // For each item, update or insert into stored_items
      const promises = items.map(async (item) => {
        // First try to get existing stored item
        const { data: existingItem } = await supabase
          .from('stored_items')
          .select('quantity')
          .eq('user_id', userId)
          .eq('product_id', item.product_id)
          .single();

        if (existingItem) {
          // Update existing item
          const { error } = await supabase
            .from('stored_items')
            .update({ 
              quantity: existingItem.quantity - item.quantity 
            })
            .eq('user_id', userId)
            .eq('product_id', item.product_id);

          if (error) throw error;
        } else {
          // Insert new item with negative quantity
          const { error } = await supabase
            .from('stored_items')
            .insert({
              user_id: userId,
              product_id: item.product_id,
              quantity: -item.quantity
            });

          if (error) throw error;
        }
      });

      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stored_items'] });
    },
  });
};

export const useDeleteReturnItem = () => {
    const queryClient = useQueryClient();
  
    return useMutation({
      async mutationFn({ itemId, returnId }: { itemId: number; returnId: number }) {
        const { error } = await supabase
          .from("return_items")
          .delete()
          .eq('id', itemId);
  
        if (error) throw error;
        return { itemId, returnId };
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ["returnItems", variables.returnId] });
        queryClient.invalidateQueries({ queryKey: ["returns", variables.returnId] });
      },
    });
  };
  
  export const useDeleteReturn = () => {
    const queryClient = useQueryClient();
  
    return useMutation({
      mutationFn: async (returnId: number) => {
        console.log('Starting return deletion process for returnId:', returnId);
  
        // First get the return details
        const { data: returns, error: returnError } = await supabase
          .from("returns")
          .select(`
            id,
            user_id,
            return_items (
              id,
              product_id,
              quantity
            )
          `)
          .eq("id", returnId)
          .single();
  
        if (returnError) {
          console.error('Error fetching return details:', returnError);
          throw returnError;
        }
  
        console.log('Fetched return details:', returns);
  
        // Update stored items one by one
        for (const item of returns.return_items) {
          console.log('Processing return item:', item);
  
          // First try to get existing stored item
          const { data: existingItem, error: fetchError } = await supabase
            .from('stored_items')
            .select('quantity')
            .eq('user_id', returns.user_id)
            .eq('product_id', item.product_id)
            .single();
  
          if (fetchError) {
            console.log('No existing stored item found:', fetchError);
          }
  
          console.log('Existing stored item:', existingItem);
  
          if (existingItem) {
            // Update existing item
            console.log('Updating existing stored item. New quantity will be:', existingItem.quantity + item.quantity);
            const { error: updateError } = await supabase
              .from('stored_items')
              .update({ 
                quantity: existingItem.quantity - item.quantity 
              })
              .eq('user_id', returns.user_id)
              .eq('product_id', item.product_id);
  
            if (updateError) {
              console.error('Error updating stored item:', updateError);
              throw updateError;
            }
          } else {
            // Insert new item
            console.log('Inserting new stored item with quantity:', item.quantity);
            const { error: insertError } = await supabase
              .from('stored_items')
              .insert({
                user_id: returns.user_id,
                product_id: item.product_id,
                quantity: item.quantity
              });
  
            if (insertError) {
              console.error('Error inserting stored item:', insertError);
              throw insertError;
            }
          }
        }
  
        // First delete order_items_history records
        console.log('Deleting return items history records');
        const { error: deleteHistoryError } = await supabase
          .from("return_items_history")
          .delete()
          .in(
            'return_item_id', 
            returns.return_items.map(item => item.id)
          );
  
        if (deleteHistoryError) {
          console.error('Error deleting return items history:', deleteHistoryError);
          throw deleteHistoryError;
        }
  
        // Then delete return items
        console.log('Deleting return items for returnId:', returnId);
        const { error: deleteItemsError } = await supabase
          .from("return_items")
          .delete()
          .eq("return_id", returnId);
  
        if (deleteItemsError) {
          console.error('Error deleting return items:', deleteItemsError);
          throw deleteItemsError;
        }
  
        // Finally delete the return
        console.log('Deleting return:', returnId);
        const { error: deleteError } = await supabase
          .from("returns")
          .delete()
          .eq("id", returnId);
  
        if (deleteError) {
          console.error('Error deleting return:', deleteError);
          throw deleteError;
        }
  
        console.log('Return deletion completed successfully');
      },
      onSuccess: () => {
        console.log('Mutation succeeded, invalidating queries');
        queryClient.invalidateQueries({ queryKey: ["returns"] });
        queryClient.invalidateQueries({ queryKey: ["storedItems"] });
      },
      onError: (error) => {
        console.error('Mutation failed:', error);
      }
    });
  };
  
export const useUpdateReturnQuantity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn({ itemId, newQuantity, userRole }: { itemId: number; newQuantity: number; userRole: string }) {
      // Update quantity first
      const { data: updatedItem } = await supabase
        .from("return_items")
        .update({ quantity: newQuantity })
        .eq("id", itemId)
        .select("return_id")
        .single();

      if (!updatedItem?.return_id) throw new Error("Failed to update item");

      // Get items with product info
      const { data: items } = await supabase
        .from("return_items")
        .select(`
          quantity,
          product:products!inner (
            price,
            priceMobil
          )
        `)
        .eq("return_id", updatedItem.return_id)
        .returns<DbReturnItem[]>();

      // Use returnStore logic for price calculation
      const newTotal = items?.reduce((sum: number, item: DbReturnItem) => {
        const price = userRole === 'mobil' 
          ? item.product.priceMobil 
          : item.product.price;
        return sum + (price * item.quantity);
      }, 0) || 0;

      // Update return total
      await supabase
        .from("returns")
        .update({ total: newTotal })
        .eq("id", updatedItem.return_id);

      return updatedItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["return", data.return_id] });
      queryClient.invalidateQueries({ queryKey: ["returns"] });
    },
  });
};
  
  