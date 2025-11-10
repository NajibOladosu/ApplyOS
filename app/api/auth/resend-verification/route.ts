/**
 * Resend Verification Email Endpoint
 * POST /api/auth/resend-verification
 * Generates new verification token and resends email
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { emailService } from '@/lib/email';
import { emailConfig } from '@/lib/email/config';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    console.log(`📧 Resending verification email to ${email}...`);

    const supabase = await createClient();

    // Find user with this email
    const { data: users, error: findError } = await supabase
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

    // Update user with new token
    const { error: updateError } = await supabase
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

    // Send verification email
    try {
      const userName = user.full_name || email.split('@')[0];
      const verificationUrl = `${emailConfig.appUrl}/api/auth/verify-email?token=${verificationToken}`;

      await emailService.sendVerificationEmail({
        userName,
        userEmail: email,
        verificationUrl,
      });

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
