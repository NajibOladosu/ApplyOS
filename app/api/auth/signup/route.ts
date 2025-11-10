/**
 * Custom Signup API Route
 * POST /api/auth/signup
 * Handles email signup and sends welcome email instead of Supabase confirmation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmailDirectly } from '@/lib/email';
import { welcomeEmailTemplate, welcomeEmailSubject } from '@/lib/email/templates/welcome';
import { emailConfig } from '@/lib/email/config';

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

    // Sign up user without email confirmation (we'll send welcome email instead)
    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
        // Don't send Supabase's confirmation email - we'll send our own welcome email
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

    console.log(`✅ User created: ${email}`);

    // Send custom welcome email
    try {
      console.log(`📧 Sending welcome email to ${email}...`);

      const userName = name || email.split('@')[0];
      const htmlBody = welcomeEmailTemplate(
        {
          userName,
          userEmail: email,
        },
        emailConfig.appUrl
      );
      const subject = welcomeEmailSubject();

      await sendEmailDirectly(email, subject, htmlBody);
      console.log(`✅ Welcome email sent to ${email}`);
    } catch (emailError) {
      console.error('⚠️ Failed to send welcome email:', emailError);
      // Don't fail the signup if email fails - user can still login
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Signup successful! Check your email for a welcome message.',
        user: {
          id: data.user?.id,
          email: data.user?.email,
          user_metadata: data.user?.user_metadata,
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
