export type AIWritingStylePolicy = 'enforce' | 'prompt-only' | 'preserve-source'

export const AI_WRITING_STYLE_INSTRUCTION = `WRITING STYLE REQUIREMENT:
- Never use em dashes (Unicode U+2014) in generated prose.
- Use a comma, colon, semicolon, parentheses, or a separate sentence instead.
- Use ordinary hyphens only where they are grammatically necessary, such as compound words or numeric ranges.`

/**
 * Final deterministic guard for AI-authored prose. Numeric ranges retain their
 * range meaning; prose em dashes become commas. En dashes and source text are
 * intentionally untouched.
 */
export function sanitizeAIGeneratedText(value: string): string {
  return value
    .replace(/(\d)\s*—+\s*(\d)/g, '$1-$2')
    .replace(/\s*—+\s*/g, ', ')
    .replace(/\\u2014/gi, ', ')
    .replace(/\s*(?:&mdash;|&#8212;|&#x2014;)\s*/gi, ', ')
}

export function applyAIWritingStyle(
  prompt: string,
  policy: AIWritingStylePolicy,
): string {
  return policy === 'preserve-source'
    ? prompt
    : `${prompt}\n\n${AI_WRITING_STYLE_INSTRUCTION}`
}
