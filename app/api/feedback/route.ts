/**
 * Feedback API Route
 * POST /api/feedback - Submit new feedback
 * GET /api/feedback - Get user's feedback (for future use)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server'
import { sendEmailDirectly } from '@/lib/email'
import { feedbackNotificationTemplate, feedbackNotificationSubject } from '@/lib/email/templates/feedback-notification'
import type { FeedbackType } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const { type, title, description } = await request.json()

    // Validate input
    if (!type || !title || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: type, title, description' },
        { status: 400 }
      )
    }

    const validTypes: FeedbackType[] = ['general', 'bug', 'feature']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid feedback type' },
        { status: 400 }
      )
    }

    // Get user profile for email
    const { data: userProfile } = await supabase
      .from('users')
      .select('email, name')
      .eq('id', user.id)
      .single()

    // Insert feedback into database
    const { data: feedback, error: insertError } = await supabase
      .from('feedback')
      .insert({
        user_id: user.id,
        type,
        title,
        description,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting feedback:', insertError)
      return NextResponse.json(
        { error: 'Failed to submit feedback' },
        { status: 500 }
      )
    }

    // Send email notification to admin
    try {
      const adminEmail = process.env.GMAIL_USER
      if (adminEmail) {
        const emailData = {
          userEmail: user.email || 'Unknown',
          userName: userProfile?.name || user.email || 'Anonymous User',
          feedbackType: type as FeedbackType,
          title,
          description,
          submittedAt: new Date(),
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const htmlBody = feedbackNotificationTemplate(emailData, appUrl)
        const subject = feedbackNotificationSubject(type)

        const emailSent = await sendEmailDirectly(adminEmail, subject, htmlBody)

        if (!emailSent) {
          console.warn('Failed to send feedback notification email')
          // Don't fail the request if email fails - feedback was still submitted
        }
      }
    } catch (emailError) {
      console.error('Error sending feedback notification email:', emailError)
      // Don't fail the request if email fails - feedback was still submitted
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Feedback submitted successfully',
        feedback,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Feedback route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
