import {create} from 'zustand'
import { OrderItem } from '../../types'
import { useCartStore } from './cartStore'
import { useOrderStore } from './orderStore'

interface OrderItemsStore {
    orderItems: OrderItem[]
    selectedOrderItemId: number
    setOrderItems: (orderItems: OrderItem[]) => void
    updateOrderItem: (updatedItem: OrderItem) => void
    addOrderItem: (product: OrderItem['product']) => void
    updateCart: (productId: number, newQuantity: number) => void
    setSelectedOrderItemId: (id: number) => void
  }
  
  export const useOrderItemsStore = create<OrderItemsStore>((set) => ({
    orderItems: [],
    selectedOrderItemId: 0,
    setSelectedOrderItemId: (id: number) => set({ selectedOrderItemId: id }),
    setOrderItems: (orderItems) => set({ orderItems }),
    updateOrderItem: (updatedItem) =>
      set((state) => ({
        orderItems: state.orderItems.map((item) =>
          item.id === updatedItem.id ? updatedItem : item
        ),
      })),
    addOrderItem: (product) => {
      const cartItems = useCartStore.getState().items;
      const selectedOrderId = useOrderStore.getState().selectedOrderId;
      
      set((state) => {
        const cartItem = cartItems.find((item) => item.product.id === product.id);
        const quantity = cartItem?.quantity || 1;
        
        const existingItem = state.orderItems.find((item) => item.product.id === product.id);
        if (existingItem) {
          return {
            orderItems: state.orderItems.map((item) =>
              item.product.id === product.id
                ? { ...item, quantity: quantity }
                : item
            ),
          };
        }
        
        return {
          orderItems: [...state.orderItems, {
            id: Date.now(),
            product_id: product.id,
            product: product,
            quantity: quantity,
            price: product.price,
            priceMobil: product.priceMobil,
            order_id: selectedOrderId || 0,
            checked: false
          }],
        };
      });
    },
    updateCart: (productId, newQuantity) => {
      set((state) => ({
        orderItems: state.orderItems.map((item) =>
          item.product.id === productId
            ? { ...item, quantity: newQuantity }
            : item
        ),
      }));
    },
  }))
