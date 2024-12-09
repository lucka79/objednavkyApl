// cartStore.ts
import { create } from 'zustand';
import { CartItem, Product } from '../../types';
import { useAuthStore } from '@/lib/supabase';



type ReturnStore = {
  selectedReturnId?: number | null;
  setSelectedReturnId: (id: number) => void;
  items: CartItem[];
  addItem: (product: Product) => void;
  // removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  
  checkout: (
    insertReturn: any, 
    insertReturnItems: any, 
    date: Date,
    returnTotal: number,
    updateStoredItems: any
  ) => Promise<void>;
};



export const useReturnStore = create<ReturnStore>((set, get) => ({
  selectedReturnId: null,
  setSelectedReturnId: (id) => set({ selectedReturnId: id }),
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
    // removeItem: (productId) => {
    //   set((state) => ({
    //     items: state.items.filter((item) =>item.product.id !== productId),
    //   }));
    // },
  updateQuantity: (productId, quantity) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    }));
  },
  clearCart: () => set({ items: [] }),


  checkout: async (
    insertReturn: any, 
    insertReturnItems: any,
    date: Date,
    returnTotal: number,
    updateStoredItems: any
  ) => {
    const user = useAuthStore.getState().user;

    try {
      const localDate = new Date(date);
      const utcDate = new Date(localDate.getTime() + (localDate.getTimezoneOffset() * 60000) + 3600000);

      if (!user?.id) {
        throw new Error("User not authenticated");
      }



      const returnResult = await insertReturn({
        total: returnTotal,
        date: utcDate.toISOString(),

      });

      const { id: returnId } = returnResult;
      if (!returnId) throw new Error('Failed to create return');

      const returnItems = get().items.map(item => ({
        return_id: returnId,
        product_id: item.product.id,
        quantity: item.quantity,
        vat: item.product.vat,
        price: item.product.price
      }));

      await insertReturnItems(returnItems);

      // Update stored items using the passed function
      await updateStoredItems({
        userId: user.id,
        items: get().items.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity
        }))
      });

      get().clearCart();
    } catch (error) {
      console.error('Checkout return failed:', error);
      throw error;
    }
  },
}));