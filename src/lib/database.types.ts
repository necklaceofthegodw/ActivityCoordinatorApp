export type ActivityCategory =
  | 'walk' | 'coffee' | 'squash' | 'running' | 'language'
  | 'skateboard' | 'cycling' | 'yoga' | 'climbing' | 'swimming'
  | 'basketball' | 'volleyball' | 'chess' | 'cooking' | 'hiking'
  | 'photography' | 'music' | 'board_games' | 'gym' | 'dancing'
  | 'other'
export type ActivityStatus = 'open' | 'full' | 'active' | 'archived' | 'expired'

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          nickname: string
          avatar_url: string | null
          bio: string | null
          activity_count: number
          is_banned: boolean
          report_count: number
          push_subscription: unknown | null
          created_at: string
          points: number
          tier: number
          flappy_highscore: number
          is_verified: boolean
          verification_attempts: number
          last_attempt_at: string | null
        }
        Insert: {
          id: string
          nickname: string
          avatar_url?: string | null
          bio?: string | null
          push_subscription?: unknown | null
        }
        Update: {
          nickname?: string
          avatar_url?: string | null
          bio?: string | null
          push_subscription?: unknown | null
          activity_count?: number
          is_banned?: boolean
          report_count?: number
          flappy_highscore?: number
          is_verified?: boolean
          verification_attempts?: number
          last_attempt_at?: string | null
        }
        Relationships: []
      }
      activities: {
        Row: {
          id: string
          organizer_id: string
          title: string
          description: string | null
          category: Database['public']['Enums']['activity_category']
          location: unknown
          location_name: string | null
          scheduled_at: string
          max_participants: number
          current_participants: number
          status: Database['public']['Enums']['activity_status']
          created_at: string
          is_private: boolean
        }
        Insert: {
          organizer_id: string
          title: string
          description?: string | null
          category: Database['public']['Enums']['activity_category']
          location: string
          location_name?: string | null
          scheduled_at: string
          max_participants: number
          is_private?: boolean
        }
        Update: {
          status?: Database['public']['Enums']['activity_status']
          current_participants?: number
          description?: string | null
        }
        Relationships: []
      }
      participants: {
        Row: {
          id: string
          activity_id: string
          user_id: string
          joined_at: string
        }
        Insert: {
          activity_id: string
          user_id: string
        }
        Update: never
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          activity_id: string
          user_id: string
          content: string
          created_at: string
        }
        Insert: {
          activity_id: string
          user_id: string
          content: string
        }
        Update: never
        Relationships: []
      }
      reports: {
        Row: {
          id: string
          reporter_id: string
          reported_user_id: string
          reason: string
          created_at: string
        }
        Insert: {
          reporter_id: string
          reported_user_id: string
          reason: string
        }
        Update: never
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      delete_my_account: {
        Args: Record<string, never>
        Returns: undefined
      }
      get_user_activity_history: {
        Args: { p_user_id: string }
        Returns: Array<{
          id: string
          title: string
          category: Database['public']['Enums']['activity_category']
          scheduled_at: string
          max_participants: number
          current_participants: number
        }>
      }
      create_profile: {
        Args: {
          p_nickname: string
          p_bio: string | null
          p_avatar_url: string | null
        }
        Returns: undefined
      }
      get_nearby_activities: {
        Args: {
          lat: number
          lng: number
          radius_meters: number
          category_filter: Database['public']['Enums']['activity_category'][] | null
        }
        Returns: Array<{
          id: string
          organizer_id: string
          title: string
          description: string | null
          category: Database['public']['Enums']['activity_category']
          location_name: string | null
          scheduled_at: string
          max_participants: number
          current_participants: number
          status: Database['public']['Enums']['activity_status']
          created_at: string
          lat: number
          lng: number
          organizer_nickname: string
          organizer_avatar_url: string | null
          is_private: boolean
        }>
      }
      get_activity_by_id: {
        Args: { p_activity_id: string }
        Returns: Array<{
          id: string
          organizer_id: string
          title: string
          description: string | null
          category: Database['public']['Enums']['activity_category']
          location_name: string | null
          scheduled_at: string
          max_participants: number
          current_participants: number
          status: Database['public']['Enums']['activity_status']
          created_at: string
          lat: number
          lng: number
          organizer_nickname: string
          organizer_avatar_url: string | null
          is_private: boolean
        }>
      }
      is_activity_member: {
        Args: { p_activity_id: string }
        Returns: boolean
      }
      join_activity: {
        Args: { p_activity_id: string }
        Returns: undefined
      }
    }
    Enums: {
      activity_category: ActivityCategory
      activity_status: ActivityStatus
    }
    CompositeTypes: Record<string, never>
  }
}
