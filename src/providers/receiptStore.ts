// cartStore.ts
import { create } from 'zustand';
import { CartItem, Product } from '../../types';

import { useAuthStore } from '@/lib/supabase';



type ReceiptStore = {
  selectedReceiptId: number | null;
  setSelectedReceiptId: (id: number | null) => void;
  items: CartItem[];
  addItem: (product: Product) => void;
  // removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  
  checkout: (
    insertReceipt: any, 
    insertReceiptItems: any, 
    date: Date,
    receiptTotal: number,
    updateStoredItems: any,
    receiptNo: string
  ) => Promise<void>;
};



export const useReceiptStore = create<ReceiptStore>((set, get) => {
  // Subscribe to auth state changes
  useAuthStore.subscribe(
    (state) => {
      if (!state.user) {
        set({ items: [] });
      }
    }
  );

  return {
    selectedReceiptId: null,
    setSelectedReceiptId: (id) => set({ selectedReceiptId: id }),
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
      insertReceipt: any,
      insertReceiptItems: any,
      date: Date,
      total: number,
      updateStoredItems: any,
      receiptNo: string
    ) => {
      const user = useAuthStore.getState().user;

      try {
        const localDate = new Date(date);
        const utcDate = new Date(localDate.getTime() + (localDate.getTimezoneOffset() * 60000) + 3600000);

        if (!user?.id) {
          throw new Error("User not authenticated");
        }

        const receiptResult = await insertReceipt({
          total: total,
          date: utcDate.toISOString(),
          receipt_no: receiptNo,
        });

        const { id: receiptId } = receiptResult;
        if (!receiptId) throw new Error('Failed to create receipt');

        const receiptItems = get().items.map(item => ({
          receipt_id: receiptId,
          product_id: item.product.id,
          quantity: item.quantity,
          vat: item.product.vat,
          price: item.product.price
        }));

        await insertReceiptItems(receiptItems);

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
        console.error('Checkout failed:', error);
        throw error;
      }
    },
  };
});