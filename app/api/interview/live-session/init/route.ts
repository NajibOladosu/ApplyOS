import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/db/supabase/server'
import {
  getInterviewSession,
  getQuestionsForSession,
} from '@/modules/interviews/services/interview.service'
import { generateSystemInstruction } from '@/lib/gemini-live/system-prompts'
import { SPECIALIZED_MODELS } from '@/shared/infrastructure/ai/model-manager'
import { AIConnectionError, resolveAISource } from '@/shared/infrastructure/ai/connections'
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/middleware/rate-limit'

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
    // Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate-limit token issuance — prevents abuse if a session ID leaks
    const rateLimitResponse = await rateLimitMiddleware(
      request,
      RATE_LIMITS.ai,
      async () => user.id
    )
    if (rateLimitResponse) return rateLimitResponse

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

    const audio = await resolveAISource('audio', user.id)
    const provider = audio.source === 'openai' ? 'openai' : 'gemini'
    const model = audio.source === 'openai' ? 'gpt-realtime-mini'
      : SPECIALIZED_MODELS.LIVE_AUDIO
    let token: string

    if (provider === 'gemini') {
      const apiKey = audio.source === 'gemini' ? audio.apiKey : process.env.GEMINI_LIVE_API_KEY
      if (!apiKey) throw new AIConnectionError('ApplyOS voice is unavailable. Select another audio source in Settings.')
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          uses: 1,
          expireTime: new Date(Date.now() + 30 * 60_000).toISOString(),
          newSessionExpireTime: new Date(Date.now() + 60_000).toISOString(),
        }),
      })
      if (!response.ok) throw new AIConnectionError(`Gemini voice connection failed (HTTP ${response.status}). Check its API billing in Settings.`)
      const body = await response.json() as { name?: string }
      if (!body.name) throw new AIConnectionError('Gemini did not issue a voice session credential.')
      token = body.name
    } else {
      const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: {
          authorization: `Bearer ${audio.apiKey}`,
          'content-type': 'application/json',
          'OpenAI-Safety-Identifier': user.id,
        },
        body: JSON.stringify({
          expires_after: { anchor: 'created_at', seconds: 60 },
          session: {
            type: 'realtime', model, instructions: systemInstruction,
            output_modalities: ['audio'],
            audio: {
              input: { format: { type: 'audio/pcm', rate: 24000 }, transcription: { model: 'gpt-4o-mini-transcribe' } },
              output: { format: { type: 'audio/pcm', rate: 24000 }, voice: 'alloy' },
            },
            tools: tools[0].functionDeclarations.map(declaration => ({
              type: 'function', name: declaration.name,
              description: declaration.description, parameters: declaration.parameters,
            })),
          },
        }),
      })
      if (!response.ok) throw new AIConnectionError(`OpenAI voice connection failed (HTTP ${response.status}). Check its API billing in Settings.`)
      const body = await response.json() as { value?: string }
      if (!body.value) throw new AIConnectionError('OpenAI did not issue a voice session credential.')
      token = body.value
    }

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
        provider,
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
  } catch (error) {
    console.error('Error initializing live session:', error instanceof AIConnectionError ? error.message : 'Unexpected error')
    return NextResponse.json(
      { error: error instanceof AIConnectionError ? error.message : 'Internal server error' },
      { status: error instanceof AIConnectionError ? 503 : 500 }
    )
  }
}
