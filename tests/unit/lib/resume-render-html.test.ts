import { describe, expect, it } from 'vitest'
import { renderResumeHTML } from '@/lib/editor/render-html'

const contentJson = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Amina Doe' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'amina@example.com' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Experience' }] },
  ],
}

describe('ATS resume HTML rendering', () => {
  it('renders the ATS-safe single-column print style', () => {
    const html = renderResumeHTML({
      contentJson,
      templateId: 'ats',
      fileName: 'Amina Resume',
      docSettings: {
        marginTopMm: 12,
        marginRightMm: 14,
        marginBottomMm: 12,
        marginLeftMm: 14,
      },
    })

    expect(html).toContain('<title>Amina Resume</title>')
    expect(html).toContain('font-family: Arial, Helvetica, sans-serif')
    expect(html).toContain('margin: 12mm 14mm 12mm 14mm')
    expect(html).toContain('Amina Doe')
  })

  it('adds density fallback CSS only when requested', () => {
    const standard = renderResumeHTML({ contentJson, templateId: 'ats' })
    const tight = renderResumeHTML({ contentJson, templateId: 'ats', density: 'tight' })

    expect(standard).not.toContain('zoom: 0.88')
    expect(tight).toContain('.resume-page { zoom: 0.88; }')
  })
})
