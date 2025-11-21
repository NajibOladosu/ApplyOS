import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateCoverLetter } from "@/lib/ai"
import { buildContextFromDocument } from "@/lib/services/documents"
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
    const { applicationId } = body

    console.log("Generate cover letter request:", { applicationId, hasBody: !!body })

    if (!applicationId) {
      return NextResponse.json(
        { error: "Missing applicationId" },
        { status: 400 }
      )
    }

    // Verify the application belongs to the user and get its details
    const { data: app, error: appError } = await supabase
      .from("applications")
      .select("id, title, company, notes")
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
      jobDescription: app.notes || undefined,
    }

    // Get the documents associated with this application
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
      const { data: analyzedDocs, error: analyzedDocsError } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .eq("analysis_status", "success")
        .not("parsed_data", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)

      if (!analyzedDocsError && analyzedDocs && analyzedDocs.length > 0) {
        console.log("Using fallback document:", analyzedDocs[0].id)
        context = {
          ...buildContextFromDocument(analyzedDocs[0]),
          jobDescription: app.notes || undefined,
        }
      }
    }

    console.log("Final context built:", {
      hasJobDescription: !!context.jobDescription,
      hasResume: !!context.resume,
      hasExperience: !!context.experience,
      hasEducation: !!context.education
    })

    try {
      console.log("Generating cover letter for application:", app.title)
      const coverLetter = await generateCoverLetter(app.title, app.company || null, context)
      console.log("Generated cover letter, length:", coverLetter.length)

      // Save the cover letter to the database
      const { data: savedApp, error: updateError } = await supabase
        .from("applications")
        .update({ ai_cover_letter: coverLetter })
        .eq("id", app.id)
        .select()
        .single()

      if (updateError || !savedApp) {
        throw new Error(`Failed to save cover letter: ${updateError?.message}`)
      }

      console.log("Cover letter saved to application:", savedApp.id)

      return NextResponse.json(
        { success: true, coverLetter: coverLetter, application: savedApp },
        { status: 200 }
      )
    } catch (error) {
      console.error("Error generating cover letter:", {
        applicationId,
        message: error instanceof Error ? error.message : String(error),
        error
      })
      return NextResponse.json(
        { error: "Failed to generate cover letter" },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Unexpected generate cover letter error:", error)
    return NextResponse.json(
      { error: "Unexpected error while generating cover letter" },
      { status: 500 }
    )
  }
}
