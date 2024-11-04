// cartStore.ts
import { create } from 'zustand';
import { Product, CartItem } from '../../types';
import { useAuthStore } from '@/lib/supabase';
import { useInsertOrder, useInsertOrderItems } from '@/hooks/useOrders';

type CartStore = {
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  total: () => number;
  totalMobil: () => number;
  checkout: (insertOrder: any, insertOrderItems: any) => Promise<void>;
};



export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (product) => {
    set((state) => {
      const existingItem = state.items.find((item) => item.product.id === product.id);
      if (existingItem) {
        return {
          items: state.items.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        };
      } 

        const newItem: CartItem = {
          id: Date.now(), // Implement this function to generate a unique ID
          product_id: product.id,
          product,
          quantity: 1
        };
        return { items: [...state.items, newItem] };
      
    //   return { items: [...state.items, { product, quantity: 1 }] };
    });
  },
  removeItem: (productId) => {
    set((state) => ({
      items: state.items.filter((item) =>item.product.id !== productId),
    }));
  },
  updateQuantity: (productId, quantity) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
      .filter((item) => item.quantity > 0), // displey only items with quantity > 0
    }));
  },
  clearCart: () => set({ items: [] }),
  total: () => {
    
    return get().items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  },
  totalMobil: () => {
    
    return get().items.reduce((sum, item) => sum + item.product.priceMobil * item.quantity, 0);
  },

  checkout: async (insertOrder: any, insertOrderItems: any) => {
    const { user } = useAuthStore.getState();
    
    try {
      console.log('Starting checkout process...');
      const tomorrow = new Date(Date.now() + 86400000); // Add 24 hours in milliseconds
      const orderResult = await insertOrder({
        date: tomorrow.toISOString(),
        total: user?.role === "admin" ? get().totalMobil() : get().total(),
        user_id: user?.id || "",
      });
      console.log('Order creation result:', orderResult);

      const { id: orderId } = orderResult;
      if (!orderId) throw new Error('Failed to create order');

      const orderItems = get().items.map(item => ({
        order_id: orderId,
        product_id: item.product.id,
        quantity: item.quantity,
        price: user?.role === "admin" ? item.product.priceMobil : item.product.price,
        
      }));
      console.log('Order items to insert:', orderItems);

      await insertOrderItems(orderItems);
      console.log('Checkout completed successfully');

      get().clearCart();
    } catch (error) {
      console.error('Checkout failed:', error);
      throw error; // Re-throw to handle in the UI
    }
  },
}));