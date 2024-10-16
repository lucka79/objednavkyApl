import {create} from 'zustand'

interface OrderStore {
    selectedOrderId: number 
    setSelectedOrderId: (id: number) => void
  }
  
  export const useOrderStore = create<OrderStore>((set) => ({
    selectedOrderId: 0,
    setSelectedOrderId: (id) => set({ selectedOrderId: id }),
  }))