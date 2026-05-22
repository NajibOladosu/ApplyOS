import { describe, expect, it } from 'vitest'
import { parseDocument, generateAnswer } from '@/shared/infrastructure/ai'
import { retry } from '@/tests/helpers/retry'

describe('AI integration (real Gemini)', () => {
  it('parses a simple resume into structured data', async () => {
    const cv = `
      John Doe
      Email: john@example.com

      EDUCATION
      BSc Computer Science, Acme University, 2018 - 2022

      EXPERIENCE
      Senior Engineer at TechCo (2022-2025): Built web apps in TypeScript and React.

      SKILLS
      TypeScript, React, Node.js, Python
    `
    const result = await retry(() => parseDocument(cv), { retries: 3, baseMs: 2000 })
    expect(result.education).toBeDefined()
    expect(result.experience).toBeDefined()
    // Lenient: Gemini output varies. Expect SOME content extracted.
    const totalEntities =
      result.education.length + result.experience.length + result.skills.technical.length
    expect(totalEntities).toBeGreaterThan(0)
  }, 90_000)

  it('generates a non-empty answer for a behavioral question', async () => {
    const result = await retry(
      () =>
        generateAnswer('Why are you interested in this role?', {
          resume: 'Senior Engineer at TechCo. Built scalable web apps in TypeScript and React.',
          jobDescription: 'Senior frontend engineer working on customer-facing dashboards.',
          extraInstructions: 'Keep concise.',
        }),
      { retries: 3, baseMs: 2000 }
    )
    expect(result).toBeTruthy()
    expect(result.length).toBeGreaterThan(20)
  }, 90_000)
})
