import { NextRequest, NextResponse } from "next/server"
import { generateAnswer } from "@/shared/infrastructure/ai"
import { buildContextFromDocument } from "@/modules/documents/services/document.service"
import { rateLimitMiddleware, RATE_LIMITS } from "@/lib/middleware/rate-limit"
import { validateString, MAX_LENGTHS } from "@/lib/validation"
import { authenticateRequest } from "../_lib/auth"
import { profileToBackground } from "../_lib/profile-context"

export const dynamic = "force-dynamic"

/**
 * AI answers for open-ended application questions, called from the extension's
 * autofill flow (the equivalent of JobJet's "AI answers" / right-click fill).
 *
 * Context precedence: the documents attached to the application (or the most
 * recent analysed resume), then the autofill profile, then the saved-answers
 * library — so generated answers stay grounded in what the user actually did.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await authenticateRequest(req)
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const rateLimitResponse = await rateLimitMiddleware(req, RATE_LIMITS.ai, async () => user.id)
    if (rateLimitResponse) return rateLimitResponse

    const body = await req.json()
    const { question, jobDescription, applicationId, previousAnswers } = body ?? {}

    const questionErr = validateString(question, "question", {
      required: true,
      maxLength: MAX_LENGTHS.userAnswer,
    })
    if (questionErr) return NextResponse.json({ error: questionErr }, { status: 400 })

    if (jobDescription) {
      const jdErr = validateString(jobDescription, "jobDescription", {
        required: false,
        maxLength: MAX_LENGTHS.jobDescription,
      })
      if (jdErr) return NextResponse.json({ error: jdErr }, { status: 400 })
    }

    let application: { id: string; job_description: string | null } | null = null
    if (applicationId) {
      const { data: app, error: appError } = await supabase
        .from("applications")
        .select("id, job_description")
        .eq("id", applicationId)
        .eq("user_id", user.id)
        .single()

      if (appError || !app) {
        return NextResponse.json(
          { error: "Application not found or access denied" },
          { status: 404 }
        )
      }
      application = app
    }

    // Autofill profile from the users table (untrusted jsonb, parsed defensively)
    const { data: profileRow } = await supabase
      .from("users")
      .select("autofill_profile")
      .eq("id", user.id)
      .single()
    const profileBackground = profileToBackground(profileRow?.autofill_profile)

    // Resume context: the application's own documents, else the newest analysed resume
    let resumeContext: { resume?: string; experience?: string; education?: string } = {}
    if (application) {
      const { data: appDocRows } = await supabase
        .from("application_documents")
        .select("document_id")
        .eq("application_id", application.id)

      const documentIds = (appDocRows ?? []).map((row: { document_id: string }) => row.document_id)
      if (documentIds.length > 0) {
        const { data: docs } = await supabase
          .from("documents")
          .select("*")
          .in("id", documentIds)
          .eq("user_id", user.id)
          .eq("analysis_status", "success")

        for (const doc of docs ?? []) {
          const docContext = buildContextFromDocument(doc)
          resumeContext = { ...docContext, ...resumeContext }
        }
      }
    }

    if (!resumeContext.resume) {
      const { data: docs } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .eq("analysis_status", "success")
        .order("created_at", { ascending: false })
        .limit(1)

      const latest = docs?.[0]
      if (latest) {
        resumeContext = buildContextFromDocument(latest)
      }
    }

    const backgroundParts: string[] = []
    if (resumeContext.resume) backgroundParts.push(resumeContext.resume)
    if (resumeContext.experience) backgroundParts.push(`Experience:\n${resumeContext.experience}`)
    if (resumeContext.education) backgroundParts.push(`Education:\n${resumeContext.education}`)
    if (profileBackground) backgroundParts.push(`Autofill profile:\n${profileBackground}`)

    // Previous answers for this application keep the narrative consistent
    const priorAnswers = Array.isArray(previousAnswers)
      ? previousAnswers
          .filter(
            (entry: unknown): entry is { question: string; answer: string } =>
              Boolean(entry) &&
              typeof (entry as { question?: unknown }).question === "string" &&
              typeof (entry as { answer?: unknown }).answer === "string"
          )
          .slice(0, 10)
          .map((entry) => ({
            question: entry.question.slice(0, MAX_LENGTHS.userAnswer),
            answer: entry.answer.slice(0, MAX_LENGTHS.userAnswer),
          }))
      : []

    const answer = await generateAnswer(question, {
      resume: backgroundParts.join("\n\n") || undefined,
      jobDescription: jobDescription || application?.job_description || undefined,
      previousAnswers: priorAnswers,
    })

    return NextResponse.json({ answer })
  } catch (error) {
    console.error("Extension answer route error:", error)
    return NextResponse.json({ error: "Failed to generate answer" }, { status: 500 })
  }
}
