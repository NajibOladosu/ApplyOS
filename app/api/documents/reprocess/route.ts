import { NextResponse } from "next/server"
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server"
import { parseDocument } from "@/lib/ai"
import type { Document } from "@/types/database"

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
export async function POST(request: Request) {
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
    }

    if (!document.file_url) {
      return NextResponse.json(
        { error: "Document has no file_url to fetch content from" },
        { status: 400 }
      )
    }

    // Idempotency / status handling
    if (document.analysis_status === "pending") {
      return NextResponse.json(
        {
          error: "Analysis already in progress",
          analysis_status: "pending",
        },
        { status: 409 }
      )
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

    // 3) Fetch raw file content (from Supabase public URL or equivalent)
    let fileResponse: Response
    try {
      fileResponse = await fetch(document.file_url)
    } catch (err) {
      console.error("Error fetching file_url:", err)
      await supabase
        .from("documents")
        .update({
          analysis_status: "failed",
          analysis_error: "Unable to fetch document content from file_url",
        })
        .eq("id", id)

      return NextResponse.json(
        { error: "Unable to fetch document content from file_url" },
        { status: 502 }
      )
    }

    if (!fileResponse.ok) {
      const msg = `Failed to fetch document content: ${fileResponse.status} ${fileResponse.statusText}`
      console.error(msg)
      await supabase
        .from("documents")
        .update({
          analysis_status: "failed",
          analysis_error: msg,
        })
        .eq("id", id)

      return NextResponse.json(
        { error: msg },
        { status: 502 }
      )
    }

    const contentType =
      fileResponse.headers.get("content-type") ?? document.file_type ?? ""

    // Basic size guard (5MB default, configurable via env)
    const maxBytes =
      (process.env.MAX_ANALYSIS_FILE_SIZE_BYTES &&
        parseInt(process.env.MAX_ANALYSIS_FILE_SIZE_BYTES, 10)) ||
      5 * 1024 * 1024

    const arrayBuffer = await fileResponse.arrayBuffer()
    if (arrayBuffer.byteLength > maxBytes) {
      const msg = "Document too large for analysis"
      await supabase
        .from("documents")
        .update({
          analysis_status: "failed",
          analysis_error: msg,
        })
        .eq("id", id)

      return NextResponse.json(
        { error: msg },
        { status: 413 }
      )
    }

    // 4) Extract text from supported types
    let extractedText = ""

    if (contentType.startsWith("text/") || contentType.includes("json")) {
      extractedText = Buffer.from(arrayBuffer).toString("utf-8")
    } else if (contentType.includes("application/pdf")) {
      // PDF: use pdf-parse (Node.js runtime only)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse: (data: Buffer) => Promise<{ text: string }> = require("pdf-parse")
      const parsed = await pdfParse(Buffer.from(arrayBuffer))
      extractedText = parsed.text || ""
    } else if (
      contentType.includes(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) ||
      contentType.includes("application/msword")
    ) {
      const msg =
        "DOC/DOCX parsing is not yet implemented. Please use PDF or text for automatic analysis."
      await supabase
        .from("documents")
        .update({
          analysis_status: "failed",
          analysis_error: msg,
        })
        .eq("id", id)

      return NextResponse.json(
        { error: msg },
        { status: 501 }
      )
    } else {
      const msg = `Unsupported content-type for analysis: ${contentType}`
      await supabase
        .from("documents")
        .update({
          analysis_status: "failed",
          analysis_error: msg,
        })
        .eq("id", id)

      return NextResponse.json(
        { error: msg },
        { status: 415 }
      )
    }

    if (!extractedText || extractedText.trim().length === 0) {
      const msg =
        "No textual content could be extracted from this document for analysis."
      await supabase
        .from("documents")
        .update({
          analysis_status: "failed",
          analysis_error: msg,
        })
        .eq("id", id)

      return NextResponse.json(
        { error: msg },
        { status: 422 }
      )
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