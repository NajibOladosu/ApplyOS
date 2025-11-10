/**
 * Deadline Reminder Cron Job
 * POST /api/cron/deadline-reminders
 * Runs daily to send deadline reminder emails
 * Triggered by Vercel Cron or external scheduler
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createDeadlineNotification } from '@/lib/services/notifications-with-email';

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

    const supabase = await createClient();

    // Get all applications with upcoming deadlines that we should remind about
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
    const remindDays = [1, 3, 7];

    // Check each application for deadline reminders
    for (const app of applications) {
      const deadline = new Date(app.deadline);
      const daysUntil = Math.ceil(
        (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Send reminder if deadline is in 1, 3, or 7 days
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
            .gte('created_at', today.toISOString());

          if (existingNotif && existingNotif.length > 0) {
            console.log(`Already sent deadline reminder for ${app.title}`);
            continue;
          }

          // Create notification and send email
          await createDeadlineNotification(
            app.user_id,
            userData.user.email,
            app.title,
            daysUntil
          );

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
