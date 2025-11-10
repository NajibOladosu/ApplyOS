/**
 * Email Service
 * Handles all email sending logic with database queue for reliability
 */

import { sendEmailViaSMTP } from './transport';
import { emailConfig } from './config';
import { createClient } from '@/lib/supabase/server';
import {
  WelcomeEmailData,
  StatusUpdateEmailData,
  DeadlineReminderEmailData,
  WeeklyDigestEmailData,
  EmailTemplateType,
  EmailService,
} from './types';

// Import templates
import { welcomeEmailTemplate, welcomeEmailSubject } from './templates/welcome';
import {
  statusUpdateEmailTemplate,
  statusUpdateEmailSubject,
} from './templates/status-update';
import {
  deadlineReminderEmailTemplate,
  deadlineReminderEmailSubject,
} from './templates/deadline-reminder';
import {
  weeklyDigestEmailTemplate,
  weeklyDigestEmailSubject,
} from './templates/weekly-digest';

/**
 * Queue email in database for reliable delivery
 */
async function queueEmail(
  userId: string,
  emailTo: string,
  subject: string,
  htmlBody: string,
  templateType: EmailTemplateType,
  notificationId?: string
) {
  const supabase = await createClient();

  const { data, error } = await supabase.from('email_queue').insert({
    user_id: userId,
    email_to: emailTo,
    subject,
    body: htmlBody.replace(/<[^>]*>/g, ''), // Plain text fallback
    html_body: htmlBody,
    template_type: templateType,
    notification_id: notificationId || null,
    status: 'pending',
  });

  if (error) {
    console.error('Failed to queue email:', error);
    throw error;
  }

  return data;
}

/**
 * Send email immediately and update queue status
 */
async function sendQueuedEmail(queueId: string) {
  const supabase = await createClient();

  // Get email from queue
  const { data: queueEntry, error: getError } = await supabase
    .from('email_queue')
    .select('*')
    .eq('id', queueId)
    .single();

  if (getError || !queueEntry) {
    console.error('Failed to fetch queued email:', getError);
    return false;
  }

  try {
    // Send email
    await sendEmailViaSMTP(
      queueEntry.email_to,
      queueEntry.subject,
      queueEntry.html_body || queueEntry.body
    );

    // Update queue status
    const { error: updateError } = await supabase
      .from('email_queue')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        attempts: queueEntry.attempts + 1,
      })
      .eq('id', queueId);

    if (updateError) {
      console.error('Failed to update email queue:', updateError);
    }

    // Update notification if linked
    if (queueEntry.notification_id) {
      await supabase
        .from('notifications')
        .update({
          email_sent: true,
          email_sent_at: new Date().toISOString(),
        })
        .eq('id', queueEntry.notification_id);
    }

    return true;
  } catch (error) {
    console.error('Failed to send email:', error);

    // Update queue with error
    const { error: updateError } = await supabase
      .from('email_queue')
      .update({
        status: queueEntry.attempts + 1 >= queueEntry.max_attempts ? 'failed' : 'pending',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        attempts: queueEntry.attempts + 1,
      })
      .eq('id', queueId);

    if (updateError) {
      console.error('Failed to update email queue with error:', updateError);
    }

    return false;
  }
}

/**
 * Email Service Implementation
 */
export const emailService: EmailService = {
  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(data: WelcomeEmailData) {
    const htmlBody = welcomeEmailTemplate(data, emailConfig.appUrl);
    const subject = welcomeEmailSubject();

    await queueEmail(
      '', // Will be set by API route
      data.userEmail,
      subject,
      htmlBody,
      'welcome'
    );
  },

  /**
   * Send status update email
   */
  async sendStatusUpdateEmail(data: StatusUpdateEmailData) {
    const htmlBody = statusUpdateEmailTemplate(data, emailConfig.appUrl);
    const subject = statusUpdateEmailSubject(data.applicationTitle, data.newStatus);

    await queueEmail(
      '', // Will be set by API route
      data.applicationTitle, // Will be replaced with actual email in API route
      subject,
      htmlBody,
      'status_update'
    );
  },

  /**
   * Send deadline reminder email
   */
  async sendDeadlineReminderEmail(data: DeadlineReminderEmailData) {
    const htmlBody = deadlineReminderEmailTemplate(data, emailConfig.appUrl);
    const subject = deadlineReminderEmailSubject(data.applications.length);

    await queueEmail(
      '', // Will be set by API route
      '', // Will be set by API route
      subject,
      htmlBody,
      'deadline_reminder'
    );
  },

  /**
   * Send weekly digest email
   */
  async sendWeeklyDigestEmail(data: WeeklyDigestEmailData) {
    const htmlBody = weeklyDigestEmailTemplate(data, emailConfig.appUrl);
    const subject = weeklyDigestEmailSubject();

    await queueEmail(
      '', // Will be set by API route
      '', // Will be set by API route
      subject,
      htmlBody,
      'weekly_digest'
    );
  },

  /**
   * Send test email
   */
  async sendTestEmail(to: string) {
    const subject = 'Trackly Email Test';
    const htmlBody = `
      <h2>Test Email</h2>
      <p>This is a test email from Trackly.</p>
      <p>If you received this, your email configuration is working correctly!</p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
        Sent at: ${new Date().toLocaleString()}
      </p>
    `;

    await sendEmailViaSMTP(to, subject, htmlBody);
  },
};

/**
 * Send email immediately (without queueing)
 * Useful for testing or urgent emails
 */
export async function sendEmailDirectly(
  to: string,
  subject: string,
  htmlBody: string
): Promise<boolean> {
  try {
    await sendEmailViaSMTP(to, subject, htmlBody);
    return true;
  } catch (error) {
    console.error('Failed to send email directly:', error);
    return false;
  }
}

/**
 * Process pending emails from queue
 * Should be called periodically (e.g., every minute via cron)
 */
export async function processPendingEmails() {
  const supabase = await createClient();

  // Get pending emails (not yet attempted or failed with retries remaining)
  const { data: pendingEmails, error } = await supabase
    .from('email_queue')
    .select('*')
    .eq('status', 'pending')
    .lt('attempts', 3) // Less than max attempts
    .order('created_at', { ascending: true })
    .limit(10); // Process max 10 emails per batch

  if (error) {
    console.error('Failed to fetch pending emails:', error);
    return;
  }

  if (!pendingEmails || pendingEmails.length === 0) {
    return;
  }

  console.log(`Processing ${pendingEmails.length} pending emails...`);

  // Send each email
  for (const email of pendingEmails) {
    await sendQueuedEmail(email.id);
    // Add small delay between emails to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * Get email statistics for monitoring
 */
export async function getEmailStats() {
  const supabase = await createClient();

  const { data: stats, error } = await supabase
    .from('email_queue')
    .select('status')
    .then((result) => {
      if (result.error) return result;

      const data = result.data as { status: string }[];
      return {
        data: {
          total: data.length,
          pending: data.filter((e) => e.status === 'pending').length,
          sent: data.filter((e) => e.status === 'sent').length,
          failed: data.filter((e) => e.status === 'failed').length,
          bounced: data.filter((e) => e.status === 'bounced').length,
        },
        error: null,
      };
    });

  if (error) {
    console.error('Failed to get email stats:', error);
    return null;
  }

  return stats;
}
