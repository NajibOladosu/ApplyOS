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
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          avatar_url: string | null
          email_verified: boolean | null
          verification_token: string | null
          verification_token_expires_at: string | null
          last_verification_email_sent: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          avatar_url?: string | null
          email_verified?: boolean | null
          verification_token?: string | null
          verification_token_expires_at?: string | null
          last_verification_email_sent?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          avatar_url?: string | null
          email_verified?: boolean | null
          verification_token?: string | null
          verification_token_expires_at?: string | null
          last_verification_email_sent?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      applications: {
        Row: {
          id: string
          user_id: string
          title: string
          url: string | null
          status: string | null
          priority: string | null
          type: string | null
          notes: string | null
          deadline: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          url?: string | null
          status?: string | null
          priority?: string | null
          type?: string | null
          notes?: string | null
          deadline?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          url?: string | null
          status?: string | null
          priority?: string | null
          type?: string | null
          notes?: string | null
          deadline?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      documents: {
        Row: {
          id: string
          user_id: string
          file_name: string
          file_url: string
          file_type: string | null
          file_size: number | null
          parsed_data: Json | null
          version: number | null
          created_at: string | null
          updated_at: string | null
          summary: string | null
          summary_generated_at: string | null
          analysis_status: string | null
          analysis_error: string | null
          parsed_at: string | null
          application_id: string | null
          extracted_text: string | null
        }
        Insert: {
          id?: string
          user_id: string
          file_name: string
          file_url: string
          file_type?: string | null
          file_size?: number | null
          parsed_data?: Json | null
          version?: number | null
          created_at?: string | null
          updated_at?: string | null
          summary?: string | null
          summary_generated_at?: string | null
          analysis_status?: string | null
          analysis_error?: string | null
          parsed_at?: string | null
          application_id?: string | null
          extracted_text?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          file_name?: string
          file_url?: string
          file_type?: string | null
          file_size?: number | null
          parsed_data?: Json | null
          version?: number | null
          created_at?: string | null
          updated_at?: string | null
          summary?: string | null
          summary_generated_at?: string | null
          analysis_status?: string | null
          analysis_error?: string | null
          parsed_at?: string | null
          application_id?: string | null
          extracted_text?: string | null
        }
      }
      questions: {
        Row: {
          id: string
          application_id: string
          question_text: string
          ai_answer: string | null
          manual_answer: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          application_id: string
          question_text: string
          ai_answer?: string | null
          manual_answer?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          application_id?: string
          question_text?: string
          ai_answer?: string | null
          manual_answer?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string | null
          message: string
          is_read: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          type?: string | null
          message: string
          is_read?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: string | null
          message?: string
          is_read?: boolean | null
          created_at?: string | null
        }
      }
      status_history: {
        Row: {
          id: string
          application_id: string
          old_status: string | null
          new_status: string
          changed_by: string | null
          timestamp: string | null
        }
        Insert: {
          id?: string
          application_id: string
          old_status?: string | null
          new_status: string
          changed_by?: string | null
          timestamp?: string | null
        }
        Update: {
          id?: string
          application_id?: string
          old_status?: string | null
          new_status?: string
          changed_by?: string | null
          timestamp?: string | null
        }
      }
      application_documents: {
        Row: {
          id: string
          application_id: string
          document_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          application_id: string
          document_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          application_id?: string
          document_id?: string
          created_at?: string | null
        }
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
  }
}
