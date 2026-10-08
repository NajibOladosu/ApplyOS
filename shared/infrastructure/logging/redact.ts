/**
 * Redacts an email address for log output: "alice@example.com" -> "a***@example.com".
 * Use it in console output so that logs do not hold full personal data.
 * The domain is kept for operational debugging.
 */
export function redactEmail(email: string | null | undefined): string {
  if (!email) return '[no-email]'
  const at = email.lastIndexOf('@')
  if (at <= 0 || at === email.length - 1) return '[redacted]'
  return `${email.charAt(0)}***${email.slice(at)}`
}
