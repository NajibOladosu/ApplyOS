export type ApplicationStatus = 'draft' | 'submitted' | 'in_review' | 'interview' | 'offer' | 'rejected'
export type ApplicationPriority = 'low' | 'medium' | 'high'
export type ApplicationType = 'job' | 'scholarship' | 'internship' | 'other'
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'deadline' | 'status_update'

export interface User {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Application {
  id: string
  user_id: string
  title: string
  url: string | null
  status: ApplicationStatus
  priority: ApplicationPriority
  type: ApplicationType
  deadline: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Question {
  id: string
  application_id: string
  question_text: string
  ai_answer: string | null
  manual_answer: string | null
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  user_id: string
  file_name: string
  file_url: string
  file_type: string | null
  file_size: number | null
  parsed_data: any
  version: number
  created_at: string
  updated_at: string
  summary: string | null
  summary_generated_at: string | null
  analysis_status: 'not_analyzed' | 'pending' | 'success' | 'failed'
  analysis_error: string | null
  parsed_at: string | null
  application_id: string | null
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  message: string
  is_read: boolean
  created_at: string
}

export interface StatusHistory {
  id: string
  application_id: string
  old_status: string | null
  new_status: string
  changed_by: string | null
  timestamp: string
}
