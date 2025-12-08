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

    const questions = await getQuestionsForSession(sessionId, supabase)  // Pass server client!


    if (questions.length > 0) {

    }

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
    const tools = [
      {
        functionDeclarations: [
          {
            name: 'signal_interview_complete',
            description: 'Call this function IMMEDIATELY and AUTOMATICALLY in the SAME TURN after speaking your closing remarks to the candidate. This signals that the interview is complete. Do not wait for user input.',
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
          },
          {
            name: 'save_answer_and_feedback',
            description: 'Call this function immediately after the user answers a question. This saves their answer and your detailed evaluation to the database. Be honest with your evaluation - only provide strengths if the answer deserves them (score >= 5), and only provide weaknesses if there are actual issues (score < 7).',
            parameters: {
              type: 'object',
              properties: {
                question_index: {
                  type: 'number',
                  description: 'The index of the question you just asked (1-based index). Question 1 = 1.',
                },
                user_response: {
                  type: 'string',
                  description: 'The verbatim transcription of the user\'s full answer to the question.',
                },
                overall_score: {
                  type: 'number',
                  description: 'Overall score from 0-10 (average of the 5 dimension scores). Use decimals like 7.5, 8.2.',
                },
                clarity_score: {
                  type: 'number',
                  description: 'Score 0-10 for how clear and understandable the answer was.',
                },
                structure_score: {
                  type: 'number',
                  description: 'Score 0-10 for how well-organized the answer was.',
                },
                relevance_score: {
                  type: 'number',
                  description: 'Score 0-10 for how directly the answer addressed the question.',
                },
                depth_score: {
                  type: 'number',
                  description: 'Score 0-10 for how detailed and thorough the answer was.',
                },
                confidence_score: {
                  type: 'number',
                  description: 'Score 0-10 for how confident the user sounded in their delivery.',
                },
                overall_feedback: {
                  type: 'string',
                  description: '2-3 sentences summarizing the answer quality.',
                },
                strengths: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of 2-3 specific positive aspects. ONLY provide if overall_score >= 5.0. If score < 5.0, use empty array [].',
                },
                weaknesses: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of 2-3 specific areas for improvement. ONLY provide if overall_score < 7.0. If score >= 7.0, use empty array [].',
                },
                suggestions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of 2-3 actionable recommendations. ALWAYS provide regardless of score.',
                },
                tone_analysis: {
                  type: 'string',
                  description: '1-2 sentences analyzing communication style and delivery.',
                },
              },
              required: ['question_index', 'user_response', 'overall_score', 'clarity_score', 'structure_score', 'relevance_score', 'depth_score', 'confidence_score', 'overall_feedback', 'strengths', 'weaknesses', 'suggestions', 'tone_analysis'],
            },
          },
        ],
      },
    ]

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
