import { createClient } from '@/lib/supabase/server'
import { sendEmailDirectly } from '@/lib/email'
import { welcomeEmailTemplate, welcomeEmailSubject } from '@/lib/email/templates/welcome'
import { emailConfig } from '@/lib/email/config'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    console.log('🔐 Auth callback invoked')
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    console.log(`📝 Code parameter: ${code ? 'present' : 'missing'}`)

    if (code) {
      const supabase = await createClient()
      console.log('✓ Supabase client created')

      // Exchange code for session
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('❌ Exchange error:', exchangeError)
      } else {
        console.log('✓ Session exchanged successfully')
      }

      if (!exchangeError) {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        console.log(`👤 User fetched: ${user ? user.email : 'null'}`)
        if (userError) {
          console.error('❌ User fetch error:', userError)
        }

        if (user && !userError) {
          // Send welcome email to new user
          try {
            const userName = user.user_metadata?.name || user.email?.split('@')[0] || 'User'
            const userEmail = user.email

            console.log(`📧 Preparing welcome email for ${userEmail}...`)

            if (userEmail) {
              const htmlBody = welcomeEmailTemplate(
                {
                  userName,
                  userEmail,
                },
                emailConfig.appUrl
              )
              const subject = welcomeEmailSubject()

              console.log(`📤 Sending welcome email to ${userEmail}...`)
              // Send welcome email
              const result = await sendEmailDirectly(userEmail, subject, htmlBody)
              console.log(`✅ Welcome email sent to ${userEmail}`)
            } else {
              console.log('⚠️ No email found for user')
            }
          } catch (emailError) {
            console.error('❌ Failed to send welcome email:', emailError)
            // Don't fail the auth flow if email fails
          }
        }
      }
    } else {
      console.log('⚠️ No code parameter in callback URL')
    }

    console.log('🔄 Redirecting to dashboard...')
    return NextResponse.redirect(new URL('/dashboard', request.url))
  } catch (error) {
    console.error('❌ Callback route error:', error)
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
}
