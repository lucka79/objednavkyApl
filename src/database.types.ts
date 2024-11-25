export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      favorite_items: {
        Row: {
          created_at: string
          id: number
          order_id: number | null
          product_id: number | null
          quantity: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          order_id?: number | null
          product_id?: number | null
          quantity?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          order_id?: number | null
          product_id?: number | null
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "favorite_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "favorite_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_orders: {
        Row: {
          created_at: string
          days: string[] | null
          id: number
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          days?: string[] | null
          id?: number
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          days?: string[] | null
          id?: number
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "favorite_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          checked: boolean
          created_at: string
          id: number
          order_id: number
          price: number
          product_id: number
          quantity: number
          updated_at: string | null
        }
        Insert: {
          checked?: boolean
          created_at?: string
          id?: number
          order_id: number
          price?: number
          product_id: number
          quantity?: number
          updated_at?: string | null
        }
        Update: {
          checked?: boolean
          created_at?: string
          id?: number
          order_id?: number
          price?: number
          product_id?: number
          quantity?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: number
          new_quantity: number | null
          old_quantity: number | null
          order_item_id: number | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: number
          new_quantity?: number | null
          old_quantity?: number | null
          order_item_id?: number | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: number
          new_quantity?: number | null
          old_quantity?: number | null
          order_item_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_history_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          crateBig: number | null
          crateBigReceived: number | null
          crateSmall: number | null
          crateSmallReceived: number | null
          created_at: string
          date: string
          id: number
          status: string
          total: number
          user_id: string
        }
        Insert: {
          crateBig?: number | null
          crateBigReceived?: number | null
          crateSmall?: number | null
          crateSmallReceived?: number | null
          created_at?: string
          date: string
          id?: number
          status?: string
          total?: number
          user_id: string
        }
        Update: {
          crateBig?: number | null
          crateBigReceived?: number | null
          crateSmall?: number | null
          crateSmallReceived?: number | null
          created_at?: string
          date?: string
          id?: number
          status?: string
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category_id: number
          created_at: string
          description: string | null
          id: number
          image: string | null
          name: string
          price: number
          priceBuyer: number
          priceMobil: number
          store: boolean
        }
        Insert: {
          active?: boolean
          category_id?: number
          created_at?: string
          description?: string | null
          id?: number
          image?: string | null
          name: string
          price?: number
          priceBuyer?: number
          priceMobil?: number
          store?: boolean
        }
        Update: {
          active?: boolean
          category_id?: number
          created_at?: string
          description?: string | null
          id?: number
          image?: string | null
          name?: string
          price?: number
          priceBuyer?: number
          priceMobil?: number
          store?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          const: string | null
          crateBig: number | null
          crateSmall: number | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["groupUser"]
          updated_at: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          const?: string | null
          crateBig?: number | null
          crateSmall?: number | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["groupUser"]
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          const?: string | null
          crateBig?: number | null
          crateSmall?: number | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["groupUser"]
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      dayOfWeek: "Po" | "├Üt" | "St" | "─ît" | "P├í" | "So" | "Ne"
      groupUser: "admin" | "user" | "driver" | "expedition" | "store" | "mobil"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
