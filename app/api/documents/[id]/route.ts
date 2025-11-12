import { NextResponse } from "next/server"
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server"
import type { Document } from "@/types/database"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(
  _req: Request,
  context: RouteContext
) {
  const { id } = await context.params

  if (!id) {
    return NextResponse.json({ error: "Missing document id" }, { status: 400 })
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

    const { data, error } = await supabase
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
          "version",
          "created_at",
          "updated_at",
          "report",
          "report_generated_at",
          "analysis_status",
          "analysis_error",
          "parsed_at",
          "application_id",
          "extracted_text",
        ].join(",")
      )
      .eq("id", id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Cast defensively to avoid TS issues with potential error-like shapes.
    const document = data as unknown as Document

    return NextResponse.json(
      {
        id: document.id,
        file_name: document.file_name,
        file_url: document.file_url,
        file_type: (document as any).file_type ?? null,
        file_size: (document as any).file_size ?? null,
        parsed_data: (document as any).parsed_data ?? null,
        version: (document as any).version ?? 1,
        created_at: document.created_at,
        updated_at: (document as any).updated_at ?? null,
        report: (document as any).report ?? null,
        report_generated_at: (document as any).report_generated_at ?? null,
        analysis_status: (document as any).analysis_status ?? "not_analyzed",
        analysis_error: (document as any).analysis_error ?? null,
        parsed_at: (document as any).parsed_at ?? null,
        application_id: (document as any).application_id ?? null,
        extracted_text: (document as any).extracted_text ?? null,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error("Error fetching document detail:", err)
    return NextResponse.json(
      { error: "Internal server error while fetching document" },
      { status: 500 }
    )
  }
}