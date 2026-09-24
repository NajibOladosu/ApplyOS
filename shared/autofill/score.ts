/**
 * Tier B -- the heuristic resolver.
 *
 * Spec: extension/AUTOFILL_ARCHITECTURE.md section 5. Every weight, threshold
 * and factor below is quoted from that section; none of them are tuned here.
 *
 * Eight weighted text channels, plus the `autocomplete` attribute at nearly
 * twice the weight of the label because it is the one signal the employer
 * authored for exactly this purpose. Per-key negatives veto the readings that
 * collide on real job forms, and an ambiguity demotion hands near-ties to the
 * human instead of coin-flipping between email and phone.
 *
 * CONSTRAINTS ON THIS DIRECTORY (see AUTOFILL_ARCHITECTURE.md section 0.3, same
 * as types.ts:6-12): relative imports only, no `chrome.*`, no Node builtins.
 */

import { classifyLabelSensitivity, strictestSensitivity } from './sensitivity'
import { phraseScore, tokenize, type Phrase } from './tokenize'
import { SIGNATURES, type KeySignature, type MappableProfileKey } from './taxonomy'
import {
  PROFILE_KEYS,
  sensitivityOf,
  type FieldDescriptor,
  type FieldKind,
  type ProfileKey,
  type Resolution,
  type Sensitivity,
} from './types'

// ---------------------------------------------------------------------------
// Constants -- section 5
// ---------------------------------------------------------------------------

/** >= : propose PRE-ACCEPTED. */
export const ACCEPT_THRESHOLD = 0.62
/** >= : propose with accepted = false. < : unresolved, an AI escalation candidate. */
export const REVIEW_THRESHOLD = 0.45

const AUTOCOMPLETE_WEIGHT = 60
const NEGATIVE_PENALTY = 26
/** Raw score that maps to confidence 1.0. */
const SATURATION = 78
const KIND_MISMATCH = 0.35

/** Exported because the ambiguity test must not re-hardcode these. */
export const AMBIGUITY_MARGIN = 0.12
export const AMBIGUITY_FACTOR = 0.6

/**
 * Phrase score at which a negative fires. Section 5: "A negative phrase hit at
 * >= 0.72 in any channel costs NEGATIVE_PENALTY." 0.72 sits between the
 * tokenizer's in-order-with-gaps score (0.80) and its any-order score (0.55)
 * (tokenize.ts:70-78), so "Manager's last name" -- where ['manager','name'] is
 * in order but not adjacent -- still trips the negative.
 */
const NEGATIVE_HIT = 0.72

type ChannelId =
  | 'label'
  | 'atsHint'
  | 'name'
  | 'ariaLabel'
  | 'elementId'
  | 'group'
  | 'placeholder'
  | 'wrapperText'

interface Channel {
  readonly id: ChannelId
  readonly weight: number
  readonly read: (d: FieldDescriptor) => string | null
}

/**
 * `atsHint` outweighs the visible label: data-automation-id / data-qa /
 * data-testid are written by the ATS vendor for their own test suite, so they
 * name the field's role in the vendor's own vocabulary and are not translated,
 * re-worded per employer, or replaced by an icon.
 *
 * `describedBy` is deliberately NOT a channel. Section 5 specifies eight, and
 * aria-describedby is help text ("We use this to contact you about your
 * application") whose vocabulary overlaps every key at once.
 */
const CHANNELS: ReadonlyArray<Channel> = [
  { id: 'label', weight: 30, read: (d) => d.label },
  { id: 'atsHint', weight: 34, read: (d) => d.atsHint },
  { id: 'name', weight: 26, read: (d) => d.name },
  { id: 'ariaLabel', weight: 24, read: (d) => d.ariaLabel },
  { id: 'elementId', weight: 22, read: (d) => d.elementId },
  { id: 'group', weight: 14, read: (d) => d.group },
  { id: 'placeholder', weight: 12, read: (d) => d.placeholder },
  { id: 'wrapperText', weight: 10, read: (d) => d.wrapperText },
]

/**
 * Channels fed to the label-based sensitivity classifier.
 *
 * `wrapperText` is excluded: it is the enclosing container's own text
 * (types.ts:288), so inside an EEO fieldset it carries "Voluntary
 * Self-Identification" onto every neighbouring control and would gate ordinary
 * fields behind the opt-in. A fieldset legend that really does describe the
 * field arrives in `group` instead, which is included.
 */
const SENSITIVITY_CHANNELS: ReadonlyArray<(d: FieldDescriptor) => string | null> = [
  (d) => d.label,
  (d) => d.ariaLabel,
  (d) => d.group,
  (d) => d.atsHint,
  (d) => d.name,
  (d) => d.elementId,
  (d) => d.placeholder,
]

/** PROFILE_KEYS position, for deterministic tie-breaking on identical scores. */
const KEY_ORDER: ReadonlyMap<ProfileKey, number> = new Map(PROFILE_KEYS.map((k, i) => [k, i]))

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface ScoredCandidate {
  key: MappableProfileKey
  /** Weighted sum after negatives and the kind multiplier, floored at 0. */
  raw: number
  /** raw / SATURATION, clamped to [0,1]. BEFORE the ambiguity demotion. */
  confidence: number
  kindMismatch: boolean
  /** Channels that contributed a positive phrase hit. */
  matched: ChannelId[]
  /** Channels where a negative fired; each cost NEGATIVE_PENALTY. */
  penalized: ChannelId[]
  /** The autocomplete token that matched, if any. */
  autocompleteHit: string | null
}

/**
 * All keys with surviving positive evidence, best first.
 *
 * Zero-scored keys are dropped rather than returned at 0: the ambiguity check in
 * resolveField compares the top two entries, and a list padded with 40 keys tied
 * at zero would demote every single-signal field for being "ambiguous" with
 * noise.
 */
export function scoreField(d: FieldDescriptor): ScoredCandidate[] {
  const channelTokens = CHANNELS.map((c) => tokenize(c.read(d)))
  const acTokens = autocompleteTokens(d.autocomplete)
  const out: ScoredCandidate[] = []

  for (const sig of SIGNATURES) {
    const matched: ChannelId[] = []
    const penalized: ChannelId[] = []
    let raw = 0

    for (let i = 0; i < CHANNELS.length; i++) {
      const channel = CHANNELS[i]
      const tokens = channelTokens[i]
      if (tokens.length === 0) continue

      const positive = bestPhraseScore(sig.phrases, tokens)
      if (positive > 0) {
        raw += channel.weight * positive
        matched.push(channel.id)
      }

      // Per CHANNEL, not per descriptor. A real form repeats the label in the
      // name and the id, so "Company name" as label + name + elementId scores
      // 30 + 26 + 22 = 78 for full_name's ph('name'). One penalty for the whole
      // descriptor leaves 52 -> 0.667, which is above ACCEPT_THRESHOLD: the
      // engine would pre-fill the employer's company field with the user's legal
      // name. Charged per channel the same descriptor nets 0.
      if (bestPhraseScore(sig.negatives, tokens) >= NEGATIVE_HIT) {
        raw -= NEGATIVE_PENALTY
        penalized.push(channel.id)
      }
    }

    const autocompleteHit = sig.autocomplete.find((token) => acTokens.includes(token)) ?? null
    if (autocompleteHit !== null) raw += AUTOCOMPLETE_WEIGHT

    if (raw <= 0) continue

    // The multiplier scales whatever evidence survived rather than subtracting a
    // flat amount, so a wrong-kind key keeps its ordering against other wrong-
    // kind keys instead of collapsing them all to zero. It is what separates
    // cover_letter_file from cover_letter_text, which share every phrase.
    const kindMismatch = isKindMismatch(sig, d.kind)
    if (kindMismatch) raw *= KIND_MISMATCH

    out.push({
      key: sig.key,
      raw,
      confidence: clamp01(raw / SATURATION),
      kindMismatch,
      matched,
      penalized,
      autocompleteHit,
    })
  }

  out.sort((a, b) => b.raw - a.raw || keyOrder(a.key) - keyOrder(b.key))
  return out
}

/**
 * The generic tier of section 5.1's resolve(): called only after the adapter's
 * selector map and its own classify() have both declined.
 *
 * Returns `unmapped` whenever the best candidate lands below REVIEW_THRESHOLD.
 * A sub-threshold key is never shown and never filled, so carrying it in the
 * Resolution only invites a later reader to treat a rejected guess as a mapping;
 * the guess is preserved in `rationale` instead. `confidence` still reports the
 * rejected candidate's score, which is what orders the AI-escalation queue by
 * near-miss (section 10.2).
 */
export function resolveField(d: FieldDescriptor): Resolution {
  const candidates = scoreField(d)
  const top = candidates[0]
  if (top === undefined) {
    return {
      key: 'unmapped',
      confidence: 0,
      source: 'heuristic',
      rationale: 'heuristic: no signature matched any channel',
      sensitivity: sensitivityFor(d, 'unmapped'),
      actionable: false,
    }
  }

  const runnerUp = candidates[1]
  const ambiguous =
    runnerUp !== undefined && top.confidence - runnerUp.confidence < AMBIGUITY_MARGIN
  const confidence = ambiguous ? top.confidence * AMBIGUITY_FACTOR : top.confidence
  const why = describe(top, ambiguous ? runnerUp : null, confidence)

  if (confidence < REVIEW_THRESHOLD) {
    return {
      key: 'unmapped',
      confidence,
      source: 'heuristic',
      rationale: `${why}; below review threshold`,
      sensitivity: sensitivityFor(d, 'unmapped'),
      actionable: false,
    }
  }

  return {
    key: top.key,
    confidence,
    source: 'heuristic',
    rationale: why,
    sensitivity: sensitivityFor(d, top.key),
    actionable: true,
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function bestPhraseScore(phrases: ReadonlyArray<Phrase>, tokens: readonly string[]): number {
  let best = 0
  for (const phrase of phrases) {
    const score = phraseScore(phrase, tokens)
    if (score > best) {
      best = score
      if (best === 1) break
    }
  }
  return best
}

function isKindMismatch(sig: KeySignature, kind: FieldKind): boolean {
  if (sig.kinds.length === 0) return false
  // 'unknown' is the scanner admitting it could not classify the control
  // (types.ts:238). Penalising it would charge the field for our own blind spot.
  if (kind === 'unknown') return false
  return !sig.kinds.includes(kind)
}

/**
 * The attribute is a space-separated token list that may carry section-*,
 * 'billing' or 'shipping' prefixes ("shipping address-line1"), and the tokens
 * themselves contain hyphens -- so normalizeText() is the wrong tool here: it
 * strips the hyphen and turns 'given-name' into two tokens.
 */
function autocompleteTokens(raw: string | null): string[] {
  if (raw === null) return []
  return raw
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0)
}

/**
 * The stricter of the key-based and the label-based verdict, over every channel
 * a human might have read. A field the resolver could not map still gets a
 * sensitivity this way, which is what lets the planner withhold an unmapped
 * "Gender" control from the AI escalation payload instead of shipping the label
 * to a model.
 */
function sensitivityFor(d: FieldDescriptor, key: ProfileKey): Sensitivity {
  let result = sensitivityOf(key)
  for (const read of SENSITIVITY_CHANNELS) {
    result = strictestSensitivity(result, classifyLabelSensitivity(read(d)))
  }
  return result
}

function describe(
  top: ScoredCandidate,
  demotedBy: ScoredCandidate | null,
  confidence: number,
): string {
  const signals: string[] = []
  if (top.autocompleteHit !== null) signals.push(`autocomplete=${top.autocompleteHit}`)
  signals.push(...top.matched)
  if (top.penalized.length > 0) signals.push(`-negatives(${top.penalized.join(',')})`)
  if (top.kindMismatch) signals.push('-kind')

  const base = `heuristic:${top.key} ${confidence.toFixed(2)} via ${signals.join(' ')}`
  return demotedBy === null ? base : `${base}; demoted, ambiguous with ${demotedBy.key}`
}

function keyOrder(key: ProfileKey): number {
  return KEY_ORDER.get(key) ?? PROFILE_KEYS.length
}

function clamp01(value: number): number {
  if (value < 0) return 0
  return value > 1 ? 1 : value
}
