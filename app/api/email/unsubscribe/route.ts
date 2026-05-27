import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  verifyUnsubscribeToken,
  type UnsubscribeCategory,
} from '@/shared/infrastructure/email/unsubscribe-token'

export const dynamic = 'force-dynamic'

const FLAGS_BY_CATEGORY: Record<UnsubscribeCategory, string[]> = {
  all: ['email_notifications', 'deadline_reminders', 'status_updates', 'weekly_digest'],
  deadline_reminders: ['deadline_reminders'],
  status_updates: ['status_updates'],
  weekly_digest: ['weekly_digest'],
}

const LABEL_BY_CATEGORY: Record<UnsubscribeCategory, string> = {
  all: 'all emails',
  deadline_reminders: 'deadline reminders',
  status_updates: 'status updates',
  weekly_digest: 'the weekly digest',
}

function htmlPage(title: string, bodyHtml: string, status = 200): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title} · ApplyOS</title>
    <style>
      :root { color-scheme: dark; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #0a0a0a;
        color: #e5e5e5;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
        padding: 24px;
      }
      .card {
        max-width: 480px;
        width: 100%;
        background: #151515;
        border: 1px solid #2a2a2a;
        border-radius: 12px;
        padding: 32px;
        text-align: center;
      }
      h1 { color: #18BB70; margin: 0 0 16px; font-size: 22px; }
      p { color: #a0a0a0; line-height: 1.6; margin: 0 0 12px; }
      a { color: #18BB70; text-decoration: none; }
      a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${title}</h1>
      ${bodyHtml}
    </div>
  </body>
</html>`
  return new NextResponse(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return htmlPage('Invalid Link', '<p>Missing unsubscribe token.</p>', 400)
  }

  const payload = verifyUnsubscribeToken(token)
  if (!payload) {
    return htmlPage(
      'Invalid Link',
      '<p>This unsubscribe link is invalid or has expired.</p>',
      400,
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return htmlPage(
      'Service Unavailable',
      '<p>The unsubscribe service is temporarily unavailable. Please contact support.</p>',
      503,
    )
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userResp, error: getErr } = await admin.auth.admin.getUserById(payload.userId)
  if (getErr || !userResp?.user) {
    return htmlPage(
      'Account Not Found',
      '<p>The associated account no longer exists.</p>',
      404,
    )
  }

  const currentMeta = (userResp.user.user_metadata as Record<string, unknown>) || {}
  const flagsToDisable = FLAGS_BY_CATEGORY[payload.category]
  const updatedMeta = { ...currentMeta }
  for (const flag of flagsToDisable) {
    updatedMeta[flag] = false
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(payload.userId, {
    user_metadata: updatedMeta,
  })
  if (updErr) {
    return htmlPage(
      'Update Failed',
      '<p>We could not update your preferences right now. Please try again later.</p>',
      500,
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '/'
  return htmlPage(
    'Unsubscribed',
    `<p>You will no longer receive <strong>${LABEL_BY_CATEGORY[payload.category]}</strong> from ApplyOS.</p>
     <p style="margin-top: 24px"><a href="${appUrl}/settings">Manage email preferences</a></p>`,
  )
}
