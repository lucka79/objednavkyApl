// cartStore.ts
import { create } from 'zustand';
import { Product, CartItem } from '../../types';


type CartStore = {
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  
  checkout: (
    insertOrder: any, 
    insertOrderItems: any, 
    orderDate: Date, 
    selectedUserId: string,
    orderTotal: number,
    selectedUserRole: string
  ) => Promise<void>;
};



export const useCartStore = create<CartStore>((set, get) => ({
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
  removeItem: (productId) => {
    set((state) => ({
      items: state.items.filter((item) =>item.product.id !== productId),
    }));
  },
  updateQuantity: (productId, quantity) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
      .filter((item) => item.quantity > 0), // displey only items with quantity > 0
    }));
  },
  clearCart: () => set({ items: [] }),


  checkout: async (
    insertOrder: any, 
    insertOrderItems: any, 
    orderDate: Date, 
    selectedUserId: string,
    orderTotal: number,
    selectedUserRole: string
  ) => {
    try {
      const tzOffset = orderDate.getTimezoneOffset() * 60000;
      const adjustedDate = new Date(orderDate.getTime() - tzOffset);

      const orderResult = await insertOrder({
        date: adjustedDate.toISOString().split('T')[0],
        total: orderTotal,  // Use the passed total
        user_id: selectedUserId,
      });
      console.log('Order creation result:', orderResult);

      const { id: orderId } = orderResult;
      if (!orderId) throw new Error('Failed to create order');

      const orderItems = get().items.map(item => ({
        order_id: orderId,
        product_id: item.product.id,
        quantity: item.quantity,
        vat: item.product.vat,
        price:
          selectedUserRole === "user"
            ? item.product.price
            : selectedUserRole === "store"
            ? item.product.priceBuyer
            : item.product.priceMobil,
      }));
      console.log("Order items to insert:", orderItems);

      await insertOrderItems(orderItems);
      console.log('Checkout completed successfully');

      get().clearCart();
    } catch (error) {
      console.error('Checkout failed:', error);
      throw error; // Re-throw to handle in the UI
    }
  },
}));