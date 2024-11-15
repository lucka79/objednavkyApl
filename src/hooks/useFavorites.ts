import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export const useFavoriteOrders = () => {
  return useQuery({
    queryKey: ['favoriteOrders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('favorite_orders')
        .select(`
            id,
            user_id,
            day,
            user:profiles(id, full_name, role)
        `)
        .order('profiles.full_name', { ascending: false });

        if (error) throw error;
        return data;
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
