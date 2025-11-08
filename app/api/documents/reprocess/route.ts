import { NextResponse } from "next/server"
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server"
import { parseDocument } from "@/lib/ai"
import { updateDocumentParsedData } from "@/lib/services/documents"
import type { Document } from "@/types/database"

/**
 * Backend pipeline to:
 * - Validate auth
 * - Load document metadata from DB
 * - Fetch raw file via file_url
 * - Extract text (basic support: PDF/text; easily extendable)
 * - Call parseDocument() (Gemini models/gemini-2.0-flash)
 * - Persist structured data into documents.parsed_data
 *
 * This is designed to be called from the client via POST /api/documents/reprocess
 * with JSON body: { id: string }
 */

export async function POST(request: Request) {
  try {
    const { id } = await request.json().catch(() => ({} as { id?: string }))

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
      .select("*")
      .eq("id", id)
      .single()

    if (docError || !doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      )
    }

    const document = doc as Document

    if (!document.file_url) {
      return NextResponse.json(
        { error: "Document has no file_url to fetch content from" },
        { status: 400 }
      )
    }

    // 3) Fetch raw file content
    // Note: We assume file_url is either:
    // - A public URL from Supabase Storage, or
    // - An accessible URL within your environment.
    // For private buckets, you should instead:
    // - Use Supabase Storage with service role key server-side to create a signed URL, then fetch that.
    let fileResponse: Response
    try {
      fileResponse = await fetch(document.file_url)
    } catch (err) {
      console.error("Error fetching file_url:", err)
      return NextResponse.json(
        { error: "Unable to fetch document content from file_url" },
        { status: 502 }
      )
    }

    if (!fileResponse.ok) {
      return NextResponse.json(
        {
          error: `Failed to fetch document content: ${fileResponse.status} ${fileResponse.statusText}`,
        },
        { status: 502 }
      )
    }

    const contentType =
      fileResponse.headers.get("content-type") ?? document.file_type ?? ""

    // 4) Extract text from supported types
    // For production-hardening:
    // - We implement a minimal but real pipeline:
    //   - text/* and JSON: treat as text
    //   - application/pdf: naive text extraction via pdf.js or server lib (not bundled here)
    //   - Others: rejected as unsupported until a parser is added.
    let extractedText = ""

    if (contentType.startsWith("text/") || contentType.includes("json")) {
      // Plain text or JSON-ish: read directly
      extractedText = await fileResponse.text()
    } else if (contentType.includes("application/pdf")) {
      // PDF: use pdf-parse to extract text
      // Ensure this route runs in a Node.js runtime (not edge),
      // since pdf-parse depends on Node APIs.
      const arrayBuffer = await fileResponse.arrayBuffer()
      const pdfBuffer = Buffer.from(arrayBuffer)
      // pdf-parse has a CommonJS-style default export signature; import and use directly.
      // We type it as any here to avoid incorrect ESM typing issues while keeping runtime correct.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse: (data: Buffer) => Promise<{ text: string }> = require("pdf-parse")
      const parsed = await pdfParse(pdfBuffer)
      extractedText = parsed.text || ""
    } else if (
      contentType.includes(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) ||
      contentType.includes("application/msword")
    ) {
      // DOC/DOCX: real parsing requires a dedicated library.
      // For now, we explicitly report this as unsupported instead of faking success.
      return NextResponse.json(
        {
          error:
            "DOC/DOCX parsing is not yet implemented on this backend. Please use PDF or text for automatic analysis.",
        },
        { status: 501 }
      )
    } else {
      return NextResponse.json(
        {
          error: `Unsupported content-type for re-processing: ${contentType}`,
        },
        { status: 415 }
      )
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json(
        {
          error:
            "No textual content could be extracted from this document for analysis.",
        },
        { status: 422 }
      )
    }

    // 5) Call AI parser to get structured data
    const parsed = await parseDocument(extractedText)

    // 6) Persist into documents.parsed_data using existing service
    const updated = await updateDocumentParsedData(id, parsed)

    return NextResponse.json(
      {
        message: "Document re-processed successfully",
        parsed_data: updated.parsed_data,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Unexpected error in /api/documents/reprocess:", error)
    return NextResponse.json(
      { error: "Internal server error while re-processing document" },
      { status: 500 }
    )
  }
}