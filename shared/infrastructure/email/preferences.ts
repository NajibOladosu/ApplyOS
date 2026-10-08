/**
 * Email preference checks.
 *
 * Preferences are stored on the auth user's `user_metadata`, written by the
 * settings page (app/settings) and by the unsubscribe endpoint
 * (app/api/email/unsubscribe). Every scheduled or non-transactional email must
 * consult this helper before sending, so an opt-out is honoured no matter which
 * job or template sends the message.
 *
 * Transactional account emails (email verification, password reset) do not
 * use this helper and are not affected by marketing or digest opt-outs.
 */

export type OptionalEmailCategory = 'deadline_reminders' | 'status_updates' | 'weekly_digest'

/**
 * Returns true only when the user has NOT opted out of the given category.
 * `email_notifications: false` is the global switch and disables every
 * optional category. Missing flags are treated as enabled, which matches the
 * defaults used by the settings page.
 */
export function isEmailCategoryEnabled(
  userMetadata: Record<string, unknown> | null | undefined,
  category: OptionalEmailCategory,
): boolean {
  const meta = userMetadata ?? {}
  if (isOptOutValue(meta.email_notifications)) return false
  if (isOptOutValue(meta[category])) return false
  return true
}

/**
 * Fail closed: an explicit `false` (or a string such as "false" written by a
 * client or import) is an opt-out. Anything else is not an opt-out.
 */
function isOptOutValue(value: unknown): boolean {
  return value === false || (typeof value === 'string' && value.trim().toLowerCase() === 'false')
}
