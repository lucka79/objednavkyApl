export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      baker_items: {
        Row: {
          actual_quantity: number | null
          completed_quantity: number | null
          created_at: string
          id: number
          is_completed: boolean
          planned_quantity: number
          product_id: number
          production_id: number
          recipe_quantity: number
          updated_at: string | null
        }
        Insert: {
          actual_quantity?: number | null
          completed_quantity?: number | null
          created_at?: string
          id?: number
          is_completed?: boolean
          planned_quantity?: number
          product_id: number
          production_id: number
          recipe_quantity?: number
          updated_at?: string | null
        }
        Update: {
          actual_quantity?: number | null
          completed_quantity?: number | null
          created_at?: string
          id?: number
          is_completed?: boolean
          planned_quantity?: number
          product_id?: number
          production_id?: number
          recipe_quantity?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "baker_production_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "baker_production_items_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "bakers"
            referencedColumns: ["id"]
          },
        ]
      }
      bakers: {
        Row: {
          created_at: string
          date: string
          id: number
          notes: string | null
          recipe_id: number
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: number
          notes?: string | null
          recipe_id: number
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: number
          notes?: string | null
          recipe_id?: number
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "baker_productions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "baker_productions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          adminOnly: boolean
          buyer: boolean | null
          created_at: string
          id: number
          name: string
          recept: boolean
          store: boolean | null
        }
        Insert: {
          adminOnly?: boolean
          buyer?: boolean | null
          created_at?: string
          id?: number
          name: string
          recept?: boolean
          store?: boolean | null
        }
        Update: {
          adminOnly?: boolean
          buyer?: boolean | null
          created_at?: string
          id?: number
          name?: string
          recept?: boolean
          store?: boolean | null
        }
        Relationships: []
      }
      crates: {
        Row: {
          crate_big_issued: number | null
          crate_big_received: number | null
          crate_small_issued: number | null
          crate_small_received: number | null
          created_at: string | null
          date: string
          driver_id: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          crate_big_issued?: number | null
          crate_big_received?: number | null
          crate_small_issued?: number | null
          crate_small_received?: number | null
          created_at?: string | null
          date: string
          driver_id?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          crate_big_issued?: number | null
          crate_big_received?: number | null
          crate_small_issued?: number | null
          crate_small_received?: number | null
          created_at?: string | null
          date?: string
          driver_id?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crates_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_ingredient_consumption: {
        Row: {
          created_at: string
          date: string
          id: number
          ingredient_id: number
          order_count: number
          quantity: number
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: number
          ingredient_id: number
          order_count?: number
          quantity?: number
          source: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: number
          ingredient_id?: number
          order_count?: number
          quantity?: number
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_ingredient_consumption_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      device_printer_settings: {
        Row: {
          created_at: string | null
          device_id: string
          id: number
          ip_address: string | null
          is_connected: boolean
          last_connected: string | null
          mac_address: string | null
          port: number | null
          printer_name: string
          printer_type: string
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          device_id: string
          id?: number
          ip_address?: string | null
          is_connected?: boolean
          last_connected?: string | null
          mac_address?: string | null
          port?: number | null
          printer_name: string
          printer_type?: string
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          device_id?: string
          id?: number
          ip_address?: string | null
          is_connected?: boolean
          last_connected?: string | null
          mac_address?: string | null
          port?: number | null
          printer_name?: string
          printer_type?: string
          settings?: Json | null
          updated_at?: string | null
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
          note: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          days?: string[] | null
          driver_id?: string | null
          id?: number
          note?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          days?: string[] | null
          driver_id?: string | null
          id?: number
          note?: string | null
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
      ingredient_categories: {
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
      ingredient_quantities: {
        Row: {
          created_at: string | null
          current_quantity: number
          id: string
          ingredient_id: number
          last_updated: string | null
          unit: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_quantity?: number
          id?: string
          ingredient_id: number
          last_updated?: string | null
          unit: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_quantity?: number
          id?: string
          ingredient_id?: number
          last_updated?: string | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_quantities_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_supplier_codes: {
        Row: {
          created_at: string | null
          id: number
          ingredient_id: number
          is_active: boolean | null
          package: number | null
          price: number
          product_code: string
          supplier_id: string
          supplier_ingredient_name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          ingredient_id: number
          is_active?: boolean | null
          package?: number | null
          price: number
          product_code: string
          supplier_id: string
          supplier_ingredient_name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          ingredient_id?: number
          is_active?: boolean | null
          package?: number | null
          price?: number
          product_code?: string
          supplier_id?: string
          supplier_ingredient_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_supplier_codes_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_supplier_codes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          active: boolean
          carbohydrate: number
          category_id: number | null
          created_at: string
          ean: string | null
          element: string | null
          fat: number
          fibre: number
          id: number
          kcal: number
          kiloPerUnit: number
          kJ: number
          name: string
          package: number | null
          price: number | null
          product_code: string | null
          protein: number
          salt: number
          saturates: number
          storeOnly: boolean
          sugars: number
          supplier_id: string | null
          unit: string
          vat: number | null
        }
        Insert: {
          active?: boolean
          carbohydrate?: number
          category_id?: number | null
          created_at?: string
          ean?: string | null
          element?: string | null
          fat?: number
          fibre?: number
          id?: number
          kcal?: number
          kiloPerUnit?: number
          kJ?: number
          name: string
          package?: number | null
          price?: number | null
          product_code?: string | null
          protein?: number
          salt?: number
          saturates?: number
          storeOnly?: boolean
          sugars?: number
          supplier_id?: string | null
          unit?: string
          vat?: number | null
        }
        Update: {
          active?: boolean
          carbohydrate?: number
          category_id?: number | null
          created_at?: string
          ean?: string | null
          element?: string | null
          fat?: number
          fibre?: number
          id?: number
          kcal?: number
          kiloPerUnit?: number
          kJ?: number
          name?: string
          package?: number | null
          price?: number | null
          product_code?: string | null
          protein?: number
          salt?: number
          saturates?: number
          storeOnly?: boolean
          sugars?: number
          supplier_id?: string | null
          unit?: string
          vat?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ingredient_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredients_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventories: {
        Row: {
          created_at: string
          date: string
          id: number
          ingredient_total: number | null
          note: string | null
          product_total: number | null
          total: number | null
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: number
          ingredient_total?: number | null
          note?: string | null
          product_total?: number | null
          total?: number | null
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: number
          ingredient_total?: number | null
          note?: string | null
          product_total?: number | null
          total?: number | null
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          created_at: string
          id: number
          ingredient_id: number | null
          inventory_id: number
          price: number | null
          product_id: number | null
          quantity: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          ingredient_id?: number | null
          inventory_id: number
          price?: number | null
          product_id?: number | null
          quantity?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          ingredient_id?: number | null
          inventory_id?: number
          price?: number | null
          product_id?: number | null
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          end_date: string
          id: number
          invoice_number: string
          order_ids: number[]
          start_date: string
          total: number
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: never
          invoice_number: string
          order_ids: number[]
          start_date: string
          total: number
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: never
          invoice_number?: string
          order_ids?: number[]
          start_date?: string
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices_received: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          created_by: string | null
          id: string
          invoice_date: string | null
          invoice_number: string
          net_amount: number | null
          original_image_url: string | null
          payment_terms: string | null
          processed_document_url: string | null
          processing_errors: string[] | null
          qr_codes: Json | null
          raw_document_ai_response: Json | null
          receiver_id: string | null
          supplier_address: string | null
          supplier_id: string | null
          supplier_name: string | null
          supplier_tax_id: string | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number: string
          net_amount?: number | null
          original_image_url?: string | null
          payment_terms?: string | null
          processed_document_url?: string | null
          processing_errors?: string[] | null
          qr_codes?: Json | null
          raw_document_ai_response?: Json | null
          receiver_id?: string | null
          supplier_address?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          supplier_tax_id?: string | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string
          net_amount?: number | null
          original_image_url?: string | null
          payment_terms?: string | null
          processed_document_url?: string | null
          processing_errors?: string[] | null
          qr_codes?: Json | null
          raw_document_ai_response?: Json | null
          receiver_id?: string | null
          supplier_address?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          supplier_tax_id?: string | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_received_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_received_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_received_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      items_received: {
        Row: {
          bounding_box: Json | null
          cena_jed: number | null
          created_at: string | null
          fakt_mn: number | null
          id: string
          invoice_received_id: string | null
          line_number: number | null
          line_total: number | null
          manual_match: boolean | null
          matched_ingredient_id: number | null
          matching_confidence: number | null
          package_weight_kg: number | null
          price_per_kg: number | null
          quantity: number | null
          raw_line_data: Json | null
          tax_amount: number | null
          tax_rate: number | null
          total_weight_kg: number | null
          unit_of_measure: string | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          bounding_box?: Json | null
          cena_jed?: number | null
          created_at?: string | null
          fakt_mn?: number | null
          id?: string
          invoice_received_id?: string | null
          line_number?: number | null
          line_total?: number | null
          manual_match?: boolean | null
          matched_ingredient_id?: number | null
          matching_confidence?: number | null
          package_weight_kg?: number | null
          price_per_kg?: number | null
          quantity?: number | null
          raw_line_data?: Json | null
          tax_amount?: number | null
          tax_rate?: number | null
          total_weight_kg?: number | null
          unit_of_measure?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          bounding_box?: Json | null
          cena_jed?: number | null
          created_at?: string | null
          fakt_mn?: number | null
          id?: string
          invoice_received_id?: string | null
          line_number?: number | null
          line_total?: number | null
          manual_match?: boolean | null
          matched_ingredient_id?: number | null
          matching_confidence?: number | null
          package_weight_kg?: number | null
          price_per_kg?: number | null
          quantity?: number | null
          raw_line_data?: Json | null
          tax_amount?: number | null
          tax_rate?: number | null
          total_weight_kg?: number | null
          unit_of_measure?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_received_invoice_received_id_fkey"
            columns: ["invoice_received_id"]
            isOneToOne: false
            referencedRelation: "invoices_received"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_received_matched_ingredient_id_fkey"
            columns: ["matched_ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      network_monitoring_devices: {
        Row: {
          created_at: string | null
          device_id: string
          device_info: Json | null
          id: string
          is_active: boolean | null
          last_seen: string | null
          push_token: string | null
          updated_at: string | null
          user_id: string | null
          user_role: string
        }
        Insert: {
          created_at?: string | null
          device_id: string
          device_info?: Json | null
          id?: string
          is_active?: boolean | null
          last_seen?: string | null
          push_token?: string | null
          updated_at?: string | null
          user_id?: string | null
          user_role?: string
        }
        Update: {
          created_at?: string | null
          device_id?: string
          device_info?: Json | null
          id?: string
          is_active?: boolean | null
          last_seen?: string | null
          push_token?: string | null
          updated_at?: string | null
          user_id?: string | null
          user_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "network_monitoring_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      network_status_log: {
        Row: {
          connection_type: string | null
          created_at: string | null
          device_id: string
          id: string
          is_connected: boolean
          is_internet_reachable: boolean
          timestamp: string
          user_id: string | null
          user_role: string
        }
        Insert: {
          connection_type?: string | null
          created_at?: string | null
          device_id: string
          id?: string
          is_connected: boolean
          is_internet_reachable: boolean
          timestamp: string
          user_id?: string | null
          user_role?: string
        }
        Update: {
          connection_type?: string | null
          created_at?: string | null
          device_id?: string
          id?: string
          is_connected?: boolean
          is_internet_reachable?: boolean
          timestamp?: string
          user_id?: string | null
          user_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "network_status_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_changes: {
        Row: {
          change_type: string
          created_at: string
          field_name: string | null
          id: number
          item_id: number | null
          new_value: string | null
          old_value: string | null
          order_id: number | null
          user_id: string | null
        }
        Insert: {
          change_type: string
          created_at?: string
          field_name?: string | null
          id?: number
          item_id?: number | null
          new_value?: string | null
          old_value?: string | null
          order_id?: number | null
          user_id?: string | null
        }
        Update: {
          change_type?: string
          created_at?: string
          field_name?: string | null
          id?: number
          item_id?: number | null
          new_value?: string | null
          old_value?: string | null
          order_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_changes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_changes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_changes_user_id_fkey1"
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
          isLocked: boolean
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
          isLocked?: boolean
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
          isLocked?: boolean
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
      product_parts: {
        Row: {
          bakerOnly: boolean
          created_at: string
          id: number
          ingredient_id: number | null
          pastry_id: number | null
          product_id: number
          productOnly: boolean
          quantity: number
          recipe_id: number | null
        }
        Insert: {
          bakerOnly?: boolean
          created_at?: string
          id?: number
          ingredient_id?: number | null
          pastry_id?: number | null
          product_id: number
          productOnly?: boolean
          quantity?: number
          recipe_id?: number | null
        }
        Update: {
          bakerOnly?: boolean
          created_at?: string
          id?: number
          ingredient_id?: number | null
          pastry_id?: number | null
          product_id?: number
          productOnly?: boolean
          quantity?: number
          recipe_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_parts_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_parts_pastry_id_fkey"
            columns: ["pastry_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_parts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_parts_recept_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
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
          allergens: string | null
          baker_recipe: boolean
          buyer: boolean
          category_id: number
          code: string | null
          created_at: string
          description: string | null
          donut_recipe: boolean
          id: number
          image: string | null
          isAdmin: boolean
          isChild: boolean
          koef: number
          limit: number | null
          name: string
          nameVi: string | null
          non_recipe: boolean
          parts: string | null
          pastry_recipe: boolean
          price: number
          priceBuyer: number
          priceMobil: number
          printId: number
          seller_id: string | null
          store: boolean
          store_recipe: boolean
          vat: number
        }
        Insert: {
          active?: boolean
          allergens?: string | null
          baker_recipe?: boolean
          buyer?: boolean
          category_id?: number
          code?: string | null
          created_at?: string
          description?: string | null
          donut_recipe?: boolean
          id?: number
          image?: string | null
          isAdmin?: boolean
          isChild?: boolean
          koef: number
          limit?: number | null
          name: string
          nameVi?: string | null
          non_recipe?: boolean
          parts?: string | null
          pastry_recipe?: boolean
          price?: number
          priceBuyer?: number
          priceMobil?: number
          printId?: number
          seller_id?: string | null
          store?: boolean
          store_recipe?: boolean
          vat?: number
        }
        Update: {
          active?: boolean
          allergens?: string | null
          baker_recipe?: boolean
          buyer?: boolean
          category_id?: number
          code?: string | null
          created_at?: string
          description?: string | null
          donut_recipe?: boolean
          id?: number
          image?: string | null
          isAdmin?: boolean
          isChild?: boolean
          koef?: number
          limit?: number | null
          name?: string
          nameVi?: string | null
          non_recipe?: boolean
          parts?: string | null
          pastry_recipe?: boolean
          price?: number
          priceBuyer?: number
          priceMobil?: number
          printId?: number
          seller_id?: string | null
          store?: boolean
          store_recipe?: boolean
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
          company: string | null
          crateBig: number | null
          crateSmall: number | null
          created_at: string | null
          dic: string | null
          email: string | null
          formatted_address: string | null
          full_name: string | null
          ico: string | null
          id: string
          lat: number | null
          lng: number | null
          mo_partners: boolean | null
          note: string | null
          oz: boolean
          oz_new: boolean
          paid_by: Database["public"]["Enums"]["paidByType"] | null
          phone: string | null
          place_id: string | null
          role: Database["public"]["Enums"]["groupUser"]
          shortcut: string | null
          supplier: boolean
          updated_at: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          avatar_url?: string | null
          company?: string | null
          crateBig?: number | null
          crateSmall?: number | null
          created_at?: string | null
          dic?: string | null
          email?: string | null
          formatted_address?: string | null
          full_name?: string | null
          ico?: string | null
          id: string
          lat?: number | null
          lng?: number | null
          mo_partners?: boolean | null
          note?: string | null
          oz?: boolean
          oz_new?: boolean
          paid_by?: Database["public"]["Enums"]["paidByType"] | null
          phone?: string | null
          place_id?: string | null
          role?: Database["public"]["Enums"]["groupUser"]
          shortcut?: string | null
          supplier?: boolean
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          avatar_url?: string | null
          company?: string | null
          crateBig?: number | null
          crateSmall?: number | null
          created_at?: string | null
          dic?: string | null
          email?: string | null
          formatted_address?: string | null
          full_name?: string | null
          ico?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          mo_partners?: boolean | null
          note?: string | null
          oz?: boolean
          oz_new?: boolean
          paid_by?: Database["public"]["Enums"]["paidByType"] | null
          phone?: string | null
          place_id?: string | null
          role?: Database["public"]["Enums"]["groupUser"]
          shortcut?: string | null
          supplier?: boolean
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
            foreignKeyName: "receipts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          created_at: string
          id: number
          ingredient_id: number
          quantity: number
          recipe_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          ingredient_id: number
          quantity?: number
          recipe_id: number
        }
        Update: {
          created_at?: string
          id?: number
          ingredient_id?: number
          quantity?: number
          recipe_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "recept_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recept_ingredients_recept_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          baker: boolean
          baking: string | null
          category_id: number
          created_at: string
          donut: boolean
          dough: string | null
          id: number
          name: string
          note: string | null
          pastry: boolean
          price: number
          pricePerKilo: number
          quantity: number
          stir: string | null
          store: boolean
          test: boolean
          water: string | null
        }
        Insert: {
          baker?: boolean
          baking?: string | null
          category_id?: number
          created_at?: string
          donut?: boolean
          dough?: string | null
          id?: number
          name: string
          note?: string | null
          pastry?: boolean
          price?: number
          pricePerKilo?: number
          quantity?: number
          stir?: string | null
          store?: boolean
          test?: boolean
          water?: string | null
        }
        Update: {
          baker?: boolean
          baking?: string | null
          category_id?: number
          created_at?: string
          donut?: boolean
          dough?: string | null
          id?: number
          name?: string
          note?: string | null
          pastry?: boolean
          price?: number
          pricePerKilo?: number
          quantity?: number
          stir?: string | null
          store?: boolean
          test?: boolean
          water?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recepts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
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
      transfer_items: {
        Row: {
          created_at: string
          id: number
          ingredient_id: number | null
          quantity: number
          transfer_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          ingredient_id?: number | null
          quantity?: number
          transfer_id: number
        }
        Update: {
          created_at?: string
          id?: number
          ingredient_id?: number | null
          quantity?: number
          transfer_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "transfer_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          created_at: string
          date: string
          id: number
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: number
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: number
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_sender_id_fkey"
            columns: ["sender_id"]
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
      cleanup_existing_duplicate_receipts: {
        Args: Record<PropertyKey, never>
        Returns: {
          cleaned_receipt_items: number
          cleaned_receipts: number
        }[]
      }
      cleanup_expired_device_triggers: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_order_changes: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_device_printer_settings_table: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      deactivate_device: {
        Args: { device_id: string }
        Returns: undefined
      }
      get_ingredient_quantity: {
        Args: { p_ingredient_id: number }
        Returns: number
      }
      get_invoice_stats: {
        Args: { user_id_param?: string }
        Returns: {
          completed_invoices: number
          pending_invoices: number
          this_month_amount: number
          total_amount: number
          total_invoices: number
        }[]
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      initialize_ingredient_quantities: {
        Args: Record<PropertyKey, never> | { p_user_id?: string }
        Returns: undefined
      }
      log_network_status: {
        Args: { status_data: Json }
        Returns: undefined
      }
      manual_sync_baker_productions: {
        Args: { target_date?: string }
        Returns: {
          created_count: number
          message: string
          updated_count: number
        }[]
      }
      match_ingredient_by_description: {
        Args: { description_text: string }
        Returns: {
          confidence: number
          ingredient_id: number
          ingredient_name: string
        }[]
      }
      register_device: {
        Args: { device_data: Json }
        Returns: undefined
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      sync_baker_productions_for_date: {
        Args: { target_date: string }
        Returns: {
          created_count: number
          updated_count: number
        }[]
      }
      sync_bakers_for_date: {
        Args: { target_date: string; target_user_id: string }
        Returns: {
          baker_id: number
          category_name: string
          total_products: number
          total_quantity: number
        }[]
      }
      sync_bakers_for_date_range: {
        Args: { end_date: string; start_date: string; target_user_id?: string }
        Returns: {
          bakers_created: number
          bakers_updated: number
          date_processed: string
        }[]
      }
      update_device_heartbeat: {
        Args: { device_id: string }
        Returns: undefined
      }
      update_ingredient_quantity: {
        Args: {
          p_ingredient_id: number
          p_operation_type: string
          p_quantity_change: number
        }
        Returns: boolean
      }
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
        | "supplier"
        | "seller"
      paidByType: "Hotov─Ť" | "Kartou" | "P┼Ö├şkazem" | "-"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      groupUser: [
        "admin",
        "user",
        "driver",
        "expedition",
        "store",
        "mobil",
        "buyer",
        "supplier",
        "seller",
      ],
      paidByType: ["Hotov─Ť", "Kartou", "P┼Ö├şkazem", "-"],
    },
  },
} as const
