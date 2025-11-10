/**
 * Custom Signup API Route
 * POST /api/auth/signup
 * Handles email signup with email verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { render } from '@react-email/render';
import VerifyEmailTemplate from '@/emails/verify-email';
import { sendEmailViaSMTP } from '@/lib/email/transport';
import { emailConfig } from '@/lib/email/config';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    // Validate input
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, name' },
        { status: 400 }
      );
    }

    console.log(`📝 Signing up user: ${email}`);

    // Get Supabase admin client for user creation without auto-sending confirmation email
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

    // Create user with admin API (doesn't send confirmation email automatically)
    const { data, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Don't auto-confirm - user must verify with our custom link
      user_metadata: {
        name,
      },
    });

    if (createError) {
      console.error('❌ User creation error:', createError);
      return NextResponse.json(
        { error: createError.message },
        { status: 400 }
      );
    }

    if (!data.user?.id) {
      console.error('❌ User created but no user ID returned');
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    console.log(`✅ User created (without Supabase email): ${email}`);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Store verification token in database
    try {
      const supabase = await createClient();
      const { error: updateError } = await supabase
        .from('users')
        .update({
          verification_token: verificationToken,
          verification_token_expires_at: expiresAt.toISOString(),
        })
        .eq('id', data.user.id);

      if (updateError) {
        console.error('❌ Failed to store verification token:', updateError);
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 500 }
        );
      }
    } catch (dbError) {
      console.error('❌ Database error:', dbError);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    // Send verification email directly (not queued, so it sends immediately)
    try {
      console.log(`📧 Sending verification email to ${email}...`);

      const userName = name || email.split('@')[0];
      const verificationUrl = `${emailConfig.appUrl}/api/auth/verify-email?token=${verificationToken}`;

      // Render React Email template
      const htmlBody = await render(
        VerifyEmailTemplate({
          userName,
          verificationUrl,
        })
      );

      // Send directly via SMTP (not queued)
      await sendEmailViaSMTP(
        email,
        'Verify your Trackly email address',
        htmlBody
      );

      console.log(`✅ Verification email sent to ${email}`);
    } catch (emailError) {
      console.error('⚠️ Failed to send verification email:', emailError);
      // Don't fail the signup if email fails
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Signup successful! Please check your email to verify your account.',
        user: {
          id: data.user.id,
          email: data.user.email,
          user_metadata: data.user.user_metadata,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ Signup route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
