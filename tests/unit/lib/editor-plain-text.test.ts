import { describe, expect, it } from 'vitest'
import { legacyBlocksToPlainText, tipTapToPlainText } from '@/lib/editor/plain-text'

describe('resume editor plain-text conversion', () => {
  it('preserves readable TipTap block boundaries', () => {
    const content = {
      type: 'doc',
      content: [
        { type: 'heading', content: [{ type: 'text', text: 'Ada Okafor' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Senior Engineer' }] },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Built reliable systems' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mentored five engineers' }] }] },
          ],
        },
      ],
    }

    expect(tipTapToPlainText(content)).toBe(
      'Ada Okafor\nSenior Engineer\nBuilt reliable systems\nMentored five engineers',
    )
  })

  it('returns an empty string for invalid TipTap data', () => {
    expect(tipTapToPlainText(null)).toBe('')
    expect(tipTapToPlainText('not json')).toBe('')
  })

  it('converts legacy editor blocks', () => {
    expect(legacyBlocksToPlainText([
      { content: 'Experience' },
      { content: 'Built ApplyOS' },
      { ignored: true },
    ])).toBe('Experience\nBuilt ApplyOS')
  })
})
