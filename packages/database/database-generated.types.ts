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
      entry: {
        Row: {
          cadenas: number | null
          comment: string | null
          created_at: string
          crossing_time: number | null
          distance_walked: number | null
          full_lines: number | null
          highline_id: string
          id: string
          instagram: string
          is_highliner: boolean
          witness: string[] | null
        }
        Insert: {
          cadenas?: number | null
          comment?: string | null
          created_at?: string
          crossing_time?: number | null
          distance_walked?: number | null
          full_lines?: number | null
          highline_id: string
          id?: string
          instagram: string
          is_highliner: boolean
          witness?: string[] | null
        }
        Update: {
          cadenas?: number | null
          comment?: string | null
          created_at?: string
          crossing_time?: number | null
          distance_walked?: number | null
          full_lines?: number | null
          highline_id?: string
          id?: string
          instagram?: string
          is_highliner?: boolean
          witness?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "entry_highline_id_fkey"
            columns: ["highline_id"]
            isOneToOne: false
            referencedRelation: "highline"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          city: string
          country: string
          description: string | null
          end_date: string | null
          id: number
          lines: number | null
          registration_url: string | null
          start_date: string
          state: string | null
          title: string
          type: string
        }
        Insert: {
          city: string
          country: string
          description?: string | null
          end_date?: string | null
          id?: never
          lines?: number | null
          registration_url?: string | null
          start_date: string
          state?: string | null
          title: string
          type: string
        }
        Update: {
          city?: string
          country?: string
          description?: string | null
          end_date?: string | null
          id?: never
          lines?: number | null
          registration_url?: string | null
          start_date?: string
          state?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      favorite_highline: {
        Row: {
          created_at: string
          highline_id: string
          id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          highline_id: string
          id?: string
          profile_id: string
        }
        Update: {
          created_at?: string
          highline_id?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_highline_highline_id_fkey"
            columns: ["highline_id"]
            isOneToOne: false
            referencedRelation: "highline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_highline_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      highline: {
        Row: {
          anchor_a: unknown
          anchor_b: unknown
          cover_image: string | null
          created_at: string
          description: string | null
          height: number
          id: string
          length: number
          name: string
          sector_id: number | null
        }
        Insert: {
          anchor_a?: unknown
          anchor_b?: unknown
          cover_image?: string | null
          created_at?: string
          description?: string | null
          height: number
          id?: string
          length: number
          name: string
          sector_id?: number | null
        }
        Update: {
          anchor_a?: unknown
          anchor_b?: unknown
          cover_image?: string | null
          created_at?: string
          description?: string | null
          height?: number
          id?: string
          length?: number
          name?: string
          sector_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "highline_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sector"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          content: string
          created_at: string
          id: string
          organization_id: string | null
          slug: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          organization_id?: string | null
          slug: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          organization_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      news_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          news_id: string | null
          user_id: string | null
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          news_id?: string | null
          user_id?: string | null
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          news_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_comments_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      news_reactions: {
        Row: {
          created_at: string
          id: string
          news_id: string | null
          reaction: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          news_id?: string | null
          reaction: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          news_id?: string | null
          reaction?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_reactions_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: Json | null
          created_at: string
          data: Json | null
          id: number
          title: Json | null
          user_id: string | null
        }
        Insert: {
          body?: Json | null
          created_at?: string
          data?: Json | null
          id?: number
          title?: Json | null
          user_id?: string | null
        }
        Update: {
          body?: Json | null
          created_at?: string
          data?: Json | null
          id?: number
          title?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          joined_at: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_role_enum"]
          user_id: string
        }
        Insert: {
          joined_at?: string
          organization_id: string
          role?: Database["public"]["Enums"]["organization_role_enum"]
          user_id: string
        }
        Update: {
          joined_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role_enum"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          annual_price_amount: number | null
          created_at: string
          id: string
          monthly_price_amount: number | null
          name: string
          slug: string
        }
        Insert: {
          annual_price_amount?: number | null
          created_at?: string
          id?: string
          monthly_price_amount?: number | null
          name: string
          slug: string
        }
        Update: {
          annual_price_amount?: number | null
          created_at?: string
          id?: string
          monthly_price_amount?: number | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          abacate_pay_charge_id: string | null
          amount: number
          created_at: string
          id: string
          organization_id: string
          paid_at: string | null
          status: Database["public"]["Enums"]["payment_status_enum"]
          subscription_id: string
          user_id: string
        }
        Insert: {
          abacate_pay_charge_id?: string | null
          amount: number
          created_at?: string
          id?: string
          organization_id: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payment_status_enum"]
          subscription_id: string
          user_id: string
        }
        Update: {
          abacate_pay_charge_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          organization_id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payment_status_enum"]
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          birthday: string | null
          deletion_requested: string | null
          description: string | null
          id: string
          name: string | null
          profile_picture: string | null
          username: string | null
        }
        Insert: {
          birthday?: string | null
          deletion_requested?: string | null
          description?: string | null
          id: string
          name?: string | null
          profile_picture?: string | null
          username?: string | null
        }
        Update: {
          birthday?: string | null
          deletion_requested?: string | null
          description?: string | null
          id?: string
          name?: string | null
          profile_picture?: string | null
          username?: string | null
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string | null
          id: number
          language: Database["public"]["Enums"]["language"] | null
          profile_id: string | null
          token: string
        }
        Insert: {
          created_at?: string | null
          id?: never
          language?: Database["public"]["Enums"]["language"] | null
          profile_id?: string | null
          token: string
        }
        Update: {
          created_at?: string | null
          id?: never
          language?: Database["public"]["Enums"]["language"] | null
          profile_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rig_setup: {
        Row: {
          highline_id: string
          id: number
          is_rigged: boolean
          rig_date: string
          riggers: string[]
          unrigged_at: string | null
        }
        Insert: {
          highline_id: string
          id?: never
          is_rigged: boolean
          rig_date: string
          riggers: string[]
          unrigged_at?: string | null
        }
        Update: {
          highline_id?: string
          id?: never
          is_rigged?: boolean
          rig_date?: string
          riggers?: string[]
          unrigged_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rig_setup_highline_id_fkey"
            columns: ["highline_id"]
            isOneToOne: false
            referencedRelation: "highline"
            referencedColumns: ["id"]
          },
        ]
      }
      rig_setup_webbing: {
        Row: {
          description: string | null
          id: number
          left_loop: boolean
          length: number
          right_loop: boolean
          setup_id: number
          webbing_id: number | null
          webbing_type: Database["public"]["Enums"]["webbing_type"]
        }
        Insert: {
          description?: string | null
          id?: never
          left_loop: boolean
          length: number
          right_loop: boolean
          setup_id: number
          webbing_id?: number | null
          webbing_type: Database["public"]["Enums"]["webbing_type"]
        }
        Update: {
          description?: string | null
          id?: never
          left_loop?: boolean
          length?: number
          right_loop?: boolean
          setup_id?: number
          webbing_id?: number | null
          webbing_type?: Database["public"]["Enums"]["webbing_type"]
        }
        Relationships: [
          {
            foreignKeyName: "rig_setup_webbing_setup_id_fkey"
            columns: ["setup_id"]
            isOneToOne: false
            referencedRelation: "rig_setup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rig_setup_webbing_webbing_id_fkey"
            columns: ["webbing_id"]
            isOneToOne: false
            referencedRelation: "webbing"
            referencedColumns: ["id"]
          },
        ]
      }
      sector: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          current_period_end: string | null
          id: string
          organization_id: string
          plan_type: Database["public"]["Enums"]["subscription_plan_type_enum"]
          status: Database["public"]["Enums"]["subscription_status_enum"]
          user_id: string
        }
        Insert: {
          current_period_end?: string | null
          id?: string
          organization_id: string
          plan_type: Database["public"]["Enums"]["subscription_plan_type_enum"]
          status?: Database["public"]["Enums"]["subscription_status_enum"]
          user_id: string
        }
        Update: {
          current_period_end?: string | null
          id?: string
          organization_id?: string
          plan_type?: Database["public"]["Enums"]["subscription_plan_type_enum"]
          status?: Database["public"]["Enums"]["subscription_status_enum"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trails: {
        Row: {
          color: string
          coordinates: number[]
          id: number
          name: string
        }
        Insert: {
          color: string
          coordinates: number[]
          id?: never
          name: string
        }
        Update: {
          color?: string
          coordinates?: number[]
          id?: never
          name?: string
        }
        Relationships: []
      }
      webbing: {
        Row: {
          description: string | null
          id: number
          left_loop: boolean
          length: number
          model: number | null
          right_loop: boolean
          tag_name: string | null
          user_id: string
        }
        Insert: {
          description?: string | null
          id?: never
          left_loop: boolean
          length: number
          model?: number | null
          right_loop: boolean
          tag_name?: string | null
          user_id: string
        }
        Update: {
          description?: string | null
          id?: never
          left_loop?: boolean
          length?: number
          model?: number | null
          right_loop?: boolean
          tag_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webbing_model_fkey"
            columns: ["model"]
            isOneToOne: false
            referencedRelation: "webbing_model"
            referencedColumns: ["id"]
          },
        ]
      }
      webbing_model: {
        Row: {
          id: number
          image_url: string | null
          material: Database["public"]["Enums"]["material_enum"]
          name: string
          recommended_lifetime_days: number | null
          strength_class:
            | Database["public"]["Enums"]["strength_class_enum"]
            | null
          weave: Database["public"]["Enums"]["weave_enum"]
        }
        Insert: {
          id?: never
          image_url?: string | null
          material: Database["public"]["Enums"]["material_enum"]
          name: string
          recommended_lifetime_days?: number | null
          strength_class?:
            | Database["public"]["Enums"]["strength_class_enum"]
            | null
          weave: Database["public"]["Enums"]["weave_enum"]
        }
        Update: {
          id?: never
          image_url?: string | null
          material?: Database["public"]["Enums"]["material_enum"]
          name?: string
          recommended_lifetime_days?: number | null
          strength_class?:
            | Database["public"]["Enums"]["strength_class_enum"]
            | null
          weave?: Database["public"]["Enums"]["weave_enum"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_crossing_time: {
        Args: { highline_id: string; page_number: number; page_size: number }
        Returns: {
          crossing_time: number
          instagram: string
          profile_picture: string
        }[]
      }
      get_highline: {
        Args: {
          pageparam?: number
          pagesize?: number
          searchid?: string[]
          searchname?: string
          userid?: string
        }
        Returns: {
          anchor_a_lat: number
          anchor_a_long: number
          anchor_b_lat: number
          anchor_b_long: number
          cover_image: string
          created_at: string
          description: string
          height: number
          id: string
          is_favorite: boolean
          length: number
          name: string
          sector_id: number
          status: string
        }[]
      }
      get_total_cadenas: {
        Args: {
          end_date?: string
          highline_ids: string[]
          page_number: number
          page_size: number
          start_date?: string
        }
        Returns: {
          instagram: string
          profile_picture: string
          total_cadenas: number
        }[]
      }
      get_total_full_lines: {
        Args: {
          end_date?: string
          highline_ids: string[]
          page_number: number
          page_size: number
          start_date?: string
        }
        Returns: {
          instagram: string
          profile_picture: string
          total_full_lines: number
        }[]
      }
      get_total_walked: {
        Args: {
          end_date?: string
          highline_ids: string[]
          page_number: number
          page_size: number
          start_date?: string
        }
        Returns: {
          instagram: string
          profile_picture: string
          total_distance_walked: number
        }[]
      }
      get_webbing_usage_days: {
        Args: { webbing_id_param: number }
        Returns: {
          rig_count: number
          usage_days: number
        }[]
      }
      highlines_in_view: {
        Args: {
          max_lat: number
          max_long: number
          min_lat: number
          min_long: number
        }
        Returns: {
          anchor_a_lat: number
          anchor_a_long: number
          anchor_b_lat: number
          anchor_b_long: number
          id: string
          name: string
        }[]
      }
      profile_stats: {
        Args: { username: string }
        Returns: {
          total_cadenas: number
          total_distance_walked: number
          total_full_lines: number
        }[]
      }
      validate_locale_keys: { Args: { json_data: Json }; Returns: boolean }
    }
    Enums: {
      language: "en" | "pt"
      material_enum: "nylon" | "dyneema" | "polyester"
      organization_role_enum: "admin" | "member"
      payment_status_enum: "pending" | "succeeded" | "failed"
      strength_class_enum: "A+" | "A" | "B" | "C"
      subscription_plan_type_enum: "monthly" | "annual"
      subscription_status_enum: "pending_payment" | "active" | "canceled"
      weave_enum: "flat" | "tubular"
      webbing_type: "main" | "backup"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          level: number | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      prefixes: {
        Row: {
          bucket_id: string
          created_at: string | null
          level: number
          name: string
          updated_at: string | null
        }
        Insert: {
          bucket_id: string
          created_at?: string | null
          level?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          bucket_id?: string
          created_at?: string | null
          level?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prefixes_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_prefixes: {
        Args: { _bucket_id: string; _name: string }
        Returns: undefined
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      delete_leaf_prefixes: {
        Args: { bucket_ids: string[]; names: string[] }
        Returns: undefined
      }
      delete_prefix: {
        Args: { _bucket_id: string; _name: string }
        Returns: boolean
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_level: { Args: { name: string }; Returns: number }
      get_prefix: { Args: { name: string }; Returns: string }
      get_prefixes: { Args: { name: string }; Returns: string[] }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          start_after?: string
        }
        Returns: {
          id: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      lock_top_prefixes: {
        Args: { bucket_ids: string[]; names: string[] }
        Returns: undefined
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_legacy_v1: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v1_optimised: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
      language: ["en", "pt"],
      material_enum: ["nylon", "dyneema", "polyester"],
      organization_role_enum: ["admin", "member"],
      payment_status_enum: ["pending", "succeeded", "failed"],
      strength_class_enum: ["A+", "A", "B", "C"],
      subscription_plan_type_enum: ["monthly", "annual"],
      subscription_status_enum: ["pending_payment", "active", "canceled"],
      weave_enum: ["flat", "tubular"],
      webbing_type: ["main", "backup"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const

