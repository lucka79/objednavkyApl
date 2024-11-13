import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, useAuthStore } from '@/lib/supabase';
import { InsertTables, Order, OrderItem, UpdateTables } from '../../types';

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
            user:profiles(id, full_name, role, crateSmall, crateBig),
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
        user:profiles (id, full_name, role),
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
  

// export const updateOrderItem = async (orderItem: OrderItem): Promise<OrderItem> => {
//   const { data, error } = await supabase
//     .from('order_items')
//     .update({ quantity: orderItem.quantity })
//     .eq('id', orderItem.id)
//     .single()

//   if (error) throw error
//   return data
// }



export const useInsertOrder = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore.getState();

  return useMutation({
    async mutationFn(data: InsertTables<"orders">) {
      const orderData = {
        ...data,
        user_id: data.user_id || user?.id
      };

      const { error, data: newOrder } = await supabase
        .from("orders")
        .insert(orderData)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }
      return newOrder;
    },
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

export const useUpdateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn({id, updatedFields}: {id: number, updatedFields: UpdateTables<"orders">}) {
      const { error, data: updatedOrder } = await supabase
        .from("orders")
        .update( updatedFields )
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }
      return updatedOrder;
    },
    async onSuccess(_, { id }) {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["orders", id] });
    },
  });
};

export const useInsertOrderItems = () => {
  // const queryClient = useQueryClient();

  return useMutation({
    async mutationFn(items: InsertTables<"order_items">[]) {
      const { error, data: newOrder } = await supabase
        .from("order_items")
        .insert(items)
        .select();
       // .single();   více položek v objednávce

      if (error) {
        throw new Error(error.message);
      }
      return newOrder;
    },

  });
};

export const fetchOrderItems = async (orderId: number) => {
  const { data, error } = await supabase
    .from('order_items')
    .select(`
      *,
      product:products(*)
    `)
    .eq('order_id', orderId);

  if (error) throw error;
  return data;
};

export const useUpdateOrderItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn({id, updatedFields}: {id: number, updatedFields: Partial<OrderItem>}) {
      // First, get the user's role from profiles if we have order_id
      let price = updatedFields.price;
      if (updatedFields.order_id) {
        const { data: orderData } = await supabase
          .from('orders')
          .select('user:profiles!inner(role)')
          .eq('id', updatedFields.order_id)
          .single();
        
        if (orderData?.user?.role === 'mobil') {
          const { data: productData } = await supabase
            .from('products')
            .select('priceMobil')
            .eq('id', updatedFields.product_id)
            .single();
          price = productData?.priceMobil;
        }
      }

      const now = new Date().toISOString();
      const query = supabase.from("order_items");
      const { data, error } = await (id === 0
        ? query.insert({ ...updatedFields, price, updated_at: now }).select()
        : query.update({ ...updatedFields, updated_at: now }).eq('id', id).select());

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      console.log('onSuccess called with data:', data);
      const orderId = variables.updatedFields.order_id;
      if (orderId) {
        queryClient.invalidateQueries({ queryKey: ["orderItems", orderId] });
        queryClient.invalidateQueries({ queryKey: ["orders", orderId] });
      }
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

export const useDeleteOrderItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn({ itemId, orderId }: { itemId: number; orderId: number }) {
      const { error } = await supabase
        .from("order_items")
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      return { itemId, orderId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["orderItems", variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders", variables.orderId] });
    },
  });
};



