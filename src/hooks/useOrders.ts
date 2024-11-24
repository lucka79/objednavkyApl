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
export const useFetchOrderById = (orderId: number | null) => {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      // Don't fetch if orderId is null
      // if (!orderId) return null;

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          user:profiles(id, full_name, role, crateSmall, crateBig),
          order_items(*, product:products(*))
        `)
        .eq('id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    // Disable the query when orderId is null
    enabled: !!orderId
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
      await queryClient.invalidateQueries({ queryKey: ["order", id] });
      await queryClient.invalidateQueries({ queryKey: ["orderItems", id] });
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

export const useOrderItemHistory = (itemId: number | null) => {
  return useQuery({
    queryKey: ["orderItemHistory", itemId],
    queryFn: async () => {
      if (!itemId) return null;
      
      const { data, error } = await supabase
        .from("order_items_history")
        .select(`
          id,
          old_quantity,
          new_quantity,
          changed_at,
          order_item_id,
          order_items!order_items_history_order_item_id_fkey (
            product:products (
              name
            )
          ),
          profiles:changed_by (
            full_name
          )
        `)
        .eq('order_item_id', itemId)
        .order('changed_at', { ascending: false });

      if (error) {
        console.error('History fetch error:', error);
        throw error;
      }
      
      console.log('Fetched history for item:', itemId, data);
      return data;
    },
    enabled: !!itemId
  });
};

export const useOrderItemsHistory = (items: { id: number }[]) => {
  return useQuery({
    queryKey: ["allOrderItemsHistory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items_history")
        .select("order_item_id")
        .in(
          "order_item_id",
          items.map((item) => item.id)
        );

      if (error) throw error;
      return data.map((item) => item.order_item_id);
    },
    enabled: items.length > 0
  });
};

export const useUpdateOrderItems = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore.getState();

  return useMutation({
    async mutationFn({id, updatedFields}: {id: number, updatedFields: Partial<OrderItem>}) {
      // Add validation for id
      if (!id || id <= 0) {
        throw new Error('Invalid order item ID');
      }

      // Start a transaction
      const { data: oldItem, error: fetchError } = await supabase
        .from('order_items')
        .select('quantity, product:products(*)')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // console.log('Quantity Change:', {
      //   itemId: id,
      //   oldQuantity: oldItem?.quantity,
      //   newQuantity: updatedFields.quantity,
      //   productName: oldItem?.product?.name,
      //   changedBy: user?.id
      // });

      // Update the item
      const { data, error } = await supabase
        .from("order_items")
        .update({ ...updatedFields, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select();

      if (error) throw error;

      // Record the change in history only if quantity has changed
      if (oldItem && updatedFields.quantity !== undefined && oldItem.quantity !== updatedFields.quantity) {
        const { error: historyError } = await supabase
          .from('order_items_history')
          .insert({
            order_item_id: id,
            old_quantity: oldItem.quantity,
            new_quantity: updatedFields.quantity,
            changed_by: user?.id
          });
          
        if (historyError) {
          console.error('Failed to record history:', historyError);
        } else {
          console.log('History recorded successfully');
        }
      }

      return data;
    },
    onSuccess: (data, variables) => {
      console.log('Update successful:', {
        data,
        variables
      });
      if (data && data.length > 0) {
        const orderId = data[0].order_id;
        if (orderId) {
          queryClient.invalidateQueries({ queryKey: ["orderItems", orderId] });
          queryClient.invalidateQueries({ queryKey: ["orders", orderId] });
          queryClient.invalidateQueries({ queryKey: ["orderItemHistory", variables.id] });
          queryClient.invalidateQueries({ queryKey: ["allOrderItemsHistory"] });
        }
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

export const useDeleteOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn(orderId: number) {
      console.log('Starting deletion process for order:', orderId);
      try {
        // First get all order_items for this order
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select('id')
          .eq('order_id', orderId);
        
        if (itemsError) throw itemsError;
        console.log('Found order items:', orderItems);

        // Delete order_items_history records for each order item
        if (orderItems && orderItems.length > 0) {
          console.log('Deleting history for items:', orderItems.map(item => item.id));
          const { error: historyError } = await supabase
            .from('order_items_history')
            .delete()
            .in('order_item_id', orderItems.map(item => item.id));

          if (historyError) throw historyError;
        }

        // Then delete order_items
        console.log('Deleting order items for order:', orderId);
        const { error: itemsDeleteError } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', orderId);

        if (itemsDeleteError) throw itemsDeleteError;

        // Finally delete the order
        console.log('Deleting main order:', orderId);
        const { error: orderError } = await supabase
          .from('orders')
          .delete()
          .eq('id', orderId);

        if (orderError) throw orderError;

        console.log('Successfully completed deletion of order:', orderId);
        return orderId;
      } catch (error) {
        console.error('Delete failed:', error);
        throw error;
      }
    },
    onSuccess: (orderId) => {
      console.log('Mutation succeeded, invalidating queries for order:', orderId);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
};



