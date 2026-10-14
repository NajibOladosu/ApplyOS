import { describe, expect, it } from 'vitest'
import {
  AI_WRITING_STYLE_INSTRUCTION,
  applyAIWritingStyle,
  sanitizeAIGeneratedText,
} from '@/shared/infrastructure/ai-style'

describe('AI writing style guard', () => {
  it('removes prose em dashes while preserving readable punctuation', () => {
    expect(sanitizeAIGeneratedText('Clear impact — without inflated claims.'))
      .toBe('Clear impact, without inflated claims.')
  })

  it('uses ordinary hyphens for numeric ranges and leaves en dashes untouched', () => {
    expect(sanitizeAIGeneratedText('2022—2025 and source range 2020–2021'))
      .toBe('2022-2025 and source range 2020–2021')
  })

  it('removes escaped em dashes from JSON responses', () => {
    const response = '{"summary":"Focused\\u2014and truthful"}'
    expect(sanitizeAIGeneratedText(response)).toBe('{"summary":"Focused, and truthful"}')
  })

  it('adds the shared rule to generated prompts but not source-preservation prompts', () => {
    expect(applyAIWritingStyle('Write an answer.', 'enforce'))
      .toContain(AI_WRITING_STYLE_INSTRUCTION)
    expect(applyAIWritingStyle('Return mixed JSON.', 'prompt-only'))
      .toContain(AI_WRITING_STYLE_INSTRUCTION)
    expect(applyAIWritingStyle('Extract this verbatim.', 'preserve-source'))
      .toBe('Extract this verbatim.')
  })
})
