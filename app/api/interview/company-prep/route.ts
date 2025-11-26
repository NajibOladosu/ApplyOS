import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateCompanySpecificQuestions } from '@/lib/ai'
import {
  createInterviewSession,
  createQuestionsForSession,
  getCompanyTemplate,
  incrementTemplateUsage,
} from '@/lib/services/interviews'
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/middleware/rate-limit'
import type { QuestionCategory } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * POST /api/interview/company-prep
 *
 * Generate company-specific interview questions from templates.
 * Uses pre-seeded question banks for major tech companies.
 *
 * Body:
 * - applicationId: string (required)
 * - companySlug: string (required) - e.g., 'google', 'meta', 'amazon', 'netflix'
 * - questionCount: number (default: 5)
 * - customizeForJob: boolean (default: false) - Whether to customize questions based on job description
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(
      request,
      RATE_LIMITS.ai,
      async () => user.id
    )
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const body = await request.json()
    const { applicationId, companySlug, questionCount = 5, customizeForJob = false } = body

    // Validation
    if (!applicationId || !companySlug) {
      return NextResponse.json(
        { error: 'Missing required fields: applicationId, companySlug' },
        { status: 400 }
      )
    }

    if (questionCount < 1 || questionCount > 20) {
      return NextResponse.json(
        { error: 'questionCount must be between 1 and 20' },
        { status: 400 }
      )
    }

    // Verify application belongs to user
    const { data: application } = await supabase
      .from('applications')
      .select('id, company, job_description')
      .eq('id', applicationId)
      .eq('user_id', user.id)
      .single()

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Fetch company template
    const template = await getCompanyTemplate(companySlug)

    if (!template) {
      return NextResponse.json(
        {
          error: `Company template not found for '${companySlug}'. Available: google, meta, amazon, netflix`,
        },
        { status: 404 }
      )
    }

    // Increment template usage
    await incrementTemplateUsage(template.id)

    // Parse template questions
    const templateQuestions = Array.isArray(template.questions) ? template.questions : []

    if (templateQuestions.length === 0) {
      return NextResponse.json({ error: 'Template has no questions' }, { status: 400 })
    }

    // Create interview session
    const session = await createInterviewSession({
      application_id: applicationId,
      session_type: 'company_specific',
      difficulty: 'medium', // Templates have mixed difficulties
      company_name: template.company_name,
    })

    // Generate/customize questions
    const aiQuestions = await generateCompanySpecificQuestions({
      templateQuestions,
      jobDescription: customizeForJob ? application.job_description || undefined : undefined,
      questionCount: Math.min(questionCount, templateQuestions.length),
    })

    // Save questions to database
    const questions = await createQuestionsForSession(
      session.id,
      aiQuestions.map((q, index) => ({
        question_text: q.question_text,
        question_category: q.question_category as QuestionCategory,
        difficulty: q.difficulty as 'easy' | 'medium' | 'hard',
        ideal_answer_outline: q.ideal_answer_outline,
        evaluation_criteria: q.evaluation_criteria,
        question_order: index + 1,
        estimated_duration_seconds: q.estimated_duration_seconds,
      }))
    )

    return NextResponse.json(
      {
        session,
        questions,
        template: {
          company_name: template.company_name,
          description: template.description,
          tips: template.tips,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error generating company-specific questions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate company-specific questions' },
      { status: 500 }
    )
  }
}
