/**
 * Welcome Email Route
 * POST /api/email/welcome
 * Sends a welcome email to newly signed up users
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmailDirectly } from '@/lib/email';
import { welcomeEmailTemplate, welcomeEmailSubject } from '@/lib/email/templates/welcome';
import { emailConfig } from '@/lib/email/config';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get email from request body or use user's email
    const { email } = await request.json().catch(() => ({}));
    const userEmail = email || user.email;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'No email address found' },
        { status: 400 }
      );
    }

    const userName =
      user.user_metadata?.name ||
      userEmail.split('@')[0].charAt(0).toUpperCase() +
        userEmail.split('@')[0].slice(1);

    // Generate welcome email
    const htmlBody = welcomeEmailTemplate(
      {
        userName,
        userEmail,
      },
      emailConfig.appUrl
    );

    const subject = welcomeEmailSubject();

    // Send email
    const success = await sendEmailDirectly(userEmail, subject, htmlBody);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to send welcome email' },
        { status: 500 }
      );
    }

    // Log email sent
    console.log(`✓ Welcome email sent to ${userEmail}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Welcome email sent successfully',
        email: userEmail,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Welcome email route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
