import { describe, expect, it } from 'vitest'
import { renderResumeHTML } from '@/lib/editor/render-html'

const doc = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Jane Example' }] }],
} as const

describe('renderResumeHTML (PDF export input)', () => {
  it('does not reference third-party font hosts or CSS @import', () => {
    const html = renderResumeHTML({ contentJson: doc as never, templateId: 'modern' })
    expect(html).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/)
    expect(html).not.toMatch(/@import/)
  })

  it('keeps the A4 @page rule and the document content', () => {
    const html = renderResumeHTML({ contentJson: doc as never, templateId: 'modern' })
    expect(html).toContain('@page {')
    expect(html).toContain('size: A4;')
    expect(html).toContain('Jane Example')
  })
})
