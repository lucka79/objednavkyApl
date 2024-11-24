import { supabase } from "@/lib/supabase";
import { useQuery} from "@tanstack/react-query";

// CategoryBadges
export const fetchCategories = () => {
    return useQuery({
      queryKey: ["categories"],
      queryFn: async () => {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order("name", {ascending: true})
        if (error) throw error;
        return data;
      },
    });
  };

  export const fetchCategoryById = (categoryId: number) => {
    return useQuery({
      queryKey: ["categories", categoryId],
      queryFn: async () => {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('id', categoryId)
            .order("name", {ascending: true})
        if (error) throw error;
        return data;
      },
    });
  };


export const fetchProductsByCategoryId = async (categoryId?: number) => {
  let query = supabase.from('products').select('*')
  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }
  const { data, error } = await query
  if (error) throw error
  return data
}

interface OrderItem {
  id: number;
  quantity: number;
  price: number;
}

export const createOrder = async (items: OrderItem[], userId: string) => {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({ user_id: userId, status: 'pending' })
    .select()
    .single()

  if (orderError) throw orderError

  const orderItems = items.map((item) => ({
    order_id: order.id,
    product_id: item.id,
    quantity: item.quantity,
    price: item.price,
  }))

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems)

  if (itemsError) throw itemsError

  return order
}