import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getInterviewSession,
  getQuestionsForSession,
} from '@/lib/services/interviews'
import { generateSystemInstruction } from '@/lib/gemini-live/system-prompts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/interview/live-session/init
 *
 * Initialize a Gemini Live API session
 * - Generates ephemeral token for secure WebSocket connection
 * - Loads or generates interview questions
 * - Builds system instruction with question guidelines
 *
 * Request body:
 * {
 *   sessionId: string  // Interview session ID
 * }
 *
 * Response:
 * {
 *   token: string            // Ephemeral token (1 hour TTL)
 *   sessionId: string        // Session ID
 *   questions: Question[]    // Pre-generated questions
 *   systemInstruction: string // System prompt for AI
 *   model: string            // Gemini model name
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify Gemini Live API key is configured
    if (!process.env.GEMINI_LIVE_API_KEY) {
      console.error('GEMINI_LIVE_API_KEY not configured')
      return NextResponse.json(
        { error: 'Gemini Live API is not configured' },
        { status: 500 }
      )
    }

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
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing required field: sessionId' },
        { status: 400 }
      )
    }

    // Fetch interview session
    let session
    try {
      session = await getInterviewSession(sessionId, supabase)
    } catch (error) {
      console.error('Failed to fetch session:', error)
      return NextResponse.json(
        { error: 'Interview session not found' },
        { status: 404 }
      )
    }

    // Verify session belongs to user
    if (session.user_id !== user.id) {
      console.error(`Unauthorized access attempt for session ${sessionId} by user ${user.id}`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Load existing questions - DO NOT regenerate
    const questions = await getQuestionsForSession(sessionId)

    if (questions.length === 0) {
      console.error(`No questions found for session ${sessionId}. Interview session must have questions before starting.`)
      return NextResponse.json(
        { error: 'Interview questions not found. Please create a new interview.' },
        { status: 400 }
      )
    }

    console.log(`Loaded ${questions.length} existing questions for session ${sessionId}`)

    // Generate system instruction
    const systemInstruction = generateSystemInstruction({
      sessionType: session.session_type,
      difficulty: session.difficulty || 'medium',
      companyName: session.company_name,
      questions: questions,
    })

    // Define interview control tools
    const tools = [{
      functionDeclarations: [{
        name: 'signal_interview_complete',
        description: 'Call this function when you have finished asking all interview questions and received answers from the candidate. This signals that the interview is complete and should be ended gracefully.',
        parameters: {
          type: 'object',
          properties: {
            reason: {
              type: 'string',
              description: 'Brief explanation of why the interview is complete (e.g., "All questions answered", "Time limit reached")',
            },
            questions_asked: {
              type: 'number',
              description: 'Number of main questions you asked during the interview',
            },
          },
          required: ['reason', 'questions_asked'],
        },
      }],
    }]

    // Model configuration
    const model = 'models/gemini-2.5-flash-native-audio-preview-09-2025'

    // TODO: Use ephemeral tokens once available in SDK
    // Ephemeral tokens provide better security by having a limited TTL (1 hour)
    // For now, using API key directly - client should connect directly to Gemini
    // and the key will be used for WebSocket authentication
    const token = process.env.GEMINI_LIVE_API_KEY

    console.log('Live session token prepared for model:', model)

    // Update session to mark conversation mode
    await supabase
      .from('interview_sessions')
      .update({
        conversation_mode: true,
        conversation_started_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    const duration = Date.now() - startTime

    console.log(`Live session initialized in ${duration}ms for session ${sessionId}`)

    return NextResponse.json(
      {
        token,
        sessionId,
        questions: questions.map((q) => ({
          id: q.id,
          question_text: q.question_text,
          question_category: q.question_category,
          difficulty: q.difficulty,
        })),
        systemInstruction,
        tools,
        model,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error initializing live session:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
