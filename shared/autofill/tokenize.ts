/**
 * Tokenizer and phrase matcher for the heuristic resolver.
 *
 * Spec: extension/AUTOFILL_ARCHITECTURE.md section 5.
 * Pure. No DOM, no chrome.*, relative imports only.
 *
 * Everything the resolver compares — labels, name/id attributes, ARIA text,
 * option text — is employer-authored and arrives in wildly different casing and
 * separator conventions: `job_application[first_name]`, `firstName`,
 * `first-name`, `First Name *`, `legalNameSection_firstName`. All of it has to
 * reduce to the same token sequence.
 */

/**
 * Collapse to comparable text: lowercase, strip accents, drop punctuation,
 * squash whitespace. Used for option matching and for label display keys.
 */
export function normalizeText(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .normalize('NFKD')
    // Strip combining marks so "José" and "Jose" compare equal.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Required-field markers and separators are noise, not content.
    .replace(/[*∗]/g, ' ')
    .replace(/[_\-./\\[\]()<>{}:;,+&|"'`~!?@#$%^=]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Split an identifier or label into lowercase word tokens.
 *
 * Handles camelCase, PascalCase, snake_case, kebab-case, dotted paths and
 * bracketed PHP/Rails-style names in one pass:
 *   'job_application[first_name]'        -> ['job','application','first','name']
 *   'legalNameSection_firstName'         -> ['legal','name','section','first','name']
 *   'urls[LinkedIn]'                     -> ['urls','linked','in']
 *   'Are you 18+ years of age?'          -> ['are','you','18','years','of','age']
 *
 * Note 'LinkedIn' -> ['linked','in']: acronym/word-boundary splitting cannot
 * know that LinkedIn is one word. The taxonomy compensates by listing the
 * phrase ['linked','in'] rather than ['linkedin'].
 */
export function tokenize(input: string | null | undefined): string[] {
  if (!input) return []
  const spaced = input
    // camelCase / PascalCase boundary
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    // ACRONYMWord boundary: 'URLValue' -> 'URL Value'
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    // letter/digit boundaries: 'address1' -> 'address 1', '18plus' -> '18 plus'
    .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([a-zA-Z])/g, '$1 $2')

  return normalizeText(spaced)
    .split(' ')
    .filter((t) => t.length > 0)
}

/** A phrase is an ordered token sequence, e.g. ['first','name']. */
export type Phrase = readonly string[]

/**
 * Score one phrase against a token list.
 *
 *   1.00  contiguous, in order            ['first','name'] in ['first','name']
 *   0.80  in order but separated          ['first','name'] in ['first','legal','name']
 *   0.55  all present, any order          ['name','first'] in ['first','name']
 *   0.00  at least one token missing
 *
 * Ordered-and-contiguous scores highest because ATS labels are written in
 * natural order, and because the difference between "first name" and
 * "name of first employer" is exactly word adjacency.
 *
 * A single-token phrase that matches scores 1.0 — which is why the taxonomy
 * must not rely on bare short tokens for anything consequential (see the
 * sensitivity classifier's word-boundary requirement).
 */
export function phraseScore(phrase: Phrase, tokens: readonly string[]): number {
  if (phrase.length === 0 || tokens.length === 0) return 0

  // Contiguous, in order.
  const limit = tokens.length - phrase.length
  for (let i = 0; i <= limit; i++) {
    let hit = true
    for (let j = 0; j < phrase.length; j++) {
      if (tokens[i + j] !== phrase[j]) {
        hit = false
        break
      }
    }
    if (hit) return 1
  }

  // In order, gaps allowed.
  let cursor = 0
  let matched = 0
  for (const want of phrase) {
    const at = tokens.indexOf(want, cursor)
    if (at === -1) break
    cursor = at + 1
    matched++
  }
  if (matched === phrase.length) return 0.8

  // Present in any order.
  const present = phrase.every((want) => tokens.includes(want))
  return present ? 0.55 : 0
}

/**
 * Whether every token of `phrase` appears in `tokens` as a contiguous run.
 * Used by the sensitivity classifier, which must not do substring matching:
 * 'age' inside 'Hiring manager' / 'Average GPA' / 'Page 2 of 3' is why.
 */
export function containsPhrase(phrase: Phrase, tokens: readonly string[]): boolean {
  return phraseScore(phrase, tokens) === 1
}

/** Fraction of `wanted` tokens present in `candidate`. Used for option matching. */
export function tokenOverlap(wanted: readonly string[], candidate: readonly string[]): number {
  if (wanted.length === 0) return 0
  const set = new Set(candidate)
  let hits = 0
  for (const t of wanted) if (set.has(t)) hits++
  return hits / wanted.length
}
