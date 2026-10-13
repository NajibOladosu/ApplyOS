import { describe, expect, it } from 'vitest'
import type { JSONContent } from '@tiptap/core'
import {
  normalizeGeneratedResumeBlocks,
  reconcileGeneratedResumeBlocks,
  resumeBlocksFromTextLines,
  resumeNeedsStructuralRepair,
  validateStructuralRepair,
} from '@/lib/resume-tailoring/structure'
import { blocksToTipTap } from '@/modules/applications/components/editor/blocks-to-tiptap'

const sections = [
  { type: 'h1' as const, content: 'Amina Doe' },
  { type: 'paragraph' as const, content: 'amina@example.com | +234 800 000 0000 | Lagos, Nigeria' },
  { type: 'h2' as const, content: 'SUMMARY' },
  { type: 'paragraph' as const, content: 'Product designer focused on accessible financial tools and clear customer experiences.' },
  { type: 'h2' as const, content: 'EXPERIENCE' },
  { type: 'h3' as const, content: 'Senior Product Designer | Example Labs | 2022–2025' },
  { type: 'bullet' as const, content: 'Led research and interface design for account opening across web and mobile products.' },
  { type: 'bullet' as const, content: 'Reduced application abandonment by 30% through usability testing and iterative prototyping.' },
  { type: 'bullet' as const, content: 'Partnered with engineering and compliance to ship an accessible component library.' },
  { type: 'h2' as const, content: 'PROJECTS' },
  { type: 'h3' as const, content: 'Merchant Insights Dashboard | 2023' },
  { type: 'bullet' as const, content: 'Designed reporting workflows used by operations teams to investigate payment issues.' },
  { type: 'h2' as const, content: 'SKILLS' },
  { type: 'paragraph' as const, content: 'Product strategy, user research, Figma, prototyping, design systems, accessibility' },
  { type: 'h2' as const, content: 'EDUCATION' },
  { type: 'paragraph' as const, content: 'BSc Computer Science | University of Lagos | 2021' },
]

const generatedBlocks = sections.map((block, index) => ({
  id: `block-${index}`,
  type: block.type,
  content: block.content,
  styles: {},
}))
const repaired = blocksToTipTap(generatedBlocks)

const flattenedText = sections.map((block) => block.content).join('').replace(/\s+/g, '')
const malformed: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: flattenedText }] }],
}

describe('resume structural repair safety', () => {
  it('detects a long flattened import but not the reconstructed hierarchy', () => {
    expect(resumeNeedsStructuralRepair(malformed)).toBe(true)
    expect(resumeNeedsStructuralRepair(repaired)).toBe(false)
  })

  it('accepts whitespace and hierarchy restoration that preserves all evidence', () => {
    expect(validateStructuralRepair(malformed, repaired)).toEqual({ valid: true })
  })

  it('uses model output only for layout and restores exact source evidence', () => {
    const modelProposal = generatedBlocks.map((block) => ({
      ...block,
      content: block.content
        .replace('Figma', 'Sketch')
        .replace('Reduced application abandonment', 'Lowered application drop-off'),
    }))
    const reconciled = reconcileGeneratedResumeBlocks(malformed, modelProposal)

    expect(reconciled).not.toBeNull()
    const reconstructedText = reconciled?.map((block) => block.content).join('\n') ?? ''
    expect(reconstructedText).toContain('Figma')
    expect(reconstructedText).not.toContain('Sketch')
    expect(reconstructedText).toContain('Reduced application abandonment')
    expect(validateStructuralRepair(malformed, blocksToTipTap(reconciled ?? []))).toEqual({ valid: true })
  })

  it('rejects a layout proposal that does not align with the source', () => {
    const unrelated = generatedBlocks.map((block, index) => ({
      ...block,
      content: `Unrelated fabricated content ${index}`,
    }))

    expect(reconcileGeneratedResumeBlocks(malformed, unrelated)).toBeNull()
  })

  it('rejects a reconstruction that changes a protected numeric fact', () => {
    const changed = JSON.parse(JSON.stringify(repaired)) as JSONContent
    const serialized = JSON.stringify(changed).replace('30%', '3.0%')

    expect(validateStructuralRepair(malformed, JSON.parse(serialized) as JSONContent)).toEqual({
      valid: false,
      reason: 'The reconstructed resume added, changed, or removed a protected factual value.',
    })
  })

  it('rejects fabricated or substituted source wording', () => {
    const changed = JSON.parse(JSON.stringify(repaired)) as JSONContent
    const serialized = JSON.stringify(changed).replace('Figma', 'Sketch')
    const validation = validateStructuralRepair(malformed, JSON.parse(serialized) as JSONContent)

    expect(validation.valid).toBe(false)
    if (!validation.valid) expect(validation.reason).toMatch(/changed the source wording/i)
  })

  it('preserves extracted line hierarchy without AI', () => {
    const blocks = resumeBlocksFromTextLines([
      'Amina Doe',
      'amina@example.com | Lagos',
      'EXPERIENCE',
      '• Built accessible payment tools',
    ].join('\n'))

    expect(blocks.map((block) => [block.type, block.content])).toEqual([
      ['h1', 'Amina Doe'],
      ['paragraph', 'amina@example.com | Lagos'],
      ['h2', 'EXPERIENCE'],
      ['bullet', 'Built accessible payment tools'],
    ])
  })

  it('normalizes only supported, non-empty generated blocks', () => {
    expect(normalizeGeneratedResumeBlocks([
      { type: 'h2', content: ' EXPERIENCE ', styles: { bold: true, align: 'left' } },
      { type: 'table', content: 'ignored' },
      { type: 'bullet', content: '' },
    ])).toEqual([{
      id: 'repaired-1',
      type: 'h2',
      content: 'EXPERIENCE',
      styles: { bold: true, align: 'left' },
    }])
  })
})
