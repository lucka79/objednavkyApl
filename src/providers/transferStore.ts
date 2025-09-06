import { create } from 'zustand';
import { Transfer, TransferItem } from '@/hooks/useTransfers';

interface TransferStore {
  // State
  selectedTransfer: Transfer | null;
  transferItems: TransferItem[];
  isCreatingTransfer: boolean;
  isEditingTransfer: boolean;
  
  // Actions
  setSelectedTransfer: (transfer: Transfer | null) => void;
  setTransferItems: (items: TransferItem[]) => void;
  addTransferItem: (item: TransferItem) => void;
  removeTransferItem: (itemId: number) => void;
  updateTransferItem: (itemId: number, updates: Partial<TransferItem>) => void;
  clearTransferItems: () => void;
  setIsCreatingTransfer: (isCreating: boolean) => void;
  setIsEditingTransfer: (isEditing: boolean) => void;
  reset: () => void;
}

export const useTransferStore = create<TransferStore>((set, get) => ({
  // Initial state
  selectedTransfer: null,
  transferItems: [],
  isCreatingTransfer: false,
  isEditingTransfer: false,

  // Actions
  setSelectedTransfer: (transfer) => {
    set({ selectedTransfer: transfer });
  },

  setTransferItems: (items) => {
    set({ transferItems: items });
  },

  addTransferItem: (item) => {
    const { transferItems } = get();
    set({ transferItems: [...transferItems, item] });
  },

  removeTransferItem: (itemId) => {
    const { transferItems } = get();
    set({ 
      transferItems: transferItems.filter(item => item.id !== itemId) 
    });
  },

  updateTransferItem: (itemId, updates) => {
    const { transferItems } = get();
    set({
      transferItems: transferItems.map(item =>
        item.id === itemId ? { ...item, ...updates } : item
      )
    });
  },

  clearTransferItems: () => {
    set({ transferItems: [] });
  },

  setIsCreatingTransfer: (isCreating) => {
    set({ isCreatingTransfer: isCreating });
  },

  setIsEditingTransfer: (isEditing) => {
    set({ isEditingTransfer: isEditing });
  },

  reset: () => {
    set({
      selectedTransfer: null,
      transferItems: [],
      isCreatingTransfer: false,
      isEditingTransfer: false,
    });
  },
}));
