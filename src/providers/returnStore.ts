// cartStore.ts
import { create } from 'zustand';
import { ReturnItem } from '../../types';
import { useStoredItemsStore } from './storedItemsStore';



interface ReturnItemsStore {
  returnItems: ReturnItem[]
  selectedReturnItemId: number
  selectedReturnId: string | null;
  setReturnItems: (returnItems: ReturnItem[]) => void
  updateReturnItem: (updatedItem: ReturnItem) => void
  addReturnItem: (product: ReturnItem['product']) => void
  updateStoredItem: (productId: number, newQuantity: number) => void
  setSelectedReturnItemId: (id: number) => void
  setSelectedReturnId: (id: string | null) => void
}

export const useReturnItemsStore = create<ReturnItemsStore>((set) => ({
  returnItems: [],
  selectedReturnItemId: 0,
  selectedReturnId: null,
  setSelectedReturnItemId: (id: number) => set({ selectedReturnItemId: id }),
  setSelectedReturnId: (id) => set({ selectedReturnId: id }),
  setReturnItems: (returnItems) => set({ returnItems }),
  updateReturnItem: (updatedItem) =>
    set((state) => ({
      returnItems: state.returnItems.map((item) =>
        item.id === updatedItem.id ? updatedItem : item
      ),
    })),
  addReturnItem: (product) => {
    const { items: storedItems } = useStoredItemsStore.getState();
    
    set((state) => {
      const storedItem = storedItems.find((item) => item.id === product.id);
      //@ts-ignore
      const quantity = storedItem?.quantity ?? 0;
      
      const existingItem = state.returnItems.find((item) => item.product.id === product.id);
      if (existingItem) {
        return {
          returnItems: state.returnItems.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: quantity }
              : item
          ),
        };
      }
      
      return {
        returnItems: [...state.returnItems, {
          id: Date.now(),
          product_id: product.id,
          product: product,
          quantity: quantity,
          price: product.price,
          priceMobil: product.priceMobil,
          return_id: 0,
          checked: false
        }],
      };
    });
  },
  updateStoredItem: (productId, newQuantity) => {
    set((state) => ({
      returnItems: state.returnItems.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: newQuantity }
          : item
      ),
    }));
  },
}));