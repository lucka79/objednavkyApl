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
              user:profiles(id, full_name, role),
              favorite_items (
                  *,
                  product:products(*)
              )
          `)
          .order('user(full_name)', { ascending: false });

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

export const useUpdateFavoriteItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, newQuantity }: { itemId: number; newQuantity: number }) => {
      const { error } = await supabase
        .from('favorite_items')
        .update({ quantity: newQuantity })
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['favoriteItems']);
    },
  });
};
