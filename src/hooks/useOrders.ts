
import { useQuery } from '@tanstack/react-query';
import { supabase, useAuthStore } from '@/lib/supabase';
import { Order } from '../../types';

export const useOrders = () => {
    return useQuery<Order[], Error>({
      queryKey: ['orders'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('orders')
          .select('*');
        
        if (error) throw error;
        return data as Order[];
      },
    });
  };

  export const useOrderDetails = (id: number) => {
    return useQuery({
      queryKey: ["orders", id],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("orders")
          .select("*, order_items(*, products(*))")   // propojené tabulky
          .eq("id", id)
          .single();
  
        if (error) {
          throw new Error(error.message);
        }
        return data;
      },
    });
  }

export const getMyOrders = () => {
    //   const { session } = useAuth();
    const user = useAuthStore((state) => state.user);
    const id = user?.id;
  
    return useQuery({
      queryKey: ["orders", { userId: id }],
      queryFn: async () => {
        if (!id) return null;
  
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("user_id", id) // id is undefined -> if(!id) return null
          .order("date", { ascending: false });
        if (error) {
          throw new Error(error.message);
        }
        return data;
      },
    });
  };