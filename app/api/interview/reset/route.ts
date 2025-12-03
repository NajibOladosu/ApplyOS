import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/interview/reset
 *
 * Resets an interview session for retake
 * - Clears conversation turns
 * - Deletes interview answers
 * - Resets session status to 'in_progress'
 * - Keeps original questions
 *
 * Request body:
 * {
 *   sessionId: string
 * }
 *
 * Response:
 * {
 *   success: boolean
 *   sessionId: string
 *   message: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session || session.user_id !== user.id) {
      return NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 404 })
    }

    console.log(`Resetting interview session ${sessionId}`)

    // Delete conversation turns
    const { error: turnsError } = await supabase
      .from('conversation_turns')
      .delete()
      .eq('session_id', sessionId)

    if (turnsError) {
      console.error('Error deleting conversation turns:', turnsError)
      throw turnsError
    }

    // Delete interview answers
    const { error: answersError } = await supabase
      .from('interview_answers')
      .delete()
      .eq('session_id', sessionId)

    if (answersError) {
      console.error('Error deleting interview answers:', answersError)
      throw answersError
    }

    // Reset session to in_progress
    const { error: updateError } = await supabase
      .from('interview_sessions')
      .update({
        status: 'in_progress',
        completed_at: null,
        conversation_ended_at: null,
        answered_questions: 0,
        average_score: null,
        full_transcript: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('Error updating session:', updateError)
      throw updateError
    }

    console.log(`Interview session ${sessionId} reset successfully`)

    return NextResponse.json(
      {
        success: true,
        sessionId,
        message: 'Interview session reset successfully',
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error resetting interview session:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
