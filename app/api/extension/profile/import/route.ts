import { NextRequest, NextResponse } from "next/server"
import { callGeminiWithFallback } from "@/shared/infrastructure/ai"
import { extractTextFromPDF } from "@/modules/documents/lib/pdf-utils"
import { extractTextFromDOCX } from "@/modules/documents/lib/docx-utils"
import { rateLimitMiddleware, RATE_LIMITS } from "@/lib/middleware/rate-limit"
import {
  MAX_DOCUMENT_FILE_SIZE_BYTES,
  ALLOWED_DOCUMENT_MIME_TYPES,
  verifyFileMagicBytes,
  MAX_LENGTHS,
} from "@/lib/validation"
import { authenticateRequest } from "../../_lib/auth"
import {
  buildImportPrompt,
  coerceImportedProfile,
  extractJsonObject,
} from "../../_lib/profile-import"

export const runtime = "nodejs" // Node for Buffer/file handling
export const dynamic = "force-dynamic"

/**
 * Resume → autofill profile ("auto profile builder").
 *
 * Accepts either:
 *  - multipart/form-data with a `file` (PDF/DOCX/TXT) — the extension's
 *    options page sends the resume the user picks, nothing is stored;
 *  - JSON `{ documentId }` — import from a document already in the vault;
 *  - JSON `{ text }` — raw resume text.
 *
 * Returns the extracted profile fields. The extension merges them into the
 * stored profile; nothing here writes to the database.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await authenticateRequest(req)
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const rateLimitResponse = await rateLimitMiddleware(req, RATE_LIMITS.ai, async () => user.id)
    if (rateLimitResponse) return rateLimitResponse

    const contentType = req.headers.get("content-type") ?? ""
    let resumeText: string | null = null

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      const file = formData.get("file")

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing file" }, { status: 400 })
      }
      if (file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: "File exceeds the 25 MB limit" }, { status: 413 })
      }
      if (file.type && !ALLOWED_DOCUMENT_MIME_TYPES.has(file.type)) {
        return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 415 })
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      if (!verifyFileMagicBytes(buffer, file.type || "application/octet-stream")) {
        return NextResponse.json(
          { error: "File contents do not match the declared type" },
          { status: 415 }
        )
      }

      if (file.type === "application/pdf") {
        resumeText = await extractTextFromPDF(buffer)
      } else if (
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.type === "application/msword"
      ) {
        resumeText = await extractTextFromDOCX(buffer)
      } else {
        resumeText = buffer.toString("utf-8")
      }
    } else {
      const body = await req.json()
      const { documentId, text } = body ?? {}

      if (documentId) {
        const { data: doc, error: docError } = await supabase
          .from("documents")
          .select("id, user_id, extracted_text, file_url, file_name")
          .eq("id", documentId)
          .eq("user_id", user.id)
          .single()

        if (docError || !doc) {
          return NextResponse.json(
            { error: "Document not found or access denied" },
            { status: 404 }
          )
        }

        if (doc.extracted_text) {
          resumeText = doc.extracted_text
        } else if (doc.file_url) {
          const response = await fetch(doc.file_url)
          if (!response.ok) {
            return NextResponse.json(
              { error: "Could not download the document file" },
              { status: 502 }
            )
          }
          const buffer = Buffer.from(await response.arrayBuffer())
          const name = (doc.file_name || "").toLowerCase()
          if (name.endsWith(".pdf")) resumeText = await extractTextFromPDF(buffer)
          else if (name.endsWith(".docx")) resumeText = await extractTextFromDOCX(buffer)
          else resumeText = buffer.toString("utf-8")
        }
      } else if (text) {
        resumeText = text
      }
    }

    if (!resumeText || resumeText.trim().length < 40) {
      return NextResponse.json(
        { error: "Could not read enough text from the resume to build a profile" },
        { status: 422 }
      )
    }

    if (resumeText.length > MAX_LENGTHS.extractedText) {
      resumeText = resumeText.slice(0, MAX_LENGTHS.extractedText)
    }

    const response = await callGeminiWithFallback(buildImportPrompt(resumeText), "COMPLEX")
    const parsed = extractJsonObject(response)
    if (!parsed) {
      return NextResponse.json(
        { error: "The AI response could not be parsed. Please try again." },
        { status: 502 }
      )
    }

    const profile = coerceImportedProfile(parsed)
    const filledSections = Object.keys(profile).length
    if (filledSections === 0) {
      return NextResponse.json(
        { error: "No profile fields could be extracted from this resume" },
        { status: 422 }
      )
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error("Extension profile import error:", error)
    return NextResponse.json(
      { error: "Failed to import the resume" },
      { status: 500 }
    )
  }
}
