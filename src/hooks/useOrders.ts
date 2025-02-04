import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, useAuthStore } from '@/lib/supabase';
import { InsertTables, Order, OrderItem } from '../../types';
// import { useToast } from "@/hooks/use-toast";

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
            console.log('Fetching orders for userId:', userId);
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    user:profiles!orders_user_id_fkey (id, full_name, role),
                    order_items (
                        *,
                        product:products (*)
                    )
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching orders:', error);
                throw error;
            }
            
            console.log('Fetched orders:', data);
            return data;
        }
    });
};

// order by id
export const useFetchOrderById = (orderId: number | null) => {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          user:profiles!orders_user_id_fkey (*),
          driver:profiles!orders_driver_id_fkey (*),
          order_items (
            *,
            product:products (*)
          )
        `)
        .eq('id', orderId);

      if (error) {
        console.error('Error fetching order:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!orderId
  });
};

// all orders
export const fetchAllOrders = () => {
  return useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      // Fetch all orders in chunks if needed
      const pageSize = 1000;
      const pages = Math.ceil((count || 0) / pageSize);
      let allOrders: Order[] = [];

      for (let i = 0; i < pages; i++) {
        const { data, error } = await supabase
          .from('orders')
          .select(`
            *,
            user:profiles!orders_user_id_fkey (*),
            driver:profiles!orders_driver_id_fkey (*),
            order_items (
              *,
              product:products (*)
            )
          `)
          .order('date', { ascending: false })
          .order('user(full_name)', { ascending: true })
          .range(i * pageSize, (i + 1) * pageSize - 1);

        if (error) throw error;
        allOrders = [...allOrders, ...data];
      }

      console.log('Fetched orders:', allOrders.length);
      return allOrders;
    }
  });
};

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
  return useMutation<any, Error, {
    user_id: string;
    date: Date;
    status: string;
    total: number;
    paid_by: string;
    driver_id?: string | null;
    note?: string;
  }>({
    mutationFn: async (orderData) => {
      // Insert the order directly without checking for duplicates
      const { data: newOrder, error: insertError } = await supabase
        .from('orders')
        .insert(orderData)
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Fetch complete order with relationships
      const { data: completeOrder, error: fetchError } = await supabase
        .from('orders')
        .select(`
          id,
          date,
          status,
          total,
          paid_by,
          user_id,
          driver_id,
          user:profiles!orders_user_id_fkey (
            id,
            full_name,
            role
          ),
          driver:profiles!orders_driver_id_fkey (
            id,
            full_name
          )
        `)
        .eq('id', newOrder.id)
        .single();

      if (fetchError) throw fetchError;
      return completeOrder;
    },
  });
};

export const useUpdateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updatedFields }: { 
      id: number; 
      updatedFields: {
        status?: string;
        crateBig?: number;
        crateSmall?: number;
        crateBigReceived?: number;
        crateSmallReceived?: number;
        driver_id?: string | null;
        total?: number;
        note?: string;
        isLocked?: boolean;
      }; 
    }) => {
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
    mutationFn: async (orderId: number) => {
      console.log('Starting order deletion process for orderId:', orderId);

      // First get the order details
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select(`
          id,
          user_id,
          order_items (
            id,
            product_id,
            quantity
          )
        `)
        .eq("id", orderId)
        .single();

      if (orderError) {
        console.error('Error fetching order details:', orderError);
        throw orderError;
      }

      console.log('Fetched order details:', order);

      // Update stored items one by one
      for (const item of order.order_items) {
        console.log('Processing order item:', item);

        // First try to get existing stored item
        const { data: existingItem, error: fetchError } = await supabase
          .from('stored_items')
          .select('quantity')
          .eq('user_id', order.user_id)
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
            .eq('user_id', order.user_id)
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
              user_id: order.user_id,
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
      console.log('Deleting order items history records');
      const { error: deleteHistoryError } = await supabase
        .from("order_items_history")
        .delete()
        .in(
          'order_item_id', 
          order.order_items.map(item => item.id)
        );

      if (deleteHistoryError) {
        console.error('Error deleting order items history:', deleteHistoryError);
        throw deleteHistoryError;
      }

      // Then delete order items
      console.log('Deleting order items for orderId:', orderId);
      const { error: deleteItemsError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", orderId);

      if (deleteItemsError) {
        console.error('Error deleting order items:', deleteItemsError);
        throw deleteItemsError;
      }

      // Finally delete the order
      console.log('Deleting order:', orderId);
      const { error: deleteError } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);

      if (deleteError) {
        console.error('Error deleting order:', deleteError);
        throw deleteError;
      }

      console.log('Order deletion completed successfully');
    },
    onSuccess: () => {
      console.log('Mutation succeeded, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["storedItems"] });
    },
    onError: (error) => {
      console.error('Mutation failed:', error);
    }
  });
};

export const useUpdateStoredItems = () => {
  const queryClient = useQueryClient();
  // const { user } = useAuthStore.getState();
  
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

export const useOrdersWithCategory9 = () => {
  return useQuery({
    queryKey: ['ordersCategory9'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          user:profiles!orders_user_id_fkey (*),
          driver:profiles!orders_driver_id_fkey (*),
          order_items!inner (
            *,
            product:products!inner (
              *,
              category_id
            )
          )
        `)
        .eq('order_items.product.category_id', 9)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching category 9 orders:', error);
        throw error;
      }

      return data;
    }
  });
};

export const fetchLastMonthOrders = () => {
  return useQuery({
    queryKey: ['lastMonthOrders'],
    queryFn: async () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const firstDay = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
      const lastDay = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          user:profiles!orders_user_id_fkey (*),
          driver:profiles!orders_driver_id_fkey (*),
          order_items (
            *,
            product:products (*)
          )
        `)
        .gte('date', firstDay.toISOString())
        .lte('date', lastDay.toISOString())
        .order('date', { ascending: false })
        .order('user(full_name)', { ascending: true });

      if (error) throw error;
      return data;
    }
  });
};



