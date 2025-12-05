import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/interview/report/generate
 *
 * Generates AI-powered interview report from conversation transcript
 * - Analyzes user responses against pre-generated questions
 * - Scores each answer with detailed feedback
 * - Stores results in interview_answers table
 * - Updates session statistics
 *
 * Request body:
 * {
 *   sessionId: string
 * }
 *
 * Response:
 * {
 *   reportData: {
 *     session: InterviewSession
 *     questions: InterviewQuestion[]
 *     answers: InterviewAnswer[]
 *   }
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

    // Get session
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get questions
    const { data: questions, error: questionsError } = await supabase
      .from('interview_questions')
      .select('*')
      .eq('session_id', sessionId)
      .order('question_order')

    if (questionsError || !questions || questions.length === 0) {
      return NextResponse.json({ error: 'Questions not found' }, { status: 404 })
    }

    // Get conversation turns
    const { data: turns, error: turnsError } = await supabase
      .from('conversation_turns')
      .select('*')
      .eq('session_id', sessionId)
      .order('turn_number')

    if (turnsError || !turns) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Check if report already exists
    const { data: existingAnswers } = await supabase
      .from('interview_answers')
      .select('id')
      .eq('session_id', sessionId)
      .limit(1)

    if (existingAnswers && existingAnswers.length > 0) {
      // Report already exists, return it
      return await getExistingReport(supabase, sessionId, session, questions)
    }

    // Initialize Gemini API
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    // Extract user responses (filter for user turns only)
    const userTurns = turns.filter((t) => t.speaker === 'user')

    console.log(`Generating report for session ${sessionId}: ${userTurns.length} user responses, ${questions.length} questions`)

    // Score each answer
    const answers: any[] = []
    let totalScore = 0

    for (let i = 0; i < Math.min(userTurns.length, questions.length); i++) {
      const question = questions[i]
      const userTurn = userTurns[i]

      try {
        // Generate scoring prompt
        const prompt = `You are an expert interview evaluator. Score the following answer to an interview question.

Question:
${question.question_text}

Category: ${question.question_category}
Difficulty: ${question.difficulty}

${question.ideal_answer_outline ? `Ideal Answer Guidance:\n${JSON.stringify(question.ideal_answer_outline, null, 2)}\n` : ''}
${question.evaluation_criteria ? `Evaluation Criteria:\n${JSON.stringify(question.evaluation_criteria, null, 2)}\n` : ''}

Candidate's Answer:
${userTurn.content}

Provide a JSON response with the following structure:
{
  "overall_score": <number 0-10>,
  "clarity_score": <number 0-10>,
  "structure_score": <number 0-10>,
  "relevance_score": <number 0-10>,
  "depth_score": <number 0-10>,
  "feedback": {
    "strengths": ["strength 1", "strength 2"],
    "areas_for_improvement": ["area 1", "area 2"],
    "suggestions": ["suggestion 1", "suggestion 2"]
  }
}

Be constructive and specific in your feedback. Focus on what the candidate did well and how they can improve.`

        const result = await model.generateContent(prompt)
        const responseText = result.response.text()

        // Parse JSON response (strip markdown if present)
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, responseText]
        const jsonText = jsonMatch[1]?.trim() || responseText.trim()
        const evaluation = JSON.parse(jsonText)

        // Store answer in database
        const { data: answer, error: answerError } = await supabase
          .from('interview_answers')
          .insert({
            question_id: question.id,
            session_id: sessionId,
            user_id: user.id,
            answer_text: userTurn.content,
            answer_type: 'voice',
            audio_url: userTurn.audio_url,
            audio_duration_seconds: userTurn.audio_duration_seconds,
            score: evaluation.overall_score,
            feedback: evaluation.feedback,
            clarity_score: evaluation.clarity_score,
            structure_score: evaluation.structure_score,
            relevance_score: evaluation.relevance_score,
            depth_score: evaluation.depth_score,
            answered_at: userTurn.timestamp,
          })
          .select()
          .single()

        if (answerError) {
          console.error('Error storing answer:', answerError)
          throw answerError
        }

        answers.push(answer)
        totalScore += evaluation.overall_score

        console.log(`Scored Q${i + 1}: ${evaluation.overall_score}/10`)
      } catch (error: any) {
        console.error(`Error scoring question ${i + 1}:`, error)
        // Continue with other questions
      }
    }

    // Calculate average score
    const averageScore = answers.length > 0 ? totalScore / answers.length : 0

    // Update session with statistics
    await supabase
      .from('interview_sessions')
      .update({
        answered_questions: answers.length,
        average_score: averageScore,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    console.log(`Report generated: ${answers.length} answers, average score: ${averageScore.toFixed(2)}`)

    // Fetch updated session
    const { data: updatedSession } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    return NextResponse.json(
      {
        reportData: {
          session: updatedSession || session,
          questions,
          answers,
        },
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error generating interview report:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * Helper function to get existing report
 */
async function getExistingReport(supabase: any, sessionId: string, session: any, questions: any[]) {
  const { data: answers } = await supabase
    .from('interview_answers')
    .select('*')
    .eq('session_id', sessionId)
    .order('answered_at')

  return NextResponse.json(
    {
      reportData: {
        session,
        questions,
        answers: answers || [],
      },
    },
    { status: 200 }
  )
}
