/**
 * Email Module
 * Resend-backed transactional / informational / support email.
 */

export { sendEmail, type SendEmailOptions } from './transport'
export { emailConfig, getEmailConfig, type SenderRole } from './config'
export type {
  EmailTemplateType,
  WelcomeEmailData,
  VerificationEmailData,
  StatusUpdateEmailData,
  DeadlineReminderEmailData,
  WeeklyDigestEmailData,
} from './types'
