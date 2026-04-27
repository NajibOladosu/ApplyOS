'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CONSENT_EVENT, readConsent, writeConsent, type ConsentValue } from '@/lib/cookie-consent'

export function CookieConsentBanner() {
  const [consent, setConsent] = useState<ConsentValue | null | 'loading'>('loading')

  useEffect(() => {
    setConsent(readConsent())
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ConsentValue | null>).detail
      setConsent(detail ?? readConsent())
    }
    window.addEventListener(CONSENT_EVENT, handler)
    return () => window.removeEventListener(CONSENT_EVENT, handler)
  }, [])

  if (consent === 'loading' || consent !== null) return null

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-3xl rounded-lg border border-border bg-card/95 p-4 shadow-lg backdrop-blur sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          We use cookies for analytics and performance insights. See our{' '}
          <Link href="/privacy" className="text-primary underline underline-offset-2 hover:opacity-80">
            Privacy Policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => writeConsent('rejected')}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => writeConsent('accepted')}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
