import { OrderItem } from 'types'
import {create} from 'zustand'

// interface OrderStore {
//     selectedOrderId: number 
//     setSelectedOrderId: (id: number) => void
//   }
  
//   export const useOrderStore = create<OrderStore>((set) => ({
//     selectedOrderId: 0,
//     setSelectedOrderId: (id) => set({ selectedOrderId: id }),
//   }))



interface OrderStore {
    selectedOrderId: number 
    orderDetails: OrderItem[] | null
    setSelectedOrderId: (id: number) => void
    setOrderDetails: (details: OrderItem[] | null) => void


}

export const useOrderStore = create<OrderStore>((set) => ({
    selectedOrderId: 0,
    orderDetails: null,
    setSelectedOrderId: (id) => set({ selectedOrderId: id }),
    setOrderDetails: (details) => set({ orderDetails: details }),
}))