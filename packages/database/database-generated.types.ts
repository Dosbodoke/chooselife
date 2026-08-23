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
      app_config: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      contribution_plan_assignments: {
        Row: {
          amount: number
          billing_timezone: string | null
          created_at: string
          currency: string
          due_day: number | null
          effective_period_start: string
          id: string
          lead_days: number | null
          pix_copy_paste: string | null
          plan_type: Database["public"]["Enums"]["subscription_plan_type_enum"]
          schedule_id: string
        }
        Insert: {
          amount: number
          billing_timezone?: string | null
          created_at?: string
          currency: string
          due_day?: number | null
          effective_period_start: string
          id?: string
          lead_days?: number | null
          pix_copy_paste?: string | null
          plan_type: Database["public"]["Enums"]["subscription_plan_type_enum"]
          schedule_id: string
        }
        Update: {
          amount?: number
          billing_timezone?: string | null
          created_at?: string
          currency?: string
          due_day?: number | null
          effective_period_start?: string
          id?: string
          lead_days?: number | null
          pix_copy_paste?: string | null
          plan_type?: Database["public"]["Enums"]["subscription_plan_type_enum"]
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contribution_plan_assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "contribution_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      contribution_reminder_batch_events: {
        Row: {
          batch_id: string
          created_at: string
          event_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          event_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contribution_reminder_batch_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "contribution_reminder_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_reminder_batch_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "contribution_reminder_events"
            referencedColumns: ["id"]
          },
        ]
      }
      contribution_reminder_batches: {
        Row: {
          attempt_count: number
          created_at: string
          delivered_at: string | null
          delivery_window_on: string
          id: string
          last_failure_code: string | null
          lease_expires_at: string | null
          lease_token: string | null
          next_attempt_at: string
          organization_id: string
          recipient_user_id: string
          status: Database["public"]["Enums"]["contribution_reminder_batch_status_enum"]
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          delivery_window_on: string
          id?: string
          last_failure_code?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          next_attempt_at?: string
          organization_id: string
          recipient_user_id: string
          status?: Database["public"]["Enums"]["contribution_reminder_batch_status_enum"]
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          delivery_window_on?: string
          id?: string
          last_failure_code?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          next_attempt_at?: string
          organization_id?: string
          recipient_user_id?: string
          status?: Database["public"]["Enums"]["contribution_reminder_batch_status_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contribution_reminder_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_reminder_batches_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contribution_reminder_delivery_attempts: {
        Row: {
          attempt_count: number
          batch_id: string
          created_at: string
          expo_receipt_error_code: string | null
          expo_receipt_status: string | null
          expo_ticket_id: string | null
          id: string
          language: Database["public"]["Enums"]["language"] | null
          lease_expires_at: string | null
          lease_token: string | null
          next_attempt_at: string
          next_receipt_check_at: string | null
          push_token_id: number | null
          status: Database["public"]["Enums"]["contribution_reminder_attempt_status_enum"]
          terminal_outcome: string | null
          token: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          batch_id: string
          created_at?: string
          expo_receipt_error_code?: string | null
          expo_receipt_status?: string | null
          expo_ticket_id?: string | null
          id?: string
          language?: Database["public"]["Enums"]["language"] | null
          lease_expires_at?: string | null
          lease_token?: string | null
          next_attempt_at?: string
          next_receipt_check_at?: string | null
          push_token_id?: number | null
          status?: Database["public"]["Enums"]["contribution_reminder_attempt_status_enum"]
          terminal_outcome?: string | null
          token: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          batch_id?: string
          created_at?: string
          expo_receipt_error_code?: string | null
          expo_receipt_status?: string | null
          expo_ticket_id?: string | null
          id?: string
          language?: Database["public"]["Enums"]["language"] | null
          lease_expires_at?: string | null
          lease_token?: string | null
          next_attempt_at?: string
          next_receipt_check_at?: string | null
          push_token_id?: number | null
          status?: Database["public"]["Enums"]["contribution_reminder_attempt_status_enum"]
          terminal_outcome?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contribution_reminder_delivery_attempts_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "contribution_reminder_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_reminder_delivery_attempts_push_token_id_fkey"
            columns: ["push_token_id"]
            isOneToOne: false
            referencedRelation: "push_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      contribution_reminder_events: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivery_window_on: string
          id: string
          obligation_id: string
          organization_id: string
          recipient_user_id: string
          stage: Database["public"]["Enums"]["contribution_reminder_stage_enum"]
          stage_on: string
          status: Database["public"]["Enums"]["contribution_reminder_event_status_enum"]
          suppression_reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          delivery_window_on: string
          id?: string
          obligation_id: string
          organization_id: string
          recipient_user_id: string
          stage: Database["public"]["Enums"]["contribution_reminder_stage_enum"]
          stage_on: string
          status?: Database["public"]["Enums"]["contribution_reminder_event_status_enum"]
          suppression_reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          delivery_window_on?: string
          id?: string
          obligation_id?: string
          organization_id?: string
          recipient_user_id?: string
          stage?: Database["public"]["Enums"]["contribution_reminder_stage_enum"]
          stage_on?: string
          status?: Database["public"]["Enums"]["contribution_reminder_event_status_enum"]
          suppression_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contribution_reminder_events_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "payment_obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_reminder_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_reminder_events_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contribution_schedules: {
        Row: {
          active: boolean
          admission_date: string
          billing_timezone: string
          cadence: Database["public"]["Enums"]["contribution_cadence_enum"]
          created_at: string
          currency: string
          due_day: number
          id: string
          lead_days: number
          organization_id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          admission_date: string
          billing_timezone: string
          cadence: Database["public"]["Enums"]["contribution_cadence_enum"]
          created_at?: string
          currency: string
          due_day: number
          id?: string
          lead_days: number
          organization_id: string
          user_id: string
        }
        Update: {
          active?: boolean
          admission_date?: string
          billing_timezone?: string
          cadence?: Database["public"]["Enums"]["contribution_cadence_enum"]
          created_at?: string
          currency?: string
          due_day?: number
          id?: string
          lead_days?: number
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contribution_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_schedules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      festival: {
        Row: {
          created_at: string
          end_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          start_at: string
          subtitle: string | null
          timezone: string
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          start_at: string
          subtitle?: string | null
          timezone?: string
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          start_at?: string
          subtitle?: string | null
          timezone?: string
        }
        Relationships: []
      }
      festival_highline: {
        Row: {
          created_at: string
          festival_id: string
          highline_id: string
          slot_duration_minutes: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          festival_id: string
          highline_id: string
          slot_duration_minutes?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          festival_id?: string
          highline_id?: string
          slot_duration_minutes?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "festival_highline_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festival"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_highline_highline_id_fkey"
            columns: ["highline_id"]
            isOneToOne: false
            referencedRelation: "highline"
            referencedColumns: ["id"]
          },
        ]
      }
      festival_schedule_booking: {
        Row: {
          booking_source: string
          cancellation_reason: string | null
          cancellation_source:
            | Database["public"]["Enums"]["festival_schedule_booking_cancellation_source_enum"]
            | null
          cancelled_at: string | null
          cancelled_by_profile_id: string | null
          completed_at: string | null
          created_at: string
          display_name: string | null
          festival_id: string
          highline_id: string
          id: string
          instagram_username: string | null
          profile_id: string | null
          slot_id: string
          status: Database["public"]["Enums"]["festival_schedule_booking_status_enum"]
        }
        Insert: {
          booking_source?: string
          cancellation_reason?: string | null
          cancellation_source?:
            | Database["public"]["Enums"]["festival_schedule_booking_cancellation_source_enum"]
            | null
          cancelled_at?: string | null
          cancelled_by_profile_id?: string | null
          completed_at?: string | null
          created_at?: string
          display_name?: string | null
          festival_id: string
          highline_id: string
          id?: string
          instagram_username?: string | null
          profile_id?: string | null
          slot_id: string
          status?: Database["public"]["Enums"]["festival_schedule_booking_status_enum"]
        }
        Update: {
          booking_source?: string
          cancellation_reason?: string | null
          cancellation_source?:
            | Database["public"]["Enums"]["festival_schedule_booking_cancellation_source_enum"]
            | null
          cancelled_at?: string | null
          cancelled_by_profile_id?: string | null
          completed_at?: string | null
          created_at?: string
          display_name?: string | null
          festival_id?: string
          highline_id?: string
          id?: string
          instagram_username?: string | null
          profile_id?: string | null
          slot_id?: string
          status?: Database["public"]["Enums"]["festival_schedule_booking_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "festival_schedule_booking_cancelled_by_profile_id_fkey"
            columns: ["cancelled_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_schedule_booking_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festival"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_schedule_booking_highline_id_fkey"
            columns: ["highline_id"]
            isOneToOne: false
            referencedRelation: "highline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_schedule_booking_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_schedule_booking_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "festival_schedule_slot"
            referencedColumns: ["id"]
          },
        ]
      }
      festival_schedule_revision: {
        Row: {
          festival_id: string
          updated_at: string
        }
        Insert: {
          festival_id: string
          updated_at?: string
        }
        Update: {
          festival_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "festival_schedule_revision_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: true
            referencedRelation: "festival"
            referencedColumns: ["id"]
          },
        ]
      }
      festival_schedule_slot: {
        Row: {
          block_reason: string | null
          created_at: string
          end_at: string
          festival_id: string
          highline_id: string
          id: string
          start_at: string
          status: Database["public"]["Enums"]["festival_schedule_slot_status_enum"]
          window_id: string
        }
        Insert: {
          block_reason?: string | null
          created_at?: string
          end_at: string
          festival_id: string
          highline_id: string
          id?: string
          start_at: string
          status?: Database["public"]["Enums"]["festival_schedule_slot_status_enum"]
          window_id: string
        }
        Update: {
          block_reason?: string | null
          created_at?: string
          end_at?: string
          festival_id?: string
          highline_id?: string
          id?: string
          start_at?: string
          status?: Database["public"]["Enums"]["festival_schedule_slot_status_enum"]
          window_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "festival_schedule_slot_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festival"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_schedule_slot_festival_id_highline_id_fkey"
            columns: ["festival_id", "highline_id"]
            isOneToOne: false
            referencedRelation: "festival_highline"
            referencedColumns: ["festival_id", "highline_id"]
          },
          {
            foreignKeyName: "festival_schedule_slot_highline_id_fkey"
            columns: ["highline_id"]
            isOneToOne: false
            referencedRelation: "highline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_schedule_slot_window_id_fkey"
            columns: ["window_id"]
            isOneToOne: false
            referencedRelation: "festival_schedule_window"
            referencedColumns: ["id"]
          },
        ]
      }
      festival_schedule_window: {
        Row: {
          created_at: string
          festival_id: string
          highline_id: string
          id: string
          scheduling_opens_at: string
          window_end_at: string
          window_start_at: string
        }
        Insert: {
          created_at?: string
          festival_id: string
          highline_id: string
          id?: string
          scheduling_opens_at: string
          window_end_at: string
          window_start_at: string
        }
        Update: {
          created_at?: string
          festival_id?: string
          highline_id?: string
          id?: string
          scheduling_opens_at?: string
          window_end_at?: string
          window_start_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "festival_schedule_window_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festival"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_schedule_window_festival_id_highline_id_fkey"
            columns: ["festival_id", "highline_id"]
            isOneToOne: false
            referencedRelation: "festival_highline"
            referencedColumns: ["festival_id", "highline_id"]
          },
          {
            foreignKeyName: "festival_schedule_window_highline_id_fkey"
            columns: ["highline_id"]
            isOneToOne: false
            referencedRelation: "highline"
            referencedColumns: ["id"]
          },
        ]
      }
      festival_staff: {
        Row: {
          created_at: string
          festival_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          festival_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          festival_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "festival_staff_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festival"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_staff_profile_id_fkey"
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
      membership_application_revisions: {
        Row: {
          accepted_terms_at: string
          address_line: string | null
          allergies: string | null
          application_id: string
          birth_date: string | null
          birthplace: string | null
          blood_type: Database["public"]["Enums"]["blood_type_enum"] | null
          city: string | null
          cpf: string | null
          created_at: string
          currency: string
          dietary_restrictions: string | null
          draft_version: number
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          first_aid_course:
            | Database["public"]["Enums"]["first_aid_course_enum"]
            | null
          full_name: string | null
          has_allergies: boolean
          has_dietary_restrictions: boolean
          has_rescue_course: boolean | null
          highline_experience:
            | Database["public"]["Enums"]["highline_experience_enum"]
            | null
          id: string
          id_document_issuer: string | null
          id_document_number: string | null
          marital_status:
            | Database["public"]["Enums"]["marital_status_enum"]
            | null
          nationality: string | null
          organization_id: string
          phone: string | null
          pix_copy_paste: string
          plan_amount: number
          plan_type: Database["public"]["Enums"]["subscription_plan_type_enum"]
          postal_code: string | null
          profession: string | null
          revision_number: number
          state: string | null
          submitted_at: string
          terms_version: string
          user_id: string
        }
        Insert: {
          accepted_terms_at: string
          address_line?: string | null
          allergies?: string | null
          application_id: string
          birth_date?: string | null
          birthplace?: string | null
          blood_type?: Database["public"]["Enums"]["blood_type_enum"] | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          currency: string
          dietary_restrictions?: string | null
          draft_version: number
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_aid_course?:
            | Database["public"]["Enums"]["first_aid_course_enum"]
            | null
          full_name?: string | null
          has_allergies: boolean
          has_dietary_restrictions: boolean
          has_rescue_course?: boolean | null
          highline_experience?:
            | Database["public"]["Enums"]["highline_experience_enum"]
            | null
          id?: string
          id_document_issuer?: string | null
          id_document_number?: string | null
          marital_status?:
            | Database["public"]["Enums"]["marital_status_enum"]
            | null
          nationality?: string | null
          organization_id: string
          phone?: string | null
          pix_copy_paste: string
          plan_amount: number
          plan_type: Database["public"]["Enums"]["subscription_plan_type_enum"]
          postal_code?: string | null
          profession?: string | null
          revision_number: number
          state?: string | null
          submitted_at: string
          terms_version: string
          user_id: string
        }
        Update: {
          accepted_terms_at?: string
          address_line?: string | null
          allergies?: string | null
          application_id?: string
          birth_date?: string | null
          birthplace?: string | null
          blood_type?: Database["public"]["Enums"]["blood_type_enum"] | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          currency?: string
          dietary_restrictions?: string | null
          draft_version?: number
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_aid_course?:
            | Database["public"]["Enums"]["first_aid_course_enum"]
            | null
          full_name?: string | null
          has_allergies?: boolean
          has_dietary_restrictions?: boolean
          has_rescue_course?: boolean | null
          highline_experience?:
            | Database["public"]["Enums"]["highline_experience_enum"]
            | null
          id?: string
          id_document_issuer?: string | null
          id_document_number?: string | null
          marital_status?:
            | Database["public"]["Enums"]["marital_status_enum"]
            | null
          nationality?: string | null
          organization_id?: string
          phone?: string | null
          pix_copy_paste?: string
          plan_amount?: number
          plan_type?: Database["public"]["Enums"]["subscription_plan_type_enum"]
          postal_code?: string | null
          profession?: string | null
          revision_number?: number
          state?: string | null
          submitted_at?: string
          terms_version?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_application_revisions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "membership_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_application_revisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_application_revisions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_applications: {
        Row: {
          accepted_terms_at: string | null
          address_line: string | null
          allergies: string | null
          birth_date: string | null
          birthplace: string | null
          blood_type: Database["public"]["Enums"]["blood_type_enum"] | null
          city: string | null
          cpf: string | null
          created_at: string
          dietary_restrictions: string | null
          draft_version: number
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          first_aid_course:
            | Database["public"]["Enums"]["first_aid_course_enum"]
            | null
          full_name: string | null
          has_allergies: boolean
          has_dietary_restrictions: boolean
          has_rescue_course: boolean | null
          highline_experience:
            | Database["public"]["Enums"]["highline_experience_enum"]
            | null
          id: string
          id_document_issuer: string | null
          id_document_number: string | null
          marital_status:
            | Database["public"]["Enums"]["marital_status_enum"]
            | null
          nationality: string | null
          organization_id: string
          phone: string | null
          postal_code: string | null
          profession: string | null
          state: string | null
          status: Database["public"]["Enums"]["membership_application_status_enum"]
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_terms_at?: string | null
          address_line?: string | null
          allergies?: string | null
          birth_date?: string | null
          birthplace?: string | null
          blood_type?: Database["public"]["Enums"]["blood_type_enum"] | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          dietary_restrictions?: string | null
          draft_version?: number
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_aid_course?:
            | Database["public"]["Enums"]["first_aid_course_enum"]
            | null
          full_name?: string | null
          has_allergies?: boolean
          has_dietary_restrictions?: boolean
          has_rescue_course?: boolean | null
          highline_experience?:
            | Database["public"]["Enums"]["highline_experience_enum"]
            | null
          id?: string
          id_document_issuer?: string | null
          id_document_number?: string | null
          marital_status?:
            | Database["public"]["Enums"]["marital_status_enum"]
            | null
          nationality?: string | null
          organization_id: string
          phone?: string | null
          postal_code?: string | null
          profession?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["membership_application_status_enum"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_terms_at?: string | null
          address_line?: string | null
          allergies?: string | null
          birth_date?: string | null
          birthplace?: string | null
          blood_type?: Database["public"]["Enums"]["blood_type_enum"] | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          dietary_restrictions?: string | null
          draft_version?: number
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_aid_course?:
            | Database["public"]["Enums"]["first_aid_course_enum"]
            | null
          full_name?: string | null
          has_allergies?: boolean
          has_dietary_restrictions?: boolean
          has_rescue_course?: boolean | null
          highline_experience?:
            | Database["public"]["Enums"]["highline_experience_enum"]
            | null
          id?: string
          id_document_issuer?: string | null
          id_document_number?: string | null
          marital_status?:
            | Database["public"]["Enums"]["marital_status_enum"]
            | null
          nationality?: string | null
          organization_id?: string
          phone?: string | null
          postal_code?: string | null
          profession?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["membership_application_status_enum"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_applications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          annual_pix_copy_paste: string | null
          annual_price_amount: number | null
          billing_currency: string
          billing_due_day: number
          billing_lead_days: number
          billing_timezone: string
          contribution_reminder_local_time: string
          created_at: string
          id: string
          membership_terms_version: string
          monthly_pix_copy_paste: string | null
          monthly_price_amount: number | null
          name: string
          organization_type: Database["public"]["Enums"]["organization_type_enum"]
          slug: string
        }
        Insert: {
          annual_pix_copy_paste?: string | null
          annual_price_amount?: number | null
          billing_currency?: string
          billing_due_day?: number
          billing_lead_days?: number
          billing_timezone?: string
          contribution_reminder_local_time?: string
          created_at?: string
          id?: string
          membership_terms_version?: string
          monthly_pix_copy_paste?: string | null
          monthly_price_amount?: number | null
          name: string
          organization_type?: Database["public"]["Enums"]["organization_type_enum"]
          slug: string
        }
        Update: {
          annual_pix_copy_paste?: string | null
          annual_price_amount?: number | null
          billing_currency?: string
          billing_due_day?: number
          billing_lead_days?: number
          billing_timezone?: string
          contribution_reminder_local_time?: string
          created_at?: string
          id?: string
          membership_terms_version?: string
          monthly_pix_copy_paste?: string | null
          monthly_price_amount?: number | null
          name?: string
          organization_type?: Database["public"]["Enums"]["organization_type_enum"]
          slug?: string
        }
        Relationships: []
      }
      payment_claim_audit_events: {
        Row: {
          actor_user_id: string
          claim_id: string
          created_at: string
          id: string
          next_state: string
          obligation_id: string
          organization_id: string
          previous_state: string
          reason: string | null
        }
        Insert: {
          actor_user_id: string
          claim_id: string
          created_at?: string
          id?: string
          next_state: string
          obligation_id: string
          organization_id: string
          previous_state: string
          reason?: string | null
        }
        Update: {
          actor_user_id?: string
          claim_id?: string
          created_at?: string
          id?: string
          next_state?: string
          obligation_id?: string
          organization_id?: string
          previous_state?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_claim_audit_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_claim_audit_events_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "payment_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_claim_audit_events_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "payment_obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_claim_audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_claims: {
        Row: {
          claimant_user_id: string
          created_at: string
          decided_at: string | null
          decision_reason: string | null
          id: string
          obligation_id: string
          organization_id: string
          payer_name: string | null
          payer_type: Database["public"]["Enums"]["payment_claim_payer_type_enum"]
          status: Database["public"]["Enums"]["payment_claim_status_enum"]
        }
        Insert: {
          claimant_user_id: string
          created_at?: string
          decided_at?: string | null
          decision_reason?: string | null
          id?: string
          obligation_id: string
          organization_id: string
          payer_name?: string | null
          payer_type: Database["public"]["Enums"]["payment_claim_payer_type_enum"]
          status?: Database["public"]["Enums"]["payment_claim_status_enum"]
        }
        Update: {
          claimant_user_id?: string
          created_at?: string
          decided_at?: string | null
          decision_reason?: string | null
          id?: string
          obligation_id?: string
          organization_id?: string
          payer_name?: string | null
          payer_type?: Database["public"]["Enums"]["payment_claim_payer_type_enum"]
          status?: Database["public"]["Enums"]["payment_claim_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "payment_claims_claimant_user_id_fkey"
            columns: ["claimant_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_claims_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "payment_obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_claims_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_obligations: {
        Row: {
          amount: number
          application_revision_id: string | null
          available_at: string
          available_on: string
          billing_due_day: number | null
          billing_lead_days: number | null
          billing_timezone: string | null
          created_at: string
          currency: string
          due_on: string
          id: string
          legacy_payment_id: string | null
          organization_id: string
          organization_name_snapshot: string | null
          organization_slug_snapshot: string | null
          payment_method: string
          period_end: string
          period_key: string
          period_start: string
          pix_copy_paste: string
          plan_type: Database["public"]["Enums"]["subscription_plan_type_enum"]
          purpose: Database["public"]["Enums"]["payment_obligation_purpose_enum"]
          schedule_id: string | null
          schedule_term_id: string | null
          settled_at: string | null
          status: Database["public"]["Enums"]["payment_obligation_status_enum"]
          user_id: string
        }
        Insert: {
          amount: number
          application_revision_id?: string | null
          available_at: string
          available_on?: string
          billing_due_day?: number | null
          billing_lead_days?: number | null
          billing_timezone?: string | null
          created_at?: string
          currency: string
          due_on?: string
          id?: string
          legacy_payment_id?: string | null
          organization_id: string
          organization_name_snapshot?: string | null
          organization_slug_snapshot?: string | null
          payment_method?: string
          period_end?: string
          period_key?: string
          period_start?: string
          pix_copy_paste: string
          plan_type: Database["public"]["Enums"]["subscription_plan_type_enum"]
          purpose?: Database["public"]["Enums"]["payment_obligation_purpose_enum"]
          schedule_id?: string | null
          schedule_term_id?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["payment_obligation_status_enum"]
          user_id: string
        }
        Update: {
          amount?: number
          application_revision_id?: string | null
          available_at?: string
          available_on?: string
          billing_due_day?: number | null
          billing_lead_days?: number | null
          billing_timezone?: string | null
          created_at?: string
          currency?: string
          due_on?: string
          id?: string
          legacy_payment_id?: string | null
          organization_id?: string
          organization_name_snapshot?: string | null
          organization_slug_snapshot?: string | null
          payment_method?: string
          period_end?: string
          period_key?: string
          period_start?: string
          pix_copy_paste?: string
          plan_type?: Database["public"]["Enums"]["subscription_plan_type_enum"]
          purpose?: Database["public"]["Enums"]["payment_obligation_purpose_enum"]
          schedule_id?: string | null
          schedule_term_id?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["payment_obligation_status_enum"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_obligations_application_revision_id_fkey"
            columns: ["application_revision_id"]
            isOneToOne: false
            referencedRelation: "membership_application_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_obligations_legacy_payment_id_fkey"
            columns: ["legacy_payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_obligations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_obligations_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "contribution_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_obligations_schedule_term_id_fkey"
            columns: ["schedule_term_id"]
            isOneToOne: false
            referencedRelation: "contribution_plan_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_obligations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          abacate_pay_charge_id: string | null
          amount: number
          created_at: string
          id: string
          organization_id: string
          paid_at: string | null
          payment_provider: string | null
          provider_payment_id: string | null
          settlement_applied_at: string | null
          status: Database["public"]["Enums"]["payment_status_enum"]
          subscription_id: string
          user_id: string
          user_marked_paid_at: string | null
        }
        Insert: {
          abacate_pay_charge_id?: string | null
          amount: number
          created_at?: string
          id?: string
          organization_id: string
          paid_at?: string | null
          payment_provider?: string | null
          provider_payment_id?: string | null
          settlement_applied_at?: string | null
          status?: Database["public"]["Enums"]["payment_status_enum"]
          subscription_id: string
          user_id: string
          user_marked_paid_at?: string | null
        }
        Update: {
          abacate_pay_charge_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          organization_id?: string
          paid_at?: string | null
          payment_provider?: string | null
          provider_payment_id?: string | null
          settlement_applied_at?: string | null
          status?: Database["public"]["Enums"]["payment_status_enum"]
          subscription_id?: string
          user_id?: string
          user_marked_paid_at?: string | null
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
          strength_class:
            | Database["public"]["Enums"]["strength_class_enum"]
            | null
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
          strength_class?:
            | Database["public"]["Enums"]["strength_class_enum"]
            | null
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
          strength_class?:
            | Database["public"]["Enums"]["strength_class_enum"]
            | null
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
      apply_payment_settlement_effects: {
        Args: { p_payment_id: string }
        Returns: boolean
      }
      approve_initial_claim: {
        Args: { p_claim_id: string }
        Returns: {
          audit_event_id: string
          claim_id: string
          claim_status: Database["public"]["Enums"]["payment_claim_status_enum"]
          decision_applied_now: boolean
          membership_user_id: string
          obligation_id: string
          obligation_status: Database["public"]["Enums"]["payment_obligation_status_enum"]
          subscription_current_period_end: string
          subscription_id: string
          subscription_status: Database["public"]["Enums"]["subscription_status_enum"]
        }[]
      }
      approve_recurring_payment_claim: {
        Args: { p_claim_id: string }
        Returns: {
          audit_event_id: string
          claim_id: string
          claim_status: Database["public"]["Enums"]["payment_claim_status_enum"]
          decision_applied_now: boolean
          obligation_id: string
          obligation_status: Database["public"]["Enums"]["payment_obligation_status_enum"]
        }[]
      }
      book_festival_schedule_slot: {
        Args: {
          target_display_name?: string
          target_instagram_username?: string
          target_profile_id?: string
          target_slot_id: string
        }
        Returns: {
          booking_source: string
          cancellation_reason: string | null
          cancellation_source:
            | Database["public"]["Enums"]["festival_schedule_booking_cancellation_source_enum"]
            | null
          cancelled_at: string | null
          cancelled_by_profile_id: string | null
          completed_at: string | null
          created_at: string
          display_name: string | null
          festival_id: string
          highline_id: string
          id: string
          instagram_username: string | null
          profile_id: string | null
          slot_id: string
          status: Database["public"]["Enums"]["festival_schedule_booking_status_enum"]
        }
        SetofOptions: {
          from: "*"
          to: "festival_schedule_booking"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_festival_schedule_booking: {
        Args: { cancellation_reason_input: string; target_booking_id: string }
        Returns: {
          booking_source: string
          cancellation_reason: string | null
          cancellation_source:
            | Database["public"]["Enums"]["festival_schedule_booking_cancellation_source_enum"]
            | null
          cancelled_at: string | null
          cancelled_by_profile_id: string | null
          completed_at: string | null
          created_at: string
          display_name: string | null
          festival_id: string
          highline_id: string
          id: string
          instagram_username: string | null
          profile_id: string | null
          slot_id: string
          status: Database["public"]["Enums"]["festival_schedule_booking_status_enum"]
        }
        SetofOptions: {
          from: "*"
          to: "festival_schedule_booking"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_contribution_reminder_batches: {
        Args: { p_lease_seconds?: number; p_limit?: number }
        Returns: {
          batch_id: string
          lease_token: string
        }[]
      }
      claim_contribution_reminder_receipts: {
        Args: { p_lease_seconds?: number; p_limit?: number }
        Returns: {
          attempt_id: string
          batch_id: string
          expo_ticket_id: string
          lease_token: string
        }[]
      }
      claim_initial_payment: {
        Args: {
          p_obligation_id: string
          p_paid_by_applicant: boolean
          p_payer_name?: string
        }
        Returns: {
          audit_event_id: string
          claim_created_at: string
          claim_id: string
          claim_status: Database["public"]["Enums"]["payment_claim_status_enum"]
          obligation_id: string
          payer_name: string
          payer_type: Database["public"]["Enums"]["payment_claim_payer_type_enum"]
        }[]
      }
      claim_recurring_payment: {
        Args: {
          p_obligation_id: string
          p_paid_by_applicant: boolean
          p_payer_name?: string
        }
        Returns: {
          audit_event_id: string
          claim_created_at: string
          claim_id: string
          claim_status: Database["public"]["Enums"]["payment_claim_status_enum"]
          obligation_id: string
          payer_name: string
          payer_type: Database["public"]["Enums"]["payment_claim_payer_type_enum"]
        }[]
      }
      clamped_billing_date: {
        Args: { p_day: number; p_month: number; p_year: number }
        Returns: string
      }
      contribution_reminder_backoff: {
        Args: { p_attempt_count: number }
        Returns: unknown
      }
      contribution_reminder_delivery_at: {
        Args: { p_local_time: string; p_stage_on: string; p_timezone: string }
        Returns: string
      }
      contribution_reminder_stage_for_date: {
        Args: { p_available_on: string; p_due_on: string; p_local_date: string }
        Returns: Database["public"]["Enums"]["contribution_reminder_stage_enum"]
      }
      enqueue_contribution_reminder_events: {
        Args: never
        Returns: {
          coalesced_count: number
          created_count: number
          skipped_count: number
          suppressed_count: number
        }[]
      }
      enqueue_contribution_reminder_events_at: {
        Args: { p_as_of: string }
        Returns: {
          coalesced_count: number
          created_count: number
          skipped_count: number
          suppressed_count: number
        }[]
      }
      enqueue_festival_schedule_open_notifications: {
        Args: never
        Returns: number
      }
      ensure_contribution_schedule: {
        Args: {
          p_admission_date?: string
          p_organization_id: string
          p_user_id: string
        }
        Returns: string
      }
      first_recurring_due_date: {
        Args: {
          p_admission_date: string
          p_cadence: Database["public"]["Enums"]["contribution_cadence_enum"]
          p_due_day: number
        }
        Returns: string
      }
      generate_membership_billing_obligations:
        | {
            Args: never
            Returns: {
              failure_reason: string
              obligation_id: string
              period_key: string
              result: string
              schedule_id: string
            }[]
          }
        | {
            Args: { p_as_of?: string }
            Returns: {
              failure_reason: string
              obligation_id: string
              period_key: string
              result: string
              schedule_id: string
            }[]
          }
      generate_membership_billing_obligations_at: {
        Args: { p_as_of: string }
        Returns: {
          failure_reason: string
          obligation_id: string
          period_key: string
          result: string
          schedule_id: string
        }[]
      }
      get_billing_workspace_claim_detail: {
        Args: { p_claim_id: string }
        Returns: {
          amount: number
          approve_command: string
          attempt_count: number
          audit_history: Json
          available_on: string
          claim_created_at: string
          claim_decided_at: string
          claim_decision_reason: string
          claim_history: Json
          claim_id: string
          claim_status: Database["public"]["Enums"]["payment_claim_status_enum"]
          currency: string
          due_on: string
          member_handle: string
          member_name: string
          member_profile_picture: string
          member_user_id: string
          obligation_id: string
          organization_id: string
          organization_name: string
          organization_slug: string
          payer_name: string
          payer_type: Database["public"]["Enums"]["payment_claim_payer_type_enum"]
          period_end: string
          period_key: string
          period_start: string
          plan_type: Database["public"]["Enums"]["subscription_plan_type_enum"]
          purpose: Database["public"]["Enums"]["payment_obligation_purpose_enum"]
          reject_command: string
        }[]
      }
      get_billing_workspace_members: {
        Args: { p_organization_id: string }
        Returns: {
          financial_standing: string
          joined_at: string
          last_verified_contribution_at: string
          member_handle: string
          member_name: string
          member_profile_picture: string
          member_role: Database["public"]["Enums"]["organization_role_enum"]
          member_user_id: string
          next_due_on: string
          oldest_attention_due_on: string
          overdue_count: number
          plan_type: Database["public"]["Enums"]["subscription_plan_type_enum"]
        }[]
      }
      get_billing_workspace_organizations: {
        Args: never
        Returns: {
          organization_id: string
          organization_name: string
          organization_slug: string
        }[]
      }
      get_billing_workspace_payments: {
        Args: { p_organization_id: string }
        Returns: {
          amount: number
          audit_history: Json
          available_on: string
          claim_history: Json
          currency: string
          due_on: string
          effective_payment_state: string
          last_decision_actor_name: string
          last_decision_actor_user_id: string
          last_decision_at: string
          latest_claim_created_at: string
          latest_claim_decided_at: string
          latest_claim_decision_reason: string
          latest_claim_id: string
          latest_claim_status: Database["public"]["Enums"]["payment_claim_status_enum"]
          member_handle: string
          member_name: string
          member_user_id: string
          obligation_id: string
          obligation_status: Database["public"]["Enums"]["payment_obligation_status_enum"]
          organization_id: string
          period_end: string
          period_key: string
          period_start: string
          plan_type: Database["public"]["Enums"]["subscription_plan_type_enum"]
          purpose: Database["public"]["Enums"]["payment_obligation_purpose_enum"]
          settled_at: string
        }[]
      }
      get_billing_workspace_queue: {
        Args: { p_organization_id: string }
        Returns: {
          amount: number
          approve_command: string
          attempt_count: number
          available_on: string
          claim_created_at: string
          claim_decided_at: string
          claim_decision_reason: string
          claim_id: string
          claim_status: Database["public"]["Enums"]["payment_claim_status_enum"]
          currency: string
          due_on: string
          member_handle: string
          member_name: string
          member_profile_picture: string
          member_user_id: string
          obligation_id: string
          organization_id: string
          payer_name: string
          payer_type: Database["public"]["Enums"]["payment_claim_payer_type_enum"]
          period_end: string
          period_key: string
          period_start: string
          plan_type: Database["public"]["Enums"]["subscription_plan_type_enum"]
          purpose: Database["public"]["Enums"]["payment_obligation_purpose_enum"]
          reject_command: string
        }[]
      }
      get_crossing_time: {
        Args: { highline_id: string; page_number: number; page_size: number }
        Returns: {
          crossing_time: number
          instagram: string
          profile_picture: string
        }[]
      }
      get_festival_schedule_booking_cooldown_ends_at: {
        Args: { target_festival_id: string }
        Returns: string
      }
      get_festival_schedule_booking_cooldown_seconds: {
        Args: never
        Returns: number
      }
      get_festival_schedule_booking_limit: { Args: never; Returns: number }
      get_festival_schedule_bookings: {
        Args: { target_festival_id: string }
        Returns: {
          completed_at: string
          created_at: string
          festival_id: string
          highline_id: string
          id: string
          is_viewer: boolean
          participant_display_name: string
          participant_secondary_text: string
          slot_id: string
          status: Database["public"]["Enums"]["festival_schedule_booking_status_enum"]
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
      get_initial_payment_claim_detail: {
        Args: { p_claim_id: string }
        Returns: {
          accepted_terms_at: string
          address_line: string
          allergies: string
          amount: number
          applicant_handle: string
          applicant_name: string
          applicant_profile_picture: string
          application_id: string
          application_revision_id: string
          attempt_count: number
          audit_history: Json
          birth_date: string
          birthplace: string
          blood_type: Database["public"]["Enums"]["blood_type_enum"]
          city: string
          claim_created_at: string
          claim_history: Json
          claim_id: string
          claim_status: Database["public"]["Enums"]["payment_claim_status_enum"]
          claimant_user_id: string
          cpf: string
          currency: string
          decided_at: string
          decision_reason: string
          dietary_restrictions: string
          draft_version: number
          email: string
          emergency_contact_name: string
          emergency_contact_phone: string
          emergency_contact_relationship: string
          first_aid_course: Database["public"]["Enums"]["first_aid_course_enum"]
          full_name: string
          has_allergies: boolean
          has_dietary_restrictions: boolean
          has_rescue_course: boolean
          highline_experience: Database["public"]["Enums"]["highline_experience_enum"]
          id_document_issuer: string
          id_document_number: string
          marital_status: Database["public"]["Enums"]["marital_status_enum"]
          nationality: string
          obligation_id: string
          organization_id: string
          organization_name: string
          organization_slug: string
          payer_name: string
          payer_type: Database["public"]["Enums"]["payment_claim_payer_type_enum"]
          phone: string
          plan_type: Database["public"]["Enums"]["subscription_plan_type_enum"]
          postal_code: string
          profession: string
          revision_number: number
          state: string
          submitted_at: string
          terms_version: string
        }[]
      }
      get_initial_payment_claim_queue: {
        Args: never
        Returns: {
          amount: number
          applicant_handle: string
          applicant_name: string
          applicant_profile_picture: string
          application_revision_id: string
          attempt_count: number
          claim_created_at: string
          claim_id: string
          claim_status: Database["public"]["Enums"]["payment_claim_status_enum"]
          claimant_user_id: string
          currency: string
          obligation_id: string
          organization_id: string
          organization_name: string
          payer_name: string
          payer_type: Database["public"]["Enums"]["payment_claim_payer_type_enum"]
          plan_type: Database["public"]["Enums"]["subscription_plan_type_enum"]
        }[]
      }
      get_manual_payment_instructions: {
        Args: { p_payment_id: string }
        Returns: {
          amount: number
          payment_id: string
          pix_copy_paste: string
          status: Database["public"]["Enums"]["payment_status_enum"]
          user_marked_paid_at: string
        }[]
      }
      get_membership_billing_ledger: {
        Args: {
          p_history_cursor?: string
          p_history_limit?: number
          p_organization_id: string
        }
        Returns: Json
      }
      get_membership_billing_ledger_legacy: {
        Args: {
          p_history_cursor?: string
          p_history_limit?: number
          p_organization_id: string
        }
        Returns: Json
      }
      get_payment_obligation_instructions: {
        Args: { p_obligation_id: string }
        Returns: {
          amount: number
          available_at: string
          available_on: string
          claim_created_at: string
          claim_decision_reason: string
          claim_id: string
          claim_status: Database["public"]["Enums"]["payment_claim_status_enum"]
          currency: string
          due_on: string
          obligation_id: string
          organization_id: string
          payer_name: string
          payer_type: Database["public"]["Enums"]["payment_claim_payer_type_enum"]
          payment_method: string
          period_key: string
          pix_copy_paste: string
          plan_type: Database["public"]["Enums"]["subscription_plan_type_enum"]
          purpose: Database["public"]["Enums"]["payment_obligation_purpose_enum"]
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
      is_festival_staff: {
        Args: { target_festival_id: string; target_profile_id: string }
        Returns: boolean
      }
      is_valid_billing_timezone: {
        Args: { p_timezone: string }
        Returns: boolean
      }
      mark_manual_payment_paid_by_user: {
        Args: { p_payment_id: string }
        Returns: {
          payment_id: string
          status: Database["public"]["Enums"]["payment_status_enum"]
          user_marked_paid_at: string
        }[]
      }
      mark_payment_succeeded_manually: {
        Args: { p_paid_at?: string; p_payment_id: string }
        Returns: {
          applied_effects_now: boolean
          paid_at: string
          payment_id: string
          previous_status: Database["public"]["Enums"]["payment_status_enum"]
          settlement_applied_at: string
          status: Database["public"]["Enums"]["payment_status_enum"]
        }[]
      }
      next_recurring_due_date: {
        Args: {
          p_cadence: Database["public"]["Enums"]["contribution_cadence_enum"]
          p_due_date: string
          p_due_day: number
        }
        Returns: string
      }
      normalize_festival_instagram_username: {
        Args: { value: string }
        Returns: string
      }
      normalize_profile_username: { Args: { value: string }; Returns: string }
      prepare_contribution_reminder_batch: {
        Args: {
          p_batch_id: string
          p_lease_seconds?: number
          p_lease_token: string
        }
        Returns: {
          batch_id: string
          delivery_attempts: Json
          delivery_window_on: string
          organization_slug: string
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
      profile_username_disambiguated: {
        Args: { normalized_username: string; profile_id: string }
        Returns: string
      }
      reconcile_festival_schedule: {
        Args: { festival_slug?: string }
        Returns: undefined
      }
      reconcile_festival_schedule_by_id: {
        Args: { target_festival_id?: string }
        Returns: undefined
      }
      reconcile_legacy_payment_obligations: {
        Args: { p_apply?: boolean }
        Returns: {
          obligation_id: string
          payment_id: string
          payment_status: Database["public"]["Enums"]["payment_status_enum"]
          reason: string
          result: string
        }[]
      }
      record_contribution_reminder_receipts: {
        Args: { p_receipts: Json }
        Returns: number
      }
      record_contribution_reminder_send_failure: {
        Args: {
          p_batch_id: string
          p_failure_code: string
          p_lease_token: string
        }
        Returns: number
      }
      record_contribution_reminder_tickets: {
        Args: { p_batch_id: string; p_lease_token: string; p_tickets: Json }
        Returns: number
      }
      recurring_due_date_on_or_after: {
        Args: {
          p_admission_date: string
          p_cadence: Database["public"]["Enums"]["contribution_cadence_enum"]
          p_due_day: number
          p_from_date: string
        }
        Returns: string
      }
      recurring_period_key: {
        Args: {
          p_cadence: Database["public"]["Enums"]["contribution_cadence_enum"]
          p_due_date: string
        }
        Returns: string
      }
      refresh_contribution_reminder_batch: {
        Args: { p_batch_id: string }
        Returns: undefined
      }
      regenerate_festival_schedule_window: {
        Args: { target_window_id: string }
        Returns: number
      }
      register_push_token: {
        Args: {
          p_language?: Database["public"]["Enums"]["language"]
          p_token: string
        }
        Returns: string
      }
      reject_initial_claim: {
        Args: { p_claim_id: string; p_reason: string }
        Returns: {
          audit_event_id: string
          claim_id: string
          claim_status: Database["public"]["Enums"]["payment_claim_status_enum"]
          decision_applied_now: boolean
          decision_reason: string
          obligation_id: string
          obligation_status: Database["public"]["Enums"]["payment_obligation_status_enum"]
        }[]
      }
      reject_recurring_payment_claim: {
        Args: { p_claim_id: string; p_reason: string }
        Returns: {
          audit_event_id: string
          claim_id: string
          claim_status: Database["public"]["Enums"]["payment_claim_status_enum"]
          decision_applied_now: boolean
          decision_reason: string
          obligation_id: string
          obligation_status: Database["public"]["Enums"]["payment_obligation_status_enum"]
        }[]
      }
      schedule_contribution_plan_change: {
        Args: {
          p_effective_period_start: string
          p_plan_type: Database["public"]["Enums"]["subscription_plan_type_enum"]
          p_schedule_id: string
        }
        Returns: string
      }
      submit_association_application: {
        Args: {
          p_application_id: string
          p_draft_version: number
          p_organization_id: string
          p_plan_type: Database["public"]["Enums"]["subscription_plan_type_enum"]
          p_terms_version: string
        }
        Returns: {
          amount: number
          application_revision_id: string
          available_at: string
          currency: string
          obligation_id: string
          obligation_status: Database["public"]["Enums"]["payment_obligation_status_enum"]
          organization_id: string
          payment_method: string
          plan_type: Database["public"]["Enums"]["subscription_plan_type_enum"]
        }[]
      }
      submit_membership_application: {
        Args: { p_application_id: string }
        Returns: {
          id: string
          organization_id: string
          status: Database["public"]["Enums"]["membership_application_status_enum"]
          submitted_at: string
          user_id: string
        }[]
      }
      unregister_push_token: { Args: { p_token: string }; Returns: boolean }
      validate_locale_keys: { Args: { json_data: Json }; Returns: boolean }
    }
    Enums: {
      blood_type_enum:
        | "a_pos"
        | "a_neg"
        | "b_pos"
        | "b_neg"
        | "ab_pos"
        | "ab_neg"
        | "o_pos"
        | "o_neg"
      contribution_cadence_enum: "monthly" | "annual"
      contribution_reminder_attempt_status_enum:
        | "pending"
        | "leased"
        | "ticketed"
        | "retryable"
        | "delivered"
        | "terminal"
      contribution_reminder_batch_status_enum:
        | "pending"
        | "leased"
        | "awaiting_receipts"
        | "retryable"
        | "delivered"
        | "no_device"
        | "terminal"
        | "suppressed"
      contribution_reminder_event_status_enum:
        | "pending"
        | "delivered"
        | "coalesced"
        | "suppressed"
        | "no_device"
        | "exhausted"
      contribution_reminder_stage_enum: "available" | "due" | "overdue"
      festival_schedule_booking_cancellation_source_enum:
        | "user"
        | "staff"
        | "slot_blocked"
      festival_schedule_booking_status_enum:
        | "booked"
        | "cancelled"
        | "completed"
      festival_schedule_slot_status_enum: "available" | "blocked" | "expired"
      first_aid_course_enum: "updated" | "outdated" | "none"
      highline_experience_enum: "beginner" | "athlete" | "professional"
      language: "en" | "pt"
      marital_status_enum:
        | "single"
        | "married"
        | "divorced"
        | "widowed"
        | "legally_separated"
        | "common_law"
      material_enum: "nylon" | "dyneema" | "polyester"
      membership_application_status_enum: "draft" | "submitted"
      organization_role_enum: "admin" | "member"
      organization_type_enum: "group" | "association"
      payment_claim_payer_type_enum: "applicant" | "other"
      payment_claim_status_enum: "under_review" | "approved" | "rejected"
      payment_obligation_purpose_enum: "initial_admission" | "recurring"
      payment_obligation_status_enum: "available" | "settled" | "void"
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
          metadata: Json | null
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
          metadata?: Json | null
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
          metadata?: Json | null
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
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
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
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
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
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
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
      blood_type_enum: [
        "a_pos",
        "a_neg",
        "b_pos",
        "b_neg",
        "ab_pos",
        "ab_neg",
        "o_pos",
        "o_neg",
      ],
      contribution_cadence_enum: ["monthly", "annual"],
      contribution_reminder_attempt_status_enum: [
        "pending",
        "leased",
        "ticketed",
        "retryable",
        "delivered",
        "terminal",
      ],
      contribution_reminder_batch_status_enum: [
        "pending",
        "leased",
        "awaiting_receipts",
        "retryable",
        "delivered",
        "no_device",
        "terminal",
        "suppressed",
      ],
      contribution_reminder_event_status_enum: [
        "pending",
        "delivered",
        "coalesced",
        "suppressed",
        "no_device",
        "exhausted",
      ],
      contribution_reminder_stage_enum: ["available", "due", "overdue"],
      festival_schedule_booking_cancellation_source_enum: [
        "user",
        "staff",
        "slot_blocked",
      ],
      festival_schedule_booking_status_enum: [
        "booked",
        "cancelled",
        "completed",
      ],
      festival_schedule_slot_status_enum: ["available", "blocked", "expired"],
      first_aid_course_enum: ["updated", "outdated", "none"],
      highline_experience_enum: ["beginner", "athlete", "professional"],
      language: ["en", "pt"],
      marital_status_enum: [
        "single",
        "married",
        "divorced",
        "widowed",
        "legally_separated",
        "common_law",
      ],
      material_enum: ["nylon", "dyneema", "polyester"],
      membership_application_status_enum: ["draft", "submitted"],
      organization_role_enum: ["admin", "member"],
      organization_type_enum: ["group", "association"],
      payment_claim_payer_type_enum: ["applicant", "other"],
      payment_claim_status_enum: ["under_review", "approved", "rejected"],
      payment_obligation_purpose_enum: ["initial_admission", "recurring"],
      payment_obligation_status_enum: ["available", "settled", "void"],
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
