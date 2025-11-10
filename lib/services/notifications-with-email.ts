/**
 * Notifications Service with Email Integration
 * Server-side only - handles creating notifications with optional email sending
 */

import { createClient } from '@/lib/supabase/server';
import { sendEmailDirectly } from '@/lib/email';
import { emailConfig } from '@/lib/email/config';

interface NotificationOptions {
  type: 'info' | 'success' | 'warning' | 'error' | 'deadline' | 'status_update';
  message: string;
  userId: string;
  userEmail?: string;
  sendEmail?: boolean;
  emailSubject?: string;
  emailHtml?: string;
}

/**
 * Create a notification in the database
 */
async function createNotificationRecord(
  userId: string,
  type: string,
  message: string
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      message,
      is_read: false,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Check if user has enabled email notifications for this type
 */
async function shouldSendEmail(userId: string, type: string): Promise<boolean> {
  const supabase = await createClient();

  // Get user's notification preferences from auth metadata
  const { data } = await supabase.auth.admin.getUserById(userId);

  if (!data.user) {
    return false;
  }

  const metadata = data.user.user_metadata || {};

  // Check global email notification setting
  if (metadata.email_notifications === false) {
    return false;
  }

  // Check type-specific settings
  if (type === 'deadline' && metadata.deadline_reminders === false) {
    return false;
  }

  if (type === 'status_update' && metadata.status_updates === false) {
    return false;
  }

  return true;
}

/**
 * Create notification and optionally send email
 */
export async function createNotificationWithEmail(
  options: NotificationOptions
) {
  const {
    type,
    message,
    userId,
    userEmail,
    sendEmail = false,
    emailSubject,
    emailHtml,
  } = options;

  // Create the notification in database
  const notification = await createNotificationRecord(userId, type, message);

  // Send email if requested and user has it enabled
  if (sendEmail && emailSubject && emailHtml && userEmail) {
    const shouldEmail = await shouldSendEmail(userId, type);

    if (shouldEmail) {
      try {
        await sendEmailDirectly(userEmail, emailSubject, emailHtml);

        // Update notification to mark email as sent
        const supabase = await createClient();
        await supabase
          .from('notifications')
          .update({
            email_sent: true,
            email_sent_at: new Date().toISOString(),
          })
          .eq('id', notification.id);
      } catch (error) {
        console.error('Failed to send notification email:', error);
        // Don't throw - notification was created, just email failed
        // Email will be queued for retry via the email queue system
      }
    }
  }

  return notification;
}

/**
 * Create a status update notification with email
 */
export async function createStatusUpdateNotification(
  userId: string,
  userEmail: string,
  applicationTitle: string,
  previousStatus: string,
  newStatus: string
) {
  const message = `Your application for "${applicationTitle}" status changed from ${previousStatus} to ${newStatus}`;

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9fafb;
          }
          .card {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          h2 {
            color: #00FF88;
            margin-bottom: 16px;
          }
          .status-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            margin: 10px 5px 10px 0;
          }
          .status-submitted { background-color: #dbeafe; color: #0c4a6e; }
          .status-in_review { background-color: #fef3c7; color: #92400e; }
          .status-interview { background-color: #dcfce7; color: #166534; }
          .status-offer { background-color: #d1fae5; color: #065f46; }
          .status-rejected { background-color: #fee2e2; color: #7f1d1d; }
          .button {
            display: inline-block;
            background-color: #00FF88;
            color: #000;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <h2>Application Status Updated 📊</h2>
            <p>Hi,</p>
            <p>Your application for <strong>${applicationTitle}</strong> has been updated:</p>
            <p>
              <span class="status-badge status-${previousStatus.toLowerCase().replace(/ /g, '_')}">
                ${previousStatus.toUpperCase()}
              </span>
              →
              <span class="status-badge status-${newStatus.toLowerCase().replace(/ /g, '_')}">
                ${newStatus.toUpperCase()}
              </span>
            </p>
            <p>
              <a href="${emailConfig.appUrl}/applications" class="button">View Application</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  return createNotificationWithEmail({
    type: 'status_update',
    message,
    userId,
    userEmail,
    sendEmail: true,
    emailSubject: `Application Update: ${applicationTitle} → ${newStatus}`,
    emailHtml,
  });
}

/**
 * Create a deadline reminder notification with email
 */
export async function createDeadlineNotification(
  userId: string,
  userEmail: string,
  applicationTitle: string,
  daysUntil: number
) {
  const urgencyWord =
    daysUntil === 1 ? 'TODAY' : daysUntil <= 3 ? 'SOON' : 'UPCOMING';
  const message = `Deadline ${urgencyWord}: ${applicationTitle} due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`;

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9fafb;
          }
          .card {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          h2 {
            color: ${daysUntil === 1 ? '#dc2626' : daysUntil <= 3 ? '#f97316' : '#eab308'};
            margin-bottom: 16px;
          }
          .button {
            display: inline-block;
            background-color: #00FF88;
            color: #000;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 20px;
          }
          .urgent {
            color: #dc2626;
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <h2>⏰ Deadline Reminder ${daysUntil === 1 ? '🔴' : daysUntil <= 3 ? '🟠' : '🟡'}</h2>
            <p>Hi,</p>
            <p>
              Your application for <strong>${applicationTitle}</strong>
              <span class="urgent"> has a deadline in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}!</span>
            </p>
            <p>
              Make sure to submit before the deadline to ensure your application is reviewed.
            </p>
            <p>
              <a href="${emailConfig.appUrl}/applications" class="button">View Applications</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  return createNotificationWithEmail({
    type: 'deadline',
    message,
    userId,
    userEmail,
    sendEmail: true,
    emailSubject: `⏰ Deadline Reminder: ${applicationTitle} (${daysUntil} days)`,
    emailHtml,
  });
}
