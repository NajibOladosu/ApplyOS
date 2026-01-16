import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/db/supabase/server'
import { createConversationTurn, saveFullTranscript } from '@/lib/services/conversation'
import type { BufferedTurn } from '@/lib/gemini-live/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/interview/live-session/complete
 *
 * Finalize live interview session
 * - Saves any remaining buffered turns
 * - Updates session status to 'completed'
 * - Stores full transcript
 * - Updates conversation_ended_at timestamp
 *
 * Request body:
 * {
 *   sessionId: string
 *   remainingTurns?: BufferedTurn[]  // Any unsaved turns
 *   transcript: ConversationTurn[]    // Full conversation history
 * }
 *
 * Response:
 * {
 *   sessionId: string
 *   turnsSaved: number
 *   status: string
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

    // Parse request body
    const body = await request.json()
    const { sessionId, remainingTurns, transcript } = body

    if (!sessionId || !transcript) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, transcript' },
        { status: 400 }
      )
    }

    // Verify session belongs to user
    const { data: session } = await supabase
      .from('interview_sessions')
      .select('user_id, status')
      .eq('id', sessionId)
      .single()

    if (!session || session.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Save any remaining buffered turns
    let turnsSaved = 0

    if (remainingTurns && Array.isArray(remainingTurns) && remainingTurns.length > 0) {
      console.log(`Saving ${remainingTurns.length} remaining turns for session ${sessionId}`)

      for (const turn of remainingTurns as BufferedTurn[]) {
        try {
          await createConversationTurn(
            {
              session_id: sessionId,
              turn_number: turn.turn_number,
              speaker: turn.speaker,
              content: turn.content,
              ...(turn.metadata && { metadata: turn.metadata }),
            },
            supabase
          )
          turnsSaved++
        } catch (error: any) {
          console.error(`Failed to save remaining turn ${turn.turn_number}:`, error)
          // Continue saving other turns even if one fails
        }
      }
    }

    // Save full transcript to session
    await saveFullTranscript(sessionId, transcript, supabase)

    // Update session status and metadata
    const { error: updateError } = await supabase
      .from('interview_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        conversation_ended_at: new Date().toISOString(),
        answered_questions: transcript.filter((t: any) => t.speaker === 'user').length,
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('Failed to update session status:', updateError)
      return NextResponse.json(
        { error: 'Failed to finalize session' },
        { status: 500 }
      )
    }

    console.log(`Interview session ${sessionId} completed successfully`)
    console.log(`- Remaining turns saved: ${turnsSaved}`)
    console.log(`- Total transcript entries: ${transcript.length}`)

    return NextResponse.json(
      {
        sessionId,
        turnsSaved,
        status: 'completed',
        message: 'Interview session completed successfully',
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error completing interview session:', {
      message: error.message,
      details: error.toString(),
      hint: error.hint || '',
      code: error.code || '',
    })
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
