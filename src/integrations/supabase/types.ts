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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string | null
          department_id: string | null
          id: string
          name: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          department_id?: string | null
          id?: string
          name: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          department_id?: string | null
          id?: string
          name?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      credits: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          department_id: string | null
          due_date: string | null
          from_department_id: string | null
          id: string
          notes: string | null
          paid_amount: number | null
          purpose: string | null
          sale_id: string | null
          settlement_status: string | null
          status: Database["public"]["Enums"]["credit_status"] | null
          to_department_id: string | null
          transaction_type: string | null
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          department_id?: string | null
          due_date?: string | null
          from_department_id?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number | null
          purpose?: string | null
          sale_id?: string | null
          settlement_status?: string | null
          status?: Database["public"]["Enums"]["credit_status"] | null
          to_department_id?: string | null
          transaction_type?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          department_id?: string | null
          due_date?: string | null
          from_department_id?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number | null
          purpose?: string | null
          sale_id?: string | null
          settlement_status?: string | null
          status?: Database["public"]["Enums"]["credit_status"] | null
          to_department_id?: string | null
          transaction_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_from_department_id_fkey"
            columns: ["from_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_to_department_id_fkey"
            columns: ["to_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credit_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          department_id: string | null
          id: string
          notes: string | null
          sale_id: string | null
          transaction_type: string
        }
        Insert: {
          amount?: number
          balance_after?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          department_id?: string | null
          id?: string
          notes?: string | null
          sale_id?: string | null
          transaction_type?: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          department_id?: string | null
          id?: string
          notes?: string | null
          sale_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_credit_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credit_transactions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credit_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_preferences: {
        Row: {
          created_at: string | null
          customer_id: string | null
          department_id: string | null
          id: string
          notes: string | null
          preferred_bottle_sizes: string[] | null
          preferred_scents: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          department_id?: string | null
          id?: string
          notes?: string | null
          preferred_bottle_sizes?: string[] | null
          preferred_scents?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          department_id?: string | null
          id?: string
          notes?: string | null
          preferred_bottle_sizes?: string[] | null
          preferred_scents?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_preferences_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_preferences_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          balance: number | null
          created_at: string | null
          credit_limit: number | null
          department_id: string | null
          email: string | null
          id: string
          last_payment_reminder_sent: string | null
          name: string
          notes: string | null
          outstanding_balance: number | null
          payment_reminder_count: number | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          balance?: number | null
          created_at?: string | null
          credit_limit?: number | null
          department_id?: string | null
          email?: string | null
          id?: string
          last_payment_reminder_sent?: string | null
          name: string
          notes?: string | null
          outstanding_balance?: number | null
          payment_reminder_count?: number | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          balance?: number | null
          created_at?: string | null
          credit_limit?: number | null
          department_id?: string | null
          email?: string | null
          id?: string
          last_payment_reminder_sent?: string | null
          name?: string
          notes?: string | null
          outstanding_balance?: number | null
          payment_reminder_count?: number | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      data_packages: {
        Row: {
          created_at: string | null
          data_amount: number
          data_unit: string
          department_id: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          validity_period: string
        }
        Insert: {
          created_at?: string | null
          data_amount?: number
          data_unit?: string
          department_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price?: number
          validity_period?: string
        }
        Update: {
          created_at?: string | null
          data_amount?: number
          data_unit?: string
          department_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          validity_period?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_packages_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      department_settings: {
        Row: {
          created_at: string | null
          department_id: string | null
          enable_notifications: boolean | null
          id: string
          low_stock_threshold: number | null
          notification_email: string | null
          seasonal_remark: string | null
          settings_json: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          department_id?: string | null
          enable_notifications?: boolean | null
          id?: string
          low_stock_threshold?: number | null
          notification_email?: string | null
          seasonal_remark?: string | null
          settings_json?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          department_id?: string | null
          enable_notifications?: boolean | null
          id?: string
          low_stock_threshold?: number | null
          notification_email?: string | null
          seasonal_remark?: string | null
          settings_json?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "department_settings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: true
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_mobile_money: boolean | null
          is_perfume_department: boolean | null
          name: string
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_mobile_money?: boolean | null
          is_perfume_department?: boolean | null
          name: string
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_mobile_money?: boolean | null
          is_perfume_department?: boolean | null
          name?: string
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          approved_by: string | null
          category: string | null
          created_at: string | null
          created_by: string | null
          department_id: string | null
          description: string
          expense_date: string | null
          id: string
          status: Database["public"]["Enums"]["expense_status"] | null
        }
        Insert: {
          amount?: number
          approved_by?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          description: string
          expense_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["expense_status"] | null
        }
        Update: {
          amount?: number
          approved_by?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          description?: string
          expense_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["expense_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox: {
        Row: {
          created_at: string | null
          department_id: string | null
          id: string
          is_read: boolean | null
          message: string
          subject: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          department_id?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          subject: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          department_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      interdepartmental_inbox: {
        Row: {
          created_at: string | null
          credit_id: string | null
          from_department_id: string | null
          id: string
          is_read: boolean | null
          message: string
          subject: string
          to_department_id: string | null
        }
        Insert: {
          created_at?: string | null
          credit_id?: string | null
          from_department_id?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          subject: string
          to_department_id?: string | null
        }
        Update: {
          created_at?: string | null
          credit_id?: string | null
          from_department_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          subject?: string
          to_department_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interdepartmental_inbox_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interdepartmental_inbox_from_department_id_fkey"
            columns: ["from_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interdepartmental_inbox_to_department_id_fkey"
            columns: ["to_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_stock_usage: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          department_id: string | null
          id: string
          ml_quantity: number | null
          notes: string | null
          product_id: string | null
          quantity: number
          reason: string
          status: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          id?: string
          ml_quantity?: number | null
          notes?: string | null
          product_id?: string | null
          quantity?: number
          reason: string
          status?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          id?: string
          ml_quantity?: number | null
          notes?: string | null
          product_id?: string | null
          quantity?: number
          reason?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_stock_usage_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_stock_usage_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_content: {
        Row: {
          content: string | null
          id: string
          image_url: string | null
          is_visible: boolean | null
          order_index: number | null
          section_key: string
          settings_json: Json | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean | null
          order_index?: number | null
          section_key: string
          settings_json?: Json | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean | null
          order_index?: number | null
          section_key?: string
          settings_json?: Json | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      perfume_pricing_config: {
        Row: {
          bottle_cost_config: Json | null
          created_at: string | null
          department_id: string | null
          id: string
          retail_bottle_pricing: Json | null
          updated_at: string | null
          wholesale_bottle_pricing: Json | null
        }
        Insert: {
          bottle_cost_config?: Json | null
          created_at?: string | null
          department_id?: string | null
          id?: string
          retail_bottle_pricing?: Json | null
          updated_at?: string | null
          wholesale_bottle_pricing?: Json | null
        }
        Update: {
          bottle_cost_config?: Json | null
          created_at?: string | null
          department_id?: string | null
          id?: string
          retail_bottle_pricing?: Json | null
          updated_at?: string | null
          wholesale_bottle_pricing?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "perfume_pricing_config_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: true
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      perfume_scents: {
        Row: {
          created_at: string | null
          current_weight_g: number | null
          density: number | null
          department_id: string | null
          description: string | null
          empty_bottle_weight_g: number | null
          id: string
          is_active: boolean | null
          name: string
          stock_ml: number | null
        }
        Insert: {
          created_at?: string | null
          current_weight_g?: number | null
          density?: number | null
          department_id?: string | null
          description?: string | null
          empty_bottle_weight_g?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          stock_ml?: number | null
        }
        Update: {
          created_at?: string | null
          current_weight_g?: number | null
          density?: number | null
          department_id?: string | null
          description?: string | null
          empty_bottle_weight_g?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          stock_ml?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "perfume_scents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          ml_size: number | null
          name: string
          price: number
          product_id: string
          size: string | null
          sku: string | null
          stock: number | null
          variant_name: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          ml_size?: number | null
          name: string
          price?: number
          product_id: string
          size?: string | null
          sku?: string | null
          stock?: number | null
          variant_name?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          ml_size?: number | null
          name?: string
          price?: number
          product_id?: string
          size?: string | null
          sku?: string | null
          stock?: number | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allow_custom_price: boolean | null
          barcode: string | null
          base_unit: string | null
          bottle_size_ml: number | null
          brand: string | null
          category_id: string | null
          cost_per_ml: number | null
          cost_price: number | null
          created_at: string | null
          current_stock: number | null
          department_id: string | null
          description: string | null
          id: string
          image_url: string | null
          imei: string | null
          internal_barcode: string | null
          is_active: boolean | null
          is_archived: boolean | null
          is_bundle: boolean | null
          max_price: number | null
          min_price: number | null
          min_stock: number | null
          name: string
          price: number
          pricing_tiers: Json | null
          quantity_per_unit: number | null
          retail_price: number | null
          retail_price_per_ml: number | null
          selling_price: number | null
          serial_number: string | null
          sku: string | null
          stock: number | null
          supplier_id: string | null
          total_ml: number | null
          tracking_type: Database["public"]["Enums"]["tracking_type"] | null
          unit: string | null
          updated_at: string | null
          volume_unit: string | null
          wholesale_price: number | null
          wholesale_price_per_ml: number | null
        }
        Insert: {
          allow_custom_price?: boolean | null
          barcode?: string | null
          base_unit?: string | null
          bottle_size_ml?: number | null
          brand?: string | null
          category_id?: string | null
          cost_per_ml?: number | null
          cost_price?: number | null
          created_at?: string | null
          current_stock?: number | null
          department_id?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          imei?: string | null
          internal_barcode?: string | null
          is_active?: boolean | null
          is_archived?: boolean | null
          is_bundle?: boolean | null
          max_price?: number | null
          min_price?: number | null
          min_stock?: number | null
          name: string
          price?: number
          pricing_tiers?: Json | null
          quantity_per_unit?: number | null
          retail_price?: number | null
          retail_price_per_ml?: number | null
          selling_price?: number | null
          serial_number?: string | null
          sku?: string | null
          stock?: number | null
          supplier_id?: string | null
          total_ml?: number | null
          tracking_type?: Database["public"]["Enums"]["tracking_type"] | null
          unit?: string | null
          updated_at?: string | null
          volume_unit?: string | null
          wholesale_price?: number | null
          wholesale_price_per_ml?: number | null
        }
        Update: {
          allow_custom_price?: boolean | null
          barcode?: string | null
          base_unit?: string | null
          bottle_size_ml?: number | null
          brand?: string | null
          category_id?: string | null
          cost_per_ml?: number | null
          cost_price?: number | null
          created_at?: string | null
          current_stock?: number | null
          department_id?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          imei?: string | null
          internal_barcode?: string | null
          is_active?: boolean | null
          is_archived?: boolean | null
          is_bundle?: boolean | null
          max_price?: number | null
          min_price?: number | null
          min_stock?: number | null
          name?: string
          price?: number
          pricing_tiers?: Json | null
          quantity_per_unit?: number | null
          retail_price?: number | null
          retail_price_per_ml?: number | null
          selling_price?: number | null
          serial_number?: string | null
          sku?: string | null
          stock?: number | null
          supplier_id?: string | null
          total_ml?: number | null
          tracking_type?: Database["public"]["Enums"]["tracking_type"] | null
          unit?: string | null
          updated_at?: string | null
          volume_unit?: string | null
          wholesale_price?: number | null
          wholesale_price_per_ml?: number | null
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
            foreignKeyName: "products_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      reconciliations: {
        Row: {
          cashier_name: string
          created_at: string | null
          date: string
          department_id: string | null
          discrepancy: number
          id: string
          notes: string | null
          reported_cash: number
          status: string | null
          system_cash: number
        }
        Insert: {
          cashier_name: string
          created_at?: string | null
          date: string
          department_id?: string | null
          discrepancy?: number
          id?: string
          notes?: string | null
          reported_cash?: number
          status?: string | null
          system_cash?: number
        }
        Update: {
          cashier_name?: string
          created_at?: string | null
          date?: string
          department_id?: string | null
          discrepancy?: number
          id?: string
          notes?: string | null
          reported_cash?: number
          status?: string | null
          system_cash?: number
        }
        Relationships: [
          {
            foreignKeyName: "reconciliations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          bottle_cost: number | null
          created_at: string | null
          customer_type: string | null
          id: string
          item_name: string | null
          ml_amount: number | null
          name: string
          price_per_ml: number | null
          product_id: string | null
          quantity: number
          sale_id: string
          scent_mixture: string | null
          service_id: string | null
          total: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          bottle_cost?: number | null
          created_at?: string | null
          customer_type?: string | null
          id?: string
          item_name?: string | null
          ml_amount?: number | null
          name: string
          price_per_ml?: number | null
          product_id?: string | null
          quantity?: number
          sale_id: string
          scent_mixture?: string | null
          service_id?: string | null
          total?: number
          unit_price?: number
          variant_id?: string | null
        }
        Update: {
          bottle_cost?: number | null
          created_at?: string | null
          customer_type?: string | null
          id?: string
          item_name?: string | null
          ml_amount?: number | null
          name?: string
          price_per_ml?: number | null
          product_id?: string | null
          quantity?: number
          sale_id?: string
          scent_mixture?: string | null
          service_id?: string | null
          total?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_paid: number | null
          cashier_id: string | null
          cashier_name: string | null
          change_amount: number | null
          created_at: string | null
          customer_id: string | null
          department_id: string | null
          discount: number | null
          id: string
          invoice_number: string | null
          is_invoice: boolean | null
          is_loan: boolean | null
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          receipt_number: string | null
          remarks: string | null
          sale_number: string
          status: Database["public"]["Enums"]["sale_status"] | null
          subtotal: number
          tax: number | null
          total: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_paid?: number | null
          cashier_id?: string | null
          cashier_name?: string | null
          change_amount?: number | null
          created_at?: string | null
          customer_id?: string | null
          department_id?: string | null
          discount?: number | null
          id?: string
          invoice_number?: string | null
          is_invoice?: boolean | null
          is_loan?: boolean | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          receipt_number?: string | null
          remarks?: string | null
          sale_number: string
          status?: Database["public"]["Enums"]["sale_status"] | null
          subtotal?: number
          tax?: number | null
          total?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_paid?: number | null
          cashier_id?: string | null
          cashier_name?: string | null
          change_amount?: number | null
          created_at?: string | null
          customer_id?: string | null
          department_id?: string | null
          discount?: number | null
          id?: string
          invoice_number?: string | null
          is_invoice?: boolean | null
          is_loan?: boolean | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          receipt_number?: string | null
          remarks?: string | null
          sale_number?: string
          status?: Database["public"]["Enums"]["sale_status"] | null
          subtotal?: number
          tax?: number | null
          total?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      sensitive_service_registrations: {
        Row: {
          created_at: string | null
          customer_address: string | null
          customer_id_number: string | null
          customer_id_type: string | null
          customer_name: string
          customer_phone: string
          department_id: string | null
          id: string
          registered_by: string | null
          service_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_address?: string | null
          customer_id_number?: string | null
          customer_id_type?: string | null
          customer_name: string
          customer_phone: string
          department_id?: string | null
          id?: string
          registered_by?: string | null
          service_type?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_address?: string | null
          customer_id_number?: string | null
          customer_id_type?: string | null
          customer_name?: string
          customer_phone?: string
          department_id?: string | null
          id?: string
          registered_by?: string | null
          service_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sensitive_service_registrations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      service_showcase: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_featured: boolean | null
          is_visible: boolean | null
          price: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_visible?: boolean | null
          price?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_visible?: boolean | null
          price?: string | null
          title?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          base_price: number | null
          category_id: string | null
          created_at: string | null
          department_id: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean | null
          is_negotiable: boolean | null
          material_cost: number | null
          name: string
          price: number
        }
        Insert: {
          base_price?: number | null
          category_id?: string | null
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          is_negotiable?: boolean | null
          material_cost?: number | null
          name: string
          price?: number
        }
        Update: {
          base_price?: number | null
          category_id?: string | null
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          is_negotiable?: boolean | null
          material_cost?: number | null
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          admin_email: string | null
          business_address: string | null
          business_email: string | null
          business_name: string | null
          business_phone: string | null
          created_at: string | null
          currency: string | null
          department_id: string | null
          id: string
          logo_url: string | null
          receipt_footer: string | null
          receipt_logo_url: string | null
          seasonal_remark: string | null
          settings_json: Json | null
          show_back_page: boolean | null
          tax_rate: number | null
          updated_at: string | null
          website: string | null
          whatsapp_number: string | null
        }
        Insert: {
          admin_email?: string | null
          business_address?: string | null
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string | null
          currency?: string | null
          department_id?: string | null
          id?: string
          logo_url?: string | null
          receipt_footer?: string | null
          receipt_logo_url?: string | null
          seasonal_remark?: string | null
          settings_json?: Json | null
          show_back_page?: boolean | null
          tax_rate?: number | null
          updated_at?: string | null
          website?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          admin_email?: string | null
          business_address?: string | null
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string | null
          currency?: string | null
          department_id?: string | null
          id?: string
          logo_url?: string | null
          receipt_footer?: string | null
          receipt_logo_url?: string | null
          seasonal_remark?: string | null
          settings_json?: Json | null
          show_back_page?: boolean | null
          tax_rate?: number | null
          updated_at?: string | null
          website?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: true
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      suspended_revenue: {
        Row: {
          amount: number
          cashier_name: string
          created_at: string | null
          date: string
          department_id: string | null
          id: string
          investigation_notes: string | null
          reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
        }
        Insert: {
          amount?: number
          cashier_name: string
          created_at?: string | null
          date: string
          department_id?: string | null
          id?: string
          investigation_notes?: string | null
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          cashier_name?: string
          created_at?: string | null
          date?: string
          department_id?: string | null
          id?: string
          investigation_notes?: string | null
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suspended_revenue_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          department_id: string | null
          id: string
          nav_permissions: string[] | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          department_id?: string | null
          id?: string
          nav_permissions?: string[] | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          department_id?: string | null
          id?: string
          nav_permissions?: string[] | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_receipt_number: { Args: never; Returns: string }
      get_or_create_master_perfume: { Args: never; Returns: string }
      get_user_department: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "cashier" | "staff"
      credit_status: "pending" | "approved" | "partial" | "settled" | "rejected"
      expense_status: "pending" | "approved" | "rejected"
      internal_usage_status: "pending" | "approved" | "rejected"
      payment_method: "cash" | "card" | "mobile_money" | "credit"
      reconciliation_status: "pending" | "completed" | "discrepancy"
      sale_status: "completed" | "voided" | "pending"
      tracking_type: "quantity" | "ml"
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
      app_role: ["admin", "manager", "cashier", "staff"],
      credit_status: ["pending", "approved", "partial", "settled", "rejected"],
      expense_status: ["pending", "approved", "rejected"],
      internal_usage_status: ["pending", "approved", "rejected"],
      payment_method: ["cash", "card", "mobile_money", "credit"],
      reconciliation_status: ["pending", "completed", "discrepancy"],
      sale_status: ["completed", "voided", "pending"],
      tracking_type: ["quantity", "ml"],
    },
  },
} as const
