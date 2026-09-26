import type { CanonicalFieldId, FieldKind } from "../../shared/fields"
import { FIELD_BY_ID, FILE_FIELD_IDS, SENSITIVE_FIELD_IDS } from "../../shared/fields"
import { resolveAnswer, type AutofillProfile, type ResolvedAnswer, type ScreeningAnswer } from "../../shared/profile"
import type { RawControl } from "./dom"
import { matchField, matchSavedAnswer, isPreFilled, type FieldDescriptor, type FieldMatch } from "./matcher"
import { fingerprint, isNegated, normalize, tokenRunIndex, tokenize } from "./normalize"

/**
 * Planning: turn a page of controls into a list of decisions.
 *
 * Kept separate from execution so the same plan can be shown to the user as a
 * review table, applied to the DOM, and unit-tested without a browser.
 */

export type PlanStatus =
  | "ready" // we know the question and have the answer
  | "file" // a document field — reported, never scripted
  | "missing-value" // we know the question, the profile has no answer
  | "sensitive" // demographic question, opt-in only
  | "unknown" // we could not tell what is being asked
  | "already-filled" // a human already answered it
  | "low-confidence" // a guess we are not willing to make

export interface FillPlanItem {
  /** Index into the `RawControl[]` this plan was built from. */
  index: number
  status: PlanStatus
  label: string
  kind: FieldKind
  fieldId?: CanonicalFieldId
  /** The exact text that will be written, or the option that will be chosen. */
  value?: string
  /** 0–1 confidence in the field identification. */
  confidence: number
  /** Why we believe this — shown in the review table. */
  reason: string
  negated?: boolean
  note?: string
}

export interface FillPlanSummary {
  total: number
  ready: number
  files: number
  missingValue: number
  sensitive: number
  unknown: number
  alreadyFilled: number
  lowConfidence: number
}

export interface FillPlan {
  items: FillPlanItem[]
  summary: FillPlanSummary
}

export interface PlanOptions {
  /** Include voluntary demographic questions. Off by default. */
  includeSensitive?: boolean
  /** Overwrite values the user (or the ATS) already put there. Off by default. */
  overwrite?: boolean
  /** The user's saved answers, consulted when the profile has nothing. */
  savedAnswers?: ScreeningAnswer[]
  /** Local overrides already merged into the profile by the caller. */
  profile: AutofillProfile
}

/** Wrap a resolved answer for display before it meets a control. */
function displayValue(answer: ResolvedAnswer): string {
  return answer.type === "boolean" ? (answer.value ? "Yes" : "No") : answer.value
}

/**
 * Build a plan for a set of controls.
 *
 * Precedence for every control: the user's own saved answer for that exact
 * question, then the structured profile. Saved answers come first because they
 * are the user's literal words, often for questions the profile cannot model
 * ("Describe a time you disagreed with a manager").
 */
export function buildFillPlan(controls: RawControl[], options: PlanOptions): FillPlan {
  const { profile, includeSensitive = false, overwrite = false, savedAnswers = [] } = options
  const library = [...savedAnswers, ...profile.screening]

  const items: FillPlanItem[] = controls.map((control, index) => {
    const descriptor = control.descriptor
    const label = descriptor.label || descriptor.ariaLabel || descriptor.name || descriptor.id || "(unlabelled field)"

    // Never touch something a human already filled in.
    if (!overwrite && control.kind !== "radio" && control.kind !== "checkbox" && isPreFilled(descriptor.value)) {
      return {
        index,
        status: "already-filled" as const,
        label,
        kind: control.kind,
        confidence: 1,
        reason: "Already contains a value",
      }
    }

    const match = matchField(descriptor)

    if (!match) {
      return {
        index,
        status: "unknown" as const,
        label,
        kind: control.kind,
        confidence: 0,
        reason: "Not a question ApplyOS recognises",
      }
    }

    return planForMatch(control, index, label, match, profile, library, includeSensitive)
  })

  return { items, summary: summarise(items) }
}

function planForMatch(
  control: RawControl,
  index: number,
  label: string,
  match: FieldMatch,
  profile: AutofillProfile,
  library: ScreeningAnswer[],
  includeSensitive: boolean
): FillPlanItem {
  const base = {
    index,
    label,
    kind: control.kind,
    fieldId: match.fieldId,
    confidence: match.confidence,
    negated: match.negated,
    reason: describeReason(match),
  }

  if (match.confidence < 0.8 && match.reason === "fuzzy") {
    // A vague guess about a real question is worth asking about, not acting on.
    return { ...base, status: "low-confidence" }
  }

  // Documents are reported so the user knows to attach one, but browsers do not
  // allow a script to populate a file input.
  if (FILE_FIELD_IDS.includes(match.fieldId)) {
    return {
      ...base,
      status: "file",
      note: FILE_FIELD_IDS.includes(match.fieldId) ? FIELD_BY_ID[match.fieldId].hint : undefined,
    }
  }

  if (SENSITIVE_FIELD_IDS.includes(match.fieldId) && !includeSensitive) {
    return {
      ...base,
      status: "sensitive",
      note: "Voluntary question — enable in settings to fill",
    }
  }

  // 1. The user's own words, if they have answered this exact question before.
  const saved = matchSavedAnswer(label, library)
  if (saved && saved.confidence >= 0.9) {
    return { ...base, status: "ready", value: saved.answer, reason: "Your saved answer" }
  }

  // 2. The structured profile.
  const answer = resolveAnswer(match.fieldId, profile)
  if (answer) {
    // A form that phrases the question negatively ("I do not require
    // sponsorship") needs the opposite of the answer we store.
    const effective: ResolvedAnswer =
      match.negated && answer.type === "boolean" ? { type: "boolean", value: !answer.value } : answer
    return { ...base, status: "ready", value: displayValue(effective) }
  }

  // 3. A saved answer we are less sure about.
  if (saved) {
    return { ...base, status: "ready", value: saved.answer, confidence: saved.confidence, reason: "Similar saved answer" }
  }

  // We know what is being asked, we simply have no answer for it yet.
  return { ...base, status: "missing-value", note: missingValueHint(match.fieldId) }
}

function describeReason(match: FieldMatch): string {
  switch (match.reason) {
    case "autocomplete":
      return "Matched the form's autocomplete hint"
    case "exact":
      return "Matched the question wording"
    case "alias":
      return "Matched a known phrasing of this question"
    case "fuzzy":
      return "Likely match"
    case "answer-library":
      return "From your saved answers"
    default:
      return "Matched"
  }
}

/** Turn "missing-value" into something the user can act on with one tap. */
function missingValueHint(fieldId: CanonicalFieldId): string {
  const field = FIELD_BY_ID[fieldId]
  if (!field) return "You have not answered this yet"
  return `Add your ${field.label.toLowerCase()} to fill this automatically`
}

function summarise(items: FillPlanItem[]): FillPlanSummary {
  const count = (status: PlanStatus) => items.filter((item) => item.status === status).length
  return {
    total: items.length,
    ready: count("ready"),
    files: count("file"),
    missingValue: count("missing-value"),
    sensitive: count("sensitive"),
    unknown: count("unknown"),
    alreadyFilled: count("already-filled"),
    lowConfidence: count("low-confidence"),
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Choosing an option in a select / radio group
// ────────────────────────────────────────────────────────────────────────────

/** Words that assert agreement. Single tokens — matched against tokenised text. */
const YES_WORDS = [
  "yes",
  "y",
  "true",
  "affirmative",
  "agree",
  "agreed",
  "confirm",
  "confirmed",
  "authorized",
  "authorised",
  "accept",
  "sure",
  "correct",
  "eligible",
]

/** Words that assert refusal. */
const NO_WORDS = ["no", "n", "false", "negative", "disagree", "decline", "never"]

/**
 * What an option asserts: yes, no, or neither.
 *
 * Negation is checked against the raw text first, because the words that carry
 * it ("not", "never", "no") are exactly the ones that get dropped as stopwords
 * during tokenisation — "Not authorized" otherwise looks identical to
 * "Authorized", which is how an autofiller checks the box that says you are
 * *not* allowed to work.
 */
function optionPolarity(option: string): boolean | null {
  const tokens = tokenize(option)
  if (tokens.length === 0) return null

  if (isNegated(option)) return false
  if (tokens.some((token) => YES_WORDS.includes(token))) return true
  if (tokens.some((token) => NO_WORDS.includes(token))) return false
  return null
}

/** Read a resolved answer as a yes/no, if it is one. */
function asBoolean(answer: ResolvedAnswer): boolean | null {
  return answer.type === "boolean" ? answer.value : asBooleanFromText(answer.value)
}

function asBooleanFromText(value: string): boolean | null {
  const tokens = tokenize(value)
  if (tokens.length === 0) return null

  if (isNegated(value)) {
    // "I am not authorized" asserts a negative even though it mentions
    // "authorized".
    return tokens.some((token) => YES_WORDS.includes(token)) ? false : null
  }

  if (tokens.some((token) => YES_WORDS.includes(token))) return true
  if (tokens.some((token) => NO_WORDS.includes(token))) return false
  return null
}

/**
 * Pick the option that answers the question.
 *
 * Returns the option's label (the caller maps it back to the DOM node) or null
 * when nothing matches — a wrong selection is worse than an empty one.
 */
export function pickOption(options: string[], answer: ResolvedAnswer): string | null {
  const usable = options.filter((option) => option.trim().length > 0)
  if (usable.length === 0) return null

  const boolean = asBoolean(answer)

  // A yes/no control only offers yes/no, whatever the profile stores.
  if (boolean !== null) {
    for (const option of usable) {
      if (optionPolarity(option) === boolean) return option
    }
    return null
  }

  const text = answer.type === "text" ? answer.value : String(answer.value)
  const answerTokens = tokenize(text)
  const answerFingerprint = fingerprint(text)

  // 1. Same words. The fingerprint comparison ignores word boundaries, which is
  //    what lets "LinkedIn" (split to "linked in" as camelCase) still match the
  //    label "LinkedIn".
  for (const option of usable) {
    if (normalize(option) === normalize(text)) return option
  }
  for (const option of usable) {
    if (fingerprint(option) === answerFingerprint) return option
  }

  // 2. One is a run of whole words inside the other.
  for (const option of usable) {
    const optionTokens = tokenize(option)
    if (optionTokens.length === 0) continue
    if (tokenRunIndex(optionTokens, answerTokens) >= 0) return option
    if (tokenRunIndex(answerTokens, optionTokens) >= 0) return option
  }

  // 3. Loose token overlap, for paraphrased options.
  let best: { option: string; score: number } | null = null
  for (const option of usable) {
    const optionTokens = tokenize(option)
    if (optionTokens.length === 0) continue
    const set = new Set(optionTokens)
    let hits = 0
    for (const token of answerTokens) if (set.has(token)) hits += 1
    const score = hits / Math.max(answerTokens.length, optionTokens.length)
    if (score >= 0.7 && (!best || score > best.score)) best = { option, score }
  }

  return best?.option ?? null
}

/** Everything in the plan that will actually be written to the page. */
export function actionableItems(plan: FillPlan): FillPlanItem[] {
  return plan.items.filter((item) => item.status === "ready")
}

/** Fields we identified but could not answer — the AI/Copilot backlog. */
export function unansweredItems(plan: FillPlan): FillPlanItem[] {
  return plan.items.filter((item) => item.status === "missing-value" || item.status === "unknown")
}

export type { FieldDescriptor }
