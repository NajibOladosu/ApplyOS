/**
 * Email Transport
 * Resend-backed delivery for transactional, informational, and support email.
 */

import { Resend } from 'resend'
import { getEmailConfig, type SenderRole } from './config'

let client: Resend | null = null

function getResend(): Resend {
  if (client) return client
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set. Add it to .env.local')
  }
  client = new Resend(apiKey)
  return client
}

function buildFrom(role: SenderRole): string {
  const { senders, from } = getEmailConfig()
  const address = senders[role]
  return `${from.name} <${address}>`
}

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: SenderRole
  replyTo?: string
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ id: string }> {
  const resend = getResend()
  const from = buildFrom(opts.from ?? 'noreply')

  const { data, error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text ?? opts.html.replace(/<[^>]*>/g, ''),
    replyTo: opts.replyTo,
  })

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`)
  }
  if (!data?.id) {
    throw new Error('Resend send returned no id')
  }
  return { id: data.id }
}
