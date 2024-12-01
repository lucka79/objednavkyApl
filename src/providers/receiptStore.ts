import { create } from 'zustand';

interface ReceiptStore {
  selectedReceiptId: number | null;
  setSelectedReceiptId: (id: number | null) => void;
}

export const useReceiptStore = create<ReceiptStore>((set) => ({
  selectedReceiptId: null,
  setSelectedReceiptId: (id) => set({ selectedReceiptId: id }),
}));