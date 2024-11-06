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
  
  export type OrderStatus = 'New' | 'Expedice' | 'Delivering' | 'Paid';
  
  export type Order = {
    id: number;
    created_at: string;
    date: string;
    total: number;
    user_id: string;
    user: Profile;
    status: OrderStatus;
  
    order_items?: OrderItem[];
  };
  
  export type OrderItem = {
    id: number;
    product_id: number;
    product: Product;
    order_id: number;
    price: number;
    priceMobil: number;
    quantity: number;
  };
  
  export type Profile = {
    id: string;
    role: string;
    full_name: string;
  };