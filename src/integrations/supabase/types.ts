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
      config_values: {
        Row: {
          active: boolean
          category: string
          created_at: string
          display_order: number
          id: string
          name: string
          points: number
          tier: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          display_order?: number
          id?: string
          name: string
          points?: number
          tier?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          points?: number
          tier?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      discord_role_cache: {
        Row: {
          discord_id: string
          guild_id: string
          nickname: string | null
          refreshed_at: string
          role_ids: string[]
        }
        Insert: {
          discord_id: string
          guild_id: string
          nickname?: string | null
          refreshed_at?: string
          role_ids?: string[]
        }
        Update: {
          discord_id?: string
          guild_id?: string
          nickname?: string | null
          refreshed_at?: string
          role_ids?: string[]
        }
        Relationships: []
      }
      donation_lines: {
        Row: {
          config_value_id: string | null
          created_at: string
          donation_id: string
          id: string
          label: string
          line_type: string
          quantity: number
          subtotal: number
          unit_points: number
        }
        Insert: {
          config_value_id?: string | null
          created_at?: string
          donation_id: string
          id?: string
          label: string
          line_type: string
          quantity?: number
          subtotal?: number
          unit_points?: number
        }
        Update: {
          config_value_id?: string | null
          created_at?: string
          donation_id?: string
          id?: string
          label?: string
          line_type?: string
          quantity?: number
          subtotal?: number
          unit_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "donation_lines_config_value_id_fkey"
            columns: ["config_value_id"]
            isOneToOne: false
            referencedRelation: "config_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_lines_donation_id_fkey"
            columns: ["donation_id"]
            isOneToOne: false
            referencedRelation: "donations"
            referencedColumns: ["id"]
          },
        ]
      }
      donations: {
        Row: {
          bonus_pct: number
          cancelled_at: string | null
          created_at: string
          expires_at: string
          id: string
          member_discord_id: string | null
          staff_discord_id: string
          staff_username: string | null
          status: string
          total_brut: number
          total_final: number
          updated_at: string
          validated_at: string | null
        }
        Insert: {
          bonus_pct?: number
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          member_discord_id?: string | null
          staff_discord_id: string
          staff_username?: string | null
          status?: string
          total_brut?: number
          total_final?: number
          updated_at?: string
          validated_at?: string | null
        }
        Update: {
          bonus_pct?: number
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          member_discord_id?: string | null
          staff_discord_id?: string
          staff_username?: string | null
          status?: string
          total_brut?: number
          total_final?: number
          updated_at?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donations_member_discord_id_fkey"
            columns: ["member_discord_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["discord_id"]
          },
        ]
      }
      logs: {
        Row: {
          action: string
          actor_discord_id: string | null
          created_at: string
          id: string
          level: string
          payload: Json | null
        }
        Insert: {
          action: string
          actor_discord_id?: string | null
          created_at?: string
          id?: string
          level?: string
          payload?: Json | null
        }
        Update: {
          action?: string
          actor_discord_id?: string | null
          created_at?: string
          id?: string
          level?: string
          payload?: Json | null
        }
        Relationships: []
      }
      member_alts: {
        Row: {
          alt_discord_id: string | null
          alt_name: string | null
          created_at: string
          id: string
          member_discord_id: string
        }
        Insert: {
          alt_discord_id?: string | null
          alt_name?: string | null
          created_at?: string
          id?: string
          member_discord_id: string
        }
        Update: {
          alt_discord_id?: string | null
          alt_name?: string | null
          created_at?: string
          id?: string
          member_discord_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_alts_member_discord_id_fkey"
            columns: ["member_discord_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["discord_id"]
          },
        ]
      }
      members: {
        Row: {
          arrival_date: string | null
          astik_points: number
          avatar_url: string | null
          created_at: string
          current_grade: string | null
          discord_id: string
          discord_username: string | null
          ig_name: string | null
          last_rankup: string | null
          messages_7d: number
          messages_total: number
          recruiter_discord_id: string | null
          status: string
          updated_at: string
          voice_7d_seconds: number
          voice_total_seconds: number
        }
        Insert: {
          arrival_date?: string | null
          astik_points?: number
          avatar_url?: string | null
          created_at?: string
          current_grade?: string | null
          discord_id: string
          discord_username?: string | null
          ig_name?: string | null
          last_rankup?: string | null
          messages_7d?: number
          messages_total?: number
          recruiter_discord_id?: string | null
          status?: string
          updated_at?: string
          voice_7d_seconds?: number
          voice_total_seconds?: number
        }
        Update: {
          arrival_date?: string | null
          astik_points?: number
          avatar_url?: string | null
          created_at?: string
          current_grade?: string | null
          discord_id?: string
          discord_username?: string | null
          ig_name?: string | null
          last_rankup?: string | null
          messages_7d?: number
          messages_total?: number
          recruiter_discord_id?: string | null
          status?: string
          updated_at?: string
          voice_7d_seconds?: number
          voice_total_seconds?: number
        }
        Relationships: []
      }
      notes: {
        Row: {
          body: string
          created_at: string
          id: string
          member_discord_id: string
          staff_discord_id: string
          staff_username: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          member_discord_id: string
          staff_discord_id: string
          staff_username?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          member_discord_id?: string
          staff_discord_id?: string
          staff_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_member_discord_id_fkey"
            columns: ["member_discord_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["discord_id"]
          },
        ]
      }
      objectives: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          done: boolean
          done_at: string | null
          done_by_discord_id: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          done?: boolean
          done_at?: string | null
          done_by_discord_id?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          done?: boolean
          done_at?: string | null
          done_by_discord_id?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      points_ledger: {
        Row: {
          action_type: string
          amount: number
          bonus_pct: number | null
          created_at: string
          id: string
          member_discord_id: string
          reason: string | null
          staff_discord_id: string
          staff_username: string | null
          total_after: number
        }
        Insert: {
          action_type: string
          amount: number
          bonus_pct?: number | null
          created_at?: string
          id?: string
          member_discord_id: string
          reason?: string | null
          staff_discord_id: string
          staff_username?: string | null
          total_after: number
        }
        Update: {
          action_type?: string
          amount?: number
          bonus_pct?: number | null
          created_at?: string
          id?: string
          member_discord_id?: string
          reason?: string | null
          staff_discord_id?: string
          staff_username?: string | null
          total_after?: number
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_member_discord_id_fkey"
            columns: ["member_discord_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["discord_id"]
          },
        ]
      }
      warnings: {
        Row: {
          body: string
          created_at: string
          id: string
          member_discord_id: string
          staff_discord_id: string
          staff_username: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          member_discord_id: string
          staff_discord_id: string
          staff_username?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          member_discord_id?: string
          staff_discord_id?: string
          staff_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warnings_member_discord_id_fkey"
            columns: ["member_discord_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["discord_id"]
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
