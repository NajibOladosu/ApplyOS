/**
 * Deadline Reminder Cron Job
 * POST /api/cron/deadline-reminders
 * Runs daily to send deadline reminder emails
 * Triggered by Vercel Cron or external scheduler
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@supabase/supabase-js';
import { sendEmailDirectly } from '@/shared/infrastructure/email';
import { emailConfig } from '@/shared/infrastructure/email/config';

export const dynamic = 'force-dynamic'

/**
 * Check deadline reminders
 * - 7 days before deadline
 * - 3 days before deadline
 * - 1 day before deadline
 */
export async function POST(request: NextRequest) {
  try {
    // Verify request is from Vercel Cron or authorized source
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role key to bypass RLS policies for cron jobs
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Get all applications with upcoming deadlines that we should remind about
    // Use UTC to match database timezone
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));

    // Get applications with deadlines in 1, 3, or 7 days (only draft status)
    const { data: applications, error: appsError } = await supabase
      .from('applications')
      .select('id, user_id, title, deadline, status')
      .not('deadline', 'is', null)
      .eq('status', 'draft');

    if (appsError) {
      console.error('Failed to fetch applications:', appsError);
      return NextResponse.json(
        { error: 'Failed to fetch applications' },
        { status: 500 }
      );
    }

    if (!applications || applications.length === 0) {
      return NextResponse.json(
        { message: 'No applications with deadlines found' },
        { status: 200 }
      );
    }

    let emailsSent = 0;
    const remindDays = [0, 1, 3, 7]; // 0 = today, 1 = tomorrow, etc.

    // Check each application for deadline reminders
    for (const app of applications) {
      const deadline = new Date(app.deadline);
      const daysUntil = Math.floor(
        (deadline.getTime() - todayUTC.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Send reminder if deadline is today or in 1, 3, or 7 days
      if (remindDays.includes(daysUntil)) {
        try {
          // Get user email
          const { data: userData, error: userError } =
            await supabase.auth.admin.getUserById(app.user_id);

          if (userError || !userData.user?.email) {
            console.error(
              `Failed to get email for user ${app.user_id}:`,
              userError
            );
            continue;
          }

          // Check if we already sent a reminder for this app today
          const { data: existingNotif } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', app.user_id)
            .eq('type', 'deadline')
            .contains('message', app.title)
            .not('created_at', 'is', null)
            .gte('created_at', todayUTC.toISOString());

          if (existingNotif && existingNotif.length > 0) {
            console.log(`Already sent deadline reminder for ${app.title}`);
            continue;
          }

          // Create notification directly with service role to bypass RLS
          const urgencyWord =
            daysUntil === 1 ? 'TODAY' : daysUntil <= 3 ? 'SOON' : 'UPCOMING';
          const message = `Deadline ${urgencyWord}: ${app.title} due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`;

          const { error: notifError } = await supabase
            .from('notifications')
            .insert({
              user_id: app.user_id,
              type: 'deadline',
              message,
              is_read: false,
            });

          if (notifError) {
            console.error(
              `Failed to create deadline notification for app ${app.id}:`,
              notifError
            );
            continue;
          }

          // Send email notification directly using ApplyOS theme
          try {
            const urgencyEmoji =
              daysUntil === 1 ? '🔴' : daysUntil <= 3 ? '🟠' : '🟡';
            const urgencyColor =
              daysUntil === 1
                ? '#dc2626'
                : daysUntil <= 3
                  ? '#f97316'
                  : '#eab308';

            const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ApplyOS</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #EDEDED;
      background-color: #0A0A0A;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #00FF88 0%, #00CC66 100%);
      color: #000;
      padding: 40px 20px;
      text-align: center;
      border-radius: 12px 12px 0 0;
    }
    .header h1 {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin: 0 0 8px 0;
    }
    .header-subtitle {
      font-size: 14px;
      color: #1A1A1A;
      margin: 0;
    }
    .content {
      background-color: #101010;
      padding: 40px 30px;
      border-radius: 0 0 12px 12px;
    }
    .footer {
      background-color: #0A0A0A;
      padding: 20px;
      text-align: center;
      border-top: 1px solid #1A1A1A;
      margin-top: 20px;
      border-radius: 8px;
    }
    .button {
      display: inline-block;
      background-color: #00FF88;
      color: #000 !important;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none !important;
      font-weight: 600;
      margin: 20px 0;
      transition: background-color 0.2s;
    }
    .button:hover {
      background-color: #00CC66;
    }
    .button:visited {
      color: #000 !important;
    }
    h2 {
      font-size: 20px;
      margin-bottom: 16px;
      color: #EDEDED;
    }
    p {
      margin-bottom: 16px;
      color: #B5B5B5;
      font-size: 14px;
      line-height: 1.6;
    }
    .divider {
      height: 1px;
      background-color: #1A1A1A;
      margin: 30px 0;
    }
    .card {
      background-color: #0A0A0A;
      border: 1px solid #1A1A1A;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .card-title {
      font-weight: 600;
      color: #EDEDED;
      margin-bottom: 8px;
      font-size: 16px;
    }
    .deadline-info {
      margin-bottom: 12px;
      font-size: 13px;
      color: #B5B5B5;
    }
    .urgency-text {
      font-weight: 700;
      color: ${urgencyColor};
    }
    .tip {
      font-size: 12px;
      color: #808080;
      margin-top: 20px;
      text-align: center;
    }
    .footer-text {
      font-size: 12px;
      color: #808080;
      margin: 0 0 10px 0;
    }
    .footer-link {
      color: #00FF88;
      text-decoration: none;
      font-weight: 600;
    }
    .footer-link:hover {
      color: #00CC66;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ Deadline Reminder</h1>
      <p class="header-subtitle">Don't miss your deadline</p>
    </div>
    <div class="content">
      <p>Hi,</p>

      <p>You have an upcoming application deadline that needs your attention!</p>

      <div class="divider"></div>

      <div class="card">
        <div class="card-title">${app.title}</div>
        <div class="deadline-info">
          <strong>Days Remaining:</strong> <span class="urgency-text">${daysUntil} day${daysUntil !== 1 ? 's' : ''} ${urgencyEmoji}</span>
        </div>
        <p style="margin: 0; color: #B5B5B5;">
          Make sure to submit your application before the deadline to ensure it gets reviewed.
        </p>
      </div>

      <div style="text-align: center;">
        <a href="${emailConfig.appUrl}/applications" class="button" style="color: #000 !important; text-decoration: none;">View Applications</a>
      </div>

      <div class="divider"></div>

      <p class="tip">
        💡 Tip: Update your notification preferences to control how often you receive deadline reminders.
      </p>
    </div>
    <div class="footer">
      <p class="footer-text">© ${new Date().getFullYear()} ApplyOS. All rights reserved.</p>
      <p class="footer-text">
        <a href="${emailConfig.appUrl}/settings" class="footer-link">Manage email preferences</a>
      </p>
      <p class="footer-text">
        Questions? Contact <a href="mailto:support@applyos.io" class="footer-link">support@applyos.io</a>
      </p>
    </div>
  </div>
</body>
</html>
            `;

            const emailSubject = `⏰ Deadline Reminder: ${app.title} (${daysUntil} days)`;
            await sendEmailDirectly(userData.user.email, emailSubject, emailHtml);
            console.log(`✓ Email sent for ${app.title}`);
          } catch (emailError) {
            console.error(`Failed to send email for ${app.title}:`, emailError);
            // Notification was created, just email failed - that's ok
          }

          emailsSent++;
          console.log(
            `✓ Deadline reminder sent for ${app.title} (${daysUntil} days)`
          );
        } catch (error) {
          console.error(
            `Error sending deadline reminder for app ${app.id}:`,
            error
          );
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Processed ${applications.length} applications, sent ${emailsSent} reminders`,
        emailsSent,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Deadline reminders cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
