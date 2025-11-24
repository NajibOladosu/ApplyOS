import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateAnswer } from "@/lib/ai"
import { getAnalyzedDocuments, buildContextFromDocument } from "@/lib/services/documents"
import type { Question } from "@/types/database"
import { rateLimitMiddleware, RATE_LIMITS } from "@/lib/middleware/rate-limit"

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Apply rate limiting for AI endpoints
    const rateLimitResponse = await rateLimitMiddleware(
      req,
      RATE_LIMITS.ai,
      async () => user.id
    )
    if (rateLimitResponse) return rateLimitResponse

    const body = await req.json()
    const { applicationId, questionId } = body

    console.log("Regenerate request:", { applicationId, questionId, hasBody: !!body })

    if (!applicationId) {
      return NextResponse.json(
        { error: "Missing applicationId" },
        { status: 400 }
      )
    }

    // Verify the application belongs to the user and get its details
    const { data: app, error: appError } = await supabase
      .from("applications")
      .select("id, job_description")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .single()

    if (appError || !app) {
      console.error("Application lookup failed:", { appError, hasApp: !!app, applicationId })
      return NextResponse.json(
        { error: "Application not found or access denied" },
        { status: 404 }
      )
    }

    // Get all questions for this application (using server client)
    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true })

    if (questionsError) {
      console.error("Questions lookup failed:", { questionsError })
      return NextResponse.json(
        { error: "Failed to retrieve questions" },
        { status: 500 }
      )
    }

    const questionList = questions || []
    console.log("Questions retrieved:", { count: questionList.length, questionIds: questionList.map(q => q.id) })

    // Build context from selected documents and application info
    let context: {
      resume?: string
      experience?: string
      education?: string
      jobDescription?: string
    } = {
      resume: undefined,
      experience: undefined,
      education: undefined,
      jobDescription: app.job_description || undefined,
    }

    // Get the documents associated with this application (using server client)
    const { data: appDocRows, error: appDocError } = await supabase
      .from("application_documents")
      .select("document_id")
      .eq("application_id", applicationId)

    if (appDocError) {
      console.error("Failed to fetch application documents:", appDocError)
      return NextResponse.json(
        { error: "Failed to retrieve related documents" },
        { status: 500 }
      )
    }

    const applicationDocIds = (appDocRows || []).map(row => row.document_id)
    console.log("Application document IDs:", { count: applicationDocIds.length, ids: applicationDocIds })

    if (applicationDocIds.length > 0) {
      // Fetch the actual documents
      const { data: selectedDocs, error: docsError } = await supabase
        .from("documents")
        .select("*")
        .in("id", applicationDocIds)
        .eq("user_id", user.id)

      console.log("Selected documents fetched:", {
        count: selectedDocs?.length || 0,
        error: docsError?.message,
        docs: selectedDocs?.map(d => ({ id: d.id, status: d.analysis_status, hasParsedData: !!d.parsed_data }))
      })

      if (!docsError && selectedDocs && selectedDocs.length > 0) {
        for (const doc of selectedDocs) {
          console.log("Processing document:", { id: doc.id, status: doc.analysis_status, hasParsedData: !!doc.parsed_data })
          if (doc.analysis_status === "success" && doc.parsed_data) {
            const docContext = buildContextFromDocument(doc)
            console.log("Built context from document:", {
              hasResume: !!docContext.resume,
              hasExperience: !!docContext.experience,
              hasEducation: !!docContext.education
            })
            if (docContext.resume) context.resume = docContext.resume
            if (docContext.experience) context.experience = docContext.experience
            if (docContext.education) context.education = docContext.education
          }
        }
      }
    } else {
      // Fallback: use the most recent analyzed document
      console.log("No selected documents, using fallback to most recent analyzed document")
      const analyzedDocs = await getAnalyzedDocuments()
      console.log("Analyzed documents available:", analyzedDocs.length)
      if (analyzedDocs.length > 0) {
        context = buildContextFromDocument(analyzedDocs[0])
        console.log("Built context from fallback document:", {
          hasResume: !!context.resume,
          hasExperience: !!context.experience,
          hasEducation: !!context.education
        })
      }
    }

    console.log("Final context built:", {
      hasJobDescription: !!context.jobDescription,
      hasResume: !!context.resume,
      hasExperience: !!context.experience,
      hasEducation: !!context.education
    })

    const updatedQuestions: Question[] = []

    if (questionId) {
      // Regenerate single question
      console.log("Regenerating single question:", { questionId, availableQuestionIds: questionList.map(q => q.id) })
      const target = questionList.find((q) => q.id === questionId)
      if (!target) {
        console.error("Target question not found:", { questionId, availableCount: questionList.length })
        return NextResponse.json(
          { error: "Question not found" },
          { status: 404 }
        )
      }

      try {
        console.log("Generating answer for question:", questionId)
        const answer = await generateAnswer(target.question_text, context)
        console.log("Generated answer, length:", answer.length)
        const { data: saved, error: updateError } = await supabase
          .from("questions")
          .update({ ai_answer: answer })
          .eq("id", target.id)
          .select()
          .single()

        if (updateError || !saved) {
          throw new Error(`Failed to update question: ${updateError?.message}`)
        }
        console.log("Question updated:", saved.id)
        updatedQuestions.push(saved)
      } catch (error) {
        console.error("Error regenerating single answer:", {
          questionId,
          message: error instanceof Error ? error.message : String(error),
          error
        })
        return NextResponse.json(
          { error: "Failed to regenerate answer" },
          { status: 500 }
        )
      }
    } else {
      // Regenerate all questions
      console.log("Regenerating all questions:", { count: questionList.length, contextKeys: Object.keys(context).filter(k => context[k as keyof typeof context]) })
      for (const q of questionList) {
        try {
          console.log("Generating answer for question:", q.id)
          const answer = await generateAnswer(q.question_text, context)
          console.log("Generated answer, length:", answer.length)
          const { data: saved, error: updateError } = await supabase
            .from("questions")
            .update({ ai_answer: answer })
            .eq("id", q.id)
            .select()
            .single()

          if (updateError || !saved) {
            throw new Error(`Failed to update question: ${updateError?.message}`)
          }
          console.log("Question updated:", saved.id)
          updatedQuestions.push(saved)
        } catch (error) {
          console.error("Error regenerating answer for question:", q.id, {
            message: error instanceof Error ? error.message : String(error),
            error
          })
          // Continue with next question instead of failing entirely
        }
      }

      console.log("Regeneration complete:", { successCount: updatedQuestions.length, totalQuestions: questionList.length })

      if (updatedQuestions.length === 0) {
        console.error("All questions failed to regenerate")
        return NextResponse.json(
          { error: "Failed to regenerate any answers" },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { success: true, questions: updatedQuestions },
      { status: 200 }
    )
  } catch (error) {
    console.error("Unexpected regenerate error:", error)
    return NextResponse.json(
      { error: "Unexpected error while regenerating answers" },
      { status: 500 }
    )
  }
}
