
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



  export const fetchOrders = async (userId: string): Promise<Order[]> => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          product:products (*)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
  
    if (error) throw error
    return data
  }

  export const fetchAllOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        user:profiles (id, full_name),
        order_items (
          *,
          product:products (*)
        )
      `)
    //   .eq('user_id', userId)
      .order('date', { ascending: false })
  
    if (error) throw error
    return data
  }

  export const fetchTableOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        user:users(name),
        order_items:order_items(
          id,
          product_id,
          quantity,
          product:products(name, price)
        )
      `, { count: 'exact' })
      
      .order('date', { ascending: false })
  
    if (error) throw error
  
    return { orders: data as Order[] }
  }