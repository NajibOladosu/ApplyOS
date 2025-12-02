import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateInterviewQuestions } from '@/lib/ai'
import {
  getInterviewSession,
  getQuestionsForSession,
  createQuestionsForSession,
} from '@/lib/services/interviews'
import { generateSystemInstruction } from '@/lib/gemini-live/system-prompts'
import type { QuestionCategory } from '@/types/database'

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

    // Get or generate questions
    let questions = await getQuestionsForSession(sessionId)

    if (questions.length === 0) {
      console.log(`No questions found for session ${sessionId}, generating...`)

      // Fetch application details for context
      const { data: application } = await supabase
        .from('applications')
        .select('job_description, company')
        .eq('id', session.application_id)
        .single()

      // Generate questions
      const aiQuestions = await generateInterviewQuestions({
        sessionType: session.session_type as any,
        difficulty: (session.difficulty || 'medium') as any,
        questionCount: session.total_questions || 5,
        jobDescription: application?.job_description || undefined,
        companyName: session.company_name || application?.company || undefined,
      })

      if (aiQuestions.length === 0) {
        return NextResponse.json(
          { error: 'Failed to generate interview questions' },
          { status: 500 }
        )
      }

      // Save questions to database
      questions = await createQuestionsForSession(
        session.id,
        aiQuestions.map((q, index) => ({
          question_text: q.question_text,
          question_category: q.question_category as QuestionCategory,
          difficulty: q.difficulty as 'easy' | 'medium' | 'hard',
          ideal_answer_outline: q.ideal_answer_outline,
          evaluation_criteria: q.evaluation_criteria,
          question_order: index + 1,
          estimated_duration_seconds: q.estimated_duration_seconds,
        })),
        supabase
      )

      console.log(`Generated and saved ${questions.length} questions`)
    }

    // Generate system instruction
    const systemInstruction = generateSystemInstruction({
      sessionType: session.session_type,
      difficulty: session.difficulty || 'medium',
      companyName: session.company_name,
      questions: questions,
    })

    // Model configuration
    const model = 'models/gemini-2.0-flash-exp'

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
