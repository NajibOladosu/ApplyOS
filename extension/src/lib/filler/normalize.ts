/**
 * Text normalisation for field matching.
 *
 * Pure functions, no DOM. The whole point is that `"First Name *"`,
 * `"firstName"`, `"first_name"` and `"Please enter your first name"` all
 * collapse to something a single dictionary can match against.
 */

/**
 * Words that carry no signal about *which* question is being asked. Removed
 * before scoring so "Please enter your email address" compares as
 * "email address" rather than being diluted by politeness.
 */
const STOPWORDS = new Set([
  "please",
  "enter",
  "your",
  "you",
  "the",
  "a",
  "an",
  "of",
  "for",
  "if",
  "applicable",
  "required",
  "optional",
  "and",
  "or",
  "to",
  "in",
  "is",
  "are",
  "do",
  "does",
  "did",
  "we",
  "our",
  "us",
  "be",
  "this",
  "that",
  "it",
  "with",
  "on",
  "at",
  "by",
  "from",
  "as",
  "have",
  "has",
  "will",
  "would",
  "can",
  "could",
  "should",
  "my",
  "me",
  "i",
  "am",
  "was",
  "were",
  "there",
  "here",
  "any",
  "all",
  "so",
  "not",
])

/**
 * Crude but consistent stemming. Applied identically to the form's text and to
 * our alias dictionary, so consistency matters more than linguistic accuracy.
 * "skills" → "skill", "address" stays "address" (double-s guard).
 */
export function stem(token: string): string {
  if (token.length <= 4) return token
  if (token.endsWith("ies")) return `${token.slice(0, -3)}y`
  if (token.endsWith("ss") || token.endsWith("us") || token.endsWith("is")) return token
  if (token.endsWith("s")) return token.slice(0, -1)
  return token
}

/**
 * Lowercase, split camelCase, replace punctuation with spaces, collapse.
 * Splitting camelCase is what makes `name="firstName"` matchable at all.
 */
export function normalize(value: string): string {
  if (!value) return ""
  return value
    // camelCase / PascalCase → spaced
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    // keep letters, digits, and the accented range to avoid mangling names
    .replace(/[^a-z0-9\u00c0-\u024f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Normalised, stopword-free, stemmed tokens. */
export function tokenize(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 0 && !STOPWORDS.has(token))
    .map(stem)
}

/**
 * True when the text asserts a negative — "I am NOT authorized to work".
 *
 * Used to flip the polarity of boolean answers: a form phrasing the question as
 * a negative statement needs the opposite of the answer our profile stores.
 */
export function isNegated(value: string): boolean {
  const normalized = normalize(value)
  return /\b(not|no|never|without|dont|doesnt|cannot|unable|neither|nor)\b/.test(normalized)
}

/** Jaccard index over token sets: |A ∩ B| / |A ∪ B|. */
export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setA = new Set(a)
  const setB = new Set(b)
  let intersection = 0
  for (const token of setA) if (setB.has(token)) intersection += 1
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * Fraction of `needle` tokens present in `haystack` tokens — 1.0 means every
 * token in the phrase we care about appears in the target.
 *
 * Asymmetric on purpose: "email" should score highly against
 * "email address for correspondence", while the reverse containment is weaker
 * evidence.
 */
export function coverage(needle: string[], haystack: string[]): number {
  if (needle.length === 0 || haystack.length === 0) return 0
  const haystackSet = new Set(haystack)
  let hits = 0
  for (const token of needle) if (haystackSet.has(token)) hits += 1
  return hits / needle.length
}

/**
 * Blended similarity in 0–1.
 *
 * `coverage` dominates because job forms pad their labels with extra words; the
 * Jaccard term breaks ties between candidates that cover the same alias.
 */
export function similarity(a: string, b: string): number {
  const tokensA = tokenize(a)
  const tokensB = tokenize(b)
  if (tokensA.length === 0 || tokensB.length === 0) return 0

  const coverageScore = Math.max(coverage(tokensA, tokensB), coverage(tokensB, tokensA))
  const jaccardScore = jaccard(tokensA, tokensB)

  return coverageScore * 0.75 + jaccardScore * 0.25
}

/** Collapse a value for equality comparison: letters and digits only. */
export function fingerprint(value: string): string {
  return normalize(value).replace(/\s+/g, "")
}
