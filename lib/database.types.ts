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
      game_reviews: {
        Row: {
          black_stats: Json
          created_at: string
          game_id: string
          moves: Json
          summary: string | null
          white_stats: Json
        }
        Insert: {
          black_stats: Json
          created_at?: string
          game_id: string
          moves: Json
          summary?: string | null
          white_stats: Json
        }
        Update: {
          black_stats?: Json
          created_at?: string
          game_id?: string
          moves?: Json
          summary?: string | null
          white_stats?: Json
        }
        Relationships: [
          {
            foreignKeyName: "game_reviews_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          black_player: string | null
          created_at: string
          id: string
          pgn: string | null
          result: string | null
          status: string
          user_id: string
          white_player: string | null
        }
        Insert: {
          black_player?: string | null
          created_at?: string
          id?: string
          pgn?: string | null
          result?: string | null
          status?: string
          user_id: string
          white_player?: string | null
        }
        Update: {
          black_player?: string | null
          created_at?: string
          id?: string
          pgn?: string | null
          result?: string | null
          status?: string
          user_id?: string
          white_player?: string | null
        }
        Relationships: []
      }
      move_history: {
        Row: {
          created_at: string
          explanation: string | null
          fen_after: string
          fen_before: string
          game_id: string
          id: number
          move: string
          move_number: number
        }
        Insert: {
          created_at?: string
          explanation?: string | null
          fen_after: string
          fen_before: string
          game_id: string
          id?: number
          move: string
          move_number: number
        }
        Update: {
          created_at?: string
          explanation?: string | null
          fen_after?: string
          fen_before?: string
          game_id?: string
          id?: number
          move?: string
          move_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_game"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          username: string | null
        }
        Insert: {
          id: string
          username?: string | null
        }
        Update: {
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      puzzles: {
        Row: {
          attempts: number
          created_at: string
          fen: string
          game_id: string | null
          id: string
          solution: string[]
          successes: number
          theme: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          fen: string
          game_id?: string | null
          id?: string
          solution: string[]
          successes?: number
          theme?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          fen?: string
          game_id?: string | null
          id?: string
          solution?: string[]
          successes?: number
          theme?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_game"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          accuracy: number | null
          blunder_rate: number | null
          rating: number
          strengths: Json | null
          updated_at: string
          user_id: string
          weaknesses: Json | null
        }
        Insert: {
          accuracy?: number | null
          blunder_rate?: number | null
          rating?: number
          strengths?: Json | null
          updated_at?: string
          user_id: string
          weaknesses?: Json | null
        }
        Update: {
          accuracy?: number | null
          blunder_rate?: number | null
          rating?: number
          strengths?: Json | null
          updated_at?: string
          user_id?: string
          weaknesses?: Json | null
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
    Enums: {},
  },
} as const
