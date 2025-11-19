/**
 * Email Types
 */

export type EmailTemplateType =
  | 'welcome'
  | 'verification'
  | 'status_update'
  | 'deadline_reminder'
  | 'weekly_digest';

export interface EmailQueueEntry {
  id: string;
  user_id: string;
  notification_id: string | null;
  email_to: string;
  subject: string;
  body: string;
  html_body: string | null;
  template_type: EmailTemplateType;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailSendOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}

export interface WelcomeEmailData {
  userName: string;
  userEmail: string;
}

export interface VerificationEmailData {
  userName: string;
  userEmail: string;
  verificationUrl: string;
}

export interface StatusUpdateEmailData {
  userName: string;
  applicationTitle: string;
  company?: string;
  previousStatus: string;
  newStatus: string;
  applicationUrl: string;
  timestamp: Date;
}

export interface DeadlineReminderEmailData {
  userName: string;
  applications: Array<{
    title: string;
    company: string;
    deadline: Date;
    daysUntil: number;
    url: string;
  }>;
}

export interface WeeklyDigestEmailData {
  userName: string;
  weekStart: Date;
  weekEnd: Date;
  applications: Array<{
    title: string;
    company: string;
    status: string;
    updatedAt: Date;
  }>;
  upcomingDeadlines: Array<{
    title: string;
    company: string;
    deadline: Date;
    daysUntil: number;
  }>;
  totalApplications: number;
  newApplicationsThisWeek: number;
  statusChangeCount: number;
}

export interface EmailService {
  sendWelcomeEmail(data: WelcomeEmailData): Promise<void>;
  sendVerificationEmail(data: VerificationEmailData): Promise<void>;
  sendStatusUpdateEmail(data: StatusUpdateEmailData): Promise<void>;
  sendDeadlineReminderEmail(data: DeadlineReminderEmailData): Promise<void>;
  sendWeeklyDigestEmail(data: WeeklyDigestEmailData): Promise<void>;
  sendTestEmail(to: string): Promise<void>;
}
