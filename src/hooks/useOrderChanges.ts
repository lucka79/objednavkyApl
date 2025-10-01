import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface OrderChange {
  id: number;
  order_id: number;
  user_id: string;
  change_type: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  item_id: number | null;
  user: {
    id: string;
    email: string;
    role: string;
    full_name: string | null;
    username: string | null;
  };
  item?: {
    id: number;
    product: {
      id: number;
      name: string;
    };
  };
}

export const useOrderChanges = (orderId?: number) => {
  return useQuery({
    queryKey: ["order-changes", orderId],
    queryFn: async () => {
      if (!orderId) return [];

      const { data, error } = await supabase
        .from("order_changes")
        .select(`
          *,
          user:profiles!order_changes_user_id_fkey1 (
            id,
            email,
            role,
            full_name,
            username
          ),
          item:order_items!order_changes_item_id_fkey (
            id,
            product:products!order_items_product_id_fkey (
              id,
              name
            )
          )
        `)
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching order changes:", error);
        throw error;
      }

      console.log("Fetched order changes:", data);
      return data as OrderChange[];
    },
    enabled: !!orderId,
  });
};