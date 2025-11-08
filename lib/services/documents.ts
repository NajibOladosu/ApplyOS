import { createClient } from "@/lib/supabase/client"
import type { Document } from "@/types/database"

export async function getDocuments() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw error
  return data as Document[]
}

/**
 * Fetch a single document (client-side) for cases where we want to use Supabase directly
 * instead of the REST API detail route.
 * The app currently relies on the dedicated API route:
 * [`app/api/documents/[id]/route.ts`](app/api/documents/[id]/route.ts:1)
 */
export async function getDocumentById(id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single()

  if (error) throw error
  return data as Document
}

export async function uploadDocument(file: File) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Not authenticated")

  const fileName = `${user.id}/${Date.now()}_${file.name}`

  const {
    data: uploadData,
    error: uploadError,
  } = await supabase.storage.from("documents").upload(fileName, file)

  if (uploadError) throw uploadError

  const {
    data: { publicUrl },
  } = supabase.storage.from("documents").getPublicUrl(fileName)

  const { data, error } = await supabase
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

  if (error) throw error
  return data as Document
}

export async function deleteDocument(id: string, fileUrl: string) {
  const supabase = createClient()

  const urlParts = fileUrl.split("/")
  const filePath = urlParts.slice(-2).join("/")

  const { error: storageError } = await supabase.storage
    .from("documents")
    .remove([filePath])

  if (storageError)
    console.error("Storage deletion error:", storageError)

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)

  if (error) throw error
}

/**
 * Legacy helper retained for compatibility.
 * For AI analysis & summary we now prefer backend routes which:
 * - enforce auth/ownership via RLS
 * - update analysis_status / parsed_at / summary, etc.
 */
export async function updateDocumentParsedData(id: string, parsedData: any) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("documents")
    .update({ parsed_data: parsedData })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data as Document
}
