/**
 * Send Status Update Email Route
 * POST /api/notifications/send-status-email
 * Sends an email when an application status changes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createStatusUpdateNotification } from '@/lib/services/notifications-with-email';

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request data
    const {
      applicationId,
      applicationTitle,
      previousStatus,
      newStatus,
    } = await request.json();

    if (!applicationId || !applicationTitle || !previousStatus || !newStatus) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify the application belongs to the user
    const { data: app, error: appError } = await supabase
      .from('applications')
      .select('id, user_id')
      .eq('id', applicationId)
      .single();

    if (appError || !app || app.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Application not found or unauthorized' },
        { status: 404 }
      );
    }

    // Create notification and send email
    await createStatusUpdateNotification(
      user.id,
      user.email || '',
      applicationTitle,
      previousStatus,
      newStatus
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Status update email sent',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Send status email route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
