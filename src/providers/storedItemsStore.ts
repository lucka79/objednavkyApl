import { create } from 'zustand';
import { Product } from '../../types';

type StoredItemsStore = {
  items: Product[];
  addItem: (item: Product) => void;
  removeItem: (id: string | number) => void;
};

export const useStoredItemsStore = create<StoredItemsStore>((set) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) => set((state) => ({ 
    items: state.items.filter(item => item.id !== id) 
  })),
})); 