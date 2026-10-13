import { describe, expect, it } from 'vitest'
import type { JSONContent } from '@tiptap/core'
import {
  applyEvidenceLedTailoring,
  assessRequirementEvidence,
  calculateEvidenceScore,
  collectEditableResumeBlocks,
} from '@/lib/resume-tailoring/engine'

const source: JSONContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Amina Doe' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'amina@example.com | +234 800 000 0000' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Experience' }] },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: 'Built REST APIs with PostgreSQL and reduced latency by 30%.' }],
          }],
        },
      ],
    },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Skills' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'TypeScript, AWS, Docker' }] },
  ],
}

describe('evidence-led resume tailoring', () => {
  it('finds auditable evidence and uses weighted coverage scoring', () => {
    const blocks = collectEditableResumeBlocks(source)
    const assessments = assessRequirementEvidence([
      { requirement: 'RESTful APIs', priority: 'required' },
      { requirement: 'AWS', priority: 'required' },
      { requirement: 'Kubernetes', priority: 'preferred' },
    ], blocks)

    expect(assessments.map((item) => item.status)).toEqual([
      'covered',
      'covered',
      'unsupported',
    ])
    expect(assessments[0].evidence[0]).toContain('REST APIs')
    expect(calculateEvidenceScore(assessments)).toBe(83)
  })

  it('applies a supported surgical rewrite without changing document structure', () => {
    const blocks = collectEditableResumeBlocks(source)
    const bullet = blocks.find((block) => block.text.startsWith('Built REST APIs'))!
    const result = applyEvidenceLedTailoring(source, {
      requirements: [
        { requirement: 'RESTful APIs', priority: 'required' },
        { requirement: 'PostgreSQL', priority: 'required' },
      ],
      edits: [{
        blockIndex: bullet.blockIndex,
        originalText: bullet.text,
        replacementText: 'Engineered RESTful APIs with PostgreSQL, reducing latency by 30%.',
        keywordsAdded: ['RESTful APIs'],
      }],
    }, 'truthful')

    expect(result.report.acceptedEdits).toHaveLength(1)
    expect(result.report.rejectedEdits).toHaveLength(0)
    expect(result.report.safety.sourceStructurePreserved).toBe(true)
    expect(JSON.stringify(result.contentJson)).toContain('reducing latency by 30%')
    expect(source.content?.[3]).toHaveProperty('type', 'bulletList')
  })

  it('rejects fabricated metrics and unsupported technology claims', () => {
    const blocks = collectEditableResumeBlocks(source)
    const bullet = blocks.find((block) => block.text.startsWith('Built REST APIs'))!
    const result = applyEvidenceLedTailoring(source, {
      requirements: [
        { requirement: 'Kubernetes', priority: 'required' },
      ],
      edits: [
        {
          blockIndex: bullet.blockIndex,
          originalText: bullet.text,
          replacementText: 'Built Kubernetes APIs and reduced latency by 55%.',
          keywordsAdded: ['Kubernetes'],
        },
      ],
    }, 'truthful')

    expect(result.report.acceptedEdits).toHaveLength(0)
    expect(result.report.rejectedEdits[0].rejectionReason).toMatch(/numeric fact|unsupported|not supported/i)
    expect(JSON.stringify(result.contentJson)).toContain('reduced latency by 30%')
  })

  it('keeps unsupported skills out of truthful mode and labels them in interview prep mode', () => {
    const plan = {
      requirements: [{ requirement: 'Kubernetes', priority: 'required' as const }],
      edits: [],
      familiaritySkills: ['Kubernetes'],
    }

    const truthful = applyEvidenceLedTailoring(source, plan, 'truthful')
    const interview = applyEvidenceLedTailoring(source, plan, 'interview-prep')

    expect(truthful.report.familiaritySkills).toEqual([])
    expect(JSON.stringify(truthful.contentJson)).not.toContain('familiarity')
    expect(interview.report.familiaritySkills).toEqual(['Kubernetes'])
    expect(JSON.stringify(interview.contentJson)).toContain('Kubernetes (familiarity)')
    expect(interview.report.safety.sourceStructurePreserved).toBe(false)
  })

  it('never lets an AI proposal change contact information or section labels', () => {
    const blocks = collectEditableResumeBlocks(source)
    const contact = blocks.find((block) => block.text.includes('@'))!
    const result = applyEvidenceLedTailoring(source, {
      requirements: [],
      edits: [{
        blockIndex: contact.blockIndex,
        originalText: contact.text,
        replacementText: 'new-address@example.com | +1 555 123 4567',
      }],
    }, 'truthful')

    expect(result.report.rejectedEdits).toHaveLength(1)
    expect(JSON.stringify(result.contentJson)).toContain('amina@example.com')
  })
})
