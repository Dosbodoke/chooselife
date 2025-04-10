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
          anchor_a: unknown | null
          anchor_b: unknown | null
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
          anchor_a?: unknown | null
          anchor_b?: unknown | null
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
          anchor_a?: unknown | null
          anchor_b?: unknown | null
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
      profiles: {
        Row: {
          birthday: string | null
          deletion_requested: string | null
          description: string | null
          expo_push_token: string | null
          id: string
          language: Database["public"]["Enums"]["language"] | null
          name: string | null
          profile_picture: string | null
          username: string | null
        }
        Insert: {
          birthday?: string | null
          deletion_requested?: string | null
          description?: string | null
          expo_push_token?: string | null
          id: string
          language?: Database["public"]["Enums"]["language"] | null
          name?: string | null
          profile_picture?: string | null
          username?: string | null
        }
        Update: {
          birthday?: string | null
          deletion_requested?: string | null
          description?: string | null
          expo_push_token?: string | null
          id?: string
          language?: Database["public"]["Enums"]["language"] | null
          name?: string | null
          profile_picture?: string | null
          username?: string | null
        }
        Relationships: []
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
          is_rigged?: boolean
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
          weave: Database["public"]["Enums"]["weave_enum"]
        }
        Insert: {
          id?: never
          image_url?: string | null
          material: Database["public"]["Enums"]["material_enum"]
          name: string
          weave: Database["public"]["Enums"]["weave_enum"]
        }
        Update: {
          id?: never
          image_url?: string | null
          material?: Database["public"]["Enums"]["material_enum"]
          name?: string
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
          instagram: string
          crossing_time: number
          profile_picture: string
        }[]
      }
      get_highline: {
        Args: {
          searchid?: string[]
          searchname?: string
          pagesize?: number
          pageparam?: number
          userid?: string
        }
        Returns: {
          id: string
          created_at: string
          name: string
          height: number
          length: number
          description: string
          sector_id: number
          cover_image: string
          anchor_a_long: number
          anchor_a_lat: number
          anchor_b_long: number
          anchor_b_lat: number
          is_favorite: boolean
          status: string
        }[]
      }
      get_total_cadenas: {
        Args: {
          highline_ids: string[]
          page_number: number
          page_size: number
          start_date?: string
          end_date?: string
        }
        Returns: {
          instagram: string
          total_cadenas: number
          profile_picture: string
        }[]
      }
      get_total_full_lines: {
        Args: {
          highline_ids: string[]
          page_number: number
          page_size: number
          start_date?: string
          end_date?: string
        }
        Returns: {
          instagram: string
          total_full_lines: number
          profile_picture: string
        }[]
      }
      get_total_walked: {
        Args: {
          highline_ids: string[]
          page_number: number
          page_size: number
          start_date?: string
          end_date?: string
        }
        Returns: {
          instagram: string
          total_distance_walked: number
          profile_picture: string
        }[]
      }
      highlines_in_view: {
        Args: {
          min_lat: number
          min_long: number
          max_lat: number
          max_long: number
        }
        Returns: {
          id: string
          name: string
          anchor_a_lat: number
          anchor_a_long: number
          anchor_b_lat: number
          anchor_b_long: number
        }[]
      }
      profile_stats: {
        Args: { username: string }
        Returns: {
          total_distance_walked: number
          total_cadenas: number
          total_full_lines: number
        }[]
      }
      validate_locale_keys: {
        Args: { json_data: Json }
        Returns: boolean
      }
    }
    Enums: {
      language: "pt" | "en"
      material_enum: "nylon" | "dyneema" | "polyester"
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
          updated_at?: string | null
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_insert_object: {
        Args: { bucketid: string; name: string; owner: string; metadata: Json }
        Returns: undefined
      }
      extension: {
        Args: { name: string }
        Returns: string
      }
      filename: {
        Args: { name: string }
        Returns: string
      }
      foldername: {
        Args: { name: string }
        Returns: string[]
      }
      get_size_by_bucket: {
        Args: Record<PropertyKey, never>
        Returns: {
          size: number
          bucket_id: string
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          prefix_param: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
        }
        Returns: {
          key: string
          id: string
          created_at: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          bucket_id: string
          prefix_param: string
          delimiter_param: string
          max_keys?: number
          start_after?: string
          next_token?: string
        }
        Returns: {
          name: string
          id: string
          metadata: Json
          updated_at: string
        }[]
      }
      operation: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      search: {
        Args: {
          prefix: string
          bucketname: string
          limits?: number
          levels?: number
          offsets?: number
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          name: string
          id: string
          updated_at: string
          created_at: string
          last_accessed_at: string
          metadata: Json
        }[]
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      language: ["pt", "en"],
      material_enum: ["nylon", "dyneema", "polyester"],
      weave_enum: ["flat", "tubular"],
      webbing_type: ["main", "backup"],
    },
  },
  storage: {
    Enums: {},
  },
} as const
