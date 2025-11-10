/**
 * Custom Signup API Route
 * POST /api/auth/signup
 * Handles email signup with email verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { emailService } from '@/lib/email';
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

    const supabase = await createClient();

    console.log(`📝 Signing up user: ${email}`);

    // Sign up user without email confirmation
    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
        // Don't send Supabase's confirmation email - we'll send our own verification email
        emailRedirectTo: undefined,
      },
    });

    if (signupError) {
      console.error('❌ Signup error:', signupError);
      return NextResponse.json(
        { error: signupError.message },
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

    console.log(`✅ User created: ${email}`);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Store verification token in database
    try {
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

    // Send verification email
    try {
      console.log(`📧 Sending verification email to ${email}...`);

      const userName = name || email.split('@')[0];
      const verificationUrl = `${emailConfig.appUrl}/api/auth/verify-email?token=${verificationToken}`;

      await emailService.sendVerificationEmail({
        userName,
        userEmail: email,
        verificationUrl,
      });

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
