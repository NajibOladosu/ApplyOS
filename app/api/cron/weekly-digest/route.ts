/**
 * Weekly Digest Cron Job
 * POST /api/cron/weekly-digest
 * Runs weekly (every Monday) to send weekly digest emails
 * Triggered by Vercel Cron or external scheduler
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmailDirectly } from '@/lib/email';
import { weeklyDigestEmailTemplate } from '@/lib/email/templates/weekly-digest';
import { emailConfig } from '@/lib/email/config';

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Verify request is from Vercel Cron or authorized source
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Calculate week date range (last 7 days)
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    // Get all users with email notifications enabled
    const { data: usersData, error: usersError } = await supabase
      .from('applications')
      .select('user_id', { count: 'exact' })
      .not('user_id', 'is', null);

    if (usersError) {
      console.error('Failed to fetch users:', usersError);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    if (!usersData || usersData.length === 0) {
      return NextResponse.json(
        { message: 'No users found' },
        { status: 200 }
      );
    }

    const uniqueUserIds = [...new Set(usersData.map((u: any) => u.user_id))];
    let digestsSent = 0;

    // Send digest to each user
    for (const userId of uniqueUserIds) {
      try {
        // Get user email and check preferences
        const { data: userData } = await supabase.auth.admin.getUserById(userId);

        if (!userData.user?.email) {
          console.log(`Skipping user ${userId} - no email found`);
          continue;
        }

        const metadata = userData.user.user_metadata || {};
        if (metadata.email_notifications === false) {
          console.log(`Skipping user ${userId} - email notifications disabled`);
          continue;
        }

        // Get user's applications for the week
        const { data: applications } = await supabase
          .from('applications')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });

        // Get applications updated this week
        const updatedThisWeek = applications?.filter((app) => {
          const updatedAt = new Date(app.updated_at);
          return updatedAt >= weekStart && updatedAt <= weekEnd;
        }) || [];

        // Get upcoming deadlines (next 30 days)
        const upcomingDeadlines = applications?.filter((app) => {
          if (!app.deadline) return false;
          const deadline = new Date(app.deadline);
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
          return deadline >= now && deadline <= thirtyDaysFromNow;
        }) || [];

        // Only send if there's content worth sending
        if (updatedThisWeek.length === 0 && upcomingDeadlines.length === 0 && applications?.length === 0) {
          console.log(`Skipping user ${userId} - no content for digest`);
          continue;
        }

        // Prepare email data
        const emailData = {
          userName: userData.user.user_metadata?.name || userData.user.email?.split('@')[0] || 'User',
          weekStart,
          weekEnd,
          applications: updatedThisWeek.map((app: any) => ({
            title: app.title,
            company: app.company || 'Unknown',
            status: app.status,
            updatedAt: new Date(app.updated_at),
          })),
          upcomingDeadlines: upcomingDeadlines.map((app: any) => {
            const deadline = new Date(app.deadline);
            const daysUntil = Math.ceil(
              (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );
            return {
              title: app.title,
              company: app.company || 'Unknown',
              deadline,
              daysUntil,
            };
          }),
          totalApplications: applications?.length || 0,
          newApplicationsThisWeek: updatedThisWeek.length,
          statusChangeCount: updatedThisWeek.filter(
            (app: any) => app.status_changed === true
          ).length,
        };

        // Generate and send email
        const htmlBody = weeklyDigestEmailTemplate(
          emailData,
          emailConfig.appUrl
        );
        const subject = `Your Trackly Weekly Summary (${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()})`;

        await sendEmailDirectly(userData.user.email, subject, htmlBody);

        digestsSent++;
        console.log(`✓ Weekly digest sent to ${userData.user.email}`);
      } catch (error) {
        console.error(`Error sending digest to user ${userId}:`, error);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Sent weekly digests to ${digestsSent} users`,
        digestsSent,
        weekRange: `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Weekly digest cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
