
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Order, OrderItem } from '../../types';

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

  // order_items by order_id
  export const fetchOrderDetails = async (orderId: number): Promise<OrderItem[]> => {
    const { data, error } = await supabase
      .from('order_items')
      .select(`
        *,
        product:products(name,price)
      `)
      .eq('order_id', orderId)
  
    if (error) throw error
    return data
  }

  // orders by user_id
  export const fetchOrdersByUserId = async (userId: string): Promise<Order[]> => {
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

  // all orders
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

  // order by id
  export const fetchOrderById = async (orderId: number): Promise<Order[]> => {
    const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      user:profiles(id, full_name),
      order_items (
        *,
        product:products (*)
      )
    `)
    .eq('id', orderId)
    .order('created_at', { ascending: false })

    if (error) throw error
    return data
  }

  export const fetchOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        user:profiles(id, full_name)
      `)
      .order('date', { ascending: false })
  
    if (error) throw error
    return data
  }

  export const fetchOrderItems = async (orderId: number): Promise<OrderItem[]> => {
  const { data, error } = await supabase
    .from('order_items')
    .select(`
      *,
      product:products(*)
    `)
    .eq('order_id', orderId)

  if (error) throw error
  return data
}

export const updateOrderItem = async (orderItem: OrderItem): Promise<OrderItem> => {
  const { data, error } = await supabase
    .from('order_items')
    .update({ quantity: orderItem.quantity })
    .eq('id', orderItem.id)
    .single()

  if (error) throw error
  return data
}

//   export const fetchTableOrders = async () => {
//     const { data, error } = await supabase
//       .from('orders')
//       .select(`
//         *,
//         user:profiles (id, full_name),
//         order_items:order_items(
//           id,
//           product_id,
//           quantity,
//           product:products(name, price)
//         )
//       `, { count: 'exact' })
      
//       .order('date', { ascending: false })
  
//     if (error) throw error
  
//     return data as Order[] 
//   }

