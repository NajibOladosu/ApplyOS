import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  extractTextFromPDF,
  reconstructTextFromPdfPages,
} from '@/modules/documents/lib/pdf-utils'

const FIXTURES = path.join(process.cwd(), 'tests', 'fixtures', 'pdfs')

describe('reconstructTextFromPdfPages', () => {
  it('uses PDF coordinates to restore words, lines, and section gaps', () => {
    const text = reconstructTextFromPdfPages([{
      Texts: [
        { x: 1, y: 1, w: 26.4, sw: 0.3, R: [{ T: 'Najib' }] },
        { x: 2.35, y: 1, w: 36, sw: 0.3, R: [{ T: 'Oladosu' }] },
        { x: 1, y: 2, w: 81.6, R: [{ T: 'najib%40example.com' }] },
        { x: 4.7, y: 2, w: 2.4, R: [{ T: '%7C' }] },
        { x: 5.1, y: 2, w: 24, R: [{ T: 'Lagos' }] },
        { x: 1, y: 4, w: 57.6, R: [{ T: 'EXPERIENCE' }] },
        { x: 1, y: 5, w: 33.6, R: [{ T: 'Senior' }] },
        { x: 2.65, y: 5, w: 38.4, R: [{ T: 'Engineer' }] },
      ],
    }])

    expect(text).toBe([
      'Najib Oladosu',
      'najib@example.com | Lagos',
      '',
      'EXPERIENCE',
      'Senior Engineer',
    ].join('\n'))
  })

  it('keeps adjacent fragments together and separates pages', () => {
    const text = reconstructTextFromPdfPages([
      { Texts: [
        { x: 1, y: 1, w: 24, R: [{ T: 'Linked' }] },
        { x: 2, y: 1, w: 9.6, R: [{ T: 'In' }] },
      ] },
      { Texts: [{ x: 1, y: 1, w: 1, R: [{ T: 'Skills' }] }] },
    ])

    expect(text).toBe('LinkedIn\n\nSkills')
  })

  it('uses readable spacing when coordinates are absent', () => {
    expect(reconstructTextFromPdfPages([{
      Texts: [
        { R: [{ T: 'Product' }] },
        { R: [{ T: 'Designer' }] },
      ],
    }])).toBe('Product Designer')
  })
})

describe('extractTextFromPDF', () => {
  it('extracts text from a real PDF', async () => {
    const buf = fs.readFileSync(path.join(FIXTURES, 'sample-cv.pdf'))
    const text = await extractTextFromPDF(buf)
    expect(text).toMatch(/Hello from sample CV/)
    expect(text).toContain('John Doe\njohn.doe@example.com')
    expect(text).toContain('\n\nSkills\nTypeScript JavaScript Python SQL')
  })

  it('returns empty string for PDF with no text', async () => {
    const buf = fs.readFileSync(path.join(FIXTURES, 'empty.pdf'))
    const text = await extractTextFromPDF(buf)
    expect(text.trim()).toBe('')
  })

  it('returns empty string for garbage buffer (graceful fail)', async () => {
    const buf = Buffer.from('not a pdf at all')
    const text = await extractTextFromPDF(buf)
    expect(text).toBe('')
  })
})
