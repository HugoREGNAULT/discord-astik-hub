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
      absences: {
        Row: {
          created_at: string
          created_by_discord_id: string
          created_by_username: string | null
          ends_on: string
          id: string
          member_discord_id: string
          reason: string | null
          starts_on: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_discord_id: string
          created_by_username?: string | null
          ends_on: string
          id?: string
          member_discord_id: string
          reason?: string | null
          starts_on: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_discord_id?: string
          created_by_username?: string | null
          ends_on?: string
          id?: string
          member_discord_id?: string
          reason?: string | null
          starts_on?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          age: number
          country: string
          created_at: string
          decided_at: string | null
          decided_by_discord_id: string | null
          decided_by_username: string | null
          decision_reason: string | null
          discord_id: string
          discord_username: string
          first_version: string
          heard_from: string
          id: string
          ig_grade: string
          knowledge_level: number
          mc_name: string
          presentation: string
          previous_factions: string | null
          schedule: string
          skills: string
          status: string
          updated_at: string
          weekly_playtime: string
        }
        Insert: {
          age: number
          country: string
          created_at?: string
          decided_at?: string | null
          decided_by_discord_id?: string | null
          decided_by_username?: string | null
          decision_reason?: string | null
          discord_id: string
          discord_username: string
          first_version: string
          heard_from: string
          id?: string
          ig_grade: string
          knowledge_level: number
          mc_name: string
          presentation: string
          previous_factions?: string | null
          schedule: string
          skills: string
          status?: string
          updated_at?: string
          weekly_playtime: string
        }
        Update: {
          age?: number
          country?: string
          created_at?: string
          decided_at?: string | null
          decided_by_discord_id?: string | null
          decided_by_username?: string | null
          decision_reason?: string | null
          discord_id?: string
          discord_username?: string
          first_version?: string
          heard_from?: string
          id?: string
          ig_grade?: string
          knowledge_level?: number
          mc_name?: string
          presentation?: string
          previous_factions?: string | null
          schedule?: string
          skills?: string
          status?: string
          updated_at?: string
          weekly_playtime?: string
        }
        Relationships: []
      }
      blacklist: {
        Row: {
          added_by_discord_id: string
          added_by_username: string | null
          created_at: string
          discord_id: string | null
          id: string
          mc_name: string | null
          mc_uuid: string | null
          reason: string
          updated_at: string
        }
        Insert: {
          added_by_discord_id: string
          added_by_username?: string | null
          created_at?: string
          discord_id?: string | null
          id?: string
          mc_name?: string | null
          mc_uuid?: string | null
          reason?: string
          updated_at?: string
        }
        Update: {
          added_by_discord_id?: string
          added_by_username?: string | null
          created_at?: string
          discord_id?: string | null
          id?: string
          mc_name?: string | null
          mc_uuid?: string | null
          reason?: string
          updated_at?: string
        }
        Relationships: []
      }
      config_values: {
        Row: {
          active: boolean
          category: string
          created_at: string
          display_order: number
          id: string
          image_url: string | null
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
          image_url?: string | null
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
          image_url?: string | null
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
      leaderboard_snapshots: {
        Row: {
          astik_points: number
          discord_id: string
          id: number
          messages_7d: number
          messages_total: number
          taken_at: string
          voice_7d_seconds: number
          voice_total_seconds: number
        }
        Insert: {
          astik_points?: number
          discord_id: string
          id?: number
          messages_7d?: number
          messages_total?: number
          taken_at?: string
          voice_7d_seconds?: number
          voice_total_seconds?: number
        }
        Update: {
          astik_points?: number
          discord_id?: string
          id?: number
          messages_7d?: number
          messages_total?: number
          taken_at?: string
          voice_7d_seconds?: number
          voice_total_seconds?: number
        }
        Relationships: []
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
          mc_uuid: string | null
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
          mc_uuid?: string | null
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
          mc_uuid?: string | null
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
      paladium_admin_shop_history: {
        Row: {
          captured_at: string
          category: string | null
          id: string
          item_name: string
          price: number | null
          price_pb: number | null
          raw: Json | null
          snapshot_date: string
        }
        Insert: {
          captured_at?: string
          category?: string | null
          id?: string
          item_name: string
          price?: number | null
          price_pb?: number | null
          raw?: Json | null
          snapshot_date?: string
        }
        Update: {
          captured_at?: string
          category?: string | null
          id?: string
          item_name?: string
          price?: number | null
          price_pb?: number | null
          raw?: Json | null
          snapshot_date?: string
        }
        Relationships: []
      }
      paladium_market_price_history: {
        Row: {
          captured_at: string
          count_listings: number | null
          id: number
          item_name: string
          price_average: number | null
          quantity_available: number | null
          quantity_sold_total: number | null
        }
        Insert: {
          captured_at?: string
          count_listings?: number | null
          id?: number
          item_name: string
          price_average?: number | null
          quantity_available?: number | null
          quantity_sold_total?: number | null
        }
        Update: {
          captured_at?: string
          count_listings?: number | null
          id?: number
          item_name?: string
          price_average?: number | null
          quantity_available?: number | null
          quantity_sold_total?: number | null
        }
        Relationships: []
      }
      paladium_player_listings_history: {
        Row: {
          expires_at: string | null
          external_id: string | null
          first_seen_at: string
          id: string
          item_name: string
          last_seen_at: string
          listed_at: string | null
          player_uuid: string
          price: number
          price_pb: number | null
          quantity: number
          sold_at: string | null
        }
        Insert: {
          expires_at?: string | null
          external_id?: string | null
          first_seen_at?: string
          id?: string
          item_name: string
          last_seen_at?: string
          listed_at?: string | null
          player_uuid: string
          price: number
          price_pb?: number | null
          quantity: number
          sold_at?: string | null
        }
        Update: {
          expires_at?: string | null
          external_id?: string | null
          first_seen_at?: string
          id?: string
          item_name?: string
          last_seen_at?: string
          listed_at?: string | null
          player_uuid?: string
          price?: number
          price_pb?: number | null
          quantity?: number
          sold_at?: string | null
        }
        Relationships: []
      }
      paladium_server_status_history: {
        Row: {
          captured_at: string
          id: number
          is_online: boolean
          max_players: number | null
          online_players: number | null
          raw: Json | null
          server_key: string
          server_label: string | null
        }
        Insert: {
          captured_at?: string
          id?: number
          is_online?: boolean
          max_players?: number | null
          online_players?: number | null
          raw?: Json | null
          server_key: string
          server_label?: string | null
        }
        Update: {
          captured_at?: string
          id?: number
          is_online?: boolean
          max_players?: number | null
          online_players?: number | null
          raw?: Json | null
          server_key?: string
          server_label?: string | null
        }
        Relationships: []
      }
      paladium_tracked_players: {
        Row: {
          first_searched_at: string
          last_searched_at: string
          last_synced_at: string | null
          search_count: number
          username: string
          uuid: string
        }
        Insert: {
          first_searched_at?: string
          last_searched_at?: string
          last_synced_at?: string | null
          search_count?: number
          username: string
          uuid: string
        }
        Update: {
          first_searched_at?: string
          last_searched_at?: string
          last_synced_at?: string | null
          search_count?: number
          username?: string
          uuid?: string
        }
        Relationships: []
      }
      pdc_blocks: {
        Row: {
          color: string
          created_at: string
          created_by_discord_id: string | null
          created_by_username: string | null
          id: string
          kind: string
          name: string
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          created_by_discord_id?: string | null
          created_by_username?: string | null
          id?: string
          kind?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by_discord_id?: string | null
          created_by_username?: string | null
          id?: string
          kind?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pdc_plans: {
        Row: {
          created_at: string
          created_by_discord_id: string
          created_by_username: string | null
          height_chunks: number
          id: string
          layers: Json
          layers_count: number
          name: string
          notes: string | null
          updated_at: string
          width_chunks: number
        }
        Insert: {
          created_at?: string
          created_by_discord_id: string
          created_by_username?: string | null
          height_chunks?: number
          id?: string
          layers?: Json
          layers_count?: number
          name: string
          notes?: string | null
          updated_at?: string
          width_chunks?: number
        }
        Update: {
          created_at?: string
          created_by_discord_id?: string
          created_by_username?: string | null
          height_chunks?: number
          id?: string
          layers?: Json
          layers_count?: number
          name?: string
          notes?: string | null
          updated_at?: string
          width_chunks?: number
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
      poll_options: {
        Row: {
          created_at: string
          display_order: number
          duration_minutes: number
          id: string
          poll_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          duration_minutes?: number
          id?: string
          poll_id: string
          starts_at: string
        }
        Update: {
          created_at?: string
          display_order?: number
          duration_minutes?: number
          id?: string
          poll_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          choice: string
          created_at: string
          id: string
          option_id: string
          poll_id: string
          updated_at: string
          voter_discord_id: string
          voter_username: string | null
        }
        Insert: {
          choice: string
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
          updated_at?: string
          voter_discord_id: string
          voter_username?: string | null
        }
        Update: {
          choice?: string
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
          updated_at?: string
          voter_discord_id?: string
          voter_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by_discord_id: string
          created_by_username: string | null
          description: string | null
          id: string
          location: string | null
          status: string
          title: string
          updated_at: string
          winning_option_id: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by_discord_id: string
          created_by_username?: string | null
          description?: string | null
          id?: string
          location?: string | null
          status?: string
          title: string
          updated_at?: string
          winning_option_id?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by_discord_id?: string
          created_by_username?: string | null
          description?: string | null
          id?: string
          location?: string | null
          status?: string
          title?: string
          updated_at?: string
          winning_option_id?: string | null
        }
        Relationships: []
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
      v_leaderboard_timeseries: {
        Row: {
          astik_points: number | null
          current_grade: string | null
          discord_id: string | null
          display_name: string | null
          messages_7d: number | null
          messages_total: number | null
          taken_at: string | null
          voice_7d_seconds: number | null
          voice_total_seconds: number | null
        }
        Relationships: []
      }
      v_points_daily: {
        Row: {
          action_type: string | null
          day: string | null
          staff_discord_id: string | null
          staff_username: string | null
          total_amount: number | null
          tx_count: number | null
        }
        Relationships: []
      }
      v_staff_activity_daily: {
        Row: {
          day: string | null
          kind: string | null
          n: number | null
          staff_discord_id: string | null
          staff_username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      capture_leaderboard_snapshot: { Args: never; Returns: undefined }
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
