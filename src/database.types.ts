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
          buyer: boolean | null
          created_at: string
          id: number
          name: string
          store: boolean | null
        }
        Insert: {
          buyer?: boolean | null
          created_at?: string
          id?: number
          name: string
          store?: boolean | null
        }
        Update: {
          buyer?: boolean | null
          created_at?: string
          id?: number
          name?: string
          store?: boolean | null
        }
        Relationships: []
      }
      favorite_items: {
        Row: {
          created_at: string
          id: number
          is_manual_price: boolean
          order_id: number | null
          price: number | null
          product_id: number | null
          quantity: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          is_manual_price?: boolean
          order_id?: number | null
          price?: number | null
          product_id?: number | null
          quantity?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          is_manual_price?: boolean
          order_id?: number | null
          price?: number | null
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
          driver_id: string | null
          id: number
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          days?: string[] | null
          driver_id?: string | null
          id?: number
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          days?: string[] | null
          driver_id?: string | null
          id?: number
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "favorite_orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          vat: number
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
          vat?: number
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
          vat?: number
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
          driver_id: string | null
          id: number
          note: string
          paid_by: Database["public"]["Enums"]["paidByType"] | null
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
          driver_id?: string | null
          id?: number
          note?: string
          paid_by?: Database["public"]["Enums"]["paidByType"] | null
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
          driver_id?: string | null
          id?: number
          note?: string
          paid_by?: Database["public"]["Enums"]["paidByType"] | null
          status?: string
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      production_items: {
        Row: {
          created_at: string
          id: number
          price: number | null
          product_id: number
          production_id: number
          quantity: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          price?: number | null
          product_id: number
          production_id: number
          quantity?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          price?: number | null
          product_id?: number
          production_id?: number
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_items_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "productions"
            referencedColumns: ["id"]
          },
        ]
      }
      productions: {
        Row: {
          created_at: string
          date: string
          id: number
          total: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: number
          total?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: number
          total?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "productions_user_id_fkey"
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
          buyer: boolean
          category_id: number
          code: string | null
          created_at: string
          description: string | null
          id: number
          image: string | null
          name: string
          price: number
          priceBuyer: number
          priceMobil: number
          seller_id: string | null
          store: boolean
          vat: number
        }
        Insert: {
          active?: boolean
          buyer?: boolean
          category_id?: number
          code?: string | null
          created_at?: string
          description?: string | null
          id?: number
          image?: string | null
          name: string
          price?: number
          priceBuyer?: number
          priceMobil?: number
          seller_id?: string | null
          store?: boolean
          vat?: number
        }
        Update: {
          active?: boolean
          buyer?: boolean
          category_id?: number
          code?: string | null
          created_at?: string
          description?: string | null
          id?: number
          image?: string | null
          name?: string
          price?: number
          priceBuyer?: number
          priceMobil?: number
          seller_id?: string | null
          store?: boolean
          vat?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          address: string | null
          avatar_url: string | null
          crateBig: number | null
          crateSmall: number | null
          email: string | null
          full_name: string | null
          ico: string | null
          id: string
          mo_partners: boolean | null
          note: string | null
          oz: boolean
          paid_by: Database["public"]["Enums"]["paidByType"] | null
          phone: string | null
          role: Database["public"]["Enums"]["groupUser"]
          shortcut: string | null
          updated_at: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          avatar_url?: string | null
          crateBig?: number | null
          crateSmall?: number | null
          email?: string | null
          full_name?: string | null
          ico?: string | null
          id: string
          mo_partners?: boolean | null
          note?: string | null
          oz?: boolean
          paid_by?: Database["public"]["Enums"]["paidByType"] | null
          phone?: string | null
          role?: Database["public"]["Enums"]["groupUser"]
          shortcut?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          avatar_url?: string | null
          crateBig?: number | null
          crateSmall?: number | null
          email?: string | null
          full_name?: string | null
          ico?: string | null
          id?: string
          mo_partners?: boolean | null
          note?: string | null
          oz?: boolean
          paid_by?: Database["public"]["Enums"]["paidByType"] | null
          phone?: string | null
          role?: Database["public"]["Enums"]["groupUser"]
          shortcut?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      receipt_items: {
        Row: {
          created_at: string
          id: number
          price: number | null
          product_id: number
          quantity: number | null
          receipt_id: number
          vat: number
        }
        Insert: {
          created_at?: string
          id?: number
          price?: number | null
          product_id: number
          quantity?: number | null
          receipt_id: number
          vat?: number
        }
        Update: {
          created_at?: string
          id?: number
          price?: number | null
          product_id?: number
          quantity?: number | null
          receipt_id?: number
          vat?: number
        }
        Relationships: [
          {
            foreignKeyName: "receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          buyer_id: string | null
          created_at: string
          date: string | null
          id: number
          paid_by: Database["public"]["Enums"]["paidByType"] | null
          receipt_no: string
          seller_id: string | null
          total: number | null
          updated_at: string | null
        }
        Insert: {
          buyer_id?: string | null
          created_at?: string
          date?: string | null
          id?: number
          paid_by?: Database["public"]["Enums"]["paidByType"] | null
          receipt_no?: string
          seller_id?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Update: {
          buyer_id?: string | null
          created_at?: string
          date?: string | null
          id?: number
          paid_by?: Database["public"]["Enums"]["paidByType"] | null
          receipt_no?: string
          seller_id?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_user_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          created_at: string
          id: number
          price: number | null
          product_id: number
          quantity: number | null
          return_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          price?: number | null
          product_id: number
          quantity?: number | null
          return_id: number
        }
        Update: {
          created_at?: string
          id?: number
          price?: number | null
          product_id?: number
          quantity?: number | null
          return_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          created_at: string
          date: string
          id: number
          total: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: number
          total?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: number
          total?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "returns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stored_items: {
        Row: {
          created_at: string
          id: number
          product_id: number | null
          quantity: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          product_id?: number | null
          quantity?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          product_id?: number | null
          quantity?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stored_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stored_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      groupUser:
        | "admin"
        | "user"
        | "driver"
        | "expedition"
        | "store"
        | "mobil"
        | "buyer"
      paidByType: "Hotov─Ť" | "Kartou" | "P┼Ö├şkazem" | "-"
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
