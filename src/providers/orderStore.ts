import { create } from 'zustand';

interface OrderStore {
  selectedOrderId: number | null;
  setSelectedOrderId: (id: number | null) => void;
  selectedDriver: { id: string; full_name: string } | null;
  setSelectedDriver: (driver: { id: string; full_name: string } | null) => void;
}

export const useOrderStore = create<OrderStore>((set) => ({
  selectedOrderId: null,
  setSelectedOrderId: (id) => set({ selectedOrderId: id }),
  selectedDriver: null,
  setSelectedDriver: (driver) => set({ selectedDriver: driver }),
}));