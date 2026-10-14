import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/shared/db/supabase/server"
import { rateLimitMiddleware, RATE_LIMITS } from "@/lib/middleware/rate-limit"
import { hasImportedProfileDetails, importedProfileFromParsedDocument } from "@/lib/autofill/from-parsed-document"
import { mergeImportedProfile, normalizeAutofillProfile } from "@/types/autofill"
import type { EducationEntry, WorkExperienceEntry } from "@/types/autofill"

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function uniqueHistory<T>(entries: T[], identity: (entry: T) => string): T[] {
  const seen = new Set<string>()
  return entries.filter((entry) => {
    const key = identity(entry).toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** List only documents with cached details that can be applied later. */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    const documents = [] as Array<{ id: string; file_name: string; parsed_data: unknown }>
    for (let start = 0; ; start += 100) {
      const { data, error } = await supabase
        .from("documents")
        .select("id, file_name, parsed_data")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(start, start + 99)
      if (error) throw error
      documents.push(...(data ?? []))
      if (!data || data.length < 100) break
    }
    return NextResponse.json({
      documents: documents
        .filter((document) => hasImportedProfileDetails(document.parsed_data))
        .map(({ id, file_name }) => ({ id, file_name })),
    })
  } catch (error) {
    console.error("Failed to list analyzed documents:", error)
    return NextResponse.json({ error: "Could not load analyzed documents" }, { status: 500 })
  }
}

/** Apply only cached document analysis to the user's still-blank profile fields. */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const limit = await rateLimitMiddleware(request, RATE_LIMITS.general, async () => user.id)
    if (limit) return limit

    const body = await request.json().catch(() => null)
    const ids = body?.documentIds
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 5000 ||
      !ids.every((id) => typeof id === "string" && UUID.test(id)) ||
      new Set(ids).size !== ids.length) {
      return NextResponse.json({ error: "Select between 1 and 5000 different documents" }, { status: 400 })
    }

    const documents = [] as Array<{ id: string; file_name: string; parsed_data: unknown }>
    for (let start = 0; start < ids.length; start += 100) {
      const { data, error: documentsError } = await supabase
        .from("documents")
        .select("id, file_name, parsed_data")
        .eq("user_id", user.id)
        .in("id", ids.slice(start, start + 100))
      if (documentsError) throw documentsError
      documents.push(...(data ?? []))
    }
    if (documents.length !== ids.length) {
      return NextResponse.json({ error: "A selected document was not found" }, { status: 404 })
    }

    const { data: row, error: profileError } = await supabase
      .from("users")
      .select("id, email, name, autofill_profile")
      .eq("id", user.id)
      .single()
    if (profileError || !row) throw profileError ?? new Error("Profile missing")

    let profile = normalizeAutofillProfile(row.autofill_profile)
    if (!profile.contact.email.trim()) profile.contact.email = row.email
    const existingExperience = profile.experience.length > 0
    const existingEducation = profile.educationHistory.length > 0
    const foundExperience: WorkExperienceEntry[] = []
    const foundEducation: EducationEntry[] = []
    const filled = new Set<string>()
    const used: string[] = []
    const byId = new Map(documents.map((document) => [document.id, document]))

    // The caller's order determines which document supplies a scalar field first.
    for (const id of ids) {
      const document = byId.get(id)!
      const imported = importedProfileFromParsedDocument(document.parsed_data)
      if (Object.keys(imported).length === 0) continue
      used.push(document.file_name)
      if (!existingExperience) {
        foundExperience.push(...(imported.experience ?? []).map((entry) => ({ ...entry, id: crypto.randomUUID() })))
      }
      if (!existingEducation) {
        foundEducation.push(...(imported.educationHistory ?? []).map((entry) => ({ ...entry, id: crypto.randomUUID() })))
      }
      const merged = mergeImportedProfile(profile, imported)
      profile = merged.profile
      merged.filled.forEach((field) => filled.add(field))
    }

    if (used.length === 0) {
      return NextResponse.json({ error: "The selected documents have no analyzed details yet" }, { status: 422 })
    }

    if (!existingExperience && foundExperience.length > 0) {
      profile.experience = uniqueHistory(foundExperience, (entry) =>
        [entry.company, entry.title, entry.startDate].join("|")
      )
      filled.add("experience")
    }
    if (!existingEducation && foundEducation.length > 0) {
      profile.educationHistory = uniqueHistory(foundEducation, (entry) =>
        [entry.school, entry.degree, entry.endYear].join("|")
      )
      filled.add("educationHistory")
    }

    const fullName = [profile.identity.firstName, profile.identity.lastName].filter(Boolean).join(" ")
    const savedName = !row.name?.trim() && fullName ? fullName : row.name
    if (filled.size > 0) {
      const { error: updateError } = await supabase
        .from("users")
        .update({
          autofill_profile: profile,
          ...(!row.name?.trim() && fullName ? { name: fullName } : {}),
        })
        .eq("id", user.id)
        .select("id")
        .single()
      if (updateError) throw updateError
    }

    return NextResponse.json({ profile, name: savedName, filledCount: filled.size, documentsUsed: used })
  } catch (error) {
    console.error("Failed to fill application details from documents:", error)
    return NextResponse.json({ error: "Could not update application details" }, { status: 500 })
  }
}
