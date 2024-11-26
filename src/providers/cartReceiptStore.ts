// cartStore.ts
import { create } from 'zustand';
import { Product, CartItem } from '../../types';


type ReceiptStore = {
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  
  checkout: (
    insertReceipt: any, 
    insertReceiptItems: any, 
    date: Date,
    receiptTotal: number,
   
  ) => Promise<void>;
};



export const useReceiptStore = create<ReceiptStore>((set, get) => ({
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
    insertReceipt: any, 
    insertReceiptItems: any,
    date: Date,
    receiptTotal: number,
  ) => {
    try {
        // Create a new date object based on the incoming date
        const localDate = new Date(date);
        
        // Adjust the date to UTC by adding the timezone offset and then adding 1 hour
        const utcDate = new Date(localDate.getTime() + (localDate.getTimezoneOffset() * 60000) + 3600000); // Add 1 hour

        const receiptResult = await insertReceipt({
            total: receiptTotal,  // Use the passed total
            date: utcDate.toISOString(), // Store the full ISO string in UTC
        });
        console.log('Receipt creation result:', receiptResult);

        const { id: receiptId } = receiptResult;
        if (!receiptId) throw new Error('Failed to create receipt');

        const receiptItems = get().items.map(item => ({
            receipt_id: receiptId,
            product_id: item.product.id,
            quantity: item.quantity,
            price: item.product.price
        }));
        console.log("Receipt items to insert:", receiptItems);

        await insertReceiptItems(receiptItems);
        console.log('Checkout completed successfully');

        get().clearCart();
    } catch (error) {
        console.error('Checkout when inserting receipt failed:', error);
        throw error; // Re-throw to handle in the UI
    }
  },
}));