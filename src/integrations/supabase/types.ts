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
  public: {
    Tables: {
      daily_checkins: {
        Row: {
          checkin_date: string
          created_at: string
          dhikr_done: boolean
          dua_done: boolean
          id: string
          quran_done: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          checkin_date?: string
          created_at?: string
          dhikr_done?: boolean
          dua_done?: boolean
          id?: string
          quran_done?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          checkin_date?: string
          created_at?: string
          dhikr_done?: boolean
          dua_done?: boolean
          id?: string
          quran_done?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dhikr_sessions: {
        Row: {
          count: number
          created_at: string
          dhikr_name: string
          id: string
          session_date: string
          target: number
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          dhikr_name: string
          id?: string
          session_date?: string
          target?: number
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          dhikr_name?: string
          id?: string
          session_date?: string
          target?: number
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          category: string
          created_at: string
          done: boolean
          id: string
          progress: number
          target: number
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          done?: boolean
          id?: string
          progress?: number
          target?: number
          title: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          done?: boolean
          id?: string
          progress?: number
          target?: number
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          content: string
          created_at: string
          entry_date: string
          id: string
          mood: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          entry_date?: string
          id?: string
          mood?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          entry_date?: string
          id?: string
          mood?: string | null
          user_id?: string
        }
        Relationships: []
      }
      prayer_logs: {
        Row: {
          completed: boolean
          completed_at: string
          id: string
          prayer_date: string
          prayer_name: string
          status: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string
          id?: string
          prayer_date?: string
          prayer_name: string
          status?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string
          id?: string
          prayer_date?: string
          prayer_name?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      prayer_settings: {
        Row: {
          asr_offset: number
          city: string | null
          country: string | null
          dhuhr_offset: number
          fajr_offset: number
          isha_offset: number
          latitude: number | null
          longitude: number | null
          maghrib_offset: number
          method: string
          notifications: boolean
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asr_offset?: number
          city?: string | null
          country?: string | null
          dhuhr_offset?: number
          fajr_offset?: number
          isha_offset?: number
          latitude?: number | null
          longitude?: number | null
          maghrib_offset?: number
          method?: string
          notifications?: boolean
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asr_offset?: number
          city?: string | null
          country?: string | null
          dhuhr_offset?: number
          fajr_offset?: number
          isha_offset?: number
          latitude?: number | null
          longitude?: number | null
          maghrib_offset?: number
          method?: string
          notifications?: boolean
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          country: string | null
          created_at: string
          display_name: string | null
          full_name: string | null
          id: string
          preferred_method: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id: string
          preferred_method?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id?: string
          preferred_method?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      quran_bookmarks: {
        Row: {
          ayah: number
          created_at: string
          id: string
          note: string | null
          surah: number
          user_id: string
        }
        Insert: {
          ayah?: number
          created_at?: string
          id?: string
          note?: string | null
          surah: number
          user_id: string
        }
        Update: {
          ayah?: number
          created_at?: string
          id?: string
          note?: string | null
          surah?: number
          user_id?: string
        }
        Relationships: []
      }
      quran_progress: {
        Row: {
          ayah: number
          created_at: string
          id: string
          minutes_read: number
          read_date: string
          surah: number
          user_id: string
        }
        Insert: {
          ayah?: number
          created_at?: string
          id?: string
          minutes_read?: number
          read_date?: string
          surah: number
          user_id: string
        }
        Update: {
          ayah?: number
          created_at?: string
          id?: string
          minutes_read?: number
          read_date?: string
          surah?: number
          user_id?: string
        }
        Relationships: []
      }
      quran_reading_state: {
        Row: {
          ayah: number
          surah: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ayah?: number
          surah?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ayah?: number
          surah?: number
          updated_at?: string
          user_id?: string
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
  public: {
    Enums: {},
  },
} as const
