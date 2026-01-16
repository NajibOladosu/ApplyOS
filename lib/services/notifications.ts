import { createClient } from '@/shared/db/supabase/client'
import type { Notification } from '@/types/database'

export async function getNotifications() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) throw error
  return data as Notification[]
}

export async function markAsRead(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)

  if (error) throw error
}

export async function markAllAsRead() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) throw error
}

export async function createNotification(notification: {
  type: string
  message: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('notifications')
    .insert([
      {
        user_id: user.id,
        ...notification,
      },
    ])
    .select()
    .single()

  if (error) throw error
  return data as Notification
}
