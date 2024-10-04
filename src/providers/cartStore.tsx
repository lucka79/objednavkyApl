import { create } from "zustand";
import { supabase } from "@/lib/supabase";

interface CartItem {
  id: number;
  productId: number;
  quantity: number;
  price: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: number) => void;
  clearCart: () => void;
  checkout: () => Promise<void>;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) =>
    set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
  clearCart: () => set({ items: [] }),
  checkout: async () => {
    const { items } = get();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({ status: "pending" })
      .select()
      .single();

    if (orderError) throw orderError;

    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      quantity: item.quantity,
      price: item.price,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) throw itemsError;

    get().clearCart();
  },
}));
