/**
 * Resend Verification Email Endpoint
 * POST /api/auth/resend-verification
 * Generates new verification token and resends email
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { render } from '@react-email/render';
import VerifyEmailTemplate from '@/emails/verify-email';
import { sendEmailViaSMTP } from '@/lib/email/transport';
import { emailConfig } from '@/lib/email/config';
import crypto from 'crypto';
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/middleware/rate-limit';

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting for auth endpoints (before authentication)
    const rateLimitResponse = await rateLimitMiddleware(
      request,
      RATE_LIMITS.auth,
      async () => undefined
    )
    if (rateLimitResponse) return rateLimitResponse

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    console.log(`📧 Resending verification email to ${email}...`);

    // Use admin client to bypass RLS (user may not be authenticated)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient(supabaseUrl, supabaseServiceKey);

    // Find user with this email (using admin API to bypass RLS)
    const { data: users, error: findError } = await adminClient
      .from('users')
      .select('id, full_name')
      .eq('email', email)
      .limit(1);

    if (findError || !users || users.length === 0) {
      console.error('❌ User not found:', email);
      // Don't reveal if email exists for security
      return NextResponse.json(
        { success: true, message: 'If the email exists, a verification link has been sent.' },
        { status: 200 }
      );
    }

    const user = users[0];

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Update user with new token (using admin API to bypass RLS)
    const { error: updateError } = await adminClient
      .from('users')
      .update({
        verification_token: verificationToken,
        verification_token_expires_at: expiresAt.toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Failed to update verification token:', updateError);
      return NextResponse.json(
        { error: 'Failed to resend verification email' },
        { status: 500 }
      );
    }

    // Send verification email directly (not queued)
    try {
      const userName = user.full_name || email.split('@')[0];
      const verificationUrl = `${emailConfig.appUrl}/api/auth/verify-email?token=${verificationToken}`;

      // Render React Email template (both HTML and plain text)
      const htmlBody = await render(
        VerifyEmailTemplate({
          userName,
          verificationUrl,
        })
      );

      const textBody = await render(
        VerifyEmailTemplate({
          userName,
          verificationUrl,
        }),
        { plainText: true }
      );

      // Send directly via SMTP (not queued) with both HTML and plain text
      await sendEmailViaSMTP(
        email,
        'Verify your ApplyOS email address',
        htmlBody,
        textBody
      );

      console.log(`✅ Verification email resent to ${email}`);
    } catch (emailError) {
      console.error('⚠️ Failed to send verification email:', emailError);
      // Still return success as token is stored
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Verification email has been sent.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Resend verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
