/**
 * Resend Verification Email Endpoint
 * POST /api/auth/resend-verification
 * Generates a new verification token and resends the email.
 *
 * Unauthenticated by design (the user may not be signed in), so it:
 * - returns the same generic response whether or not the address exists,
 * - sends only to accounts that are still unverified,
 * - allows at most one email per address per RESEND_MIN_INTERVAL_MS,
 * - stores only a hash of the token (raw token is sent in the link only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import React from 'react';
import { render } from '@react-email/render';
import VerifyEmailTemplate from '@/emails/verify-email';
import { sendEmail } from '@/shared/infrastructure/email';
import { emailConfig } from '@/shared/infrastructure/email/config';
import crypto from 'crypto';
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/middleware/rate-limit';
import { redactEmail } from '@/shared/infrastructure/logging/redact'
import { hashVerificationToken } from '@/shared/infrastructure/auth/verification-token'

export const dynamic = 'force-dynamic'

const RESEND_MIN_INTERVAL_MS = 60 * 1000
const GENERIC_RESPONSE = {
  success: true,
  message: 'If the email exists, a verification link has been sent.',
}

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

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

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
      .select('id, name, email_verified, last_verification_email_sent')
      .eq('email', email)
      .limit(1);

    if (findError) {
      console.error('❌ Resend lookup failed:', findError.message);
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }

    if (!users || users.length === 0) {
      console.log('ℹ️ Resend requested for unknown email:', redactEmail(email));
      // Don't reveal if email exists for security
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }

    const user = users[0];

    if (user.email_verified) {
      console.log('ℹ️ Resend requested for verified account:', redactEmail(email));
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }

    const lastSent = user.last_verification_email_sent
      ? new Date(user.last_verification_email_sent).getTime()
      : 0;
    if (lastSent && Date.now() - lastSent < RESEND_MIN_INTERVAL_MS) {
      console.log('ℹ️ Resend throttled for:', redactEmail(email));
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }

    // Generate new verification token (raw value goes in the email; hash is stored)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    const sentAt = new Date();

    // Update user with new token (using admin API to bypass RLS)
    const { error: updateError } = await adminClient
      .from('users')
      .update({
        verification_token: hashVerificationToken(verificationToken),
        verification_token_expires_at: expiresAt.toISOString(),
        last_verification_email_sent: sentAt.toISOString(),
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
      const userName = user.name || email.split('@')[0];
      const verificationUrl = `${emailConfig.appUrl}/api/auth/verify-email?token=${verificationToken}`;

      // Render React Email template (both HTML and plain text)
      const htmlBody = await render(
        React.createElement(VerifyEmailTemplate, { userName, verificationUrl })
      );

      const textBody = await render(
        React.createElement(VerifyEmailTemplate, { userName, verificationUrl }),
        { plainText: true }
      );

      await sendEmail({
        to: email,
        subject: 'Verify your ApplyOS email address',
        html: htmlBody,
        text: textBody,
        from: 'noreply',
      });

      console.log(`✅ Verification email resent to ${redactEmail(email)}`);
    } catch (emailError) {
      console.error('⚠️ Failed to send verification email:', emailError);
      // Still return success as token is stored
    }

    // Same body as the unknown-address path so the response does not reveal
    // whether the address exists.
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  } catch (error) {
    console.error('❌ Resend verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
