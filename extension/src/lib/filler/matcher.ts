import { CANONICAL_FIELDS, type CanonicalField, type CanonicalFieldId, type FieldKind } from "../../shared/fields"
import { fingerprint, isNegated, normalize, similarity, tokenize, tokenRunIndex } from "./normalize"

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
  /** Token offset of the match. Earlier usually means it is the subject. */
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

type Score = {
  score: number
  evidence: string
  reason: FieldMatch["reason"]
  specificity: number
  position: number
  kindCompatible: boolean
}

/**
 * Extra confidence an incompatible interpretation must have before we refuse to
 * fill anything at all. See `matchField` for why this exists.
 */
const REFUSAL_MARGIN = 0.05

/**
 * Score one canonical field against one descriptor's text, returning the best
 * `(attribute, score)` pair.
 *
 * Note this does *not* filter on control kind — compatibility is reported so the
 * caller can detect when the best reading of a label is a question this control
 * cannot answer.
 */
function scoreField(field: CanonicalField, descriptor: FieldDescriptor): Score | null {
  const kindCompatible = kindAllowed(field, descriptor.kind)

  // 1. The HTML autocomplete token is a standard, not a guess. It wins.
  if (descriptor.autocomplete) {
    const tokens = descriptor.autocomplete.toLowerCase().split(/\s+/)
    for (const token of field.autocomplete) {
      if (tokens.includes(token)) {
        return {
          score: 1,
          evidence: descriptor.autocomplete,
          reason: "autocomplete",
          specificity: 1,
          position: 0,
          kindCompatible,
        }
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
        consider({ score: weight * 0.95, evidence: raw, reason: "exact", specificity: 1, position: 0, kindCompatible })
        continue
      }

      // 2b. The alias is a run of whole words inside a longer label.
      //     Specificity rewards aliases that account for more of the label, and
      //     token position rewards the phrase the sentence is actually about —
      //     this is what separates "require sponsorship" from a trailing
      //     "visa status" alias belonging to a different question.
      const forward = tokenRunIndex(textTokens, aliasTokens)
      if (aliasTokens.length > 0 && forward >= 0) {
        const specificity = aliasTokens.length / Math.max(textTokens.length, aliasTokens.length)
        consider({
          score: weight * (0.62 + 0.28 * specificity),
          evidence: raw,
          reason: "alias",
          specificity,
          position: forward,
          kindCompatible,
        })
        continue
      }

      // 2c. The label is shorter than the alias ("Email" vs "contact email").
      if (textTokens.length > 0 && tokenRunIndex(aliasTokens, textTokens) >= 0) {
        const specificity = textTokens.length / Math.max(textTokens.length, aliasTokens.length)
        consider({
          score: weight * (0.62 + 0.28 * specificity),
          evidence: raw,
          reason: "alias",
          specificity,
          position: 0,
          kindCompatible,
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
          kindCompatible,
        })
      }
    }
  }

  return best
}

/**
 * All plausible interpretations of a control, best first.
 *
 * Exported because the same ranking drives two things: the decision below, and
 * the "why did it fill that?" explanation in the review table.
 */
interface Scored {
  match: FieldMatch
  score: number
  kindCompatible: boolean
}

/** Every field that clears the threshold, best first, ignoring control kind. */
function scoreAll(descriptor: FieldDescriptor): Scored[] {
  const scored: Scored[] = []

  for (const field of CANONICAL_FIELDS) {
    const result = scoreField(field, descriptor)
    if (!result || result.score < MATCH_THRESHOLD) continue

    // A negative phrasing inverts the meaning of boolean questions.
    const text = `${descriptor.label ?? ""} ${descriptor.ariaLabel ?? ""}`
    const negated = NEGATABLE_FIELDS.has(field.id) && isNegated(text)

    scored.push({
      score: result.score,
      kindCompatible: result.kindCompatible,
      match: {
        fieldId: field.id,
        confidence: Math.min(1, Number(result.score.toFixed(4))),
        reason: result.reason,
        evidence: result.evidence,
        negated,
        specificity: result.specificity,
        position: result.position,
      },
    })
  }

  // Confidence first; then specificity (the match that explains more of the
  // label); then position (the phrase the sentence is about comes first); and
  // only then registry order, so the result is always deterministic.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.match.specificity !== a.match.specificity) return b.match.specificity - a.match.specificity
    if (a.match.position !== b.match.position) return a.match.position - b.match.position
    const indexA = CANONICAL_FIELDS.findIndex((f) => f.id === a.match.fieldId)
    const indexB = CANONICAL_FIELDS.findIndex((f) => f.id === b.match.fieldId)
    return indexA - indexB
  })

  return scored
}

/**
 * Interpretations that this control can actually accept, best first.
 *
 * Used by the review table to explain a fill.
 */
export function rankFieldCandidates(descriptor: FieldDescriptor): FieldMatch[] {
  return scoreAll(descriptor)
    .filter((entry) => entry.kindCompatible)
    .map((entry) => entry.match)
}

export function matchField(descriptor: FieldDescriptor): FieldMatch | null {
  const scored = scoreAll(descriptor)
  if (scored.length === 0) return null

  const bestOverall = scored[0]
  const bestCompatible = scored.find((entry) => entry.kindCompatible)

  // Nothing this control can hold beats the threshold — leave it alone.
  if (!bestCompatible) return null

  // The label reads more like a question this control cannot answer. A yes/no
  // question rendered as a text box, for instance: filling our visa-status
  // string into "Will you require sponsorship?" would be worse than leaving it
  // blank, so refuse and let the user (or Copilot) answer it.
  if (!bestOverall.kindCompatible && bestOverall.score > bestCompatible.score + REFUSAL_MARGIN) {
    return null
  }

  return bestCompatible.match
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
