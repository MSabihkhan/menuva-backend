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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      analytics_refresh_state: {
        Row: {
          id: boolean
          last_refreshed_at: string
        }
        Insert: {
          id?: boolean
          last_refreshed_at?: string
        }
        Update: {
          id?: boolean
          last_refreshed_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string
          actor_type: string
          entity_id: string
          entity_type: string
          id: string
          new_value: Json | null
          occurred_at: string
          old_value: Json | null
          restaurant_id: string
        }
        Insert: {
          action: string
          actor_id: string
          actor_type: string
          entity_id: string
          entity_type: string
          id?: string
          new_value?: Json | null
          occurred_at?: string
          old_value?: Json | null
          restaurant_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          actor_type?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_value?: Json | null
          occurred_at?: string
          old_value?: Json | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_menu_items: {
        Row: {
          available: boolean
          branch_id: string
          id: string
          menu_item_id: string
          price_override: number | null
          restaurant_id: string
        }
        Insert: {
          available?: boolean
          branch_id: string
          id?: string
          menu_item_id: string
          price_override?: number | null
          restaurant_id: string
        }
        Update: {
          available?: boolean
          branch_id?: string
          id?: string
          menu_item_id?: string
          price_override?: number | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_menu_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_menu_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          closes_at: string
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          opens_at: string
          restaurant_id: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          closes_at?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          opens_at?: string
          restaurant_id: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          closes_at?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          opens_at?: string
          restaurant_id?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      card_discounts: {
        Row: {
          bank_name: string
          card_type: string | null
          created_at: string
          discount_bps: number
          id: string
          is_active: boolean
          restaurant_id: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          bank_name: string
          card_type?: string | null
          created_at?: string
          discount_bps: number
          id?: string
          is_active?: boolean
          restaurant_id: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          bank_name?: string
          card_type?: string | null
          created_at?: string
          discount_bps?: number
          id?: string
          is_active?: boolean
          restaurant_id?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_discounts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          added_at: string
          id: string
          member_id: string
          menu_item_id: string
          modifiers_json: Json | null
          quantity: number
          restaurant_id: string
          session_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          member_id: string
          menu_item_id: string
          modifiers_json?: Json | null
          quantity?: number
          restaurant_id: string
          session_id: string
        }
        Update: {
          added_at?: string
          id?: string
          member_id?: string
          menu_item_id?: string
          modifiers_json?: Json | null
          quantity?: number
          restaurant_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "session_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email: string
          id?: string
          is_active?: boolean
          name: string
          restaurant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          actor_type: string
          branch_id: string | null
          event_type: string
          id: string
          item_id: string | null
          occurred_at: string
          payload: Json | null
          session_id: string | null
          tenant_id: string
        }
        Insert: {
          actor_type: string
          branch_id?: string | null
          event_type: string
          id?: string
          item_id?: string | null
          occurred_at?: string
          payload?: Json | null
          session_id?: string | null
          tenant_id: string
        }
        Update: {
          actor_type?: string
          branch_id?: string | null
          event_type?: string
          id?: string
          item_id?: string | null
          occurred_at?: string
          payload?: Json | null
          session_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      events_2026_07: {
        Row: {
          actor_type: string
          branch_id: string | null
          event_type: string
          id: string
          item_id: string | null
          occurred_at: string
          payload: Json | null
          session_id: string | null
          tenant_id: string
        }
        Insert: {
          actor_type: string
          branch_id?: string | null
          event_type: string
          id?: string
          item_id?: string | null
          occurred_at?: string
          payload?: Json | null
          session_id?: string | null
          tenant_id: string
        }
        Update: {
          actor_type?: string
          branch_id?: string | null
          event_type?: string
          id?: string
          item_id?: string | null
          occurred_at?: string
          payload?: Json | null
          session_id?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      events_2026_08: {
        Row: {
          actor_type: string
          branch_id: string | null
          event_type: string
          id: string
          item_id: string | null
          occurred_at: string
          payload: Json | null
          session_id: string | null
          tenant_id: string
        }
        Insert: {
          actor_type: string
          branch_id?: string | null
          event_type: string
          id?: string
          item_id?: string | null
          occurred_at?: string
          payload?: Json | null
          session_id?: string | null
          tenant_id: string
        }
        Update: {
          actor_type?: string
          branch_id?: string | null
          event_type?: string
          id?: string
          item_id?: string | null
          occurred_at?: string
          payload?: Json | null
          session_id?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      events_2026_09: {
        Row: {
          actor_type: string
          branch_id: string | null
          event_type: string
          id: string
          item_id: string | null
          occurred_at: string
          payload: Json | null
          session_id: string | null
          tenant_id: string
        }
        Insert: {
          actor_type: string
          branch_id?: string | null
          event_type: string
          id?: string
          item_id?: string | null
          occurred_at?: string
          payload?: Json | null
          session_id?: string | null
          tenant_id: string
        }
        Update: {
          actor_type?: string
          branch_id?: string | null
          event_type?: string
          id?: string
          item_id?: string | null
          occurred_at?: string
          payload?: Json | null
          session_id?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      events_default: {
        Row: {
          actor_type: string
          branch_id: string | null
          event_type: string
          id: string
          item_id: string | null
          occurred_at: string
          payload: Json | null
          session_id: string | null
          tenant_id: string
        }
        Insert: {
          actor_type: string
          branch_id?: string | null
          event_type: string
          id?: string
          item_id?: string | null
          occurred_at?: string
          payload?: Json | null
          session_id?: string | null
          tenant_id: string
        }
        Update: {
          actor_type?: string
          branch_id?: string | null
          event_type?: string
          id?: string
          item_id?: string | null
          occurred_at?: string
          payload?: Json | null
          session_id?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      images: {
        Row: {
          alt_text: string | null
          id: string
          is_primary: boolean
          menu_item_id: string
          restaurant_id: string
          sort_order: number
          url: string
        }
        Insert: {
          alt_text?: string | null
          id?: string
          is_primary?: boolean
          menu_item_id: string
          restaurant_id: string
          sort_order?: number
          url: string
        }
        Update: {
          alt_text?: string | null
          id?: string
          is_primary?: boolean
          menu_item_id?: string
          restaurant_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "images_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "images_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          branch_id: string
          created_at: string
          employee_id: string
          id: string
          restaurant_id: string
          role: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          employee_id: string
          id?: string
          restaurant_id: string
          role: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          restaurant_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category_id: string
          cost_price: number | null
          created_at: string
          deleted_at: string | null
          description: string | null
          emoji: string | null
          id: string
          is_active: boolean
          is_gluten_free: boolean | null
          is_spicy: boolean | null
          name: string
          price: number
          restaurant_id: string
          sort_order: number
          tag: string | null
          updated_at: string
        }
        Insert: {
          category_id: string
          cost_price?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean
          is_gluten_free?: boolean | null
          is_spicy?: boolean | null
          name: string
          price: number
          restaurant_id: string
          sort_order?: number
          tag?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string
          cost_price?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean
          is_gluten_free?: boolean | null
          is_spicy?: boolean | null
          name?: string
          price?: number
          restaurant_id?: string
          sort_order?: number
          tag?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      models_3d: {
        Row: {
          glb_url: string
          id: string
          menu_item_id: string
          poster_url: string | null
          restaurant_id: string
          usdz_url: string | null
        }
        Insert: {
          glb_url: string
          id?: string
          menu_item_id: string
          poster_url?: string | null
          restaurant_id: string
          usdz_url?: string | null
        }
        Update: {
          glb_url?: string
          id?: string
          menu_item_id?: string
          poster_url?: string | null
          restaurant_id?: string
          usdz_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "models_3d_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "models_3d_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_groups: {
        Row: {
          group_type: string
          id: string
          is_required: boolean
          max_selections: number | null
          menu_item_id: string
          name: string
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          group_type?: string
          id?: string
          is_required?: boolean
          max_selections?: number | null
          menu_item_id: string
          name: string
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          group_type?: string
          id?: string
          is_required?: boolean
          max_selections?: number | null
          menu_item_id?: string
          name?: string
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "modifier_groups_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_groups_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      modifiers: {
        Row: {
          group_id: string
          id: string
          name: string
          price_delta: number
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          group_id: string
          id?: string
          name: string
          price_delta?: number
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          group_id?: string
          id?: string
          name?: string
          price_delta?: number
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "modifiers_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifiers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          channel: string
          delivered: boolean | null
          event_type: string
          id: string
          payload: Json | null
          recipient_id: string
          recipient_type: string
          restaurant_id: string
          sent_at: string
        }
        Insert: {
          channel: string
          delivered?: boolean | null
          event_type: string
          id?: string
          payload?: Json | null
          recipient_id: string
          recipient_type: string
          restaurant_id: string
          sent_at?: string
        }
        Update: {
          channel?: string
          delivered?: boolean | null
          event_type?: string
          id?: string
          payload?: Json | null
          recipient_id?: string
          recipient_type?: string
          restaurant_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean
          name: string
          restaurant_id: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      onboard_restaurants: {
        Row: {
          id: string
          onboarded_at: string
          onboarded_by: string
          restaurant_id: string | null
          status: string
        }
        Insert: {
          id?: string
          onboarded_at?: string
          onboarded_by: string
          restaurant_id?: string | null
          status?: string
        }
        Update: {
          id?: string
          onboarded_at?: string
          onboarded_by?: string
          restaurant_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboard_restaurants_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_cost_tracking: {
        Row: {
          amount: number
          cost_type: string
          id: string
          notes: string | null
          period_end: string
          period_start: string
          restaurant_id: string | null
        }
        Insert: {
          amount: number
          cost_type: string
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          restaurant_id?: string | null
        }
        Update: {
          amount?: number
          cost_type?: string
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ops_cost_tracking_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_line_items: {
        Row: {
          by_member_id: string | null
          by_member_name: string
          id: string
          menu_item_id: string | null
          modifiers_snapshot: Json | null
          name_snapshot: string
          order_id: string
          quantity: number
          restaurant_id: string
          unit_price_snapshot: number
        }
        Insert: {
          by_member_id?: string | null
          by_member_name: string
          id?: string
          menu_item_id?: string | null
          modifiers_snapshot?: Json | null
          name_snapshot: string
          order_id: string
          quantity: number
          restaurant_id: string
          unit_price_snapshot: number
        }
        Update: {
          by_member_id?: string | null
          by_member_name?: string
          id?: string
          menu_item_id?: string | null
          modifiers_snapshot?: Json | null
          name_snapshot?: string
          order_id?: string
          quantity?: number
          restaurant_id?: string
          unit_price_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_line_items_by_member_id_fkey"
            columns: ["by_member_id"]
            isOneToOne: false
            referencedRelation: "session_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          idempotency_key: string
          kitchen_notes: string | null
          placed_at: string
          restaurant_id: string
          round: number
          session_id: string
          status: string
          status_changed_at: string | null
          subtotal: number
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          kitchen_notes?: string | null
          placed_at?: string
          restaurant_id: string
          round: number
          session_id: string
          status?: string
          status_changed_at?: string | null
          subtotal: number
          tax: number
          total: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          kitchen_notes?: string | null
          placed_at?: string
          restaurant_id?: string
          round?: number
          session_id?: string
          status?: string
          status_changed_at?: string | null
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          restaurant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          restaurant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          restaurant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owners_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          discount_amount: number
          discount_source: string | null
          id: string
          method: string
          order_id: string
          paid_at: string
          provider_ref: string | null
          restaurant_id: string
        }
        Insert: {
          amount: number
          discount_amount?: number
          discount_source?: string | null
          id?: string
          method: string
          order_id: string
          paid_at?: string
          provider_ref?: string | null
          restaurant_id: string
        }
        Update: {
          amount?: number
          discount_amount?: number
          discount_source?: string | null
          id?: string
          method?: string
          order_id?: string
          paid_at?: string
          provider_ref?: string | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_price_changes: {
        Row: {
          applied_at: string | null
          id: string
          menu_item_id: string
          new_price: number
          requested_at: string
          requested_by: string
          restaurant_id: string
          status: string
        }
        Insert: {
          applied_at?: string | null
          id?: string
          menu_item_id: string
          new_price: number
          requested_at?: string
          requested_by: string
          restaurant_id: string
          status?: string
        }
        Update: {
          applied_at?: string | null
          id?: string
          menu_item_id?: string
          new_price?: number
          requested_at?: string
          requested_by?: string
          restaurant_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_price_changes_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_price_changes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          features: Json | null
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          features?: Json | null
          id?: string
          is_active?: boolean
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          features?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          created_at: string
          currency: string
          deleted_at: string | null
          id: string
          name: string
          service_charge_bps: number | null
          slug: string
          tax_rate_bps: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          deleted_at?: string | null
          id?: string
          name: string
          service_charge_bps?: number | null
          slug: string
          tax_rate_bps: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          deleted_at?: string | null
          id?: string
          name?: string
          service_charge_bps?: number | null
          slug?: string
          tax_rate_bps?: number
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          branch_id: string
          comment: string | null
          created_at: string
          id: string
          order_id: string | null
          rating: number
          restaurant_id: string
          session_id: string | null
        }
        Insert: {
          branch_id: string
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          rating: number
          restaurant_id: string
          session_id?: string | null
        }
        Update: {
          branch_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          rating?: number
          restaurant_id?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_billing: {
        Row: {
          amount: number
          billed_at: string
          id: string
          invoice_url: string | null
          paid_at: string | null
          restaurant_id: string
          status: string
          subscription_id: string
        }
        Insert: {
          amount: number
          billed_at?: string
          id?: string
          invoice_url?: string | null
          paid_at?: string | null
          restaurant_id: string
          status?: string
          subscription_id: string
        }
        Update: {
          amount?: number
          billed_at?: string
          id?: string
          invoice_url?: string | null
          paid_at?: string | null
          restaurant_id?: string
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_billing_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_billing_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_members: {
        Row: {
          device_id: string
          id: string
          initials: string
          joined_at: string
          name: string
          restaurant_id: string
          session_id: string
        }
        Insert: {
          device_id: string
          id?: string
          initials: string
          joined_at?: string
          name: string
          restaurant_id: string
          session_id: string
        }
        Update: {
          device_id?: string
          id?: string
          initials?: string
          joined_at?: string
          name?: string
          restaurant_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_members_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_members_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          period_end: string
          period_start: string
          plan_id: string
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          plan_id: string
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          plan_id?: string
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      table_prompt_responses: {
        Row: {
          member_id: string
          prompt_id: string
          responded_at: string
          response: string
        }
        Insert: {
          member_id: string
          prompt_id: string
          responded_at?: string
          response: string
        }
        Update: {
          member_id?: string
          prompt_id?: string
          responded_at?: string
          response?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_prompt_responses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "session_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_prompt_responses_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "table_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      table_prompts: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          initiated_by: string
          kind: string
          payload: Json
          resolved_at: string | null
          restaurant_id: string
          session_id: string
          status: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          initiated_by: string
          kind: string
          payload?: Json
          resolved_at?: string | null
          restaurant_id: string
          session_id: string
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          initiated_by?: string
          kind?: string
          payload?: Json
          resolved_at?: string | null
          restaurant_id?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_prompts_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "session_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_prompts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_prompts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      table_sessions: {
        Row: {
          branch_id: string
          closed_at: string | null
          created_at: string
          expires_at: string
          id: string
          is_locked: boolean
          opened_at: string
          restaurant_id: string
          table_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          closed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          is_locked?: boolean
          opened_at?: string
          restaurant_id: string
          table_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          closed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          is_locked?: boolean
          opened_at?: string
          restaurant_id?: string
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          branch_id: string
          capacity: number | null
          code: string
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          label: string | null
          qr_code_url: string | null
          qr_token: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          capacity?: number | null
          code: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          qr_code_url?: string | null
          qr_token: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          capacity?: number | null
          code?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          qr_code_url?: string | null
          qr_token?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tables_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      upsell_category_affinity: {
        Row: {
          id: string
          priority: number
          restaurant_id: string
          source_category_id: string
          target_category_id: string
        }
        Insert: {
          id?: string
          priority?: number
          restaurant_id: string
          source_category_id: string
          target_category_id: string
        }
        Update: {
          id?: string
          priority?: number
          restaurant_id?: string
          source_category_id?: string
          target_category_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "upsell_category_affinity_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upsell_category_affinity_source_category_id_fkey"
            columns: ["source_category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upsell_category_affinity_target_category_id_fkey"
            columns: ["target_category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      upsell_rules: {
        Row: {
          auto_dismiss_seconds: number
          created_at: string
          id: string
          is_enabled: boolean
          max_impressions_per_round: number
          max_suggestions_add_cart: number
          max_suggestions_cart: number
          max_suggestions_checkout: number
          minimum_lift_bps: number
          minimum_support_bps: number
          restaurant_id: string
          suppress_after_decline: boolean
          updated_at: string
        }
        Insert: {
          auto_dismiss_seconds?: number
          created_at?: string
          id?: string
          is_enabled?: boolean
          max_impressions_per_round?: number
          max_suggestions_add_cart?: number
          max_suggestions_cart?: number
          max_suggestions_checkout?: number
          minimum_lift_bps?: number
          minimum_support_bps?: number
          restaurant_id: string
          suppress_after_decline?: boolean
          updated_at?: string
        }
        Update: {
          auto_dismiss_seconds?: number
          created_at?: string
          id?: string
          is_enabled?: boolean
          max_impressions_per_round?: number
          max_suggestions_add_cart?: number
          max_suggestions_cart?: number
          max_suggestions_checkout?: number
          minimum_lift_bps?: number
          minimum_support_bps?: number
          restaurant_id?: string
          suppress_after_decline?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "upsell_rules_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      upselling_combinations: {
        Row: {
          id: string
          restaurant_id: string
          sort_order: number
          source_item_id: string
          target_item_id: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          sort_order?: number
          source_item_id: string
          target_item_id: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          sort_order?: number
          source_item_id?: string
          target_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "upselling_combinations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upselling_combinations_source_item_id_fkey"
            columns: ["source_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upselling_combinations_target_item_id_fkey"
            columns: ["target_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          duration_sec: number | null
          id: string
          menu_item_id: string
          restaurant_id: string
          sort_order: number
          url: string
        }
        Insert: {
          duration_sec?: number | null
          id?: string
          menu_item_id: string
          restaurant_id: string
          sort_order?: number
          url: string
        }
        Update: {
          duration_sec?: number | null
          id?: string
          menu_item_id?: string
          restaurant_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      daily_sales_by_branch: {
        Row: {
          aov_paisa: number | null
          branch_id: string | null
          covers: number | null
          day: string | null
          order_count: number | null
          restaurant_id: string | null
          revenue_paisa: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      item_pair_scores: {
        Row: {
          confidence_a_to_b_bps: number | null
          confidence_b_to_a_bps: number | null
          item_a: string | null
          item_b: string | null
          lift_bps: number | null
          pair_count: number | null
          restaurant_id: string | null
          support_bps: number | null
          total_orders: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_line_items_menu_item_id_fkey"
            columns: ["item_b"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_items_menu_item_id_fkey"
            columns: ["item_a"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      item_performance: {
        Row: {
          category_id: string | null
          cost_paisa: number | null
          margin_paisa: number | null
          menu_item_id: string | null
          popularity_rank: number | null
          restaurant_id: string | null
          revenue_paisa: number | null
          units_sold: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_item_timings: {
        Row: {
          avg_time_sec: number | null
          branch_id: string | null
          menu_item_id: string | null
          restaurant_id: string | null
          sample_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_line_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_timings: {
        Row: {
          avg_prep_seconds: number | null
          avg_ready_seconds: number | null
          avg_serve_seconds: number | null
          branch_id: string | null
          restaurant_id: string | null
          sample_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      model_3d_conversion: {
        Row: {
          conversion_bps: number | null
          menu_item_id: string | null
          ordered_count: number | null
          restaurant_id: string | null
          viewed_3d_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_heatmap: {
        Row: {
          branch_id: string | null
          dow: number | null
          hour: number | null
          order_count: number | null
          restaurant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      upsell_performance: {
        Row: {
          acceptance_rate_bps: number | null
          accepted: number | null
          branch_id: string | null
          declined: number | null
          ignore_rate_bps: number | null
          ignored: number | null
          restaurant_id: string | null
          shown: number | null
          source_type: string | null
          upsell_revenue_paisa: number | null
        }
        Relationships: [
          {
            foreignKeyName: "events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      close_stale_sessions_for_token: {
        Args: { p_qr_token: string }
        Returns: number
      }
      close_stale_table_sessions: {
        Args: {
          p_idle_minutes?: number
          p_settled_idle_minutes?: number
          p_table_id: string
        }
        Returns: number
      }
      close_table_prompt: {
        Args: { p_prompt_id: string; p_status: string }
        Returns: undefined
      }
      create_events_partition: {
        Args: { p_month: number; p_year: number }
        Returns: undefined
      }
      current_branch_id: { Args: never; Returns: string }
      current_diner_session_id: { Args: never; Returns: string }
      current_member_id: { Args: never; Returns: string }
      current_restaurant_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      end_diner_session: { Args: { p_session_id: string }; Returns: Json }
      get_active_table_prompt: { Args: { p_session_id: string }; Returns: Json }
      get_daily_sales: {
        Args: { p_branch_id?: string; p_from?: string; p_to?: string }
        Returns: {
          aov_paisa: number | null
          branch_id: string | null
          covers: number | null
          day: string | null
          order_count: number | null
          restaurant_id: string | null
          revenue_paisa: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "daily_sales_by_branch"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_function_def: { Args: never; Returns: string }
      get_item_performance: {
        Args: never
        Returns: {
          category_id: string | null
          cost_paisa: number | null
          margin_paisa: number | null
          menu_item_id: string | null
          popularity_rank: number | null
          restaurant_id: string | null
          revenue_paisa: number | null
          units_sold: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "item_performance"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_kitchen_item_timings: {
        Args: never
        Returns: {
          avg_time_sec: number | null
          branch_id: string | null
          menu_item_id: string | null
          restaurant_id: string | null
          sample_count: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "kitchen_item_timings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_kitchen_timings: {
        Args: never
        Returns: {
          avg_prep_seconds: number | null
          avg_ready_seconds: number | null
          avg_serve_seconds: number | null
          branch_id: string | null
          restaurant_id: string | null
          sample_count: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "kitchen_timings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_order_heatmap: {
        Args: never
        Returns: {
          branch_id: string | null
          dow: number | null
          hour: number | null
          order_count: number | null
          restaurant_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "order_heatmap"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_table_members: { Args: { p_qr_token: string }; Returns: Json }
      get_table_prompt: { Args: { p_prompt_id: string }; Returns: Json }
      get_upsell_performance: {
        Args: never
        Returns: {
          acceptance_rate_bps: number | null
          accepted: number | null
          branch_id: string | null
          declined: number | null
          ignore_rate_bps: number | null
          ignored: number | null
          restaurant_id: string | null
          shown: number | null
          source_type: string | null
          upsell_revenue_paisa: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "upsell_performance"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_upsell_suggestions: {
        Args: {
          p_cart_item_ids?: string[]
          p_declined_item_ids?: string[]
          p_impressions_this_round?: number
          p_session_id: string
          p_trigger: string
          p_trigger_item_id?: string
        }
        Returns: Json
      }
      invite_staff: {
        Args: {
          p_branch_id: string
          p_email: string
          p_name: string
          p_role: string
        }
        Returns: string
      }
      is_diner: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      join_table_session: {
        Args: {
          p_device_id: string
          p_diner_name: string
          p_initials?: string
          p_qr_token: string
        }
        Returns: Json
      }
      log_upsell_event: {
        Args: { p_event_type: string; p_payload: Json; p_session_id: string }
        Returns: undefined
      }
      open_table_prompt: {
        Args: {
          p_kind: string
          p_member_id: string
          p_payload?: Json
          p_session_id: string
          p_ttl_seconds?: number
        }
        Returns: Json
      }
      place_order: {
        Args: {
          p_idempotency_key: string
          p_kitchen_notes?: string
          p_session_id: string
        }
        Returns: Json
      }
      refresh_all_analytics: { Args: never; Returns: undefined }
      refresh_analytics_if_stale: {
        Args: { p_max_age_seconds?: number }
        Returns: Json
      }
      respond_table_prompt: {
        Args: { p_member_id: string; p_prompt_id: string; p_response: string }
        Returns: Json
      }
      run_end_of_day: { Args: never; Returns: Json }
      validate_diner_session: {
        Args: never
        Returns: {
          branch_id: string
          closed_at: string | null
          created_at: string
          expires_at: string
          id: string
          is_locked: boolean
          opened_at: string
          restaurant_id: string
          table_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "table_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
