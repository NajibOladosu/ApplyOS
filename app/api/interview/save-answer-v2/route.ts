import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQuestionsForSession } from '@/lib/services/interviews'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { sessionId, questionIndex, userAnswer, feedback, score, toneAnalysis } = body

        if (!sessionId || !questionIndex || !userAnswer) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        // 1. Get questions for session to map index to ID
        // We pass the supabase client to ensure RLS passes
        const questions = await getQuestionsForSession(sessionId, supabase)

        // questionIndex is 1-based (from AI), array is 0-based
        const question = questions[questionIndex - 1]

        if (!question) {
            console.error(`Question not found for index ${questionIndex} in session ${sessionId}`)
            return NextResponse.json(
                { error: 'Question not found' },
                { status: 404 }
            )
        }

        // 2. Save answer
        const { error: insertError } = await supabase.from('interview_answers').insert({
            session_id: sessionId,
            question_id: question.id,
            user_id: user.id,
            answer_text: userAnswer,
            audio_url: null, // We are not saving audio blobs anymore
            // Store tone analysis inside the feedback JSONB object
            feedback: {
                text: feedback,
                tone_analysis: toneAnalysis
            },
            score: score,
            answer_type: 'voice', // Since it's from live interview
            transcription_confidence: 1.0, // AI transcribed it, high confidence
        })

        if (insertError) {
            // If unique constraint violation (already answered), we might want to update instead?
            // But for now, let's just log and throw
            console.error('Error saving answer:', insertError)
            throw insertError
        }

        // 3. Update session stats (optional, but good for UI)
        // The previous logic updated `answered_questions` count. 
        // We can rely on a DB trigger or manual update.
        // Let's manually increment for now to be safe, or leave it to the aggregation view.
        // The "view" we created earlier relies on count(answers), so insertion is enough.

        return NextResponse.json({ success: true }, { status: 200 })
    } catch (error: any) {
        console.error('Error in save-answer-v2:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
