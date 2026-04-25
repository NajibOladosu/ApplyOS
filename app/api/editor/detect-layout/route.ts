import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/shared/db/supabase/server"
import { detectPdfLayout } from "@/lib/editor/layout-detect"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const { documentId } = await req.json()
        if (!documentId) {
            return new NextResponse("Missing documentId", { status: 400 })
        }

        const { data: doc, error: docError } = await supabase
            .from("documents")
            .select("id, file_url, file_type, user_id")
            .eq("id", documentId)
            .single()

        if (docError || !doc) {
            return new NextResponse("Document not found", { status: 404 })
        }
        if (doc.user_id !== user.id) {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const isPdf =
            (doc.file_type ?? "").includes("pdf") ||
            (doc.file_url ?? "").toLowerCase().endsWith(".pdf")

        if (!isPdf) {
            return NextResponse.json({
                layout: {
                    columnCount: 1,
                    hasPhoto: false,
                    hasSidebar: false,
                    confidence: 0.5,
                    suggestedTemplate: 'modern',
                },
            })
        }

        const fileResponse = await fetch(doc.file_url)
        if (!fileResponse.ok) {
            return new NextResponse(`Failed to fetch document: ${fileResponse.status}`, {
                status: 502,
            })
        }
        const arrayBuffer = await fileResponse.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const layout = await detectPdfLayout(buffer)
        return NextResponse.json({ layout })
    } catch (error: any) {
        console.error("[Layout Detect] Error:", error)
        return new NextResponse(
            JSON.stringify({ error: error.message || "Layout detection failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        )
    }
}
