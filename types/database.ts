export type ApplicationStatus = 'draft' | 'submitted' | 'in_review' | 'interview' | 'offer' | 'rejected'
export type ApplicationPriority = 'low' | 'medium' | 'high'
export type ApplicationType = 'job' | 'scholarship' | 'internship' | 'other'
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'deadline' | 'status_update'
export type FeedbackType = 'general' | 'bug' | 'feature'
export type FeedbackStatus = 'pending' | 'reviewed' | 'resolved'

export interface ReportCategory {
  name: string
  score: number
  strengths: string[]
  improvements: string[]
}

export interface DocumentReport {
  documentType: string
  overallScore: number
  overallAssessment: string
  categories: ReportCategory[]
}

export interface User {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  email_verified: boolean | null
  verification_token: string | null
  verification_token_expires_at: string | null
  last_verification_email_sent: string | null
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
  job_description: string | null
  ai_cover_letter: string | null
  manual_cover_letter: string | null
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
  report: DocumentReport | null
  report_generated_at: string | null
  analysis_status: 'not_analyzed' | 'pending' | 'success' | 'failed'
  analysis_error: string | null
  parsed_at: string | null
  application_id: string | null
  extracted_text: string | null
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  message: string
  is_read: boolean
  created_at: string
  email_sent?: boolean
  email_sent_at?: string | null
  email_error?: string | null
}

export interface StatusHistory {
  id: string
  application_id: string
  old_status: string | null
  new_status: string
  changed_by: string | null
  timestamp: string
}

export interface Feedback {
  id: string
  user_id: string
  type: FeedbackType
  title: string
  description: string
  status: FeedbackStatus
  created_at: string
  updated_at: string
}

export interface ApplicationNote {
  id: string
  application_id: string
  user_id: string
  content: string
  category: string | null
  is_pinned: boolean
  created_at: string
  updated_at: string
}
