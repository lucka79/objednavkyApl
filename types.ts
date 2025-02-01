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
  code: string;
  name: string;
  nameVi?: string;
  price: number;
  priceMobil: number;
  priceBuyer: number;
  vat: number;
  active: boolean;
  buyer: boolean;
  store: boolean;
  category_id?: number;
  created_at?: string;
  description?: string | null;
  image?: string | null;
};

  export type Category = {
    id: number;
    name: string;
    store: boolean;
    buyer: boolean;
  };

  export type CartItem = {
    id: number;
    product: Product;
    product_id: number;
    quantity: number;
  };
  
  export const OrderStatusList: OrderStatus[] = [
    'Pre-order',
    'New',
    'Expedice R',
    'Expedice O',
    'Přeprava',
    'Paid',
  ];
  
  export type OrderStatus = 'Pre-order' | 'New' | 'Expedice R' | 'Expedice O' | 'Přeprava' | 'Paid';

  export type PaidBy = 'Hotově' | 'Karta' | 'Příkazem' | '-';

  // export type Day = "Po" | "Út" | "St" | "Čt" | "Pá" | "So" | "Ne";
  export type UserRole = 'buyer' | 'driver' | 'user' | 'store' | 'mobil' | 'expedition' | 'admin';
  
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
    paid_by: PaidBy;
    driver_id: string;
    driver: Profile;
    note?: string;
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
  note?: string;
  user: Profile;
  paid_by: PaidBy;
  driver?: Profile;
  favorite_items?: FavoriteItem[];
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
    email: string;
    role: string;
    full_name: string;
    crateSmall: number;
    crateBig: number;
    crateSmallReceived: number;
    crateBigReceived: number;
    shortcut: string;
    paid_by: PaidBy;
    note?: string;
    address?: string; 
    oz: boolean;
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
  paid_by: string | null;
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
  vat: number;
}

export type Return = {
  id: number;
  created_at: string;
  date: string;
  total: number;
  user_id: string;
  user: Profile;
  return_items: ReturnItem[];
}

export interface ReturnItem {
  id: number;
  return_id: number;
  product_id: number;
  product: Product;
  quantity: number;
  price: number;
  priceMobil: number;
}

export interface StoredItem {
  product: Product;
  quantity: number;
}

export interface ProductionItem {
  id: number;
  production_id: number;
  product_id: number;
  product: Product;
  quantity: number;
  price: number;

}

export type Production = {
  id: number;
  created_at: string;
  date: string;
  total: number;
  user_id: string;
  user: Profile;
  production_items: ProductionItem[];
}

export interface Invoice {
  invoice_number: string;
  start_date: string;
  end_date: string;
  created_at: string;
  total: number;
  profiles?: {
    full_name: string;
    company?: string;
    email?: string;
    address?: string;
    ico?: string;
    dic?: string;
  };
}
