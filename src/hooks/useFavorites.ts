import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';


export const useFavoriteOrders = () => {
  return useQuery({
    queryKey: ['favoriteOrders'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('favorite_orders')
          .select(`
              *,
              user:profiles(id, full_name, role, paid_by),
              favorite_items (
                  *,
                  product:products(*)
              )
          `)
          .order('user(full_name)', { ascending: true });

        console.log('Supabase response:', { data, error });

        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Error fetching favorite orders:', error);
        throw error;
      }
    }
  })
}

export const fetchFavoriteOrdersByUserId = (userId: string) => {
    return useQuery({
        queryKey: ['favoriteOrders', userId],
        queryFn: async () => {
    const { data, error } = await supabase
      .from('favorite_orders')
      .select(`
        *,
        favorite_items (
          *,
          product:products (*)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
  
    if (error) throw error
    return data
  }
});
};

export const useFavoriteItems = () => {
  return useQuery({
    queryKey: ['favoriteItems'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('favorite_items')
        .select(`
          id,
          product_id,
          quantity,
          product:products(name,price),
                  `)
        .order('product(name)', { ascending: false });

      console.log('Supabase response:', { data, error });

      if (error) throw error;
      if (!data) return [];
      
      return data;
    },
  });
};

interface UpdateFavoriteItemParams {
  itemId: number;
  newQuantity?: number;
  newPrice?: number;
  isManualPrice?: boolean;
}

export const useUpdateFavoriteItem = () => {
  return useMutation({
    mutationFn: async (params: UpdateFavoriteItemParams) => {
      const { data, error } = await supabase
        .from('favorite_items')
        .update({
          quantity: params.newQuantity,
          price: params.newPrice,
          is_manual_price: params.isManualPrice
        })
        .eq('id', params.itemId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  });
};

export const useDeleteFavoriteItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: number) => {
      const { error } = await supabase
        .from('favorite_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favoriteOrders"] });
      queryClient.invalidateQueries({ queryKey: ["favoriteItems"] });
    },
  });
};

export const useUpdateFavoriteOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      data 
    }: { 
      id: number; 
      data: {
        days?: ("Po" | "Út" | "St" | "Čt" | "Pá" | "So" | "Ne" | "X")[];
        status?: string;
        user_id?: string;
      }
    }) => {
      const { error } = await supabase
        .from('favorite_orders')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favoriteOrders'] });
    },
  });
};

export const useCreateFavoriteOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      data 
    }: { 
      data: {
        days: Day[];
        status?: string;
        user_id: string;
      }
    }) => {
      const { data: newOrder, error } = await supabase
        .from('favorite_orders')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return newOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favoriteOrders'] });
    },
  });
};

export const useDeleteFavoriteOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('favorite_orders')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favoriteOrders'] });
    },
  });
};

interface UpdateStoredItemsParams {
  userId: string;
  items: {
    product_id: number;
    quantity: number;
    increment?: boolean;
  }[];
}

export const useUpdateStoredItems = () => {
  return useMutation({
    mutationFn: async ({ userId, items }: UpdateStoredItemsParams) => {
      for (const item of items) {
        // Check if item exists
        const { data: existingItem } = await supabase
          .from('stored_items')
          .select('quantity')
          .eq('user_id', userId)
          .eq('product_id', item.product_id)
          .single();

        if (existingItem) {
          // Update existing item
          await supabase
            .from('stored_items')
            .update({
              quantity: item.increment 
                ? existingItem.quantity + item.quantity 
                : item.quantity
            })
            .eq('user_id', userId)
            .eq('product_id', item.product_id);
        } else {
          // Insert new item
          await supabase
            .from('stored_items')
            .insert({
              user_id: userId,
              product_id: item.product_id,
              quantity: item.quantity
            });
        }
      }
    }
  });
};
