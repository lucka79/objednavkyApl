
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
  export const fetchOrderDetails = (orderId: number) => {
    return useQuery({
        queryKey: ['orderItems', orderId],
        queryFn: async () => {
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
});
};

// orders by user_id
export const fetchOrdersByUserId = (userId: string) => {
    return useQuery({
        queryKey: ['orders', userId],
        queryFn: async () => {
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
});
};

// order by id
export const fetchOrderById = (orderId: number) => {
    return useQuery({
        queryKey: ['orders', orderId],
        queryFn: async () => {
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
        },
    });
  };

// all orders
export const fetchAllOrders =  () => {
return useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
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
});
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

