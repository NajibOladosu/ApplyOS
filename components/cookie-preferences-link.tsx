'use client'

import { clearConsent } from '@/lib/cookie-consent'

export function CookiePreferencesLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => clearConsent()}
      className={className ?? 'hover:text-primary transition-colors'}
    >
      Cookie Preferences
    </button>
  )
}
