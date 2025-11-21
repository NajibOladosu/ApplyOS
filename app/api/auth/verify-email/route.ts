/**
 * Email Verification Endpoint
 * GET /api/auth/verify-email?token=xxx
 * Verifies email token and marks user as verified
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/middleware/rate-limit';

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting for auth endpoints (before authentication)
    const rateLimitResponse = await rateLimitMiddleware(
      request,
      RATE_LIMITS.auth,
      async () => undefined
    )
    if (rateLimitResponse) return rateLimitResponse

    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Verifying email with token...');

    // Use admin client to bypass RLS (user is not authenticated yet)
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

    // Find user with matching verification token (using admin API to bypass RLS)
    const { data: users, error: findError } = await adminClient
      .from('users')
      .select('id, email, verification_token_expires_at')
      .eq('verification_token', token)
      .limit(1);

    if (findError || !users || users.length === 0) {
      console.error('❌ Invalid or expired verification token:', findError);
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

    // Mark user as verified in Supabase Auth (so they can log in)
    try {
      const { error: authError } = await adminClient.auth.admin.updateUserById(
        user.id,
        { email_confirm: true }
      );

      if (authError) {
        console.error('⚠️ Failed to confirm email in auth:', authError);
        // Continue anyway - we'll still mark as verified in our database
      } else {
        console.log(`✅ Email confirmed in Supabase Auth: ${user.email}`);
      }
    } catch (authError) {
      console.error('⚠️ Auth confirmation error:', authError);
      // Continue anyway
    }

    // Mark user as verified in our users table and clear verification token
    const { error: updateError } = await adminClient
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
