// 자동 생성: Supabase project ovtnmslyjzvghirdvife
// 재생성: npx supabase gen types typescript --project-id ovtnmslyjzvghirdvife
// 손으로 수정하지 말 것 — 스키마 변경 시 재생성한다.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
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
          post_id: string
          reaction_count: number
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
          reaction_count?: number
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          reaction_count?: number
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
      profiles: {
        Row: {
          assists: number
          badges: string[]
          ban_matches_remaining: number
          bio: string | null
          birth_date: string | null
          card_rating: number
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
          profile_photo_url: string | null
          role: Database["public"]["Enums"]["player_role_t"]
          season_yellow_cards: number
          team_id: string | null
          team_role: Database["public"]["Enums"]["team_role_t"] | null
        }
        Insert: {
          assists?: number
          badges?: string[]
          ban_matches_remaining?: number
          bio?: string | null
          birth_date?: string | null
          card_rating?: number
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
          profile_photo_url?: string | null
          role?: Database["public"]["Enums"]["player_role_t"]
          season_yellow_cards?: number
          team_id?: string | null
          team_role?: Database["public"]["Enums"]["team_role_t"] | null
        }
        Update: {
          assists?: number
          badges?: string[]
          ban_matches_remaining?: number
          bio?: string | null
          birth_date?: string | null
          card_rating?: number
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
      team_gallery_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          match_id: string | null
          storage_path: string
          team_id: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          match_id?: string | null
          storage_path: string
          team_id: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
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
          logo: string
          member_count: number
          name: string
          season_stats: Json
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
          logo?: string
          member_count?: number
          name: string
          season_stats?: Json
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
          logo?: string
          member_count?: number
          name?: string
          season_stats?: Json
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
      tournaments: {
        Row: {
          created_at: string
          date: string | null
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
      [_ in never]: never
    }
    Functions: {
      bump_post_view: { Args: { p_post_id: string }; Returns: undefined }
      end_match: { Args: { p_match_id: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      is_referee_or_admin: { Args: never; Returns: boolean }
      is_team_coach: { Args: { p_team_id: string }; Returns: boolean }
      is_team_manager: { Args: { p_team_id: string }; Returns: boolean }
      is_team_staff: { Args: { p_team_id: string }; Returns: boolean }
      notify_mentions: {
        Args: {
          p_mentioned_user_ids: string[]
          p_target_id: string
          p_target_type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      card_type_t: "gold" | "premium"
      match_event_t:
        | "goal"
        | "assist"
        | "yellow_card"
        | "red_card"
        | "substitution"
        | "mom"
      match_status_t: "scheduled" | "live" | "finished" | "cancelled"
      notification_kind_t:
        | "mention"
        | "reply"
        | "reaction"
        | "team_notice"
        | "coach_approved"
      player_role_t: "player" | "captain" | "referee" | "admin"
      position_t: "GK" | "FIXO" | "ALA" | "PIVO"
      post_category_t: "자유" | "매치후기" | "팁" | "모집" | "질문"
      team_role_t: "member" | "captain" | "manager" | "coach"
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
      card_type_t: ["gold", "premium"],
      match_event_t: [
        "goal",
        "assist",
        "yellow_card",
        "red_card",
        "substitution",
        "mom",
      ],
      match_status_t: ["scheduled", "live", "finished", "cancelled"],
      notification_kind_t: [
        "mention",
        "reply",
        "reaction",
        "team_notice",
        "coach_approved",
      ],
      player_role_t: ["player", "captain", "referee", "admin"],
      position_t: ["GK", "FIXO", "ALA", "PIVO"],
      post_category_t: ["자유", "매치후기", "팁", "모집", "질문"],
      team_role_t: ["member", "captain", "manager", "coach"],
    },
  },
} as const
