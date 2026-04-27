'use client'

import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { CONSENT_EVENT, readConsent, type ConsentValue } from '@/lib/cookie-consent'

export function AnalyticsGate() {
  const [consent, setConsent] = useState<ConsentValue | null>(null)

  useEffect(() => {
    setConsent(readConsent())
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ConsentValue | null>).detail
      setConsent(detail ?? readConsent())
    }
    window.addEventListener(CONSENT_EVENT, handler)
    return () => window.removeEventListener(CONSENT_EVENT, handler)
  }, [])

  if (consent !== 'accepted') return null

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  )
}
