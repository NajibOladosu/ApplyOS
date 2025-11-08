import { NextResponse } from "next/server"
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server"
import { summarizeDocument } from "@/lib/ai"

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
          "parsed_data",
          "summary",
          "summary_generated_at",
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
      parsed_data,
      summary,
      summary_generated_at,
    } = doc as unknown as {
      id: string
      file_name: string
      parsed_data: unknown
      summary?: string | null
      summary_generated_at?: string | null
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

    const generated = await summarizeDocument({
      fileName: file_name,
      parsedData: parsed_data ?? undefined,
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