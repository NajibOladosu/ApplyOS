import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/db/supabase/server'
import { createConversationTurn, saveFullTranscript } from '@/modules/interviews/services/conversation.service'
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/middleware/rate-limit'
import type { BufferedTurn } from '@/lib/gemini-live/types'
import type { ConversationTurn } from '@/types/database'
import { sanitizeAIGeneratedText } from '@/shared/infrastructure/ai-style'

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

    const rateLimitResponse = await rateLimitMiddleware(request, RATE_LIMITS.general, async () => user.id)
    if (rateLimitResponse) return rateLimitResponse

    // Parse request body
    const body = await request.json()
    const { sessionId, remainingTurns, transcript } = body

    if (!sessionId || !transcript || !Array.isArray(transcript)) {
      return NextResponse.json(
        { error: 'Missing or invalid required fields: sessionId, transcript' },
        { status: 400 }
      )
    }
    const sanitizedTranscript = (transcript as ConversationTurn[]).map((turn) => ({
      ...turn,
      content: turn.speaker === 'ai'
        ? sanitizeAIGeneratedText(turn.content)
        : turn.content,
    }))

    // Verify session belongs to user
    const { data: session } = await supabase
      .from('interview_sessions')
      .select('user_id, status, conversation_started_at')
      .eq('id', sessionId)
      .single()

    if (!session || session.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const endedAt = new Date()
    const startedAt = session.conversation_started_at ? new Date(session.conversation_started_at) : null
    const totalDurationSeconds = startedAt
      ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000))
      : 0

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
              content: turn.speaker === 'ai'
                ? sanitizeAIGeneratedText(turn.content)
                : turn.content,
              ...(turn.metadata && { metadata: turn.metadata }),
            },
            supabase
          )
          turnsSaved++
        } catch (error) {
          console.error(`Failed to save remaining turn ${turn.turn_number}:`, error)
          // Continue saving other turns even if one fails
        }
      }
    }

    // Save full transcript to session
    await saveFullTranscript(sessionId, sanitizedTranscript, supabase)

    // Update session status and metadata
    const { error: updateError } = await supabase
      .from('interview_sessions')
      .update({
        status: 'completed',
        completed_at: endedAt.toISOString(),
        conversation_ended_at: endedAt.toISOString(),
        answered_questions: sanitizedTranscript.filter((turn) => turn.speaker === 'user').length,
        total_duration_seconds: totalDurationSeconds,
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
    console.log(`- Total transcript entries: ${sanitizedTranscript.length}`)

    return NextResponse.json(
      {
        sessionId,
        turnsSaved,
        status: 'completed',
        message: 'Interview session completed successfully',
      },
      { status: 200 }
    )
  } catch (error) {
    const err = error as { message?: string; hint?: string; code?: string }
    console.error('Error completing interview session:', {
      message: err.message,
      details: String(error),
      hint: err.hint || '',
      code: err.code || '',
    })
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
