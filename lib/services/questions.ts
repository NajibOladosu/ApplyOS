import { createClient } from "@/shared/db/supabase/client"
import type { Question } from "@/types/database"

export async function getQuestionsByApplicationId(applicationId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return data as Question[]
}

export async function createQuestion(input: {
  application_id: string
  question_text: string
  ai_answer?: string | null
  manual_answer?: string | null
}) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("questions")
    .insert([
      {
        application_id: input.application_id,
        question_text: input.question_text,
        ai_answer: input.ai_answer ?? null,
        manual_answer: input.manual_answer ?? null,
      },
    ])
    .select()
    .single()

  if (error) throw error
  return data as Question
}

export async function updateQuestion(id: string, updates: Partial<Question>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("questions")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data as Question
}

export async function deleteQuestion(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from("questions")
    .delete()
    .eq("id", id)

  if (error) throw error
}
