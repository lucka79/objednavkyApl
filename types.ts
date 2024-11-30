import { Database } from "./src/database.types";

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

  export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

  export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];


  // types.ts
export type Product = {
  id: number;
  name: string;
  image: string | null;
  price: number;
  priceMobil: number;
  priceBuyer: number;
  description: string | null;
  created_at: string;
  category_id: number | null;
  category?: Category | null;
}

  export type Category = {
    id: number;
    name: string;
  };

  export type CartItem = {
    id: number;
    product: Product;
    product_id: number;
    quantity: number;
  };
  
  export const OrderStatusList: OrderStatus[] = [
    'New',
    'Expedice',
    'Delivering',
    'Paid',
  ];
  
  export type OrderStatus = 'Pre-order' | 'New' | 'Expedice' | 'Delivering' | 'Paid';

  // export type Day = "Po" | "Út" | "St" | "Čt" | "Pá" | "So" | "Ne";
  
  export type Order = {
    id: number;
    created_at: string;
    date: string;
    total: number;
    user_id: string;
    user: Profile;
    status: OrderStatus;
    crateSmall: number;
    crateBig: number;
    crateSmallReceived: number;
    crateBigReceived: number;
    order_items: {
      checked: boolean;
      product_id: number;
      quantity: number;
      product: Product;
      price: number;
    }[];
  };
  
  export interface OrderItem {
    id: number;
    product: Product;
    quantity: number;
    price: number;
    checked: boolean;
    product_id: number;
    order_id: number;
    priceMobil: number;
  };

 export interface FavoriteOrder {
  id: number;
  user_id: string;
  days: Day[];
  status: OrderStatus;
  user: Profile;
  favorite_items: FavoriteItem[];
 };

  export interface FavoriteItem {
    id: number;
    product: Product;
    quantity: number;
    product_id: number;
    order_id: number;   
  };
  
  export type Profile = {
    id: string;
    role: string;
    full_name: string;
    crateSmall: number;
    crateBig: number;
    crateSmallReceived: number;
    crateBigReceived: number;
    shortcut: string;
  };

export interface HistoryEntry {
  id: number;
  old_quantity: number;
  new_quantity: number;
  changed_at: string;
  changed_by: {
    full_name: string;
  };
  profiles?: {
    full_name: string;
  };
}

export type Receipt = {
  id: number;
  date: string;
  receipt_no: string;
  total: number;
  paid_By: string | null;
  seller_id: string | null;
  buyer_id: string | null;
  receipt_items: ReceiptItem[];
};

export interface ReceiptItem {
  id: number;
  product_id: number;
  product: Product;
  quantity: number;
  price: number;
}