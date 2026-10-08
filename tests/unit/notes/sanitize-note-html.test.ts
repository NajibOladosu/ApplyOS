import { describe, expect, it } from 'vitest'
import { sanitizeNoteHtml } from '@/modules/notes/lib/sanitize-note-html'

describe('sanitizeNoteHtml', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeNoteHtml(null)).toBe('')
    expect(sanitizeNoteHtml(undefined)).toBe('')
    expect(sanitizeNoteHtml('')).toBe('')
  })

  it('removes script elements', () => {
    const out = sanitizeNoteHtml('<p>hi</p><script>alert(1)</script>')
    expect(out).not.toMatch(/<script/i)
    expect(out).toContain('<p>hi</p>')
  })

  it('removes event-handler attributes on allowed and disallowed tags', () => {
    const out = sanitizeNoteHtml('<img src=x onerror="alert(1)"><strong onclick="alert(2)">b</strong>')
    expect(out).not.toMatch(/onerror|onclick|<img/i)
    expect(out).toContain('<strong>b</strong>')
  })

  it('blocks javascript: and data: URLs in links', () => {
    const js = sanitizeNoteHtml('<a href="javascript:alert(1)">x</a>')
    expect(js).not.toMatch(/javascript:/i)
    const data = sanitizeNoteHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>')
    expect(data).not.toMatch(/data:/i)
  })

  it('keeps http(s) and mailto links', () => {
    expect(sanitizeNoteHtml('<a href="https://example.com/a">x</a>')).toContain('href="https://example.com/a"')
    expect(sanitizeNoteHtml('<a href="mailto:a@example.com">x</a>')).toContain('href="mailto:a@example.com"')
  })

  it('strips inline styles and unknown elements but keeps text', () => {
    const out = sanitizeNoteHtml('<p style="background:url(x)">Hello <iframe src="https://evil.test"></iframe></p>')
    expect(out).not.toMatch(/style=|iframe/i)
    expect(out).toContain('Hello')
  })

  it('keeps basic note formatting produced by the editor', () => {
    const html = '<h2>Plan</h2><ul><li><em>one</em></li></ul><blockquote>q</blockquote>'
    expect(sanitizeNoteHtml(html)).toBe(html)
  })
})
