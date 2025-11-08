import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { parseDocument } from "@/lib/ai"

/**
 * Handles document upload + analysis.
 *
 * Flow:
 * - Authenticate user via server-side Supabase.
 * - Read multipart/form-data, accept one or more "files".
 * - For each file:
 *   - Upload to Supabase Storage bucket "documents" under path: user.id/timestamp_filename
 *   - Insert row into public.documents with metadata + public URL.
 *   - Run AI-based parsing via parseDocument() when GEMINI_API_KEY is set.
 *   - Update the document row with parsed_data.
 *
 * Returns:
 * - 200 with an array of created documents on success.
 * - 401 when unauthenticated.
 * - 400/500 on validation or server errors.
 */

export const runtime = "nodejs" // ensure Node runtime for FormData/file handling

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

    const formData = await req.formData()
    const files = formData.getAll("files")

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files uploaded" },
        { status: 400 }
      )
    }

    const createdDocuments: {
      id: string
      file_name: string
      file_url: string
      file_type: string | null
      file_size: number | null
      parsed_data: unknown | null
    }[] = []

    for (const entry of files) {
      if (!(entry instanceof File)) {
        continue
      }

      const file = entry
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      if (!buffer.length) {
        continue
      }

      const safeName = file.name.replace(/[^\w.\-]+/g, "_")
      const path = `${user.id}/${Date.now()}_${safeName}`

      // Upload to Supabase Storage (documents bucket)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, buffer, {
          contentType: file.type || undefined,
          upsert: false,
        })

      if (uploadError || !uploadData) {
        console.error("Storage upload error:", uploadError)
        continue
      }

      // Get public URL (or you can switch to signed URLs if preferred)
      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(uploadData.path)

      // Insert DB row
      const { data: docRow, error: insertError } = await supabase
        .from("documents")
        .insert([
          {
            user_id: user.id,
            file_name: file.name,
            file_url: publicUrl,
            file_type: file.type,
            file_size: file.size,
          },
        ])
        .select()
        .single()

      if (insertError || !docRow) {
        console.error("Insert document error:", insertError)
        continue
      }

      let parsed_data = null

      try {
        // Attempt AI-based parsing if GEMINI_API_KEY is configured.
        const textToAnalyze = `File name: ${file.name}`
        const parsed = await parseDocument(textToAnalyze)
        if (parsed) {
          parsed_data = parsed
          const { error: updateError } = await supabase
            .from("documents")
            .update({ parsed_data })
            .eq("id", docRow.id)

          if (updateError) {
            console.error("Failed to update parsed_data:", updateError)
          }
        }
      } catch (parseError) {
        // Parsing is best-effort; log but do not fail the upload pipeline
        console.error("Error parsing document with AI:", parseError)
      }

      createdDocuments.push({
        ...docRow,
        parsed_data: parsed_data ?? docRow.parsed_data ?? null,
      })
    }

    if (createdDocuments.length === 0) {
      return NextResponse.json(
        { error: "Failed to process uploaded documents" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, documents: createdDocuments },
      { status: 200 }
    )
  } catch (error) {
    console.error("Unexpected upload error:", error)
    return NextResponse.json(
      { error: "Unexpected error while uploading documents" },
      { status: 500 }
    )
  }
}