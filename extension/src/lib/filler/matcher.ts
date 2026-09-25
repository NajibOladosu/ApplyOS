import { CANONICAL_FIELDS, type CanonicalField, type CanonicalFieldId, type FieldKind } from "../../shared/fields"
import { fingerprint, isNegated, normalize, similarity, tokenize } from "./normalize"

/**
 * Deterministic field matching.
 *
 * Pure — takes a plain descriptor, returns a decision. No DOM, no globals, so
 * every claim in here is unit-testable and the behaviour on a live ATS page is
 * predictable rather than emergent.
 */

/** Everything we can learn about a form control without touching its value. */
export interface FieldDescriptor {
  /** Visible label text (from `<label for>`, a wrapping label, or a legend). */
  label?: string
  /** `aria-label` — usually cleaner than the DOM label. */
  ariaLabel?: string
  /** `name` attribute. */
  name?: string
  /** `id` attribute. */
  id?: string
  placeholder?: string
  /** Values of the `autocomplete` attribute. */
  autocomplete?: string
  /** Control type: `input[type]`, or textarea/select. */
  kind: FieldKind
  /** Option labels, for select/radio/checkbox. */
  options?: string[]
  /** Section heading the control sits under (e.g. "Voluntary Self-Identification"). */
  sectionHeading?: string
  /** Current value, used to avoid overwriting the user's own work. */
  value?: string
}

export interface FieldMatch {
  fieldId: CanonicalFieldId
  /** 0–1. Callers should treat anything under 0.55 as "don't touch it". */
  confidence: number
  /** Which signal produced the match — surfaced in the review table. */
  reason: "autocomplete" | "exact" | "alias" | "fuzzy" | "section" | "answer-library"
  /** The text that matched, for debugging and the UI. */
  evidence: string
  /** True when the question is phrased negatively — flip boolean answers. */
  negated: boolean
  /**
   * How much of the label the matched alias accounts for (0–1).
   * Used to break ties between two fields that both look plausible.
   */
  specificity: number
  /** Where in the label the alias matched. Earlier usually means it is the subject. */
  position: number
}

/** Minimum confidence to act on. Below this we leave the field alone. */
export const MATCH_THRESHOLD = 0.55

/** Strong matches; used to decide whether a fill is worth highlighting. */
export const HIGH_CONFIDENCE = 0.8

/**
 * Labels that look like form fields but never are.
 *
 * Multi-word entries are matched as substrings; single words must match a whole
 * token, so a question about "research" is not mistaken for a search box.
 */
const NEVER_MATCH = [
  "search",
  "search jobs",
  "search companies",
  "search by keyword",
  "search location",
  "subscribe",
  "newsletter",
  "sign in",
  "log in",
  "login",
  "sign up",
  "register",
  "password",
  "confirm password",
  "username",
  "captcha",
  "credit card",
  "card number",
  "cvv",
  "security code",
  "coupon",
  "promo code",
  "promo",
  "job alert",
  "filter",
  "sort by",
  "date posted",
  "minimum salary",
  "maximum salary",
  "radius",
  "miles",
]

function isBlocked(normalizedText: string, tokens: string[]): boolean {
  const tokenSet = new Set(tokens)
  return NEVER_MATCH.some((blocked) =>
    blocked.includes(" ") ? normalizedText.includes(blocked) : tokenSet.has(blocked)
  )
}

/**
 * Sections where every control must be treated as a free-text answer rather
 * than a profile lookup. Keeps us from filling "Describe your experience with
 * React" with the string "Yes".
 */
const OPEN_ENDED_SECTION_HINTS = [
  "additional information",
  "tell us more",
  "essay",
  "questions",
  "screening",
  "why",
]

/**
 * Weight per source attribute. A real `<label>` beats an `id`, and a
 * placeholder is closer to an example than a question, so it barely counts.
 */
const SOURCE_WEIGHTS: Array<{ key: keyof FieldDescriptor; weight: number }> = [
  { key: "label", weight: 1 },
  { key: "ariaLabel", weight: 0.95 },
  { key: "name", weight: 0.9 },
  { key: "id", weight: 0.85 },
  { key: "placeholder", weight: 0.55 },
]

/** Fields whose question can legitimately be asked in the negative. */
const NEGATABLE_FIELDS = new Set<CanonicalFieldId>([
  "workAuthorization",
  "requiresSponsorship",
  "willingToRelocate",
  "isOver18",
  "backgroundCheckConsent",
  "nonCompete",
  "previousEmployee",
  "previousApplicant",
])

/** Narrow a canonical field to the control shapes it may fill. */
function kindAllowed(field: CanonicalField, kind: FieldKind): boolean {
  if (field.kinds.includes(kind)) return true
  // Text-shaped answers belong in number inputs too ("2" years of experience),
  // and a `text` field may legitimately land on an `email`/`tel`/`url` input.
  const textish: FieldKind[] = ["text", "email", "tel", "url", "number", "date"]
  if (textish.includes(kind) && field.kinds.some((k) => textish.includes(k))) return true
  return false
}

type Score = { score: number; evidence: string; reason: FieldMatch["reason"]; specificity: number; position: number }

/**
 * Score one canonical field against one descriptor's text, returning the best
 * `(attribute, score)` pair.
 */
function scoreField(field: CanonicalField, descriptor: FieldDescriptor): Score | null {
  if (!kindAllowed(field, descriptor.kind)) return null

  // 1. The HTML autocomplete token is a standard, not a guess. It wins.
  if (descriptor.autocomplete) {
    const tokens = descriptor.autocomplete.toLowerCase().split(/\s+/)
    for (const token of field.autocomplete) {
      if (tokens.includes(token)) {
        return { score: 1, evidence: descriptor.autocomplete, reason: "autocomplete", specificity: 1, position: 0 }
      }
    }
  }

  let best: Score | null = null
  const consider = (candidate: Score) => {
    if (!best || candidate.score > best.score) best = candidate
  }

  for (const { key, weight } of SOURCE_WEIGHTS) {
    const raw = descriptor[key]
    if (typeof raw !== "string" || !raw.trim()) continue

    const normalizedText = normalize(raw)
    if (!normalizedText) continue

    const textTokens = tokenize(raw)
    // Hard exclusions — a search box is never a form question.
    if (isBlocked(normalizedText, textTokens)) continue

    for (const alias of field.aliases) {
      const normalizedAlias = normalize(alias)
      const aliasTokens = tokenize(alias)

      // 2a. Same question, same words.
      if (normalizedText === normalizedAlias) {
        consider({ score: weight * 0.95, evidence: raw, reason: "exact", specificity: 1, position: 0 })
        continue
      }

      // 2b. The alias is a phrase inside a longer label.
      //     Specificity rewards aliases that account for more of the label, and
      //     position rewards the phrase the sentence is actually about — this is
      //     what separates "require sponsorship" from a trailing "visa status".
      const position = normalizedText.indexOf(normalizedAlias)
      if (aliasTokens.length > 0 && position >= 0) {
        const specificity = aliasTokens.length / Math.max(textTokens.length, aliasTokens.length)
        consider({
          score: weight * (0.62 + 0.28 * specificity),
          evidence: raw,
          reason: "alias",
          specificity,
          position,
        })
        continue
      }

      // 3. Fuzzy — token overlap for paraphrased labels.
      const fuzzy = similarity(raw, alias)
      if (fuzzy >= 0.6) {
        consider({
          score: weight * (fuzzy * 0.8),
          evidence: raw,
          reason: "fuzzy",
          specificity: fuzzy,
          position: 0,
        })
      }
    }
  }

  return best
}

/**
 * Decide which question a control is asking.
 *
 * Returns `null` when nothing clears the threshold — an honest "I don't know"
 * is what keeps autofill from filling a phone number into a salary box.
 */
export function matchField(descriptor: FieldDescriptor): FieldMatch | null {
  const candidates: FieldMatch[] = []

  for (const field of CANONICAL_FIELDS) {
    const scored = scoreField(field, descriptor)
    if (!scored) continue
    if (scored.score < MATCH_THRESHOLD) continue

    // A negative phrasing inverts the meaning of boolean questions.
    const text = `${descriptor.label ?? ""} ${descriptor.ariaLabel ?? ""}`
    const negated = NEGATABLE_FIELDS.has(field.id) && isNegated(text)

    candidates.push({
      fieldId: field.id,
      confidence: Math.min(1, Number(scored.score.toFixed(4))),
      reason: scored.reason,
      evidence: scored.evidence,
      negated,
      specificity: scored.specificity,
      position: scored.position,
    })
  }

  if (candidates.length === 0) return null

  // Confidence first; then specificity (the match that explains more of the
  // label); then position (the phrase the sentence is about comes first); and
  // only then registry order, so the result is always deterministic.
  candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    if (b.specificity !== a.specificity) return b.specificity - a.specificity
    if (a.position !== b.position) return a.position - b.position
    const indexA = CANONICAL_FIELDS.findIndex((f) => f.id === a.fieldId)
    const indexB = CANONICAL_FIELDS.findIndex((f) => f.id === b.fieldId)
    return indexA - indexB
  })

  return candidates[0]
}

/**
 * Look up a question in the user's own saved answers.
 *
 * The answer library is what makes the second application to the same company
 * feel instant: the question was already answered once, in the user's words.
 * Exact (fingerprint) matches win; otherwise the closest fuzzy match above a
 * higher bar than the alias threshold, because a wrong saved answer is worse
 * than no answer.
 */
export function matchSavedAnswer(
  question: string,
  saved: Array<{ question: string; answer: string }>
): { answer: string; confidence: number } | null {
  if (!question.trim() || saved.length === 0) return null

  const target = fingerprint(question)
  if (!target) return null

  let best: { answer: string; confidence: number } | null = null

  for (const entry of saved) {
    if (!entry.answer.trim()) continue
    if (fingerprint(entry.question) === target) {
      return { answer: entry.answer, confidence: 1 }
    }
    const score = similarity(question, entry.question)
    if (score >= 0.82 && (!best || score > best.confidence)) {
      best = { answer: entry.answer, confidence: score }
    }
  }

  return best
}

/** True when a control already holds something a human typed. */
export function isPreFilled(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0)
}
