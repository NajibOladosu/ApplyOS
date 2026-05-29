import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mock next/headers so that cookie-based Supabase server clients don't throw
// "cookies was called outside a request scope" when handlers are invoked
// directly in vitest's node environment (no real Next.js request pipeline).
// ---------------------------------------------------------------------------
vi.mock('next/headers', () => {
  const noop = () => {}
  const cookieStore = {
    get: () => undefined,
    getAll: () => [],
    has: () => false,
    set: noop,
    delete: noop,
  }
  return {
    cookies: () => Promise.resolve(cookieStore),
    headers: () => Promise.resolve(new Headers()),
  }
})

// Build a NextRequest representing an unauthenticated call.
// Some handlers expect specific methods; we try GET first, fall back to POST.
function makeReq(path: string, method: string = 'GET', body?: unknown): NextRequest {
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
    init.headers = { 'content-type': 'application/json' }
  }
  return new NextRequest(`http://localhost${path}`, init as ConstructorParameters<typeof NextRequest>[1])
}

// Helper: call a handler and assert response is non-500 and gated.
// `handler` and `ctx` are intentionally loose — route handler signatures vary
// (some take just NextRequest, some take a RouteContext with typed params),
// and this smoke layer just verifies non-crash behavior across all routes.
 
type AnyHandler = (req: NextRequest, ctx?: any) => Promise<Response>
async function assertGated(
  handler: any,
  path: string,
  method: string = 'GET',
  body?: unknown,
  ctx?: any
): Promise<Response> {
  const req = makeReq(path, method, body)
  const res = await (handler as AnyHandler)(req, ctx)
  expect(res.status, `${method} ${path} should not crash`).toBeLessThan(500)
  return res
}

describe('API route smoke — unauthenticated requests are non-500', () => {

  // ============ ACCOUNT ============
  it('POST /api/account/delete is auth-gated', async () => {
    const { POST } = await import('@/app/api/account/delete/route')
    const res = await assertGated(POST, '/api/account/delete', 'POST')
    expect([401, 403]).toContain(res.status)
  })

  it('POST /api/account/avatar is auth-gated', async () => {
    const { POST } = await import('@/app/api/account/avatar/route')
    const res = await assertGated(POST, '/api/account/avatar', 'POST')
    expect([401, 403]).toContain(res.status)
  })

  // ============ AI ============
  it('POST /api/ai/compatibility is auth-gated', async () => {
    const { POST } = await import('@/app/api/ai/compatibility/route')
    const res = await assertGated(POST, '/api/ai/compatibility', 'POST', {})
    expect([400, 401, 403]).toContain(res.status)
  })

  // ============ ANALYTICS ============
  it('GET /api/analytics/metrics is auth-gated', async () => {
    const { GET } = await import('@/app/api/analytics/metrics/route')
    const res = await assertGated(GET, '/api/analytics/metrics', 'GET')
    expect([401, 403]).toContain(res.status)
  })

  it('GET /api/analytics/status-flow is auth-gated', async () => {
    const { GET } = await import('@/app/api/analytics/status-flow/route')
    const res = await assertGated(GET, '/api/analytics/status-flow', 'GET')
    expect([401, 403]).toContain(res.status)
  })

  // ============ APPLICATIONS ============
  it('POST /api/applications/analyze is auth-gated', async () => {
    const { POST } = await import('@/app/api/applications/analyze/route')
    const res = await assertGated(POST, '/api/applications/analyze', 'POST', {})
    expect([400, 401, 403]).toContain(res.status)
  })

  it('POST /api/applications/import/execute is auth-gated', async () => {
    const { POST } = await import('@/app/api/applications/import/execute/route')
    const res = await assertGated(POST, '/api/applications/import/execute', 'POST', {})
    expect([400, 401, 403]).toContain(res.status)
  })

  it('GET /api/applications/import/template returns non-500', async () => {
    const { GET } = await import('@/app/api/applications/import/template/route')
    const res = await assertGated(GET, '/api/applications/import/template', 'GET')
    // This route is intentionally unauthenticated (returns CSV template)
    expect(res.status).toBeLessThan(500)
  })

  it('POST /api/applications/import/validate is auth-gated', async () => {
    const { POST } = await import('@/app/api/applications/import/validate/route')
    const res = await assertGated(POST, '/api/applications/import/validate', 'POST', {})
    expect([400, 401, 403]).toContain(res.status)
  })

  // ============ AUTH ============
  it('POST /api/auth/resend-verification accepts unauthenticated requests', async () => {
    const { POST } = await import('@/app/api/auth/resend-verification/route')
    const res = await assertGated(POST, '/api/auth/resend-verification', 'POST', { email: 'test@example.com' })
    // Email verification is public by design; expect 200/400 (validation), NOT 500
    expect(res.status).toBeLessThan(500)
  })

  it('GET /api/auth/verify-email accepts unauthenticated requests', async () => {
    const { GET } = await import('@/app/api/auth/verify-email/route')
    const res = await assertGated(GET, '/api/auth/verify-email', 'GET')
    // Public endpoint with token param; missing token yields 400/redirect, NOT 500
    expect(res.status).toBeLessThan(500)
  })

  // ============ COVER LETTER ============
  it('POST /api/cover-letter/generate is auth-gated', async () => {
    const { POST } = await import('@/app/api/cover-letter/generate/route')
    const res = await assertGated(POST, '/api/cover-letter/generate', 'POST', {})
    expect([400, 401, 403]).toContain(res.status)
  })

  // ============ CRON ============
  it('POST /api/cron/cleanup-old-notifications is auth-gated', async () => {
    const { POST } = await import('@/app/api/cron/cleanup-old-notifications/route')
    const res = await assertGated(POST, '/api/cron/cleanup-old-notifications', 'POST')
    expect([401, 403]).toContain(res.status)
  })

  it('POST /api/cron/deadline-reminders is auth-gated', async () => {
    const { POST } = await import('@/app/api/cron/deadline-reminders/route')
    const res = await assertGated(POST, '/api/cron/deadline-reminders', 'POST')
    expect([401, 403]).toContain(res.status)
  })

  it('POST /api/cron/retry-ai-tasks is auth-gated', async () => {
    const { POST } = await import('@/app/api/cron/retry-ai-tasks/route')
    const res = await assertGated(POST, '/api/cron/retry-ai-tasks', 'POST')
    expect([401, 403]).toContain(res.status)
  })

  it('POST /api/cron/weekly-digest is auth-gated', async () => {
    const { POST } = await import('@/app/api/cron/weekly-digest/route')
    const res = await assertGated(POST, '/api/cron/weekly-digest', 'POST')
    expect([401, 403]).toContain(res.status)
  })

  // ============ DOCUMENTS ============
  it('GET /api/documents/[id] is auth-gated', async () => {
    const { GET } = await import('@/app/api/documents/[id]/route')
    const ctx = { params: Promise.resolve({ id: 'fake-id' }) }
    const res = await assertGated(GET, '/api/documents/fake-id', 'GET', undefined, ctx)
    expect([401, 403, 404]).toContain(res.status)
  })

  it('POST /api/documents/[id]/report is auth-gated', async () => {
    const { POST } = await import('@/app/api/documents/[id]/report/route')
    const ctx = { params: Promise.resolve({ id: 'fake-id' }) }
    const res = await assertGated(POST, '/api/documents/fake-id/report', 'POST', {}, ctx)
    expect([400, 401, 403, 404]).toContain(res.status)
  })

  it('POST /api/documents/[id]/summary is auth-gated', async () => {
    const { POST } = await import('@/app/api/documents/[id]/summary/route')
    const ctx = { params: Promise.resolve({ id: 'fake-id' }) }
    const res = await assertGated(POST, '/api/documents/fake-id/summary', 'POST', {}, ctx)
    expect([400, 401, 403, 404]).toContain(res.status)
  })

  it('POST /api/documents/reprocess is auth-gated', async () => {
    const { POST } = await import('@/app/api/documents/reprocess/route')
    const res = await assertGated(POST, '/api/documents/reprocess', 'POST', {})
    expect([400, 401, 403]).toContain(res.status)
  })

  it('POST /api/documents/upload is auth-gated', async () => {
    const { POST } = await import('@/app/api/documents/upload/route')
    const res = await assertGated(POST, '/api/documents/upload', 'POST')
    expect([400, 401, 403]).toContain(res.status)
  })

  // ============ EDITOR ============
  it('POST /api/editor/ai-rewrite is auth-gated', async () => {
    const { POST } = await import('@/app/api/editor/ai-rewrite/route')
    const res = await assertGated(POST, '/api/editor/ai-rewrite', 'POST', {})
    expect([400, 401, 403]).toContain(res.status)
  })

  it('POST /api/editor/apply-recommendations is auth-gated', async () => {
    const { POST } = await import('@/app/api/editor/apply-recommendations/route')
    const res = await assertGated(POST, '/api/editor/apply-recommendations', 'POST', {})
    expect([400, 401, 403]).toContain(res.status)
  })

  it('POST /api/editor/detect-layout is auth-gated', async () => {
    const { POST } = await import('@/app/api/editor/detect-layout/route')
    const res = await assertGated(POST, '/api/editor/detect-layout', 'POST', {})
    expect([400, 401, 403]).toContain(res.status)
  })

  it('POST /api/editor/export-docx is auth-gated', async () => {
    const { POST } = await import('@/app/api/editor/export-docx/route')
    const res = await assertGated(POST, '/api/editor/export-docx', 'POST', {})
    expect([400, 401, 403]).toContain(res.status)
  })

  it('POST /api/editor/export-pdf is auth-gated', async () => {
    const { POST } = await import('@/app/api/editor/export-pdf/route')
    const res = await assertGated(POST, '/api/editor/export-pdf', 'POST', {})
    expect([400, 401, 403]).toContain(res.status)
  })

  it('POST /api/editor/import-docx is auth-gated', async () => {
    const { POST } = await import('@/app/api/editor/import-docx/route')
    const res = await assertGated(POST, '/api/editor/import-docx', 'POST', {})
    expect([400, 401, 403]).toContain(res.status)
  })

  it('POST /api/editor/parse-text is auth-gated', async () => {
    const { POST } = await import('@/app/api/editor/parse-text/route')
    const res = await assertGated(POST, '/api/editor/parse-text', 'POST', {})
    expect([400, 401, 403]).toContain(res.status)
  })

  // ============ EMAIL ============
  it('POST /api/email/test is auth-gated', async () => {
    const { POST } = await import('@/app/api/email/test/route')
    const res = await assertGated(POST, '/api/email/test', 'POST', {})
    expect([400, 401, 403]).toContain(res.status)
  })

  it('POST /api/email/welcome is auth-gated', async () => {
    const { POST } = await import('@/app/api/email/welcome/route')
    const res = await assertGated(POST, '/api/email/welcome', 'POST', {})
    expect([400, 401, 403]).toContain(res.status)
  })

  // ============ FEEDBACK ============
  it('POST /api/feedback is auth-gated', async () => {
    const { POST } = await import('@/app/api/feedback/route')
    const res = await assertGated(POST, '/api/feedback', 'POST', { message: 'test' })
    expect([400, 401, 403]).toContain(res.status)
  })

  // ============ INTERVIEW ============
  const interviewRoutes: Array<[string, string]> = [
    ['company-prep', 'POST'],
    ['conversation', 'POST'],
    ['generate-questions', 'POST'],
    ['grill-resume', 'POST'],
    ['live-session/complete', 'POST'],
    ['live-session/flush', 'POST'],
    ['live-session/init', 'POST'],
    ['report/generate', 'POST'],
    ['reset', 'POST'],
    ['save-answer-v2', 'POST'],
    ['submit-answer', 'POST'],
    ['voice/transcribe', 'POST'],
  ]

  for (const [sub, method] of interviewRoutes) {
    it(`${method} /api/interview/${sub} is auth-gated`, async () => {
      const mod = await import(`@/app/api/interview/${sub}/route`)
      const handler = (mod as Record<string, ((req: NextRequest, ctx?: { params: Promise<unknown> }) => Promise<Response>)>)[method]
      const res = await assertGated(handler, `/api/interview/${sub}`, method, {})
      expect([400, 401, 403]).toContain(res.status)
    })
  }

  // ============ NOTES ============
  it('GET /api/notes is auth-gated', async () => {
    const { GET } = await import('@/app/api/notes/route')
    const res = await assertGated(GET, '/api/notes', 'GET')
    expect([401, 403]).toContain(res.status)
  })

  it('POST /api/notes is auth-gated', async () => {
    const { POST } = await import('@/app/api/notes/route')
    const res = await assertGated(POST, '/api/notes', 'POST', {})
    expect([400, 401, 403]).toContain(res.status)
  })

  it('PATCH /api/notes/[id] is auth-gated', async () => {
    const { PATCH } = await import('@/app/api/notes/[id]/route')
    const ctx = { params: Promise.resolve({ id: 'fake' }) }
    const res = await assertGated(PATCH, '/api/notes/fake', 'PATCH', {}, ctx)
    expect([400, 401, 403, 404]).toContain(res.status)
  })

  it('DELETE /api/notes/[id] is auth-gated', async () => {
    const { DELETE } = await import('@/app/api/notes/[id]/route')
    const ctx = { params: Promise.resolve({ id: 'fake' }) }
    const res = await assertGated(DELETE, '/api/notes/fake', 'DELETE', undefined, ctx)
    expect([401, 403, 404]).toContain(res.status)
  })

  // ============ NOTIFICATIONS ============
  it('POST /api/notifications/send-status-email is auth-gated', async () => {
    const { POST } = await import('@/app/api/notifications/send-status-email/route')
    const res = await assertGated(POST, '/api/notifications/send-status-email', 'POST', {})
    expect([400, 401, 403]).toContain(res.status)
  })

  // ============ QUESTIONS ============
  it('POST /api/questions/extract-from-url is auth-gated', async () => {
    const { POST } = await import('@/app/api/questions/extract-from-url/route')
    const res = await assertGated(POST, '/api/questions/extract-from-url', 'POST', { url: 'https://example.com' })
    expect([400, 401, 403]).toContain(res.status)
  })

  it('POST /api/questions/regenerate is auth-gated', async () => {
    const { POST } = await import('@/app/api/questions/regenerate/route')
    const res = await assertGated(POST, '/api/questions/regenerate', 'POST', {})
    expect([400, 401, 403]).toContain(res.status)
  })
})
