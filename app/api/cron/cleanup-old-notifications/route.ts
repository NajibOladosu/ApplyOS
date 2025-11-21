/**
 * Cleanup Old Notifications Cron Job
 * DELETE /api/cron/cleanup-old-notifications
 * Runs daily to delete notifications older than 30 days
 * Triggered by Vercel Cron or external scheduler
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'

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

    // Calculate the date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Delete notifications older than 30 days
    const { error: deleteError, count } = await supabase
      .from('notifications')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString());

    if (deleteError) {
      console.error('Failed to delete old notifications:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete old notifications' },
        { status: 500 }
      );
    }

    console.log(
      `✓ Cleanup completed: deleted notifications older than 30 days`
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Successfully cleaned up old notifications',
        deletedCount: count || 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Cleanup notifications cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
