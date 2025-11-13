import { createClient } from '@/lib/supabase/client'
import type { Feedback, FeedbackType } from '@/types/database'

export async function createFeedback(input: {
  type: FeedbackType
  title: string
  description: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('feedback')
    .insert({
      user_id: user.id,
      type: input.type,
      title: input.title,
      description: input.description,
    })
    .select()
    .single()

  if (error) throw error
  return data as Feedback
}
