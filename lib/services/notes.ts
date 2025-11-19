import { createClient } from '@/lib/supabase/client'
import type { ApplicationNote } from '@/types/database'

export async function getNotesByApplicationId(applicationId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('application_notes')
    .select('*')
    .eq('application_id', applicationId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as ApplicationNote[]
}

export async function createNote(applicationId: string, note: {
  content: string
  category?: string
  is_pinned?: boolean
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('application_notes')
    .insert([
      {
        application_id: applicationId,
        user_id: user.id,
        content: note.content,
        category: note.category || null,
        is_pinned: note.is_pinned || false,
      },
    ])
    .select()
    .single()

  if (error) throw error
  return data as ApplicationNote
}

export async function updateNote(noteId: string, updates: {
  content?: string
  category?: string | null
  is_pinned?: boolean
}) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('application_notes')
    .update(updates)
    .eq('id', noteId)
    .select()
    .single()

  if (error) throw error
  return data as ApplicationNote
}

export async function deleteNote(noteId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('application_notes')
    .delete()
    .eq('id', noteId)

  if (error) throw error
}

export async function togglePinNote(noteId: string, isPinned: boolean) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('application_notes')
    .update({ is_pinned: !isPinned })
    .eq('id', noteId)
    .select()
    .single()

  if (error) throw error
  return data as ApplicationNote
}
