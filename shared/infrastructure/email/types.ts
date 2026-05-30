/**
 * Email Types
 */

export type EmailTemplateType =
  | 'welcome'
  | 'verification'
  | 'status_update'
  | 'deadline_reminder'
  | 'weekly_digest'
  | 'feedback'
  | 'password_reset'

export interface WelcomeEmailData {
  userId: string
  userName: string
  userEmail: string
}

export interface VerificationEmailData {
  userName: string
  userEmail: string
  verificationUrl: string
}

export interface StatusUpdateEmailData {
  userId: string
  userName: string
  applicationTitle: string
  company?: string
  previousStatus: string
  newStatus: string
  applicationUrl: string
  timestamp: Date
}

export interface DeadlineReminderEmailData {
  userId: string
  userName: string
  applications: Array<{
    title: string
    company: string
    deadline: Date
    daysUntil: number
    url: string
  }>
}

export interface WeeklyDigestEmailData {
  userId: string
  userName: string
  weekStart: Date
  weekEnd: Date
  applications: Array<{
    title: string
    company: string
    status: string
    updatedAt: Date
  }>
  upcomingDeadlines: Array<{
    title: string
    company: string
    deadline: Date
    daysUntil: number
  }>
  totalApplications: number
  newApplicationsThisWeek: number
  statusChangeCount: number
}
