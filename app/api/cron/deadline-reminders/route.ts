/**
 * Deadline Reminder Cron Job
 * POST /api/cron/deadline-reminders
 * Runs daily to send deadline reminder emails
 * Triggered by Vercel Cron or external scheduler
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@supabase/supabase-js';
import { sendEmailDirectly } from '@/lib/email';
import { emailConfig } from '@/lib/email/config';

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

    // Get applications with deadlines in 1, 3, or 7 days
    const { data: applications, error: appsError } = await supabase
      .from('applications')
      .select('id, user_id, title, deadline')
      .not('deadline', 'is', null);

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

          // Send email notification directly using Trackly theme
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
  <title>Trackly</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f9fafb;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #00FF88 0%, #00CC66 100%);
      color: #000;
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .content {
      padding: 40px 30px;
    }
    .footer {
      background-color: #f3f4f6;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
    }
    .button {
      display: inline-block;
      background-color: #00FF88;
      color: #000;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      margin: 20px 0;
      transition: background-color 0.2s;
    }
    .button:hover {
      background-color: #00CC66;
    }
    h2 {
      font-size: 20px;
      margin-bottom: 16px;
      color: #1f2937;
    }
    p {
      margin-bottom: 16px;
      color: #4b5563;
    }
    .divider {
      height: 1px;
      background-color: #e5e7eb;
      margin: 30px 0;
    }
    .card {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .card-title {
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
      font-size: 16px;
    }
    .deadline-info {
      margin-bottom: 12px;
      font-size: 13px;
    }
    .urgency-text {
      font-weight: 700;
      color: ${urgencyColor};
    }
    .tip {
      font-size: 12px;
      color: #6b7280;
      margin-top: 20px;
      text-align: center;
    }
    a {
      color: #00FF88;
      text-decoration: none;
      font-weight: 600;
    }
    a:hover {
      color: #00CC66;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Trackly</h1>
    </div>
    <div class="content">
      <h2>⏰ Deadline Reminder ${urgencyEmoji}</h2>

      <p>Hi,</p>

      <p>You have an upcoming application deadline that needs your attention!</p>

      <div class="divider"></div>

      <div class="card">
        <div class="card-title">${app.title}</div>
        <div class="deadline-info">
          <strong>Days Remaining:</strong> <span class="urgency-text">${daysUntil} day${daysUntil !== 1 ? 's' : ''} ${urgencyEmoji}</span>
        </div>
        <p style="margin: 0;">
          Make sure to submit your application before the deadline to ensure it gets reviewed.
        </p>
      </div>

      <div style="text-align: center;">
        <a href="${emailConfig.appUrl}/applications" class="button">View Applications</a>
      </div>

      <div class="divider"></div>

      <p class="tip">
        💡 Tip: Update your notification preferences to control how often you receive deadline reminders.
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Trackly. All rights reserved.</p>
      <p>
        <a href="${emailConfig.appUrl}/settings" style="color: #6b7280;">Manage email preferences</a>
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
