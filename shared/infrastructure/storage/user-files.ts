import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Storage buckets whose objects are stored under a `<userId>/` folder:
 * - documents: private bucket, uploads via app/api/documents/upload and
 *   modules/documents/services/document.service.ts
 * - avatars: avatar uploads via app/api/account/avatar (path `<userId>/avatar`)
 */
export const USER_FILE_BUCKETS = ['documents', 'avatars'] as const

const PAGE_SIZE = 100

export interface UserFileCleanupResult {
  removed: number
  /** Folders found inside a user folder. The app writes flat files only; these are reported, not deleted. */
  skippedFolders: number
}

/**
 * Removes every object stored under `<userId>/` in the user file buckets.
 * Uses the service-role client (bypasses storage RLS). Fails closed: any
 * list or remove error throws, so the caller can stop before deleting the
 * database rows and let the user retry.
 */
export async function deleteAllUserStorageObjects(
  admin: SupabaseClient,
  userId: string,
): Promise<UserFileCleanupResult> {
  if (!userId || !/^[0-9a-fA-F-]{36}$/.test(userId)) {
    throw new Error('Invalid user id for storage cleanup')
  }

  let removed = 0
  let skippedFolders = 0

  for (const bucket of USER_FILE_BUCKETS) {
    const paths: string[] = []

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await admin.storage
        .from(bucket)
        .list(userId, { limit: PAGE_SIZE, offset })
      if (error) throw new Error(`Listing ${bucket} failed: ${error.message}`)
      if (!data || data.length === 0) break

      for (const entry of data) {
        // Supabase returns folders with a null id; files have an id.
        if (entry.id) paths.push(`${userId}/${entry.name}`)
        else skippedFolders += 1
      }
      if (data.length < PAGE_SIZE) break
    }

    for (let i = 0; i < paths.length; i += PAGE_SIZE) {
      const chunk = paths.slice(i, i + PAGE_SIZE)
      const { error } = await admin.storage.from(bucket).remove(chunk)
      if (error) throw new Error(`Removing from ${bucket} failed: ${error.message}`)
      removed += chunk.length
    }
  }

  return { removed, skippedFolders }
}
