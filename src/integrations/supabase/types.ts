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
      achievements: {
        Row: {
          code: string
          description: string | null
          earned_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          code: string
          description?: string | null
          earned_at?: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          code?: string
          description?: string | null
          earned_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          created_at: string
          event: string
          id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          tags: string[]
          title: string | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          tags?: string[]
          title?: string | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          tags?: string[]
          title?: string | null
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          location: string | null
          starts_at: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          starts_at: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          starts_at?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      coding_attempts: {
        Row: {
          challenge_on: string
          created_at: string
          difficulty: string
          id: string
          language: string
          solution: string | null
          status: string
          title: string
          topic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_on?: string
          created_at?: string
          difficulty?: string
          id?: string
          language?: string
          solution?: string | null
          status?: string
          title: string
          topic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_on?: string
          created_at?: string
          difficulty?: string
          id?: string
          language?: string
          solution?: string | null
          status?: string
          title?: string
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_missions: {
        Row: {
          created_at: string
          detail: string | null
          done: boolean
          id: string
          mission_on: string
          title: string
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          created_at?: string
          detail?: string | null
          done?: boolean
          id?: string
          mission_on?: string
          title: string
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          created_at?: string
          detail?: string | null
          done?: boolean
          id?: string
          mission_on?: string
          title?: string
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      flashcards: {
        Row: {
          back: string
          created_at: string
          deck: string
          front: string
          id: string
          user_id: string
        }
        Insert: {
          back: string
          created_at?: string
          deck?: string
          front: string
          id?: string
          user_id: string
        }
        Update: {
          back?: string
          created_at?: string
          deck?: string
          front?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          duration_min: number
          ended_at: string
          id: string
          label: string | null
          user_id: string
        }
        Insert: {
          duration_min: number
          ended_at?: string
          id?: string
          label?: string | null
          user_id: string
        }
        Update: {
          duration_min?: number
          ended_at?: string
          id?: string
          label?: string | null
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          description: string | null
          id: string
          progress_pct: number
          status: string
          target_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          progress_pct?: number
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          progress_pct?: number
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          created_at: string
          habit_id: string
          id: string
          logged_on: string
          user_id: string
        }
        Insert: {
          created_at?: string
          habit_id: string
          id?: string
          logged_on?: string
          user_id: string
        }
        Update: {
          created_at?: string
          habit_id?: string
          id?: string
          logged_on?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          created_at: string
          frequency: string
          id: string
          name: string
          streak: number
          user_id: string
        }
        Insert: {
          created_at?: string
          frequency?: string
          id?: string
          name: string
          streak?: number
          user_id: string
        }
        Update: {
          created_at?: string
          frequency?: string
          id?: string
          name?: string
          streak?: number
          user_id?: string
        }
        Relationships: []
      }
      internship_applications: {
        Row: {
          company: string
          created_at: string
          description: string | null
          employment_type: string | null
          id: string
          location: string | null
          notes: string | null
          posted_at: string | null
          source: string | null
          status: string
          stipend: string | null
          title: string
          updated_at: string
          url: string
          user_id: string
          work_mode: string | null
        }
        Insert: {
          company: string
          created_at?: string
          description?: string | null
          employment_type?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          posted_at?: string | null
          source?: string | null
          status?: string
          stipend?: string | null
          title: string
          updated_at?: string
          url: string
          user_id: string
          work_mode?: string | null
        }
        Update: {
          company?: string
          created_at?: string
          description?: string | null
          employment_type?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          posted_at?: string | null
          source?: string | null
          status?: string
          stipend?: string | null
          title?: string
          updated_at?: string
          url?: string
          user_id?: string
          work_mode?: string | null
        }
        Relationships: []
      }
      memory_embeddings: {
        Row: {
          chunk_index: number
          chunk_text: string
          created_at: string
          embedding: string | null
          id: string
          item_id: string
          model_version: string
          user_id: string
        }
        Insert: {
          chunk_index?: number
          chunk_text: string
          created_at?: string
          embedding?: string | null
          id?: string
          item_id: string
          model_version?: string
          user_id: string
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          created_at?: string
          embedding?: string | null
          id?: string
          item_id?: string
          model_version?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_embeddings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "memory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_items: {
        Row: {
          archived: boolean
          category: Database["public"]["Enums"]["memory_category"]
          content: string | null
          created_at: string
          deleted_at: string | null
          favorite: boolean
          id: string
          kind: Database["public"]["Enums"]["memory_kind"]
          metadata: Json
          pinned: boolean
          source_id: string | null
          source_table: string | null
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          category?: Database["public"]["Enums"]["memory_category"]
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          favorite?: boolean
          id?: string
          kind: Database["public"]["Enums"]["memory_kind"]
          metadata?: Json
          pinned?: boolean
          source_id?: string | null
          source_table?: string | null
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          category?: Database["public"]["Enums"]["memory_category"]
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          favorite?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["memory_kind"]
          metadata?: Json
          pinned?: boolean
          source_id?: string | null
          source_table?: string | null
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      memory_versions: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          snapshot: Json
          source_id: string
          source_table: string
          user_id: string
          version_no: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          snapshot: Json
          source_id: string
          source_table: string
          user_id: string
          version_no: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          snapshot?: Json
          source_id?: string
          source_table?: string
          user_id?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "memory_versions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "memory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          created_at: string
          id: string
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string
          created_at: string
          id: string
          topic: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          topic: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      quizzes: {
        Row: {
          created_at: string
          id: string
          questions: Json
          topic: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          questions?: Json
          topic: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          questions?: Json
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      resource_bookmarks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: string
          source: string | null
          thumbnail: string | null
          title: string
          topic: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          source?: string | null
          thumbnail?: string | null
          title: string
          topic?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          source?: string | null
          thumbnail?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      resource_search_history: {
        Row: {
          id: string
          searched_at: string
          topic: string
          user_id: string
        }
        Insert: {
          id?: string
          searched_at?: string
          topic: string
          user_id: string
        }
        Update: {
          id?: string
          searched_at?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      resource_searches: {
        Row: {
          created_at: string
          id: string
          results: Json
          topic: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          results?: Json
          topic: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          results?: Json
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          created_at: string
          id: string
          kind: string
          notes: string | null
          sem_no: number | null
          subject: string | null
          tags: string[]
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          notes?: string | null
          sem_no?: number | null
          subject?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          notes?: string | null
          sem_no?: number | null
          subject?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rewards: {
        Row: {
          code: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          code: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          code?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      roadmaps: {
        Row: {
          created_at: string
          goal: string
          id: string
          steps: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          goal: string
          id?: string
          steps: Json
          user_id: string
        }
        Update: {
          created_at?: string
          goal?: string
          id?: string
          steps?: Json
          user_id?: string
        }
        Relationships: []
      }
      semester_courses: {
        Row: {
          created_at: string
          credits: number
          grade_point: number
          id: string
          name: string
          semester_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          grade_point?: number
          id?: string
          name: string
          semester_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          grade_point?: number
          id?: string
          name?: string
          semester_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "semester_courses_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      semesters: {
        Row: {
          created_at: string
          id: string
          label: string | null
          sem_no: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          sem_no: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          sem_no?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sleep_logs: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          quality: number | null
          slept_at: string
          user_id: string
          woke_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          quality?: number | null
          slept_at: string
          user_id: string
          woke_at: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          quality?: number | null
          slept_at?: string
          user_id?: string
          woke_at?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          attended: number
          created_at: string
          id: string
          name: string
          required_pct: number
          total_classes: number
          user_id: string
        }
        Insert: {
          attended?: number
          created_at?: string
          id?: string
          name: string
          required_pct?: number
          total_classes?: number
          user_id: string
        }
        Update: {
          attended?: number
          created_at?: string
          id?: string
          name?: string
          required_pct?: number
          total_classes?: number
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          category: string
          created_at: string
          due_date: string | null
          duration_min: number
          id: string
          notes: string | null
          priority: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          due_date?: string | null
          duration_min?: number
          id?: string
          notes?: string | null
          priority?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          due_date?: string | null
          duration_min?: number
          id?: string
          notes?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          id: string
          kind: string
          note: string | null
          occurred_on: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          occurred_on?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          occurred_on?: string
          user_id?: string
        }
        Relationships: []
      }
      uploads: {
        Row: {
          created_at: string
          filename: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          data_jarvis_access: boolean
          prefs: Json
          updated_at: string
          use_memory_rag: boolean
          user_id: string
          voice_enabled: boolean
        }
        Insert: {
          data_jarvis_access?: boolean
          prefs?: Json
          updated_at?: string
          use_memory_rag?: boolean
          user_id: string
          voice_enabled?: boolean
        }
        Update: {
          data_jarvis_access?: boolean
          prefs?: Json
          updated_at?: string
          use_memory_rag?: boolean
          user_id?: string
          voice_enabled?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      water_logs: {
        Row: {
          id: string
          logged_at: string
          ml: number
          user_id: string
        }
        Insert: {
          id?: string
          logged_at?: string
          ml: number
          user_id: string
        }
        Update: {
          id?: string
          logged_at?: string
          ml?: number
          user_id?: string
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          points: number
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          points?: number
          source: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          points?: number
          source?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_memories: {
        Args: {
          _kinds?: Database["public"]["Enums"]["memory_kind"][]
          _limit?: number
          _query_embedding: string
          _since?: string
          _until?: string
          _user_id: string
        }
        Returns: {
          category: Database["public"]["Enums"]["memory_category"]
          chunk: string
          created_at: string
          item_id: string
          kind: Database["public"]["Enums"]["memory_kind"]
          similarity: number
          summary: string
          title: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      upsert_memory_item: {
        Args: {
          _category: Database["public"]["Enums"]["memory_category"]
          _content: string
          _kind: Database["public"]["Enums"]["memory_kind"]
          _metadata?: Json
          _source_id: string
          _source_table: string
          _summary: string
          _tags?: string[]
          _title: string
          _user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
      memory_category:
        | "knowledge"
        | "learning"
        | "projects"
        | "notes"
        | "assignments"
        | "voice"
        | "chats"
        | "study"
        | "calendar"
        | "goals"
        | "health"
        | "documents"
        | "uploads"
        | "bookmarks"
        | "activity"
        | "archive"
        | "favorites"
        | "trash"
        | "other"
      memory_kind:
        | "chat"
        | "mentor_msg"
        | "voice"
        | "note"
        | "flashcard"
        | "quiz"
        | "study_plan"
        | "task"
        | "goal"
        | "habit"
        | "water"
        | "sleep"
        | "calendar"
        | "bookmark"
        | "upload"
        | "document"
        | "pdf"
        | "image"
        | "code"
        | "roadmap"
        | "ai_answer"
        | "search"
        | "preference"
        | "login"
        | "activity"
        | "transaction"
        | "focus"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
      memory_category: [
        "knowledge",
        "learning",
        "projects",
        "notes",
        "assignments",
        "voice",
        "chats",
        "study",
        "calendar",
        "goals",
        "health",
        "documents",
        "uploads",
        "bookmarks",
        "activity",
        "archive",
        "favorites",
        "trash",
        "other",
      ],
      memory_kind: [
        "chat",
        "mentor_msg",
        "voice",
        "note",
        "flashcard",
        "quiz",
        "study_plan",
        "task",
        "goal",
        "habit",
        "water",
        "sleep",
        "calendar",
        "bookmark",
        "upload",
        "document",
        "pdf",
        "image",
        "code",
        "roadmap",
        "ai_answer",
        "search",
        "preference",
        "login",
        "activity",
        "transaction",
        "focus",
      ],
    },
  },
} as const
