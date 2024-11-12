import { create } from 'zustand';

interface OrderStore {
  selectedOrderId: number | null;
  setSelectedOrderId: (id: number | null) => void;
}

export const useOrderStore = create<OrderStore>((set) => ({
  selectedOrderId: null,
  setSelectedOrderId: (id) => set({ selectedOrderId: id }),
}));