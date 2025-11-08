import { createClient } from '@/lib/supabase/client'
import type { Question } from '@/types/database'

export async function getQuestionsByApplication(applicationId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data as Question[]
}

export async function createQuestion(question: {
  application_id: string
  question_text: string
  ai_answer?: string
}) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('questions')
    .insert([question])
    .select()
    .single()

  if (error) throw error
  return data as Question
}

export async function updateQuestion(id: string, updates: Partial<Question>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('questions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Question
}

export async function deleteQuestion(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('questions')
    .delete()
    .eq('id', id)

  if (error) throw error
}
