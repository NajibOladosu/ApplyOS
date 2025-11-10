import { createClient } from '@/lib/supabase/server'
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
          // Mark OAuth user as verified (they already verified via OAuth provider)
          try {
            console.log(`✓ Marking OAuth user as verified: ${user.email}...`)

            const { error: updateError } = await supabase
              .from('users')
              .update({
                email_verified: true,
                verification_token: null,
                verification_token_expires_at: null,
              })
              .eq('id', user.id)

            if (updateError) {
              console.error('⚠️ Failed to mark user as verified:', updateError)
              // Don't fail the auth flow if update fails
            } else {
              console.log(`✅ User marked as verified: ${user.email}`)
            }
          } catch (error) {
            console.error('❌ Error marking user as verified:', error)
            // Don't fail the auth flow if verification marking fails
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
