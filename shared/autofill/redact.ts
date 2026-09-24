/**
 * The two redaction boundaries.
 *
 * Spec: extension/AUTOFILL_ARCHITECTURE.md sections 10.1 (wire) and 9.4 (audit).
 *
 * There are exactly two places a plan is allowed to leave the page:
 *   1. `redactForWire` — the AI escalation route. Gemini maps *descriptors to key
 *      names*; it never needs, and never receives, a value.
 *   2. `toAuditPlan` — the telemetry writer for public.autofill_runs.
 *
 * Both boundaries are enforced by the TYPES, not by these comments. `AuditPlan`
 * and `WireFieldDescriptor` declare every banned property as `?: never`, so the
 * source types are structurally non-assignable to them: a future "just log the
 * plan" shortcut fails `tsc` instead of shipping a row full of phone numbers.
 * Section 9.4 is explicit that a `plan JSONB` column plus a comment saying "no
 * values" is not enforcement.
 *
 * CONSTRAINTS (AUTOFILL_ARCHITECTURE.md section 0.3, same as types.ts:6-12):
 * relative imports only, no `chrome.*`, no Node builtins, JSON-serializable out.
 */

import type {
  AdapterConfidence,
  AtsId,
  FieldDescriptor,
  FieldKind,
  FillOutcome,
  FillPlanPreview,
  FillStatus,
  FillStrategy,
  ProfileKey,
  Sensitivity,
} from './types'

// ---------------------------------------------------------------------------
// Clipping
// ---------------------------------------------------------------------------

/**
 * Budgets for employer-authored free text.
 *
 * Every one of these strings is scraped off the page, and "employer-authored"
 * is an assumption the page can break: after a Greenhouse resume upload the
 * file input's rendered label becomes the uploaded filename, which contains the
 * user's legal name (section 9.4). Clipping does not make that safe, but it
 * bounds the blast radius and it bounds the prompt: section 10.2 caps the
 * escalation payload at 40 fields, and 40 unbounded `wrapperText` values is a
 * request no rate limiter can price.
 */
export const WIRE_LIMITS = {
  /** Matches the bound the scanner already applies to wrapperText (types.ts:288). */
  wrapperText: 240,
  label: 160,
  /** name / elementId / autocomplete / atsHint / group / placeholder / ariaLabel. */
  attr: 120,
  optionText: 80,
  /** A <select> of every country is ~250 options; the classifier learns nothing from the tail. */
  options: 40,
} as const

/** Clip to `max`, preserving null. Length is measured in UTF-16 units, same as the DB's TEXT checks. */
function clip(value: string | null, max: number): string | null {
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max)
}

// ---------------------------------------------------------------------------
// Boundary 1 — the wire (section 10.1)
// ---------------------------------------------------------------------------

/**
 * The ONLY shape that may leave the device.
 *
 * Dropped, and why each one matters:
 *  - `hasExistingValue` — leaks which fields the user has already answered on
 *    this employer's form, i.e. how far into an application they are.
 *  - `domPath` / `frameKey` / `id` — page- and session-local handles. They
 *    cannot help a classifier that only sees employer metadata, and `frameKey`
 *    is a tab identifier.
 *
 * The banned properties are declared `?: never` so `FieldDescriptor` is not
 * assignable here: `send(d)` where `send(w: WireFieldDescriptor)` fails to
 * compile, which is the point.
 */
export interface WireFieldDescriptor {
  fieldKey: string
  kind: FieldKind
  name: string | null
  elementId: string | null
  autocomplete: string | null
  label: string | null
  placeholder: string | null
  ariaLabel: string | null
  wrapperText: string | null
  group: string | null
  atsHint: string | null
  required: boolean
  /** Option TEXT only. `FieldOption.value` is the submitted id and is useless to a classifier. */
  optionTexts: string[] | null

  hasExistingValue?: never
  domPath?: never
  frameKey?: never
  id?: never
}

export function redactForWire(d: FieldDescriptor): WireFieldDescriptor {
  return {
    fieldKey: d.fieldKey,
    kind: d.kind,
    name: clip(d.name, WIRE_LIMITS.attr),
    elementId: clip(d.elementId, WIRE_LIMITS.attr),
    autocomplete: clip(d.autocomplete, WIRE_LIMITS.attr),
    label: clip(d.label, WIRE_LIMITS.label),
    placeholder: clip(d.placeholder, WIRE_LIMITS.attr),
    ariaLabel: clip(d.ariaLabel, WIRE_LIMITS.attr),
    wrapperText: clip(d.wrapperText, WIRE_LIMITS.wrapperText),
    group: clip(d.group, WIRE_LIMITS.attr),
    atsHint: clip(d.atsHint, WIRE_LIMITS.attr),
    required: d.required,
    optionTexts:
      d.options === null
        ? null
        : d.options
            .slice(0, WIRE_LIMITS.options)
            .map((o) => clip(o.text, WIRE_LIMITS.optionText) ?? ''),
  }
}

// ---------------------------------------------------------------------------
// Boundary 2 — the audit row (section 9.4)
// ---------------------------------------------------------------------------

/**
 * One planned field as it may be persisted.
 *
 * `descriptor` is banned outright rather than projected: it carries `domPath`,
 * `hasExistingValue` and the raw option list, and the audit trail answers
 * "which canonical key did we map this to, and did the user have to confirm it",
 * not "what did the form look like".
 */
export interface AuditField {
  fieldId: string
  profileKey: ProfileKey
  kind: FieldKind
  label: string | null
  required: boolean
  confidence: number
  sensitivity: Sensitivity

  descriptor?: never
  value?: never
}

/**
 * The ONLY thing the report writer may hand to public.autofill_runs.
 *
 * `values?: never` is what makes `toAuditPlan` unavoidable: `FillPlanPreview`
 * (types.ts:369-371) has `values: Record<string, FillValue>`, which is not
 * assignable to `undefined`, so passing a preview straight through is a compile
 * error. `unresolved?: never` closes the same door on `FillPlanPublic`, whose
 * `unresolved: FieldDescriptor[]` would otherwise carry `domPath` and
 * `hasExistingValue` into the row — the unresolved COUNT survives in `stats`,
 * which is all the metric in section 12.1 needs.
 *
 * `frameKey` is dropped for the same reason the wire drops it: it is a tab id,
 * and it is not a fact about the employer's form.
 */
export interface AuditPlan {
  planId: string
  createdAt: string
  ats: AtsId
  adapterConfidence: AdapterConfidence
  formFingerprint: string
  /** Re-narrowed through safePageUrl even though the plan's url should already be narrow. */
  url: string
  fields: AuditField[]
  stats: { total: number; resolved: number; sensitive: number; unresolved: number }

  values?: never
  unresolved?: never
  frameKey?: never
}

export function toAuditPlan(plan: FillPlanPreview): AuditPlan {
  return {
    planId: plan.planId,
    createdAt: plan.createdAt,
    ats: plan.ats,
    adapterConfidence: plan.adapterConfidence,
    formFingerprint: plan.formFingerprint,
    url: safePageUrl(plan.url),
    fields: plan.fields.map((f) => ({
      fieldId: f.fieldId,
      profileKey: f.profileKey,
      kind: f.descriptor.kind,
      label: clip(f.descriptor.label, WIRE_LIMITS.label),
      required: f.descriptor.required,
      confidence: f.confidence,
      sensitivity: f.sensitivity,
    })),
    stats: { ...plan.stats },
  }
}

/**
 * A `FillOutcome` (types.ts:399-412) with the read-back stripped.
 *
 * `observed` is the value read off the live element after the write — it is the
 * user's phone number by construction, so it stays on the device.
 *
 * `error` goes with it. It is `string | null` free text, and an ATS validation
 * message quotes the rejected input back ("'5550134' is not a valid phone
 * number"), so persisting it re-opens the exact hole `observed` closes. Section
 * 9.4 makes the same call at the schema level: `autofill_events.error_code` is a
 * CHECK-constrained enum "precisely so a future `catch (e) { log(e.message) }`
 * cannot compile into a row". `hasError` keeps the only signal the funnel needs.
 */
export interface AuditOutcome {
  fieldId: string
  profileKey: ProfileKey
  status: FillStatus
  strategy: FillStrategy
  attempts: number
  elapsedMs: number
  hasError: boolean

  observed?: never
  error?: never
}

export function redactOutcome(o: FillOutcome): AuditOutcome {
  return {
    fieldId: o.fieldId,
    profileKey: o.profileKey,
    status: o.status,
    strategy: o.strategy,
    attempts: o.attempts,
    elapsedMs: o.elapsedMs,
    hasError: o.error !== null,
  }
}

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

/**
 * Origin + pathname. Nothing else.
 *
 * The query string is the problem: Greenhouse's embed is
 * `/embed/job_app?token=...`, Workday carries session identifiers, and several
 * ATS put a candidate id in `?candidate=`. The fragment is worse — it is never
 * sent to the server, so nobody audits what accumulates there.
 *
 * Non-HTTP schemes return '' rather than their origin: `javascript:` and `data:`
 * hrefs ARE their payload, and a `file:` URL is a local path that usually
 * contains the user's name.
 */
export function safePageUrl(href: string): string {
  let parsed: URL
  try {
    parsed = new URL(href)
  } catch {
    return ''
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return ''
  return `${parsed.origin}${parsed.pathname}`
}
