import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient, SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { render } from '@react-email/render'
import VerifyEmailTemplate from '@/emails/verify-email'
import { sendEmailViaSMTP } from '@/lib/email/transport'
import { emailConfig } from '@/lib/email/config'
import type { Database } from '@/types/supabase'

// Rate limit: 5 minutes between verification email sends
const VERIFICATION_EMAIL_RATE_LIMIT_MS = 5 * 60 * 1000

/**
 * Check if enough time has passed since last email send
 */
function isRateLimitOk(lastEmailSent: string | null): boolean {
  if (!lastEmailSent) return true
  const lastSentTime = new Date(lastEmailSent).getTime()
  const now = Date.now()
  return now - lastSentTime >= VERIFICATION_EMAIL_RATE_LIMIT_MS
}

/**
 * Generate and send verification email
 */
async function sendVerificationEmail(
  userId: string,
  email: string,
  userName: string,
  adminClient: SupabaseClient<Database>
) {
  try {
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Update user with token and rate limit timestamp
    const { error: updateError } = await (adminClient as any)
      .from('users')
      .update({
        verification_token: verificationToken,
        verification_token_expires_at: expiresAt.toISOString(),
        last_verification_email_sent: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      console.error('❌ Failed to store verification token:', updateError)
      return false
    }

    // Send verification email
    const verificationUrl = `${emailConfig.appUrl}/api/auth/verify-email?token=${verificationToken}`
    const htmlBody = await render(
      VerifyEmailTemplate({
        userName,
        verificationUrl,
      })
    )

    const textBody = await render(
      VerifyEmailTemplate({
        userName,
        verificationUrl,
      }),
      { plainText: true }
    )

    await sendEmailViaSMTP(
      email,
      'Verify your Trackly email address',
      htmlBody,
      textBody
    )

    console.log(`✅ Verification email sent to ${email}`)
    return true
  } catch (error) {
    console.error('❌ Failed to send verification email:', error)
    return false
  }
}

export async function GET(request: Request) {
  try {
    console.log('🔐 Auth callback invoked')
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const intent = requestUrl.searchParams.get('intent') || 'login' // Default to login

    console.log(`📝 Code: ${code ? 'present' : 'missing'}, Intent: ${intent}`)

    if (!code) {
      console.log('⚠️ No code parameter in callback URL')
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    // Create Supabase clients
    const supabase = await createClient()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase environment variables')
      return NextResponse.redirect(new URL('/auth/login?error=config', request.url))
    }

    const adminClient = createAdminClient<Database>(supabaseUrl, supabaseServiceKey)

    // Exchange code for session
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('❌ Exchange error:', exchangeError)
      return NextResponse.redirect(new URL('/auth/login?error=exchange', request.url))
    }

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('❌ User fetch error:', userError)
      return NextResponse.redirect(new URL('/auth/login?error=user', request.url))
    }

    console.log(`👤 User: ${user.email}`)

    // Query existing profile
    const { data: existingProfile, error: profileError } = await (adminClient as any)
      .from('users')
      .select('id, email_verified, name, last_verification_email_sent')
      .eq('id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      // PGRST116 = not found, which is expected for new users
      console.error('❌ Profile query error:', profileError)
    }

    const profileExists = !!existingProfile

    console.log(`📋 Profile exists: ${profileExists}, Verified: ${profileExists ? existingProfile.email_verified : 'n/a'}`)

    // ===== INTENT: SIGNUP =====
    if (intent === 'signup') {
      if (profileExists) {
        if (existingProfile.email_verified) {
          // Already registered and verified - show error
          console.log('ℹ️ User already registered and verified')
          await supabase.auth.signOut()
          return NextResponse.redirect(
            new URL('/auth/signup?error=already_registered', request.url)
          )
        } else {
          // Registered but not verified - send verification email and redirect to check-email
          console.log('ℹ️ User registered but not verified - resending verification email')

          // Check rate limit
          if (!isRateLimitOk(existingProfile.last_verification_email_sent)) {
            console.log('⏱️ Rate limit: verification email sent too recently')
            await supabase.auth.signOut()
            return NextResponse.redirect(
              new URL(`/auth/check-email?email=${encodeURIComponent(user.email!)}`, request.url)
            )
          }

          const userName = existingProfile.name || user.email!.split('@')[0]
          await sendVerificationEmail(user.id, user.email!, userName, adminClient)

          await supabase.auth.signOut()
          return NextResponse.redirect(
            new URL(`/auth/check-email?email=${encodeURIComponent(user.email!)}`, request.url)
          )
        }
      } else {
        // New profile created by trigger - send verification email
        console.log('✨ New OAuth signup - sending verification email')

        const userName = user.user_metadata?.name || user.email!.split('@')[0]
        await sendVerificationEmail(user.id, user.email!, userName, adminClient)

        await supabase.auth.signOut()
        return NextResponse.redirect(
          new URL(`/auth/check-email?email=${encodeURIComponent(user.email!)}`, request.url)
        )
      }
    }

    // ===== INTENT: LOGIN =====
    if (intent === 'login') {
      if (!profileExists) {
        // No account found - delete the auth.users record created by trigger
        console.log('❌ Login attempt with unregistered email - deleting auth record')

        try {
          await adminClient.auth.admin.deleteUser(user.id)
          console.log('✓ Auth user deleted')
        } catch (deleteError) {
          console.error('⚠️ Failed to delete auth user:', deleteError)
          // Continue anyway, just let them see the error message
        }

        await supabase.auth.signOut()
        return NextResponse.redirect(
          new URL('/auth/login?error=no_account', request.url)
        )
      }

      if (!existingProfile.email_verified) {
        // Profile exists but not verified - send verification email and redirect
        console.log('ℹ️ Login with unverified account - sending verification email')

        // Check rate limit
        if (!isRateLimitOk(existingProfile.last_verification_email_sent)) {
          console.log('⏱️ Rate limit: verification email sent too recently')
          await supabase.auth.signOut()
          return NextResponse.redirect(
            new URL(`/auth/check-email?email=${encodeURIComponent(user.email!)}`, request.url)
          )
        }

        const userName = existingProfile.name || user.email!.split('@')[0]
        await sendVerificationEmail(user.id, user.email!, userName, adminClient)

        await supabase.auth.signOut()
        return NextResponse.redirect(
          new URL(`/auth/check-email?email=${encodeURIComponent(user.email!)}`, request.url)
        )
      }

      // Profile exists and verified - keep signed in and go to dashboard
      console.log('✅ Login successful - redirecting to dashboard')
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Fallback
    console.log('⚠️ Unknown intent, redirecting to dashboard')
    return NextResponse.redirect(new URL('/dashboard', request.url))
  } catch (error) {
    console.error('❌ Callback route error:', error)
    return NextResponse.redirect(new URL('/auth/login?error=callback', request.url))
  }
}
