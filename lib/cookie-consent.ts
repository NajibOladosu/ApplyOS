export const CONSENT_COOKIE = 'applyos-cookie-consent'
export const CONSENT_EVENT = 'applyos:consent-changed'

export type ConsentState = {
  analytics: boolean
  performance: boolean
}

export const ALL_CONSENT: ConsentState = { analytics: true, performance: true }
export const NO_CONSENT: ConsentState = { analytics: false, performance: false }

export function readConsent(): ConsentState | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CONSENT_COOKIE}=`))
  if (!match) return null
  try {
    const raw = decodeURIComponent(match.split('=')[1] || '')
    const parsed = JSON.parse(raw)
    return {
      analytics: !!parsed.analytics,
      performance: !!parsed.performance,
    }
  } catch {
    return null
  }
}

export function writeConsent(state: ConsentState): void {
  if (typeof document === 'undefined') return
  const oneYear = 60 * 60 * 24 * 365
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  const value = encodeURIComponent(JSON.stringify(state))
  document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${oneYear}; Path=/; SameSite=Lax${secure}`
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }))
}

export function clearConsent(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${CONSENT_COOKIE}=; Max-Age=0; Path=/`
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: null }))
}
