import { NextResponse } from "next/server"
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server"
import { summarizeDocument } from "@/lib/ai"
import { extractTextFromPDF } from "@/lib/pdf-utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(
  request: Request,
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
          "summary",
          "summary_generated_at",
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
      summary,
      summary_generated_at,
      extracted_text,
    } = doc as unknown as {
      id: string
      file_name: string
      file_url: string
      file_type: string | null
      parsed_data: unknown
      summary?: string | null
      summary_generated_at?: string | null
      extracted_text?: string | null
    }

    if (!force && summary && summary_generated_at) {
      return NextResponse.json(
        {
          id: docId,
          summary,
          summary_generated_at,
          from_cache: true,
        },
        { status: 200 }
      )
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "AI summarization is not configured. Please set GEMINI_API_KEY on the server.",
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
        console.error("Error fetching document for summary:", err)
        // Continue with parsed_data if file fetch fails
      }
    }

    const generated = await summarizeDocument({
      fileName: file_name,
      parsedData: parsed_data ?? undefined,
      extractedText: textContent || undefined,
    })

    const { data: updated, error: updateError } = await supabase
      .from("documents")
      .update({
        summary: generated,
        summary_generated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("summary, summary_generated_at")
      .single()

    if (updateError || !updated) {
      console.error("Error updating summary:", updateError)
      return NextResponse.json(
        { error: "Failed to persist summary" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        id: docId,
        summary: updated.summary,
        summary_generated_at: updated.summary_generated_at,
        from_cache: false,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error("Error generating document summary:", err)
    return NextResponse.json(
      { error: "Internal server error while generating summary" },
      { status: 500 }
    )
  }
}