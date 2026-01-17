import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseServerClient } from "@/shared/db/supabase/server"
import { parseDocument } from "@/shared/infrastructure/ai"
import { extractTextFromPDF } from "@/modules/documents/lib/pdf-utils"
import { extractTextFromDOCX } from "@/modules/documents/lib/docx-utils"
import type { Document } from "@/types/database"
import { rateLimitMiddleware, RATE_LIMITS } from "@/lib/middleware/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Analyze document (formerly "reprocess"):
 * - POST /api/documents/reprocess
 * - Body: { id: string, force?: boolean }
 *
 * Behavior:
 * - Auth + RLS-backed ownership check
 * - Loads document metadata
 * - Fetches file via file_url
 * - Extracts text for supported types
 * - Calls parseDocument() (Gemini)
 * - Persists structured parsed_data + analysis_status + parsed_at + analysis_error
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as { id?: string; force?: boolean }))
    const id = body.id
    const force = Boolean(body.force)

    if (!id) {
      return NextResponse.json(
        { error: "Missing document id" },
        { status: 400 }
      )
    }

    const supabase = await createSupabaseServerClient()

    // 1) Verify session / auth
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Apply rate limiting for AI endpoints
    const rateLimitResponse = await rateLimitMiddleware(
      request,
      RATE_LIMITS.ai,
      async () => user.id
    )
    if (rateLimitResponse) return rateLimitResponse

    // 2) Load document from DB (RLS ensures user owns it)
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select(
        [
          "id",
          "user_id",
          "file_name",
          "file_url",
          "file_type",
          "file_size",
          "parsed_data",
          "analysis_status",
          "analysis_error",
          "parsed_at",
          "extracted_text",
          "updated_at",
        ].join(",")
      )
      .eq("id", id)
      .single()

    if (docError || !doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      )
    }

    const document = doc as unknown as Document & {
      analysis_status?: string
      analysis_error?: string | null
      parsed_at?: string | null
      extracted_text?: string | null
    }

    if (!document.file_url) {
      return NextResponse.json(
        { error: "Document has no file_url to fetch content from" },
        { status: 400 }
      )
    }

    // Idempotency / status handling
    if (document.analysis_status === "pending" && !force) {
      // Check if it's been stuck in pending for more than 5 minutes
      const updatedAt = document.updated_at ? new Date(document.updated_at) : null
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

      if (updatedAt && updatedAt > fiveMinutesAgo) {
        return NextResponse.json(
          {
            error: "Analysis already in progress. Use force=true to retry.",
            analysis_status: "pending",
          },
          { status: 409 }
        )
      }
      // If stuck for more than 5 minutes, allow retry
      console.log(`Document ${id} stuck in pending, allowing retry`)
    }

    if (document.analysis_status === "success" && !force) {
      return NextResponse.json(
        {
          id: document.id,
          message: "Analysis already completed",
          analysis_status: "success",
          parsed_data: (document as any).parsed_data ?? null,
          parsed_at: (document as any).parsed_at ?? null,
          from_cache: true,
        },
        { status: 200 }
      )
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "AI analysis is not configured. Please set GEMINI_API_KEY on the server.",
        },
        { status: 503 }
      )
    }

    // Mark as pending (best effort; if this fails we still continue but log it)
    await supabase
      .from("documents")
      .update({
        analysis_status: "pending",
        analysis_error: null,
      })
      .eq("id", id)

    // 3) Use stored extracted text or re-extract if needed
    let extractedText = document.extracted_text || ""

    // If no stored text or force re-extraction, fetch and extract
    if (!extractedText || force) {
      console.log(`Extracting text for document ${id} (force=${force}, hasStored=${!!document.extracted_text})`)

      try {
        const fileResponse = await fetch(document.file_url)

        if (!fileResponse.ok) {
          const msg = `Failed to fetch document: ${fileResponse.status} ${fileResponse.statusText}`
          console.error(msg)
          await supabase
            .from("documents")
            .update({
              analysis_status: "failed",
              analysis_error: msg,
            })
            .eq("id", id)

          return NextResponse.json({ error: msg }, { status: 502 })
        }

        const contentType =
          fileResponse.headers.get("content-type") ?? document.file_type ?? ""
        const arrayBuffer = await fileResponse.arrayBuffer()

        // Basic size guard (10MB)
        const maxBytes = 10 * 1024 * 1024
        if (arrayBuffer.byteLength > maxBytes) {
          const msg = "Document too large for analysis (max 10MB)"
          await supabase
            .from("documents")
            .update({
              analysis_status: "failed",
              analysis_error: msg,
            })
            .eq("id", id)

          return NextResponse.json({ error: msg }, { status: 413 })
        }

        // Extract text based on content type
        if (contentType.startsWith("text/") || contentType.includes("json")) {
          extractedText = Buffer.from(arrayBuffer).toString("utf-8")
        } else if (contentType.includes("application/pdf")) {
          extractedText = await extractTextFromPDF(Buffer.from(arrayBuffer))
        } else if (
          contentType.includes("application/vnd.openxmlformats-officedocument") ||
          contentType.includes("application/msword")
        ) {
          extractedText = await extractTextFromDOCX(Buffer.from(arrayBuffer))
        } else {
          const msg = `Unsupported file type: ${contentType}`
          await supabase
            .from("documents")
            .update({
              analysis_status: "failed",
              analysis_error: msg,
            })
            .eq("id", id)

          return NextResponse.json({ error: msg }, { status: 415 })
        }

        // Truncate if too long (100KB)
        if (extractedText.length > 100000) {
          extractedText = extractedText.slice(0, 100000) + "\n...(truncated)"
        }

        // Store extracted text for future use
        await supabase
          .from("documents")
          .update({ extracted_text: extractedText })
          .eq("id", id)
      } catch (err) {
        console.error("Error during text extraction:", err)
        const msg = `Text extraction failed: ${err}`
        await supabase
          .from("documents")
          .update({
            analysis_status: "failed",
            analysis_error: msg,
          })
          .eq("id", id)

        return NextResponse.json({ error: msg }, { status: 500 })
      }
    }

    if (!extractedText || extractedText.trim().length === 0) {
      const msg = "No textual content could be extracted from this document."
      await supabase
        .from("documents")
        .update({
          analysis_status: "failed",
          analysis_error: msg,
        })
        .eq("id", id)

      return NextResponse.json({ error: msg }, { status: 422 })
    }

    // 5) Call AI parser to get structured data
    const parsedData = await parseDocument(extractedText)

    // 6) Persist analysis result
    const { data: updatedRaw, error: updateError } = await supabase
      .from("documents")
      .update({
        parsed_data: parsedData,
        parsed_at: new Date().toISOString(),
        analysis_status: "success",
        analysis_error: null,
      })
      .eq("id", id)
      .select(
        [
          "id",
          "parsed_data",
          "parsed_at",
          "analysis_status",
          "analysis_error",
        ].join(",")
      )
      .single()

    if (updateError || !updatedRaw) {
      console.error("Error updating document analysis:", updateError)
      return NextResponse.json(
        {
          error: "Failed to persist analysis result",
        },
        { status: 500 }
      )
    }

    const updated = updatedRaw as unknown as {
      id: string
      parsed_data: unknown
      parsed_at: string | null
      analysis_status: string
      analysis_error: string | null
    }

    return NextResponse.json(
      {
        id: updated.id,
        message: "Document analyzed successfully",
        analysis_status: updated.analysis_status,
        parsed_data: updated.parsed_data,
        parsed_at: updated.parsed_at,
        from_cache: false,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Unexpected error in /api/documents/reprocess:", error)
    return NextResponse.json(
      {
        error:
          "Internal server error while analyzing document",
      },
      { status: 500 }
    )
  }
}