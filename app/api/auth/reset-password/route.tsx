import { createClient } from '@/shared/db/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { render } from '@react-email/render'
import ResetPasswordTemplate from '@/emails/reset-password'
import { sendEmailViaSMTP } from '@/shared/infrastructure/email/transport'
import { getEmailConfig } from '@/shared/infrastructure/email/config'
import type { Database } from '@/types/supabase'

export async function POST(request: Request) {
    try {
        const { email } = await request.json()

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('❌ Missing Supabase environment variables')
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
        }

        const adminClient = createAdminClient<Database>(supabaseUrl, supabaseServiceKey)

        // 1. Get the user's name or fallback to part of email
        const { data: users, error: userError } = await adminClient
            .from('users')
            .select('name')
            .eq('email', email)
            .limit(1)

        const userName = (users as any[] && (users as any[]).length > 0 && (users as any[])[0].name) || email.split('@')[0]

        // 2. Generate recovery link
        // We use process.env.NEXT_PUBLIC_APP_URL for the redirect
        const emailConfig = getEmailConfig()
        const redirectTo = `${emailConfig.appUrl}/auth/update-password`

        const { data, error: linkError } = await adminClient.auth.admin.generateLink({
            type: 'recovery',
            email,
            options: {
                redirectTo,
            },
        })

        if (linkError) {
            console.error('❌ Link generation error:', linkError)
            // We return success even if link generation fails for security (don't reveal if email exists)
            // but in this case, we might want to log it and return a generic success.
            // However, if the user doesn't exist, generateLink returns an error.
            // To prevent email enumeration, we'll return 200 regardless.
            return NextResponse.json({ message: 'If an account exists, a reset link has been sent' })
        }

        const resetUrl = data.properties.action_link

        // 3. Render and send email
        const htmlBody = await render(
            <ResetPasswordTemplate
                userName={ userName }
                resetUrl = { resetUrl }
            />
        )

        const textBody = await render(
            <ResetPasswordTemplate
                userName={ userName }
                resetUrl = { resetUrl }
            />,
            { plainText: true }
        )

        await sendEmailViaSMTP(
            email,
            'Reset your ApplyOS password',
            htmlBody,
            textBody
        )

        console.log(`✅ Custom reset email sent to ${email}`)
        return NextResponse.json({ message: 'Reset email sent successfully' })
    } catch (error) {
        console.error('❌ Reset password route error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
