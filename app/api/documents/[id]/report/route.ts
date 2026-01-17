import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseServerClient } from "@/shared/db/supabase/server"
import { generateDocumentReport } from "@/shared/infrastructure/ai"
import { extractTextFromPDF } from "@/modules/documents/lib/pdf-utils"
import type { DocumentReport } from "@/types/database"
import { rateLimitMiddleware, RATE_LIMITS } from "@/lib/middleware/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params

  if (!id) {
    return NextResponse.json({ error: "Missing document id" }, { status: 400 })
  }

  let force = false
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = await request.json().catch(() => ({}))
      if (typeof body.force === "boolean") {
        force = body.force
      }
    }
  } catch {
    // Ignore malformed body; treat as no "force"
  }

  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Apply rate limiting for AI endpoints
    const rateLimitResponse = await rateLimitMiddleware(
      request,
      RATE_LIMITS.ai,
      async () => user.id
    )
    if (rateLimitResponse) return rateLimitResponse

    // Fetch document scoped by RLS (ensures ownership)
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select(
        [
          "id",
          "user_id",
          "file_name",
          "file_url",
          "file_type",
          "parsed_data",
          "report",
          "report_generated_at",
          "extracted_text",
        ].join(",")
      )
      .eq("id", id)
      .single()

    if (docError || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const {
      id: docId,
      file_name,
      file_url,
      file_type,
      parsed_data,
      report,
      report_generated_at,
      extracted_text,
    } = doc as unknown as {
      id: string
      file_name: string
      file_url: string
      file_type: string | null
      parsed_data: unknown
      report?: DocumentReport | null
      report_generated_at?: string | null
      extracted_text?: string | null
    }

    if (!force && report && report_generated_at) {
      return NextResponse.json(
        {
          id: docId,
          report,
          report_generated_at,
          from_cache: true,
        },
        { status: 200 }
      )
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "AI report generation is not configured. Please set GEMINI_API_KEY on the server.",
        },
        { status: 503 }
      )
    }

    // Use stored extracted text (much faster!)
    // Only fetch and extract if no stored text is available
    let textContent = extracted_text || ""

    if (!textContent && file_url) {
      try {
        const fileResponse = await fetch(file_url)
        if (fileResponse.ok) {
          const contentType = fileResponse.headers.get("content-type") ?? file_type ?? ""
          const arrayBuffer = await fileResponse.arrayBuffer()

          // Extract text based on content type
          if (contentType.startsWith("text/") || contentType.includes("json")) {
            textContent = Buffer.from(arrayBuffer).toString("utf-8")
          } else if (contentType.includes("application/pdf")) {
            textContent = await extractTextFromPDF(Buffer.from(arrayBuffer))
          }

          // Store for future use
          if (textContent) {
            await supabase
              .from("documents")
              .update({ extracted_text: textContent })
              .eq("id", id)
          }
        }
      } catch (err) {
        console.error("Error fetching document for report generation:", err)
        // Continue with parsed_data if file fetch fails
      }
    }

    const generated = await generateDocumentReport({
      fileName: file_name,
      parsedData: parsed_data ?? undefined,
      extractedText: textContent || undefined,
    })

    const { data: updated, error: updateError } = await supabase
      .from("documents")
      .update({
        report: generated,
        report_generated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("report, report_generated_at")
      .single()

    if (updateError || !updated) {
      console.error("Error updating report:", updateError)
      return NextResponse.json(
        { error: "Failed to persist report" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        id: docId,
        report: updated.report,
        report_generated_at: updated.report_generated_at,
        from_cache: false,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error("Error generating document report:", err)
    return NextResponse.json(
      { error: "Internal server error while generating report" },
      { status: 500 }
    )
  }
}
