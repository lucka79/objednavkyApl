import { Database } from "./src/database.types";

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

  export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

  export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];


  export type Product = {
    id: number;
    image: string | null;
    name: string;
    description: string | null;
    price: number;
    priceMobile: number | null
    category_id: number | null
  };

  export type Category = {
    id: number;
    name: string;
  };

  export type CartItem = {
    id: string;
    product: Product;
    product_id: number;
    quantity: number;
  };
  
  export const OrderStatusList: OrderStatus[] = [
    'New',
    'Baking',
    'Delivering',
    'Delivered',
  ];
  
  export type OrderStatus = 'New' | 'Baking' | 'Delivering' | 'Delivered';
  
  export type Order = {
    id: number;
    created_at: string;
    total: number;
    user_id: string;
    status: OrderStatus;
  
    order_items?: OrderItem[];
  };
  
  export type OrderItem = {
    id: number;
    product_id: number;
    products: Product;
    order_id: number;
    
    quantity: number;
  };
  
  export type Profile = {
    id: string;
    role: string;
  };