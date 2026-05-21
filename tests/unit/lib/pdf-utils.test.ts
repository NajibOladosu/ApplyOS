import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { extractTextFromPDF } from '@/modules/documents/lib/pdf-utils'

const FIXTURES = path.join(process.cwd(), 'tests', 'fixtures', 'pdfs')

describe('extractTextFromPDF', () => {
  it('extracts text from a real PDF', async () => {
    const buf = fs.readFileSync(path.join(FIXTURES, 'sample-cv.pdf'))
    const text = await extractTextFromPDF(buf)
    expect(text).toMatch(/Hello from sample CV/)
    expect(text).toMatch(/Skills/)
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
