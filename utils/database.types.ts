// Command used to generate the types
// npx supabase gen types typescript --local --schema storage,public,functions > utils/supabase/database.types.ts

export type Functions = Database["public"]["Functions"];
// Supabase does not generate types for non defaul SQL data types, this type represent a postgis POINT
// Notice that it should be called as POINT(longitude latitude)
export type Point = `POINT(${number} ${number})`;

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      entry: {
        Row: {
          cadenas: number | null;
          comment: string | null;
          created_at: string;
          crossing_time: number | null;
          distance_walked: number | null;
          full_lines: number | null;
          highline_id: string;
          id: string;
          instagram: string;
          is_highliner: boolean;
          witness: string[] | null;
        };
        Insert: {
          cadenas?: number | null;
          comment?: string | null;
          created_at?: string;
          crossing_time?: number | null;
          distance_walked?: number | null;
          full_lines?: number | null;
          highline_id: string;
          id?: string;
          instagram: string;
          is_highliner: boolean;
          witness?: string[] | null;
        };
        Update: {
          cadenas?: number | null;
          comment?: string | null;
          created_at?: string;
          crossing_time?: number | null;
          distance_walked?: number | null;
          full_lines?: number | null;
          highline_id?: string;
          id?: string;
          instagram?: string;
          is_highliner?: boolean;
          witness?: string[] | null;
        };
        Relationships: [
          {
            foreignKeyName: "entry_highline_id_fkey";
            columns: ["highline_id"];
            isOneToOne: false;
            referencedRelation: "highline";
            referencedColumns: ["id"];
          }
        ];
      };
      favorite_highline: {
        Row: {
          created_at: string;
          highline_id: string;
          id: string;
          profile_id: string;
        };
        Insert: {
          created_at?: string;
          highline_id: string;
          id?: string;
          profile_id: string;
        };
        Update: {
          created_at?: string;
          highline_id?: string;
          id?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorite_highline_highline_id_fkey";
            columns: ["highline_id"];
            isOneToOne: false;
            referencedRelation: "highline";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favorite_highline_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      highline: {
        Row: {
          anchor_a: unknown | null;
          anchor_b: unknown | null;
          backup_webbing: string;
          cover_image: string | null;
          created_at: string;
          description: string | null;
          height: number;
          id: string;
          lenght: number;
          main_webbing: string;
          name: string;
          riggers: string[] | null;
          sector_id: number | null;
        };
        Insert: {
          anchor_a?: unknown | null;
          anchor_b?: unknown | null;
          backup_webbing?: string;
          cover_image?: string | null;
          created_at?: string;
          description?: string | null;
          height: number;
          id?: string;
          lenght: number;
          main_webbing?: string;
          name: string;
          riggers?: string[] | null;
          sector_id?: number | null;
        };
        Update: {
          anchor_a?: unknown | null;
          anchor_b?: unknown | null;
          backup_webbing?: string;
          cover_image?: string | null;
          created_at?: string;
          description?: string | null;
          height?: number;
          id?: string;
          lenght?: number;
          main_webbing?: string;
          name?: string;
          riggers?: string[] | null;
          sector_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "highline_sector_id_fkey";
            columns: ["sector_id"];
            isOneToOne: false;
            referencedRelation: "sector";
            referencedColumns: ["id"];
          }
        ];
      };
      profiles: {
        Row: {
          birthday: string | null;
          description: string | null;
          id: string;
          name: string | null;
          profile_picture: string | null;
          username: string | null;
        };
        Insert: {
          birthday?: string | null;
          description?: string | null;
          id: string;
          name?: string | null;
          profile_picture?: string | null;
          username?: string | null;
        };
        Update: {
          birthday?: string | null;
          description?: string | null;
          id?: string;
          name?: string | null;
          profile_picture?: string | null;
          username?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      sector: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: number;
          name: string;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: number;
          name: string;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_crossing_time: {
        Args: {
          highline_id: string;
          page_number: number;
          page_size: number;
        };
        Returns: {
          instagram: string;
          crossing_time: number;
          profile_picture: string;
        }[];
      };
      get_highline: {
        Args: {
          searchid?: string[];
          searchname?: string;
          pagesize?: number;
          pageparam?: number;
          userid?: string;
        };
        Returns: {
          id: string;
          created_at: string;
          name: string;
          height: number;
          lenght: number;
          main_webbing: string;
          backup_webbing: string;
          description: string;
          sector_id: number;
          cover_image: string;
          riggers: string[];
          anchor_a_long: number;
          anchor_a_lat: number;
          anchor_b_long: number;
          anchor_b_lat: number;
          is_favorite: boolean;
        }[];
      };
      get_total_cadenas: {
        Args: {
          highline_ids: string[];
          page_number: number;
          page_size: number;
          start_date?: string;
          end_date?: string;
        };
        Returns: {
          instagram: string;
          total_cadenas: number;
          profile_picture: string;
        }[];
      };
      get_total_full_lines: {
        Args: {
          highline_ids: string[];
          page_number: number;
          page_size: number;
          start_date?: string;
          end_date?: string;
        };
        Returns: {
          instagram: string;
          total_full_lines: number;
          profile_picture: string;
        }[];
      };
      get_total_walked: {
        Args: {
          highline_ids: string[];
          page_number: number;
          page_size: number;
          start_date?: string;
          end_date?: string;
        };
        Returns: {
          instagram: string;
          total_distance_walked: number;
          profile_picture: string;
        }[];
      };
      highlines_in_view: {
        Args: {
          min_lat: number;
          min_long: number;
          max_lat: number;
          max_long: number;
        };
        Returns: {
          id: string;
          name: string;
          anchor_a_lat: number;
          anchor_a_long: number;
          anchor_b_lat: number;
          anchor_b_long: number;
        }[];
      };
      profile_stats: {
        Args: {
          username: string;
        };
        Returns: {
          total_distance_walked: number;
          total_cadenas: number;
          total_full_lines: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null;
          avif_autodetection: boolean | null;
          created_at: string | null;
          file_size_limit: number | null;
          id: string;
          name: string;
          owner: string | null;
          owner_id: string | null;
          public: boolean | null;
          updated_at: string | null;
        };
        Insert: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id: string;
          name: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          updated_at?: string | null;
        };
        Update: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id?: string;
          name?: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      migrations: {
        Row: {
          executed_at: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Insert: {
          executed_at?: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Update: {
          executed_at?: string | null;
          hash?: string;
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
      objects: {
        Row: {
          bucket_id: string | null;
          created_at: string | null;
          id: string;
          last_accessed_at: string | null;
          metadata: Json | null;
          name: string | null;
          owner: string | null;
          owner_id: string | null;
          path_tokens: string[] | null;
          updated_at: string | null;
          version: string | null;
        };
        Insert: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          version?: string | null;
        };
        Update: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          }
        ];
      };
      s3_multipart_uploads: {
        Row: {
          bucket_id: string;
          created_at: string;
          id: string;
          in_progress_size: number;
          key: string;
          owner_id: string | null;
          upload_signature: string;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          id: string;
          in_progress_size?: number;
          key: string;
          owner_id?: string | null;
          upload_signature: string;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          id?: string;
          in_progress_size?: number;
          key?: string;
          owner_id?: string | null;
          upload_signature?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          }
        ];
      };
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string;
          created_at: string;
          etag: string;
          id: string;
          key: string;
          owner_id: string | null;
          part_number: number;
          size: number;
          upload_id: string;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          etag: string;
          id?: string;
          key: string;
          owner_id?: string | null;
          part_number: number;
          size?: number;
          upload_id: string;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          etag?: string;
          id?: string;
          key?: string;
          owner_id?: string | null;
          part_number?: number;
          size?: number;
          upload_id?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey";
            columns: ["upload_id"];
            isOneToOne: false;
            referencedRelation: "s3_multipart_uploads";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_insert_object: {
        Args: {
          bucketid: string;
          name: string;
          owner: string;
          metadata: Json;
        };
        Returns: undefined;
      };
      extension: {
        Args: {
          name: string;
        };
        Returns: string;
      };
      filename: {
        Args: {
          name: string;
        };
        Returns: string;
      };
      foldername: {
        Args: {
          name: string;
        };
        Returns: string[];
      };
      get_size_by_bucket: {
        Args: Record<PropertyKey, never>;
        Returns: {
          size: number;
          bucket_id: string;
        }[];
      };
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string;
          prefix_param: string;
          delimiter_param: string;
          max_keys?: number;
          next_key_token?: string;
          next_upload_token?: string;
        };
        Returns: {
          key: string;
          id: string;
          created_at: string;
        }[];
      };
      list_objects_with_delimiter: {
        Args: {
          bucket_id: string;
          prefix_param: string;
          delimiter_param: string;
          max_keys?: number;
          start_after?: string;
          next_token?: string;
        };
        Returns: {
          name: string;
          id: string;
          metadata: Json;
          updated_at: string;
        }[];
      };
      search: {
        Args: {
          prefix: string;
          bucketname: string;
          limits?: number;
          levels?: number;
          offsets?: number;
          search?: string;
          sortcolumn?: string;
          sortorder?: string;
        };
        Returns: {
          name: string;
          id: string;
          updated_at: string;
          created_at: string;
          last_accessed_at: string;
          metadata: Json;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
      PublicSchema["Views"])
  ? (PublicSchema["Tables"] &
      PublicSchema["Views"])[PublicTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
  ? PublicSchema["Enums"][PublicEnumNameOrOptions]
  : never;
