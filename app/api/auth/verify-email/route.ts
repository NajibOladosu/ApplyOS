/**
 * Email Verification Endpoint
 * GET /api/auth/verify-email?token=xxx
 * Verifies email token and marks user as verified
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Verifying email with token...');

    const supabase = await createClient();

    // Find user with matching verification token
    const { data: users, error: findError } = await supabase
      .from('users')
      .select('id, email, verification_token_expires_at')
      .eq('verification_token', token)
      .limit(1);

    if (findError || !users || users.length === 0) {
      console.error('❌ Invalid or expired verification token');
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }

    const user = users[0];

    // Check if token has expired
    if (user.verification_token_expires_at) {
      const expiryTime = new Date(user.verification_token_expires_at).getTime();
      const now = Date.now();

      if (now > expiryTime) {
        console.error('❌ Verification token has expired');
        return NextResponse.json(
          { error: 'Verification token has expired' },
          { status: 400 }
        );
      }
    }

    // Mark user as verified and clear verification token
    const { error: updateError } = await supabase
      .from('users')
      .update({
        email_verified: true,
        verification_token: null,
        verification_token_expires_at: null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Failed to mark user as verified:', updateError);
      return NextResponse.json(
        { error: 'Failed to verify email' },
        { status: 500 }
      );
    }

    console.log(`✅ Email verified for user: ${user.email}`);

    // Redirect to success page
    const successUrl = new URL('/auth/verified', request.url);
    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error('❌ Email verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
