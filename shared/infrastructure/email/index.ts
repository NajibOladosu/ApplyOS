/**
 * Email Module
 * Exports all email-related functions and types
 */

export { emailService, sendEmailDirectly, processPendingEmails, getEmailStats } from './service';
export { getTransporter, verifyTransporter, sendEmailViaSMTP } from './transport';
export { emailConfig, getEmailConfig } from './config';
export type {
  EmailTemplateType,
  EmailQueueEntry,
  EmailSendOptions,
  WelcomeEmailData,
  VerificationEmailData,
  StatusUpdateEmailData,
  DeadlineReminderEmailData,
  WeeklyDigestEmailData,
  EmailService,
} from './types';
