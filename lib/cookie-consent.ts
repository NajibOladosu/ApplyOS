export const CONSENT_COOKIE = 'applyos-cookie-consent'
export const CONSENT_EVENT = 'applyos:consent-changed'

export type ConsentValue = 'accepted' | 'rejected'

export function readConsent(): ConsentValue | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CONSENT_COOKIE}=`))
  if (!match) return null
  const value = decodeURIComponent(match.split('=')[1] || '')
  return value === 'accepted' || value === 'rejected' ? value : null
}

export function writeConsent(value: ConsentValue): void {
  if (typeof document === 'undefined') return
  const oneYear = 60 * 60 * 24 * 365
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${oneYear}; Path=/; SameSite=Lax${secure}`
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }))
}

export function clearConsent(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${CONSENT_COOKIE}=; Max-Age=0; Path=/`
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: null }))
}
