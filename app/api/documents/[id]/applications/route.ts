import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseServerClient } from "@/shared/db/supabase/server"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

/**
 * Applications linked to a document.
 *
 * Sources, newest first:
 *  - the application_documents junction (the link created when an application
 *    is saved with the document attached);
 *  - the legacy single documents.application_id column, for rows that predate
 *    the junction table.
 */
export async function GET(
  _req: NextRequest,
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

    // Confirm the document belongs to this user (RLS would block otherwise,
    // but a clean 404 is friendlier than an empty success).
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, application_id")
      .eq("id", id)
      .maybeSingle()

    if (docError || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const { data: links, error: linkError } = await supabase
      .from("application_documents")
      .select("application_id, created_at")
      .eq("document_id", id)

    if (linkError) throw linkError

    const linkedIds = (links ?? []).map((l) => l.application_id)
    if (doc.application_id && !linkedIds.includes(doc.application_id)) {
      linkedIds.unshift(doc.application_id)
    }

    if (linkedIds.length === 0) {
      return NextResponse.json({ applications: [] }, { status: 200 })
    }

    const { data: apps, error: appsError } = await supabase
      .from("applications")
      .select("id, title, company, status, type, priority, deadline, created_at")
      .in("id", linkedIds)

    if (appsError) throw appsError

    const byId = new Map((apps ?? []).map((a) => [a.id, a]))

    // Preserve junction order (newest link first); legacy link goes last.
    const applications = linkedIds
      .map((applicationId) => byId.get(applicationId))
      .filter((a): a is NonNullable<typeof a> => Boolean(a))

    return NextResponse.json({ applications }, { status: 200 })
  } catch (err) {
    console.error("Error fetching linked applications:", err)
    return NextResponse.json(
      { error: "Internal server error while fetching linked applications" },
      { status: 500 }
    )
  }
}
