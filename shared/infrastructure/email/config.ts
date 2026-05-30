/**
 * Email Configuration
 * Resend-backed. Single verified domain with role-based sender addresses.
 */

export type SenderRole = 'noreply' | 'info' | 'support'

const DOMAIN = process.env.RESEND_DOMAIN || 'applyos.io'

export const getEmailConfig = () => ({
  domain: DOMAIN,
  senders: {
    noreply: `noreply@${DOMAIN}`,
    info: `info@${DOMAIN}`,
    support: `support@${DOMAIN}`,
  } as Record<SenderRole, string>,
  from: {
    name: process.env.EMAIL_FROM_NAME || 'ApplyOS',
  },
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  appName: 'ApplyOS',
})

export const emailConfig = getEmailConfig()
