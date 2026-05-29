import { NextRequest } from "next/server"
import { createClient } from "@/shared/db/supabase/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { generateAnswer } from "@/shared/infrastructure/ai"
import {
  getAnalyzedDocuments,
  buildContextFromDocument,
} from "@/modules/documents/services/document.service"
import { rateLimitMiddleware, RATE_LIMITS } from "@/lib/middleware/rate-limit"

export const dynamic = "force-dynamic"

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function POST(req: NextRequest) {
  // --- auth (same shape as /api/questions/regenerate) ---
  let supabase
  const authHeader = req.headers.get("Authorization")
  if (authHeader?.startsWith("Bearer ")) {
    supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    )
  } else {
    supabase = await createClient()
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response("Not authenticated", { status: 401 })
  }

  const rateLimitResponse = await rateLimitMiddleware(
    req,
    RATE_LIMITS.ai,
    async () => user.id
  )
  if (rateLimitResponse) return rateLimitResponse

  const body = await req.json().catch(() => ({}))
  const { applicationId, extraContext } = body as {
    applicationId?: string
    extraContext?: string
  }
  if (!applicationId) {
    return new Response("Missing applicationId", { status: 400 })
  }

  // --- verify app ownership ---
  const { data: app, error: appError } = await supabase
    .from("applications")
    .select("id, job_description")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .single()
  if (appError || !app) {
    return new Response("Application not found or access denied", { status: 404 })
  }

  // --- fetch questions ---
  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true })
  if (questionsError) {
    return new Response("Failed to retrieve questions", { status: 500 })
  }
  const questionList = questions || []

  // --- build shared context (same logic as /regenerate) ---
  const context: {
    resume?: string
    experience?: string
    education?: string
    jobDescription?: string
    extraInstructions?: string
  } = {
    jobDescription: app.job_description || undefined,
    extraInstructions: extraContext || undefined,
  }

  const { data: appDocRows } = await supabase
    .from("application_documents")
    .select("document_id")
    .eq("application_id", applicationId)
  const applicationDocIds = (appDocRows || []).map((r: { document_id: string }) => r.document_id)

  if (applicationDocIds.length > 0) {
    const { data: docs } = await supabase
      .from("documents")
      .select("*")
      .in("id", applicationDocIds)
      .eq("user_id", user.id)
    for (const doc of docs || []) {
      if (doc.analysis_status === "success" && doc.parsed_data) {
        const c = buildContextFromDocument(doc)
        if (c.resume) context.resume = c.resume
        if (c.experience) context.experience = c.experience
        if (c.education) context.education = c.education
      }
    }
  } else {
    const fallback = await getAnalyzedDocuments()
    if (fallback.length > 0) {
      const c = buildContextFromDocument(fallback[0])
      if (c.resume) context.resume = c.resume
      if (c.experience) context.experience = c.experience
      if (c.education) context.education = c.education
    }
  }

  // --- stream answers as they arrive ---
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(sseEvent("start", { total: questionList.length }))
      )

      let successCount = 0
      // Coherence: accumulate answered pairs so each answer builds on the prior ones.
      const answeredPairs: { question: string; answer: string }[] = []
      for (const q of questionList) {
        try {
          const answer = await generateAnswer(q.question_text, {
            ...context,
            previousAnswers: answeredPairs,
          })
          const { data: saved, error: updateError } = await supabase
            .from("questions")
            .update({ ai_answer: answer })
            .eq("id", q.id)
            .select()
            .single()
          if (updateError || !saved) {
            throw new Error(updateError?.message || "Update failed")
          }
          successCount++
          answeredPairs.push({ question: q.question_text, answer })
          controller.enqueue(encoder.encode(sseEvent("answer", saved)))
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              sseEvent("error", {
                questionId: q.id,
                message: err instanceof Error ? err.message : String(err),
              })
            )
          )
        }
      }

      controller.enqueue(
        encoder.encode(
          sseEvent("done", {
            successCount,
            total: questionList.length,
          })
        )
      )
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
