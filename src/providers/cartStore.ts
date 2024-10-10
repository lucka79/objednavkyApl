// cartStore.ts
import { create } from 'zustand';
import { Product, CartItem } from '../../types';
import { useAuthStore } from '@/lib/supabase';

type CartStore = {
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  total: () => number;
  totalMobil: () => number;
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
}));