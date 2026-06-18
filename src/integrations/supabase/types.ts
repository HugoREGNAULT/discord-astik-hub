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
      ai_digests: {
        Row: {
          content: string
          created_at: string
          generated_at: string
          generated_by: string
          id: string
          meta: Json
          model: string | null
          summary: string | null
          week_start: string
        }
        Insert: {
          content: string
          created_at?: string
          generated_at?: string
          generated_by?: string
          id?: string
          meta?: Json
          model?: string | null
          summary?: string | null
          week_start: string
        }
        Update: {
          content?: string
          created_at?: string
          generated_at?: string
          generated_by?: string
          id?: string
          meta?: Json
          model?: string | null
          summary?: string | null
          week_start?: string
        }
        Relationships: []
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          member_discord_id: string
          read_at: string
        }
        Insert: {
          announcement_id: string
          id?: string
          member_discord_id: string
          read_at?: string
        }
        Update: {
          announcement_id?: string
          id?: string
          member_discord_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by_discord_id: string
          created_by_username: string | null
          id: string
          pinned: boolean
          published_at: string | null
          require_ack: boolean
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by_discord_id: string
          created_by_username?: string | null
          id?: string
          pinned?: boolean
          published_at?: string | null
          require_ack?: boolean
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by_discord_id?: string
          created_by_username?: string | null
          id?: string
          pinned?: boolean
          published_at?: string | null
          require_ack?: boolean
          title?: string
        }
        Relationships: []
      }
      anomaly_flags: {
        Row: {
          ai_explanation: string | null
          created_at: string
          evidence: Json
          id: string
          kind: string
          member_discord_id: string
          reviewed_at: string | null
          reviewed_by_discord_id: string | null
          score: number | null
          severity: string
          status: string
        }
        Insert: {
          ai_explanation?: string | null
          created_at?: string
          evidence?: Json
          id?: string
          kind: string
          member_discord_id: string
          reviewed_at?: string | null
          reviewed_by_discord_id?: string | null
          score?: number | null
          severity?: string
          status?: string
        }
        Update: {
          ai_explanation?: string | null
          created_at?: string
          evidence?: Json
          id?: string
          kind?: string
          member_discord_id?: string
          reviewed_at?: string | null
          reviewed_by_discord_id?: string | null
          score?: number | null
          severity?: string
          status?: string
        }
        Relationships: []
      }
      application_drafts: {
        Row: {
          additional_info: string | null
          age: number | null
          char_count: number
          country: string | null
          discord_id: string
          discord_username: string | null
          form_rating: number | null
          heard_from: string | null
          keystroke_count: number
          mc_name: string | null
          motivation: string | null
          objectives: string | null
          paste_count: number
          paste_events: Json
          paste_total_chars: number
          presentation: string | null
          presentation_gaming: string | null
          pvp_level: number | null
          schedule: string | null
          started_at: string
          submitted: boolean
          typing_ms: number
          updated_at: string
        }
        Insert: {
          additional_info?: string | null
          age?: number | null
          char_count?: number
          country?: string | null
          discord_id: string
          discord_username?: string | null
          form_rating?: number | null
          heard_from?: string | null
          keystroke_count?: number
          mc_name?: string | null
          motivation?: string | null
          objectives?: string | null
          paste_count?: number
          paste_events?: Json
          paste_total_chars?: number
          presentation?: string | null
          presentation_gaming?: string | null
          pvp_level?: number | null
          schedule?: string | null
          started_at?: string
          submitted?: boolean
          typing_ms?: number
          updated_at?: string
        }
        Update: {
          additional_info?: string | null
          age?: number | null
          char_count?: number
          country?: string | null
          discord_id?: string
          discord_username?: string | null
          form_rating?: number | null
          heard_from?: string | null
          keystroke_count?: number
          mc_name?: string | null
          motivation?: string | null
          objectives?: string | null
          paste_count?: number
          paste_events?: Json
          paste_total_chars?: number
          presentation?: string | null
          presentation_gaming?: string | null
          pvp_level?: number | null
          schedule?: string | null
          started_at?: string
          submitted?: boolean
          typing_ms?: number
          updated_at?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          additional_info: string | null
          age: number
          ai_review: Json | null
          country: string
          created_at: string
          decided_at: string | null
          decided_by_discord_id: string | null
          decided_by_username: string | null
          decision_reason: string | null
          discord_id: string
          discord_username: string
          first_version: string | null
          form_rating: number | null
          heard_from: string
          id: string
          ig_grade: string | null
          interview_validated_at: string | null
          interview_validated_by_discord_id: string | null
          interview_validated_by_username: string | null
          knowledge_level: number | null
          mc_name: string
          motivation: string | null
          objectives: string | null
          presentation: string
          presentation_gaming: string | null
          previous_factions: string | null
          pvp_level: number | null
          schedule: string
          skills: string | null
          status: string
          updated_at: string
          weekly_playtime: string | null
        }
        Insert: {
          additional_info?: string | null
          age: number
          ai_review?: Json | null
          country: string
          created_at?: string
          decided_at?: string | null
          decided_by_discord_id?: string | null
          decided_by_username?: string | null
          decision_reason?: string | null
          discord_id: string
          discord_username: string
          first_version?: string | null
          form_rating?: number | null
          heard_from: string
          id?: string
          ig_grade?: string | null
          interview_validated_at?: string | null
          interview_validated_by_discord_id?: string | null
          interview_validated_by_username?: string | null
          knowledge_level?: number | null
          mc_name: string
          motivation?: string | null
          objectives?: string | null
          presentation: string
          presentation_gaming?: string | null
          previous_factions?: string | null
          pvp_level?: number | null
          schedule: string
          skills?: string | null
          status?: string
          updated_at?: string
          weekly_playtime?: string | null
        }
        Update: {
          additional_info?: string | null
          age?: number
          ai_review?: Json | null
          country?: string
          created_at?: string
          decided_at?: string | null
          decided_by_discord_id?: string | null
          decided_by_username?: string | null
          decision_reason?: string | null
          discord_id?: string
          discord_username?: string
          first_version?: string | null
          form_rating?: number | null
          heard_from?: string
          id?: string
          ig_grade?: string | null
          interview_validated_at?: string | null
          interview_validated_by_discord_id?: string | null
          interview_validated_by_username?: string | null
          knowledge_level?: number | null
          mc_name?: string
          motivation?: string | null
          objectives?: string | null
          presentation?: string
          presentation_gaming?: string | null
          previous_factions?: string | null
          pvp_level?: number | null
          schedule?: string
          skills?: string | null
          status?: string
          updated_at?: string
          weekly_playtime?: string | null
        }
        Relationships: []
      }
      audit_integrity_checks: {
        Row: {
          broken_at_seq: number | null
          checked_at: string
          detail: string | null
          id: string
          ok: boolean
        }
        Insert: {
          broken_at_seq?: number | null
          checked_at?: string
          detail?: string | null
          id?: string
          ok: boolean
        }
        Update: {
          broken_at_seq?: number | null
          checked_at?: string
          detail?: string | null
          id?: string
          ok?: boolean
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          action: Json
          created_at: string
          enabled: boolean
          id: string
          last_run_at: string | null
          mode: string
          name: string
          trigger: Json
        }
        Insert: {
          action: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          mode?: string
          name: string
          trigger: Json
        }
        Update: {
          action?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          mode?: string
          name?: string
          trigger?: Json
        }
        Relationships: []
      }
      badges: {
        Row: {
          auto_rule: Json | null
          code: string
          color: string | null
          created_at: string
          criteria: Json | null
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          auto_rule?: Json | null
          code: string
          color?: string | null
          created_at?: string
          criteria?: Json | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          auto_rule?: Json | null
          code?: string
          color?: string | null
          created_at?: string
          criteria?: Json | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
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
      config_values_history: {
        Row: {
          category: string
          changed_at: string
          changed_by_discord_id: string | null
          id: string
          name: string
          points: number
          value_id: string
        }
        Insert: {
          category: string
          changed_at?: string
          changed_by_discord_id?: string | null
          id?: string
          name: string
          points: number
          value_id: string
        }
        Update: {
          category?: string
          changed_at?: string
          changed_by_discord_id?: string | null
          id?: string
          name?: string
          points?: number
          value_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_values_history_value_id_fkey"
            columns: ["value_id"]
            isOneToOne: false
            referencedRelation: "config_values"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "donations_member_discord_id_fkey"
            columns: ["member_discord_id"]
            isOneToOne: false
            referencedRelation: "v_faction_member_sales"
            referencedColumns: ["discord_id"]
          },
        ]
      }
      event_loot: {
        Row: {
          created_at: string
          event_id: string
          id: string
          ledger_id: string | null
          member_discord_id: string
          note: string | null
          points: number
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          ledger_id?: string | null
          member_discord_id: string
          note?: string | null
          points: number
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          ledger_id?: string | null
          member_discord_id?: string
          note?: string | null
          points?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_loot_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_signups: {
        Row: {
          attended: boolean | null
          created_at: string
          event_id: string
          id: string
          member_discord_id: string
          member_username: string | null
          rsvp: string
          updated_at: string
        }
        Insert: {
          attended?: boolean | null
          created_at?: string
          event_id: string
          id?: string
          member_discord_id: string
          member_username?: string | null
          rsvp: string
          updated_at?: string
        }
        Update: {
          attended?: boolean | null
          created_at?: string
          event_id?: string
          id?: string
          member_discord_id?: string
          member_username?: string | null
          rsvp?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_signups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by_discord_id: string
          created_by_username: string | null
          description: string | null
          id: string
          location: string | null
          loot_distributed: boolean
          report: string | null
          starts_at: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_discord_id: string
          created_by_username?: string | null
          description?: string | null
          id?: string
          location?: string | null
          loot_distributed?: boolean
          report?: string | null
          starts_at: string
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_discord_id?: string
          created_by_username?: string | null
          description?: string | null
          id?: string
          location?: string | null
          loot_distributed?: boolean
          report?: string | null
          starts_at?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      faction_bc_checks: {
        Row: {
          created_at: string
          created_by_discord_id: string
          created_by_username: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          status: string
          updated_at: string
          updated_by_discord_id: string | null
          updated_by_username: string | null
        }
        Insert: {
          created_at?: string
          created_by_discord_id: string
          created_by_username?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
          updated_by_discord_id?: string | null
          updated_by_username?: string | null
        }
        Update: {
          created_at?: string
          created_by_discord_id?: string
          created_by_username?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
          updated_by_discord_id?: string | null
          updated_by_username?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          enabled: boolean
          key: string
          updated_at: string
          updated_by_discord_id: string | null
        }
        Insert: {
          enabled?: boolean
          key: string
          updated_at?: string
          updated_by_discord_id?: string | null
        }
        Update: {
          enabled?: boolean
          key?: string
          updated_at?: string
          updated_by_discord_id?: string | null
        }
        Relationships: []
      }
      grade_thresholds: {
        Row: {
          active: boolean
          created_at: string
          display_order: number
          grade_label: string
          id: string
          min_days_in_faction: number
          min_days_since_rankup: number
          min_messages_7d: number
          min_points: number
          min_voice_7d_seconds: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_order: number
          grade_label: string
          id?: string
          min_days_in_faction?: number
          min_days_since_rankup?: number
          min_messages_7d?: number
          min_points?: number
          min_voice_7d_seconds?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_order?: number
          grade_label?: string
          id?: string
          min_days_in_faction?: number
          min_days_since_rankup?: number
          min_messages_7d?: number
          min_points?: number
          min_voice_7d_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      inactivity_pings: {
        Row: {
          channel: string
          created_at: string
          dm_error: string | null
          dm_ok: boolean | null
          id: string
          member_discord_id: string
          message: string | null
          sent_by_discord_id: string | null
          sent_by_username: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          dm_error?: string | null
          dm_ok?: boolean | null
          id?: string
          member_discord_id: string
          message?: string | null
          sent_by_discord_id?: string | null
          sent_by_username?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          dm_error?: string | null
          dm_ok?: boolean | null
          id?: string
          member_discord_id?: string
          message?: string | null
          sent_by_discord_id?: string | null
          sent_by_username?: string | null
        }
        Relationships: []
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
      leaderboard_snapshots_1d: {
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
          taken_at: string
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
      leaderboard_snapshots_2h: {
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
          taken_at: string
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
      legacy_applications: {
        Row: {
          age: number | null
          contact_note: string | null
          contact_status: string
          contact_updated_at: string | null
          contact_updated_by_discord_id: string | null
          contact_updated_by_username: string | null
          created_at: string
          discord_name: string | null
          id: string
          ig_name: string | null
          mojang_checked_at: string | null
          mojang_current_name: string | null
          mojang_status: string | null
          mojang_uuid: string | null
          paladium_checked_at: string | null
          paladium_faction: string | null
          paladium_first_join: string | null
          paladium_job_total: number | null
          paladium_jobs: Json | null
          paladium_last_seen: string | null
          paladium_level: number | null
          paladium_money: number | null
          paladium_played_v11: boolean | null
          paladium_status: string | null
          raw: Json
          source: string
          submitted_at: string | null
        }
        Insert: {
          age?: number | null
          contact_note?: string | null
          contact_status?: string
          contact_updated_at?: string | null
          contact_updated_by_discord_id?: string | null
          contact_updated_by_username?: string | null
          created_at?: string
          discord_name?: string | null
          id?: string
          ig_name?: string | null
          mojang_checked_at?: string | null
          mojang_current_name?: string | null
          mojang_status?: string | null
          mojang_uuid?: string | null
          paladium_checked_at?: string | null
          paladium_faction?: string | null
          paladium_first_join?: string | null
          paladium_job_total?: number | null
          paladium_jobs?: Json | null
          paladium_last_seen?: string | null
          paladium_level?: number | null
          paladium_money?: number | null
          paladium_played_v11?: boolean | null
          paladium_status?: string | null
          raw?: Json
          source: string
          submitted_at?: string | null
        }
        Update: {
          age?: number | null
          contact_note?: string | null
          contact_status?: string
          contact_updated_at?: string | null
          contact_updated_by_discord_id?: string | null
          contact_updated_by_username?: string | null
          created_at?: string
          discord_name?: string | null
          id?: string
          ig_name?: string | null
          mojang_checked_at?: string | null
          mojang_current_name?: string | null
          mojang_status?: string | null
          mojang_uuid?: string | null
          paladium_checked_at?: string | null
          paladium_faction?: string | null
          paladium_first_join?: string | null
          paladium_job_total?: number | null
          paladium_jobs?: Json | null
          paladium_last_seen?: string | null
          paladium_level?: number | null
          paladium_money?: number | null
          paladium_played_v11?: boolean | null
          paladium_status?: string | null
          raw?: Json
          source?: string
          submitted_at?: string | null
        }
        Relationships: []
      }
      logs: {
        Row: {
          action: string
          actor_discord_id: string | null
          created_at: string
          hash: string | null
          id: string
          level: string
          payload: Json | null
          prev_hash: string | null
          seq: number
        }
        Insert: {
          action: string
          actor_discord_id?: string | null
          created_at?: string
          hash?: string | null
          id?: string
          level?: string
          payload?: Json | null
          prev_hash?: string | null
          seq?: number
        }
        Update: {
          action?: string
          actor_discord_id?: string | null
          created_at?: string
          hash?: string | null
          id?: string
          level?: string
          payload?: Json | null
          prev_hash?: string | null
          seq?: number
        }
        Relationships: []
      }
      material_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by_discord_id: string | null
          decided_by_username: string | null
          delivered_at: string | null
          id: string
          item_name: string
          member_discord_id: string
          quantity: number
          reason: string | null
          status: string
          stock_item_id: string | null
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by_discord_id?: string | null
          decided_by_username?: string | null
          delivered_at?: string | null
          id?: string
          item_name: string
          member_discord_id: string
          quantity: number
          reason?: string | null
          status?: string
          stock_item_id?: string | null
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by_discord_id?: string | null
          decided_by_username?: string | null
          delivered_at?: string | null
          id?: string
          item_name?: string
          member_discord_id?: string
          quantity?: number
          reason?: string | null
          status?: string
          stock_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_requests_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_jobs_snapshots: {
        Row: {
          captured_at: string
          id: number
          jobs: Json
          mc_uuid: string
          member_discord_id: string | null
        }
        Insert: {
          captured_at?: string
          id?: number
          jobs?: Json
          mc_uuid: string
          member_discord_id?: string | null
        }
        Update: {
          captured_at?: string
          id?: number
          jobs?: Json
          mc_uuid?: string
          member_discord_id?: string | null
        }
        Relationships: []
      }
      mc_link_challenges: {
        Row: {
          code: string
          created_at: string
          discord_id: string
          expires_at: string
          id: string
          mc_name: string
          mc_uuid: string | null
          status: string
          verified_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          discord_id: string
          expires_at: string
          id?: string
          mc_name: string
          mc_uuid?: string | null
          status?: string
          verified_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          discord_id?: string
          expires_at?: string
          id?: string
          mc_name?: string
          mc_uuid?: string | null
          status?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      mc_player_stats: {
        Row: {
          faction_ingame: string | null
          id: string
          jobs: Json
          mc_uuid: string
          money: number | null
          raw: Json
          snapshot_at: string
        }
        Insert: {
          faction_ingame?: string | null
          id?: string
          jobs?: Json
          mc_uuid: string
          money?: number | null
          raw?: Json
          snapshot_at?: string
        }
        Update: {
          faction_ingame?: string | null
          id?: string
          jobs?: Json
          mc_uuid?: string
          money?: number | null
          raw?: Json
          snapshot_at?: string
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
          {
            foreignKeyName: "member_alts_member_discord_id_fkey"
            columns: ["member_discord_id"]
            isOneToOne: false
            referencedRelation: "v_faction_member_sales"
            referencedColumns: ["discord_id"]
          },
        ]
      }
      member_badges: {
        Row: {
          awarded_at: string
          awarded_by_discord_id: string | null
          badge_id: string
          id: string
          member_discord_id: string
        }
        Insert: {
          awarded_at?: string
          awarded_by_discord_id?: string | null
          badge_id: string
          id?: string
          member_discord_id: string
        }
        Update: {
          awarded_at?: string
          awarded_by_discord_id?: string | null
          badge_id?: string
          id?: string
          member_discord_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      member_quest_claims: {
        Row: {
          claimed_at: string
          id: string
          member_discord_id: string
          period_id: string
          reward_points: number
          template_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          member_discord_id: string
          period_id: string
          reward_points?: number
          template_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          member_discord_id?: string
          period_id?: string
          reward_points?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_quest_claims_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "quest_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_quest_claims_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "quest_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      member_xp: {
        Row: {
          current_streak_days: number
          discord_id: string
          last_active_date: string | null
          level: number
          longest_streak_days: number
          updated_at: string
          xp: number
        }
        Insert: {
          current_streak_days?: number
          discord_id: string
          last_active_date?: string | null
          level?: number
          longest_streak_days?: number
          updated_at?: string
          xp?: number
        }
        Update: {
          current_streak_days?: number
          discord_id?: string
          last_active_date?: string | null
          level?: number
          longest_streak_days?: number
          updated_at?: string
          xp?: number
        }
        Relationships: []
      }
      members: {
        Row: {
          arrival_date: string | null
          astik_points: number
          avatar_url: string | null
          bio: string | null
          created_at: string
          current_grade: string | null
          discord_id: string
          discord_username: string | null
          ig_name: string | null
          last_rankup: string | null
          mc_uuid: string | null
          mentor_discord_id: string | null
          messages_7d: number
          messages_total: number
          recruiter_discord_id: string | null
          roles: string[]
          status: string
          trial_until: string | null
          updated_at: string
          voice_7d_seconds: number
          voice_total_seconds: number
        }
        Insert: {
          arrival_date?: string | null
          astik_points?: number
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_grade?: string | null
          discord_id: string
          discord_username?: string | null
          ig_name?: string | null
          last_rankup?: string | null
          mc_uuid?: string | null
          mentor_discord_id?: string | null
          messages_7d?: number
          messages_total?: number
          recruiter_discord_id?: string | null
          roles?: string[]
          status?: string
          trial_until?: string | null
          updated_at?: string
          voice_7d_seconds?: number
          voice_total_seconds?: number
        }
        Update: {
          arrival_date?: string | null
          astik_points?: number
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_grade?: string | null
          discord_id?: string
          discord_username?: string | null
          ig_name?: string | null
          last_rankup?: string | null
          mc_uuid?: string | null
          mentor_discord_id?: string | null
          messages_7d?: number
          messages_total?: number
          recruiter_discord_id?: string | null
          roles?: string[]
          status?: string
          trial_until?: string | null
          updated_at?: string
          voice_7d_seconds?: number
          voice_total_seconds?: number
        }
        Relationships: []
      }
      minecraft_uuid_cache: {
        Row: {
          first_seen_at: string
          updated_at: string
          username: string
          username_lower: string | null
          uuid: string
        }
        Insert: {
          first_seen_at?: string
          updated_at?: string
          username: string
          username_lower?: string | null
          uuid: string
        }
        Update: {
          first_seen_at?: string
          updated_at?: string
          username?: string
          username_lower?: string | null
          uuid?: string
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
          {
            foreignKeyName: "notes_member_discord_id_fkey"
            columns: ["member_discord_id"]
            isOneToOne: false
            referencedRelation: "v_faction_member_sales"
            referencedColumns: ["discord_id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          discord_dm: boolean
          discord_id: string
          kind: string
          web: boolean
          web_push: boolean
        }
        Insert: {
          discord_dm?: boolean
          discord_id: string
          kind: string
          web?: boolean
          web_push?: boolean
        }
        Update: {
          discord_dm?: boolean
          discord_id?: string
          kind?: string
          web?: boolean
          web_push?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          detail: string | null
          href: string | null
          id: string
          kind: string
          read_at: string | null
          recipient_discord_id: string
          title: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          href?: string | null
          id?: string
          kind: string
          read_at?: string | null
          recipient_discord_id: string
          title: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          href?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          recipient_discord_id?: string
          title?: string
        }
        Relationships: []
      }
      objective_contributions: {
        Row: {
          amount: number
          created_at: string
          created_by_discord_id: string | null
          id: string
          member_discord_id: string
          member_username: string | null
          note: string | null
          objective_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by_discord_id?: string | null
          id?: string
          member_discord_id: string
          member_username?: string | null
          note?: string | null
          objective_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by_discord_id?: string | null
          id?: string
          member_discord_id?: string
          member_username?: string | null
          note?: string | null
          objective_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "objective_contributions_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      objectives: {
        Row: {
          created_at: string
          current_value: number
          description: string | null
          display_order: number
          done: boolean
          done_at: string | null
          done_by_discord_id: string | null
          id: string
          reward_points: number
          rewarded: boolean
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_value?: number
          description?: string | null
          display_order?: number
          done?: boolean
          done_at?: string | null
          done_by_discord_id?: string | null
          id?: string
          reward_points?: number
          rewarded?: boolean
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_value?: number
          description?: string | null
          display_order?: number
          done?: boolean
          done_at?: string | null
          done_by_discord_id?: string | null
          id?: string
          reward_points?: number
          rewarded?: boolean
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_tasks: {
        Row: {
          created_at: string
          display_order: number
          done: boolean
          done_at: string | null
          id: string
          label: string
          member_discord_id: string
          template_key: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          done?: boolean
          done_at?: string | null
          id?: string
          label: string
          member_discord_id: string
          template_key?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          done?: boolean
          done_at?: string | null
          id?: string
          label?: string
          member_discord_id?: string
          template_key?: string | null
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
          {
            foreignKeyName: "points_ledger_member_discord_id_fkey"
            columns: ["member_discord_id"]
            isOneToOne: false
            referencedRelation: "v_faction_member_sales"
            referencedColumns: ["discord_id"]
          },
        ]
      }
      poll_options: {
        Row: {
          created_at: string
          display_order: number
          duration_minutes: number | null
          id: string
          label: string | null
          poll_id: string
          starts_at: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          duration_minutes?: number | null
          id?: string
          label?: string | null
          poll_id: string
          starts_at?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          duration_minutes?: number | null
          id?: string
          label?: string | null
          poll_id?: string
          starts_at?: string | null
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
          kind: string
          location: string | null
          question_mode: string | null
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
          kind?: string
          location?: string | null
          question_mode?: string | null
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
          kind?: string
          location?: string | null
          question_mode?: string | null
          status?: string
          title?: string
          updated_at?: string
          winning_option_id?: string | null
        }
        Relationships: []
      }
      project_contributions: {
        Row: {
          created_at: string
          created_by_discord_id: string
          id: string
          item_name: string
          member_discord_id: string
          member_username: string | null
          note: string | null
          points_awarded: number | null
          project_id: string
          quantity: number
          resource_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_discord_id: string
          id?: string
          item_name: string
          member_discord_id: string
          member_username?: string | null
          note?: string | null
          points_awarded?: number | null
          project_id: string
          quantity: number
          resource_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_discord_id?: string
          id?: string
          item_name?: string
          member_discord_id?: string
          member_username?: string | null
          note?: string | null
          points_awarded?: number | null
          project_id?: string
          quantity?: number
          resource_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_contributions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contributions_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "project_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      project_resources: {
        Row: {
          created_at: string
          display_order: number
          id: string
          item_name: string
          project_id: string
          qty_collected: number
          qty_needed: number
          unit_points: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          item_name: string
          project_id: string
          qty_collected?: number
          qty_needed?: number
          unit_points?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          item_name?: string
          project_id?: string
          qty_collected?: number
          qty_needed?: number
          unit_points?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_resources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by_discord_id: string
          created_by_username: string | null
          deadline: string | null
          description: string | null
          id: string
          owner_discord_id: string | null
          owner_username: string | null
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by_discord_id: string
          created_by_username?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          owner_discord_id?: string | null
          owner_username?: string | null
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by_discord_id?: string
          created_by_username?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          owner_discord_id?: string | null
          owner_username?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      quest_periods: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          starts_on: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          starts_on: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          starts_on?: string
        }
        Relationships: []
      }
      quest_templates: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          display_order: number
          id: string
          quest_type: string
          reward_points: number
          target_value: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          quest_type: string
          reward_points?: number
          target_value: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          quest_type?: string
          reward_points?: number
          target_value?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      salary_grades: {
        Row: {
          active: boolean
          created_at: string
          grade_label: string
          id: string
          min_activity_seconds: number
          updated_at: string
          weekly_points: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          grade_label: string
          id?: string
          min_activity_seconds?: number
          updated_at?: string
          weekly_points?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          grade_label?: string
          id?: string
          min_activity_seconds?: number
          updated_at?: string
          weekly_points?: number
        }
        Relationships: []
      }
      salary_runs: {
        Row: {
          breakdown: Json
          committed_at: string | null
          created_at: string
          created_by_discord_id: string | null
          created_by_username: string | null
          id: string
          period_end: string
          period_start: string
          recipient_count: number
          status: string
          total_points: number
        }
        Insert: {
          breakdown?: Json
          committed_at?: string | null
          created_at?: string
          created_by_discord_id?: string | null
          created_by_username?: string | null
          id?: string
          period_end: string
          period_start: string
          recipient_count?: number
          status?: string
          total_points?: number
        }
        Update: {
          breakdown?: Json
          committed_at?: string | null
          created_at?: string
          created_by_discord_id?: string | null
          created_by_username?: string | null
          id?: string
          period_end?: string
          period_start?: string
          recipient_count?: number
          status?: string
          total_points?: number
        }
        Relationships: []
      }
      seasons: {
        Row: {
          active: boolean
          created_at: string
          ends_at: string
          id: string
          name: string
          starts_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          ends_at: string
          id?: string
          name: string
          starts_at: string
        }
        Update: {
          active?: boolean
          created_at?: string
          ends_at?: string
          id?: string
          name?: string
          starts_at?: string
        }
        Relationships: []
      }
      shop_admin_price_alerts: {
        Row: {
          created_at: string
          direction: string
          id: string
          is_triggered: boolean
          item_name: string
          last_triggered_at: string | null
          price_type: string
          source: string
          threshold: number
          updated_at: string
          user_discord_id: string
          user_username: string | null
        }
        Insert: {
          created_at?: string
          direction: string
          id?: string
          is_triggered?: boolean
          item_name: string
          last_triggered_at?: string | null
          price_type?: string
          source?: string
          threshold: number
          updated_at?: string
          user_discord_id: string
          user_username?: string | null
        }
        Update: {
          created_at?: string
          direction?: string
          id?: string
          is_triggered?: boolean
          item_name?: string
          last_triggered_at?: string | null
          price_type?: string
          source?: string
          threshold?: number
          updated_at?: string
          user_discord_id?: string
          user_username?: string | null
        }
        Relationships: []
      }
      shop_rewards: {
        Row: {
          active: boolean
          category: string | null
          cost_points: number
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          name: string
          per_member_limit: number | null
          stock: number | null
        }
        Insert: {
          active?: boolean
          category?: string | null
          cost_points: number
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          name: string
          per_member_limit?: number | null
          stock?: number | null
        }
        Update: {
          active?: boolean
          category?: string | null
          cost_points?: number
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          name?: string
          per_member_limit?: number | null
          stock?: number | null
        }
        Relationships: []
      }
      spend_requests: {
        Row: {
          decided_at: string | null
          decided_by_discord_id: string | null
          decided_by_username: string | null
          expires_at: string
          fulfilled_at: string | null
          id: string
          ledger_id: string | null
          member_discord_id: string
          quantity: number
          reject_reason: string | null
          requested_at: string
          reward_id: string | null
          reward_name: string
          status: string
          total_cost: number
          unit_cost: number
        }
        Insert: {
          decided_at?: string | null
          decided_by_discord_id?: string | null
          decided_by_username?: string | null
          expires_at?: string
          fulfilled_at?: string | null
          id?: string
          ledger_id?: string | null
          member_discord_id: string
          quantity?: number
          reject_reason?: string | null
          requested_at?: string
          reward_id?: string | null
          reward_name: string
          status?: string
          total_cost: number
          unit_cost: number
        }
        Update: {
          decided_at?: string | null
          decided_by_discord_id?: string | null
          decided_by_username?: string | null
          expires_at?: string
          fulfilled_at?: string | null
          id?: string
          ledger_id?: string | null
          member_discord_id?: string
          quantity?: number
          reject_reason?: string | null
          requested_at?: string
          reward_id?: string | null
          reward_name?: string
          status?: string
          total_cost?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "spend_requests_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "shop_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_tasks: {
        Row: {
          assignee_discord_id: string | null
          assignee_username: string | null
          created_at: string
          created_by_discord_id: string | null
          created_by_username: string | null
          description: string | null
          display_order: number
          done_at: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
        }
        Insert: {
          assignee_discord_id?: string | null
          assignee_username?: string | null
          created_at?: string
          created_by_discord_id?: string | null
          created_by_username?: string | null
          description?: string | null
          display_order?: number
          done_at?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
        }
        Update: {
          assignee_discord_id?: string | null
          assignee_username?: string | null
          created_at?: string
          created_by_discord_id?: string | null
          created_by_username?: string | null
          description?: string | null
          display_order?: number
          done_at?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      stock_items: {
        Row: {
          chest_id: string | null
          created_at: string
          id: string
          item_name: string
          min_threshold: number
          quantity: number
          unit: string | null
          updated_at: string
          updated_by_discord_id: string | null
        }
        Insert: {
          chest_id?: string | null
          created_at?: string
          id?: string
          item_name: string
          min_threshold?: number
          quantity?: number
          unit?: string | null
          updated_at?: string
          updated_by_discord_id?: string | null
        }
        Update: {
          chest_id?: string | null
          created_at?: string
          id?: string
          item_name?: string
          min_threshold?: number
          quantity?: number
          unit?: string | null
          updated_at?: string
          updated_by_discord_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_chest_id_fkey"
            columns: ["chest_id"]
            isOneToOne: false
            referencedRelation: "storage_chests"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_chests: {
        Row: {
          created_at: string
          created_by_discord_id: string | null
          description: string | null
          id: string
          location: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_discord_id?: string | null
          description?: string | null
          id?: string
          location?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_discord_id?: string | null
          description?: string | null
          id?: string
          location?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      treasury_accounts: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          name: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          name: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      treasury_movements: {
        Row: {
          account_id: string
          balance_after: number
          created_at: string
          delta: number
          id: string
          reason: string | null
          source: string | null
          source_id: string | null
          staff_discord_id: string | null
          staff_username: string | null
        }
        Insert: {
          account_id: string
          balance_after: number
          created_at?: string
          delta: number
          id?: string
          reason?: string | null
          source?: string | null
          source_id?: string | null
          staff_discord_id?: string | null
          staff_username?: string | null
        }
        Update: {
          account_id?: string
          balance_after?: number
          created_at?: string
          delta?: number
          id?: string
          reason?: string | null
          source?: string | null
          source_id?: string | null
          staff_discord_id?: string | null
          staff_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treasury_movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "treasury_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_votes: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          member_discord_id: string
          vote: string
          voter_discord_id: string
          voter_username: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          member_discord_id: string
          vote: string
          voter_discord_id: string
          voter_username?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          member_discord_id?: string
          vote?: string
          voter_discord_id?: string
          voter_username?: string | null
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          actor_discord_id: string
          created_at: string
          id: number
          path: string
        }
        Insert: {
          actor_discord_id: string
          created_at?: string
          id?: number
          path: string
        }
        Update: {
          actor_discord_id?: string
          created_at?: string
          id?: number
          path?: string
        }
        Relationships: []
      }
      warning_appeals: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by_discord_id: string | null
          decided_by_username: string | null
          decision_note: string | null
          id: string
          member_discord_id: string
          message: string
          status: string
          warning_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by_discord_id?: string | null
          decided_by_username?: string | null
          decision_note?: string | null
          id?: string
          member_discord_id: string
          message: string
          status?: string
          warning_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by_discord_id?: string | null
          decided_by_username?: string | null
          decision_note?: string | null
          id?: string
          member_discord_id?: string
          message?: string
          status?: string
          warning_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warning_appeals_warning_id_fkey"
            columns: ["warning_id"]
            isOneToOne: false
            referencedRelation: "warnings"
            referencedColumns: ["id"]
          },
        ]
      }
      warnings: {
        Row: {
          body: string
          category: string | null
          created_at: string
          expires_at: string | null
          id: string
          member_discord_id: string
          points: number
          revoked_by_discord_id: string | null
          revoked_reason: string | null
          severity: string
          staff_discord_id: string
          staff_username: string | null
          status: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          member_discord_id: string
          points?: number
          revoked_by_discord_id?: string | null
          revoked_reason?: string | null
          severity?: string
          staff_discord_id: string
          staff_username?: string | null
          status?: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          member_discord_id?: string
          points?: number
          revoked_by_discord_id?: string | null
          revoked_reason?: string | null
          severity?: string
          staff_discord_id?: string
          staff_username?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "warnings_member_discord_id_fkey"
            columns: ["member_discord_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["discord_id"]
          },
          {
            foreignKeyName: "warnings_member_discord_id_fkey"
            columns: ["member_discord_id"]
            isOneToOne: false
            referencedRelation: "v_faction_member_sales"
            referencedColumns: ["discord_id"]
          },
        ]
      }
    }
    Views: {
      v_faction_member_sales: {
        Row: {
          discord_id: string | null
          first_seen_at: string | null
          item_name: string | null
          name: string | null
          price: number | null
          price_pb: number | null
          quantity: number | null
          sold_at: string | null
        }
        Relationships: []
      }
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
      apply_points_delta: {
        Args: { p_delta: number; p_discord_id: string }
        Returns: number
      }
      capture_leaderboard_snapshot: { Args: never; Returns: undefined }
      expire_old_carts: { Args: never; Returns: undefined }
      increment_messages_total: {
        Args: { p_discord_id: string; p_inc: number }
        Returns: number
      }
      leaderboard_history: {
        Args: { p_period: string }
        Returns: {
          astik_points: number
          discord_id: string
          id: number
          messages_7d: number
          messages_total: number
          taken_at: string
          voice_7d_seconds: number
          voice_total_seconds: number
        }[]
        SetofOptions: {
          from: "*"
          to: "leaderboard_snapshots"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      level_for_xp: { Args: { p_xp: number }; Returns: number }
      recompute_member_xp: { Args: never; Returns: undefined }
      rollup_leaderboard_1d: { Args: never; Returns: undefined }
      rollup_leaderboard_2h: { Args: never; Returns: undefined }
      set_member_points: {
        Args: { p_discord_id: string; p_total: number }
        Returns: number
      }
      verify_logs_chain: {
        Args: never
        Returns: {
          broken_at_seq: number
          detail: string
          ok: boolean
          scanned: number
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
