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
      activity_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          badge_id: string | null
          comment_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["activity_kind_t"]
          match_id: string | null
          photo_id: string | null
          player_id: string | null
          post_id: string | null
          snippet: string | null
          team_id: string | null
          title: string
          tournament_id: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          badge_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["activity_kind_t"]
          match_id?: string | null
          photo_id?: string | null
          player_id?: string | null
          post_id?: string | null
          snippet?: string | null
          team_id?: string | null
          title: string
          tournament_id?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          badge_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["activity_kind_t"]
          match_id?: string | null
          photo_id?: string | null
          player_id?: string | null
          post_id?: string | null
          snippet?: string | null
          team_id?: string | null
          title?: string
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "board_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "team_gallery_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "board_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      app_push_config: {
        Row: {
          id: boolean
          subject: string
          updated_at: string
          vapid_private: string
          vapid_public: string
          webhook_secret: string | null
        }
        Insert: {
          id?: boolean
          subject?: string
          updated_at?: string
          vapid_private: string
          vapid_public: string
          webhook_secret?: string | null
        }
        Update: {
          id?: boolean
          subject?: string
          updated_at?: string
          vapid_private?: string
          vapid_public?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      badges: {
        Row: {
          category: string
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          max_progress: number | null
          name: string
          unlock_condition: string | null
        }
        Insert: {
          category?: string
          description?: string | null
          icon?: string | null
          id: string
          image_url?: string | null
          max_progress?: number | null
          name: string
          unlock_condition?: string | null
        }
        Update: {
          category?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          max_progress?: number | null
          name?: string
          unlock_condition?: string | null
        }
        Relationships: []
      }
      board_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_edited: boolean
          is_hidden: boolean
          parent_comment_id: string | null
          post_id: string
          reaction_count: number
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_edited?: boolean
          is_hidden?: boolean
          parent_comment_id?: string | null
          post_id: string
          reaction_count?: number
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_edited?: boolean
          is_hidden?: boolean
          parent_comment_id?: string | null
          post_id?: string
          reaction_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "board_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "board_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      board_posts: {
        Row: {
          author_id: string
          body: string
          category: Database["public"]["Enums"]["post_category_t"]
          comment_count: number
          created_at: string
          id: string
          is_hidden: boolean
          reaction_count: number
          team_id: string | null
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          author_id: string
          body: string
          category?: Database["public"]["Enums"]["post_category_t"]
          comment_count?: number
          created_at?: string
          id?: string
          is_hidden?: boolean
          reaction_count?: number
          team_id?: string | null
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_id?: string
          body?: string
          category?: Database["public"]["Enums"]["post_category_t"]
          comment_count?: number
          created_at?: string
          id?: string
          is_hidden?: boolean
          reaction_count?: number
          team_id?: string | null
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "board_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_posts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "board_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          created_at: string
          half: number
          id: string
          is_cancelled: boolean
          match_id: string
          minute: number
          player_id: string | null
          player_name: string
          team_id: string | null
          type: Database["public"]["Enums"]["match_event_t"]
        }
        Insert: {
          created_at?: string
          half?: number
          id?: string
          is_cancelled?: boolean
          match_id: string
          minute?: number
          player_id?: string | null
          player_name?: string
          team_id?: string | null
          type: Database["public"]["Enums"]["match_event_t"]
        }
        Update: {
          created_at?: string
          half?: number
          id?: string
          is_cancelled?: boolean
          match_id?: string
          minute?: number
          player_id?: string | null
          player_name?: string
          team_id?: string | null
          type?: Database["public"]["Enums"]["match_event_t"]
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_lineups: {
        Row: {
          created_at: string
          is_starter: boolean
          jersey_number: number | null
          match_id: string
          player_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          is_starter?: boolean
          jersey_number?: number | null
          match_id: string
          player_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          is_starter?: boolean
          jersey_number?: number | null
          match_id?: string
          player_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_score: number
          away_team_id: string | null
          away_team_name: string
          created_at: string
          current_half: number
          elapsed_seconds: number
          group_id: string | null
          home_score: number
          home_team_id: string | null
          home_team_name: string
          id: string
          is_running: boolean
          mom_player_id: string | null
          round: number
          scheduled_at: string | null
          stats_applied: boolean
          status: Database["public"]["Enums"]["match_status_t"]
          tournament_id: string | null
        }
        Insert: {
          away_score?: number
          away_team_id?: string | null
          away_team_name?: string
          created_at?: string
          current_half?: number
          elapsed_seconds?: number
          group_id?: string | null
          home_score?: number
          home_team_id?: string | null
          home_team_name?: string
          id?: string
          is_running?: boolean
          mom_player_id?: string | null
          round?: number
          scheduled_at?: string | null
          stats_applied?: boolean
          status?: Database["public"]["Enums"]["match_status_t"]
          tournament_id?: string | null
        }
        Update: {
          away_score?: number
          away_team_id?: string | null
          away_team_name?: string
          created_at?: string
          current_half?: number
          elapsed_seconds?: number
          group_id?: string | null
          home_score?: number
          home_team_id?: string | null
          home_team_name?: string
          id?: string
          is_running?: boolean
          mom_player_id?: string | null
          round?: number
          scheduled_at?: string | null
          stats_applied?: boolean
          status?: Database["public"]["Enums"]["match_status_t"]
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_mom_player_id_fkey"
            columns: ["mom_player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          author_id: string | null
          body: string
          category: string
          created_at: string
          id: string
          is_important: boolean
          is_pinned: boolean
          published_at: string
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          category?: string
          created_at?: string
          id?: string
          is_important?: boolean
          is_pinned?: boolean
          published_at?: string
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_important?: boolean
          is_pinned?: boolean
          published_at?: string
          team_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notices_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          comment_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind_t"]
          match_id: string | null
          post_id: string | null
          read_at: string | null
          snippet: string | null
          team_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind_t"]
          match_id?: string | null
          post_id?: string | null
          read_at?: string | null
          snippet?: string | null
          team_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind_t"]
          match_id?: string | null
          post_id?: string | null
          read_at?: string | null
          snippet?: string | null
          team_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "board_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "board_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_badges: {
        Row: {
          badge_id: string
          earned_at: string | null
          is_earned: boolean
          player_id: string
          progress: number
        }
        Insert: {
          badge_id: string
          earned_at?: string | null
          is_earned?: boolean
          player_id: string
          progress?: number
        }
        Update: {
          badge_id?: string
          earned_at?: string | null
          is_earned?: boolean
          player_id?: string
          progress?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_badges_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "board_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_challenge_records: {
        Row: {
          air_touch_score: number
          card_badge_ids: string[]
          completed_at: string | null
          created_at: string
          event_badges: string[]
          event_date: string
          event_slug: string
          id: string
          memo: string | null
          participant_name: string
          phone_last4: string | null
          player_id: string
          recorded_by: string | null
          speed_kmh: number
          target_hit: boolean
          target_attempt_count: number | null
          target_number: number
          target_recorded: boolean
          total_score: number
          updated_at: string
        }
        Insert: {
          air_touch_score?: number
          card_badge_ids?: string[]
          completed_at?: string | null
          created_at?: string
          event_badges?: string[]
          event_date: string
          event_slug?: string
          id?: string
          memo?: string | null
          participant_name: string
          phone_last4?: string | null
          player_id: string
          recorded_by?: string | null
          speed_kmh?: number
          target_hit?: boolean
          target_attempt_count?: number | null
          target_number?: number
          target_recorded?: boolean
          total_score?: number
          updated_at?: string
        }
        Update: {
          air_touch_score?: number
          card_badge_ids?: string[]
          completed_at?: string | null
          created_at?: string
          event_badges?: string[]
          event_date?: string
          event_slug?: string
          id?: string
          memo?: string | null
          participant_name?: string
          phone_last4?: string | null
          player_id?: string
          recorded_by?: string | null
          speed_kmh?: number
          target_hit?: boolean
          target_attempt_count?: number | null
          target_number?: number
          target_recorded?: boolean
          total_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_challenge_records_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_challenge_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          assists: number
          attendance_streak: number
          attendance_streak_best: number
          badges: string[]
          ban_matches_remaining: number
          bio: string | null
          birth_date: string | null
          card_rating: number
          card_skin: "standard" | "hologram"
          card_type: Database["public"]["Enums"]["card_type_t"]
          created_at: string
          disposition: string | null
          email: string | null
          games: number
          gender: string | null
          goals: number
          has_player_experience: boolean
          id: string
          is_approved: boolean
          is_banned: boolean
          mbti: string | null
          mom: number
          name: string
          nationality: string
          number: number
          personal_values: string | null
          phone: string | null
          photo_offset_x: number | null
          photo_scale: number | null
          photo_url: string
          position: Database["public"]["Enums"]["position_t"]
          portrait_consent_at: string | null
          profile_photo_locked: boolean
          profile_photo_url: string | null
          role: Database["public"]["Enums"]["player_role_t"]
          season_yellow_cards: number
          team_id: string | null
          team_role: Database["public"]["Enums"]["team_role_t"] | null
        }
        Insert: {
          assists?: number
          attendance_streak?: number
          attendance_streak_best?: number
          badges?: string[]
          ban_matches_remaining?: number
          bio?: string | null
          birth_date?: string | null
          card_rating?: number
          card_skin?: "standard" | "hologram"
          card_type?: Database["public"]["Enums"]["card_type_t"]
          created_at?: string
          disposition?: string | null
          email?: string | null
          games?: number
          gender?: string | null
          goals?: number
          has_player_experience?: boolean
          id: string
          is_approved?: boolean
          is_banned?: boolean
          mbti?: string | null
          mom?: number
          name: string
          nationality?: string
          number?: number
          personal_values?: string | null
          phone?: string | null
          photo_offset_x?: number | null
          photo_scale?: number | null
          photo_url?: string
          position?: Database["public"]["Enums"]["position_t"]
          portrait_consent_at?: string | null
          profile_photo_locked?: boolean
          profile_photo_url?: string | null
          role?: Database["public"]["Enums"]["player_role_t"]
          season_yellow_cards?: number
          team_id?: string | null
          team_role?: Database["public"]["Enums"]["team_role_t"] | null
        }
        Update: {
          assists?: number
          attendance_streak?: number
          attendance_streak_best?: number
          badges?: string[]
          ban_matches_remaining?: number
          bio?: string | null
          birth_date?: string | null
          card_rating?: number
          card_skin?: "standard" | "hologram"
          card_type?: Database["public"]["Enums"]["card_type_t"]
          created_at?: string
          disposition?: string | null
          email?: string | null
          games?: number
          gender?: string | null
          goals?: number
          has_player_experience?: boolean
          id?: string
          is_approved?: boolean
          is_banned?: boolean
          mbti?: string | null
          mom?: number
          name?: string
          nationality?: string
          number?: number
          personal_values?: string | null
          phone?: string | null
          photo_offset_x?: number | null
          photo_scale?: number | null
          photo_url?: string
          position?: Database["public"]["Enums"]["position_t"]
          portrait_consent_at?: string | null
          profile_photo_locked?: boolean
          profile_photo_url?: string | null
          role?: Database["public"]["Enums"]["player_role_t"]
          season_yellow_cards?: number
          team_id?: string | null
          team_role?: Database["public"]["Enums"]["team_role_t"] | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_fk"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          body: string | null
          created_at: string
          id: string
          reason: Database["public"]["Enums"]["report_reason_t"]
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status_t"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_t"]
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          reason: Database["public"]["Enums"]["report_reason_t"]
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status_t"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_t"]
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          reason?: Database["public"]["Enums"]["report_reason_t"]
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status_t"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target_t"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          start_date: string | null
          year: number
        }
        Insert: {
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          start_date?: string | null
          year: number
        }
        Update: {
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string | null
          year?: number
        }
        Relationships: []
      }
      site_popups: {
        Row: {
          body: string
          created_at: string
          cta_href: string
          cta_label: string
          detail_one: string
          detail_two: string
          dismiss_version: number
          display_delay_ms: number
          ends_at: string | null
          eyebrow: string
          id: string
          image_url: string
          is_active: boolean
          name: string
          placement: string
          priority: number
          secondary_href: string
          secondary_label: string
          starts_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string
          created_at?: string
          cta_href?: string
          cta_label?: string
          detail_one?: string
          detail_two?: string
          dismiss_version?: number
          display_delay_ms?: number
          ends_at?: string | null
          eyebrow?: string
          id?: string
          image_url?: string
          is_active?: boolean
          name: string
          placement?: string
          priority?: number
          secondary_href?: string
          secondary_label?: string
          starts_at?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          cta_href?: string
          cta_label?: string
          detail_one?: string
          detail_two?: string
          dismiss_version?: number
          display_delay_ms?: number
          ends_at?: string | null
          eyebrow?: string
          id?: string
          image_url?: string
          is_active?: boolean
          name?: string
          placement?: string
          priority?: number
          secondary_href?: string
          secondary_label?: string
          starts_at?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_popups_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_dues_expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          memo: string | null
          occurred_on: string
          team_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          memo?: string | null
          occurred_on?: string
          team_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          memo?: string | null
          occurred_on?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_dues_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_dues_expenses_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_dues_payments: {
        Row: {
          amount_paid: number
          id: string
          memo: string | null
          paid_at: string | null
          period_id: string
          player_id: string
          recorded_by: string | null
          status: Database["public"]["Enums"]["team_dues_payment_status_t"]
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          id?: string
          memo?: string | null
          paid_at?: string | null
          period_id: string
          player_id: string
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["team_dues_payment_status_t"]
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          id?: string
          memo?: string | null
          paid_at?: string | null
          period_id?: string
          player_id?: string
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["team_dues_payment_status_t"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_dues_payments_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "team_dues_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_dues_payments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_dues_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_dues_periods: {
        Row: {
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          memo: string | null
          monthly_amount: number
          period_month: string
          team_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          memo?: string | null
          monthly_amount: number
          period_month: string
          team_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          memo?: string | null
          monthly_amount?: number
          period_month?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_dues_periods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_dues_periods_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_gallery_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          is_hidden: boolean
          match_id: string | null
          storage_path: string
          team_id: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          is_hidden?: boolean
          match_id?: string | null
          storage_path: string
          team_id: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          is_hidden?: boolean
          match_id?: string | null
          storage_path?: string
          team_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_gallery_photos_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_gallery_photos_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_gallery_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_join_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          player_id: string
          processed_at: string | null
          processed_by: string | null
          status: Database["public"]["Enums"]["team_join_status_t"]
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          player_id: string
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["team_join_status_t"]
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          player_id?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["team_join_status_t"]
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_join_requests_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_join_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_join_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          banner_url: string | null
          captain_id: string | null
          created_at: string
          description: string | null
          founded_year: number | null
          id: string
          intro_subtitle: string | null
          is_approved: boolean
          league_tier: Database["public"]["Enums"]["league_tier_t"]
          logo: string
          member_count: number
          name: string
          participation_streak: number
          portrait_consent_at: string | null
          season_stats: Json
          team_type: Database["public"]["Enums"]["team_type_t"]
        }
        Insert: {
          banner_url?: string | null
          captain_id?: string | null
          created_at?: string
          description?: string | null
          founded_year?: number | null
          id?: string
          intro_subtitle?: string | null
          is_approved?: boolean
          league_tier?: Database["public"]["Enums"]["league_tier_t"]
          logo?: string
          member_count?: number
          name: string
          participation_streak?: number
          portrait_consent_at?: string | null
          season_stats?: Json
          team_type?: Database["public"]["Enums"]["team_type_t"]
        }
        Update: {
          banner_url?: string | null
          captain_id?: string | null
          created_at?: string
          description?: string | null
          founded_year?: number | null
          id?: string
          intro_subtitle?: string | null
          is_approved?: boolean
          league_tier?: Database["public"]["Enums"]["league_tier_t"]
          logo?: string
          member_count?: number
          name?: string
          participation_streak?: number
          portrait_consent_at?: string | null
          season_stats?: Json
          team_type?: Database["public"]["Enums"]["team_type_t"]
        }
        Relationships: [
          {
            foreignKeyName: "teams_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_entry_fees: {
        Row: {
          amount: number
          id: string
          memo: string | null
          paid_at: string | null
          status: string
          team_id: string
          tournament_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number
          id?: string
          memo?: string | null
          paid_at?: string | null
          status?: string
          team_id: string
          tournament_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          id?: string
          memo?: string | null
          paid_at?: string | null
          status?: string
          team_id?: string
          tournament_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tournaments: {
        Row: {
          created_at: string
          date: string | null
          fixtures_published: boolean
          groups: Json
          id: string
          location: string | null
          name: string
          season_id: string | null
          status: string
          winning_team_id: string | null
          winning_team_name: string | null
        }
        Insert: {
          created_at?: string
          date?: string | null
          fixtures_published?: boolean
          groups?: Json
          id?: string
          location?: string | null
          name: string
          season_id?: string | null
          status?: string
          winning_team_id?: string | null
          winning_team_name?: string | null
        }
        Update: {
          created_at?: string
          date?: string | null
          fixtures_published?: boolean
          groups?: Json
          id?: string
          location?: string | null
          name?: string
          season_id?: string | null
          status?: string
          winning_team_id?: string | null
          winning_team_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_winning_team_id_fkey"
            columns: ["winning_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_player_profiles: {
        Row: {
          assists: number
          attendance_streak: number
          attendance_streak_best: number
          badges: string[]
          ban_matches_remaining: number
          bio: string | null
          card_rating: number
          card_skin: "standard" | "hologram"
          card_type: Database["public"]["Enums"]["card_type_t"]
          created_at: string
          disposition: string | null
          games: number
          goals: number
          id: string
          is_approved: boolean
          is_banned: boolean
          mbti: string | null
          mom: number
          name: string
          nationality: string
          number: number
          personal_values: string | null
          photo_offset_x: number | null
          photo_scale: number | null
          photo_url: string
          position: Database["public"]["Enums"]["position_t"]
          profile_photo_locked: boolean
          profile_photo_url: string | null
          role: Database["public"]["Enums"]["player_role_t"]
          season_yellow_cards: number
          team_id: string | null
        }
        Relationships: []
      }
      team_member_player_profiles: {
        Row: Database["public"]["Views"]["public_player_profiles"]["Row"] & {
          team_role: Database["public"]["Enums"]["team_role_t"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      register_team: {
        Args: { p_request_id: string; p_name: string; p_logo?: string; p_founded_year?: number | null; p_team_type?: string; p_portrait_consent_at?: string | null };
        Returns: Database["public"]["Tables"]["teams"]["Row"];
      };
      add_match_event: {
        Args: {
          p_half?: number
          p_match_id: string
          p_minute?: number
          p_player_id?: string | null
          p_player_name?: string
          p_team_id?: string | null
          p_type: Database["public"]["Enums"]["match_event_t"]
        }
        Returns: string
      }
      backfill_badge_unlocks: { Args: never; Returns: undefined }
      bump_post_view: { Args: { p_post_id: string }; Returns: undefined }
      cancel_match_event: {
        Args: { p_event_id: string; p_match_id: string }
        Returns: undefined
      }
      compute_card_rating: {
        Args: { p_assists: number; p_goals: number; p_mom: number }
        Returns: number
      }
      end_match: { Args: { p_match_id: string }; Returns: undefined }
      forfeit_match: {
        Args: { p_match_id: string; p_forfeit_team_id: string }
        Returns: undefined
      }
      get_admin_profiles: {
        Args: never
        Returns: Database["public"]["Tables"]["profiles"]["Row"][]
      }
      get_my_profile: {
        Args: never
        Returns: Database["public"]["Tables"]["profiles"]["Row"][]
      }
      get_team_admin_profiles: {
        Args: { p_team_id: string }
        Returns: Database["public"]["Tables"]["profiles"]["Row"][]
      }
      get_team_join_request_profiles: {
        Args: { p_team_id: string }
        Returns: Database["public"]["Tables"]["profiles"]["Row"][]
      }
      get_team_member_profiles: {
        Args: { p_team_id: string }
        Returns: Database["public"]["Views"]["team_member_player_profiles"]["Row"][]
      }
      enforce_user_rate_limit: {
        Args: {
          p_max: number
          p_seconds: number
          p_table: string
          p_user_col: string
          p_user_id: string
        }
        Returns: undefined
      }
      get_vapid_public_key: { Args: never; Returns: string }
      get_skill_challenge_leaderboard: {
        Args: { p_event_slug?: string; p_limit?: number }
        Returns: {
          air_touch_score: number
          card_badge_ids: string[]
          completed_at: string | null
          created_at: string
          event_badges: string[]
          event_date: string
          event_slug: string
          id: string
          participant_name: string
          photo_url: string | null
          player_id: string
          player_number: number | null
          player_position: string | null
          profile_photo_url: string | null
          speed_kmh: number
          target_hit: boolean
          target_attempt_count: number | null
          target_number: number
          target_recorded: boolean
          total_score: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_referee_or_admin: { Args: never; Returns: boolean }
      leave_team: { Args: never; Returns: undefined }
      notify_next_match_ready: { Args: { p_match_id: string }; Returns: number }
      pause_match: { Args: { p_match_id: string }; Returns: undefined }
      resume_match: { Args: { p_match_id: string }; Returns: undefined }
      start_match: { Args: { p_match_id: string }; Returns: undefined }
      upsert_skill_challenge_record: {
        Args: {
          p_air_touch_score: number
          p_event_date: string
          p_event_slug: string
          p_memo?: string | null
          p_player_id: string
          p_speed_kmh: number
          p_target_hit: boolean
          p_target_attempt_count: number | null
          p_target_recorded: boolean
        }
        Returns: Database["public"]["Tables"]["skill_challenge_records"]["Row"]
      }
      update_match_timer: {
        Args: {
          p_current_half?: number
          p_elapsed_seconds: number
          p_match_id: string
        }
        Returns: undefined
      }
      claim_team_coach: { Args: { p_team_id: string }; Returns: undefined }
      is_team_coach: { Args: { p_team_id: string }; Returns: boolean }
      is_team_director: { Args: { p_team_id: string }; Returns: boolean }
      is_team_match_staff: { Args: { p_team_id: string }; Returns: boolean }
      is_team_manager: { Args: { p_team_id: string }; Returns: boolean }
      is_team_member: { Args: { p_team_id: string }; Returns: boolean }
      set_team_member_role: {
        Args: {
          p_player_id: string
          p_team_role: Database["public"]["Enums"]["team_role_t"]
        }
        Returns: undefined
      }
      transfer_team_ownership: {
        Args: {
          p_team_id: string
          p_new_owner_id: string
        }
        Returns: undefined
      }
      substitute_player: {
        Args: {
          p_match_id: string
          p_team_id: string
          p_out_player_id: string
          p_in_player_id: string
          p_in_player_name?: string
          p_minute?: number
          p_half?: number
        }
        Returns: undefined
      }
      is_team_staff: { Args: { p_team_id: string }; Returns: boolean }
      match_is_open: { Args: { p_match_id: string }; Returns: boolean }
      notify_mentions: {
        Args: {
          p_mentioned_user_ids: string[]
          p_target_id: string
          p_target_type: string
        }
        Returns: undefined
      }
      promote_team: { Args: { p_team_id: string }; Returns: undefined }
      process_team_join_request: {
        Args: {
          p_request_id: string
          p_status: Database["public"]["Enums"]["team_join_status_t"]
        }
        Returns: undefined
      }
      record_participation: { Args: { p_team_id: string }; Returns: undefined }
      relegate_team: { Args: { p_team_id: string }; Returns: undefined }
      reset_participation_streak: {
        Args: { p_team_id: string }
        Returns: undefined
      }
      safe_uuid: { Args: { p: string }; Returns: string }
      set_match_mom: {
        Args: { p_match_id: string; p_player_id: string }
        Returns: undefined
      }
      set_player_approval: {
        Args: { p_is_approved: boolean; p_player_id: string }
        Returns: undefined
      }
      set_player_eligibility: {
        Args: { p_player_id: string; p_is_registered_player: boolean }
        Returns: undefined
      }
      set_player_role: {
        Args: {
          p_player_id: string
          p_role: Database["public"]["Enums"]["player_role_t"]
        }
        Returns: undefined
      }
    }
    Enums: {
      activity_kind_t:
        | "post_created"
        | "comment_created"
        | "match_finished"
        | "photo_uploaded"
        | "badge_earned"
        | "player_joined"
        | "tournament_created"
        | "tier_promoted"
      card_type_t: "gold" | "premium"
      league_tier_t: "bronze" | "silver" | "gold" | "premium"
      match_event_t:
        | "goal"
        | "assist"
        | "yellow_card"
        | "red_card"
        | "substitution"
        | "mom"
        | "foul"
      match_status_t: "scheduled" | "live" | "finished" | "cancelled"
      notification_kind_t:
        | "mention"
        | "reply"
        | "reaction"
        | "team_notice"
        | "coach_approved"
        | "tier_promoted"
        | "player_approved"
        | "team_role_changed"
        | "match_ready"
      player_role_t: "player" | "captain" | "referee" | "admin"
      position_t: "GK" | "FIXO" | "ALA" | "PIVO"
      post_category_t: "자유" | "매치후기" | "팁" | "모집" | "질문"
      report_reason_t: "spam" | "abuse" | "sexual" | "illegal" | "other"
      report_status_t: "pending" | "resolved" | "dismissed"
      report_target_t: "post" | "comment" | "photo"
      team_dues_payment_status_t: "unpaid" | "paid" | "exempt" | "partial"
      team_join_status_t: "pending" | "approved" | "rejected"
      team_role_t: "member" | "captain" | "manager" | "coach"
      team_type_t: "community" | "club"
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
      activity_kind_t: [
        "post_created",
        "comment_created",
        "match_finished",
        "photo_uploaded",
        "badge_earned",
        "player_joined",
        "tournament_created",
        "tier_promoted",
      ],
      card_type_t: ["gold", "premium"],
      league_tier_t: ["bronze", "silver", "gold", "premium"],
      match_event_t: [
        "goal",
        "assist",
        "yellow_card",
        "red_card",
        "substitution",
        "mom",
        "foul",
      ],
      match_status_t: ["scheduled", "live", "finished", "cancelled"],
      notification_kind_t: [
        "mention",
        "reply",
        "reaction",
        "team_notice",
        "coach_approved",
        "tier_promoted",
        "player_approved",
        "team_role_changed",
        "match_ready",
      ],
      player_role_t: ["player", "captain", "referee", "admin"],
      position_t: ["GK", "FIXO", "ALA", "PIVO"],
      post_category_t: ["자유", "매치후기", "팁", "모집", "질문"],
      report_reason_t: ["spam", "abuse", "sexual", "illegal", "other"],
      report_status_t: ["pending", "resolved", "dismissed"],
      report_target_t: ["post", "comment", "photo"],
      team_dues_payment_status_t: ["unpaid", "paid", "exempt", "partial"],
      team_join_status_t: ["pending", "approved", "rejected"],
      team_role_t: ["member", "captain", "manager", "coach"],
      team_type_t: ["community", "club"],
    },
  },
} as const
