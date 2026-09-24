/**
 * Canonical key -> profile column.
 *
 * Spec: extension/AUTOFILL_ARCHITECTURE.md section 9.5 — "mapping each
 * ProfileKey to its source column so the planner has one place to resolve a key
 * to a value, and so adding a profile column does not mean editing the engine."
 *
 * This file is app-side, not part of shared/autofill/, so `@/` imports are the
 * right form here: it depends on types/database.ts, which the extension never
 * builds. The relative-import rule (types.ts:6-12) binds files INSIDE
 * shared/autofill/.
 */

import {
  PROFILE_KEYS,
  PROTECTED_KEYS,
  type FillValue,
  type ProfileKey,
} from '@/shared/autofill/types'
import type {
  ProvenanceKey,
  RemotePreference,
  UserProfile,
  VisaStatus,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

/** Where the answer to a canonical key lives, once every table of M0 exists. */
export type CanonicalKeyOrigin =
  /** A column on public.user_profiles (033). */
  | 'profile'
  /** user_work_history / user_education (034) — a row set, not a profile column. */
  | 'career'
  /** public.user_profile_eeo (033), service-role only and consent-gated. */
  | 'eeo'
  /** Per-application, not per-user — public.applications. */
  | 'application'
  /** Nothing in this schema answers it; the engine hands the field to the human. */
  | 'none'

export interface CanonicalKeySource {
  readonly origin: CanonicalKeyOrigin

  /**
   * The user_profiles columns this key OWNS — empty for every origin but
   * 'profile'. Ownership is what stamps field_provenance, so it is 1:1 in the
   * other direction too; COLUMN_TO_KEY enforces that.
   */
  readonly columns: ReadonlyArray<keyof UserProfile>

  /**
   * True when the key only reads columns another key owns. Derived keys are
   * absent from COLUMN_TO_KEY: stamping provenance for `full_name` because the
   * user edited their surname would record an assertion the user never made.
   */
  readonly derived: boolean

  /**
   * The value this profile row alone can produce, or null.
   *
   * null is not the same as "empty". The file keys own a column — the document
   * id — but cannot build a FillValue of type 'file' without the fileName and
   * mimeType from public.documents and the bytes the service worker relays
   * (section 6.4). `columns` is what completeness and provenance read;
   * `resolve` is what the planner reads.
   */
  resolve(profile: UserProfile): FillValue | null
}

// ---------------------------------------------------------------------------
// Value builders
// ---------------------------------------------------------------------------

/**
 * Columns whose type is assignable to T. Declaring a key as textColumn('x')
 * both records the ownership and reads the value, so the two cannot drift —
 * a single name, checked against the real column type.
 */
type ColumnsOfType<T> = {
  [K in keyof UserProfile]-?: UserProfile[K] extends T ? K : never
}[keyof UserProfile]

type StringColumn = ColumnsOfType<string | null>
type BooleanColumn = ColumnsOfType<boolean | null>

function text(value: string | null): FillValue | null {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : { type: 'text', text: trimmed }
}

/**
 * `false` is an answer. "No, I do not require sponsorship" has to reach the
 * form as `{type:'bool', checked:false}` — routing it through text would hand
 * the executor the string "false" (types.ts:317-321).
 */
function bool(value: boolean | null): FillValue | null {
  return typeof value === 'boolean' ? { type: 'bool', checked: value } : null
}

/**
 * A stored enum token never appears verbatim on a form: no ATS labels an option
 * "permanent_resident". optionText carries the human wording the executor's
 * option matcher can actually match; optionValue keeps the token for a control
 * whose values happen to be canonical.
 */
function option<T extends string>(
  value: T | null,
  labels: Readonly<Record<T, string>>,
): FillValue | null {
  return value === null ? null : { type: 'option', optionValue: value, optionText: labels[value] }
}

const ISO_DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})/

/**
 * FillValue.date is "always YYYY-MM-DD" (types.ts:327). A DATE column already
 * serializes that way; the prefix match is for a caller that hydrated the row
 * from something returning a full timestamp. Anything else is dropped rather
 * than passed on — a segmented date widget handed '02/2026' fills the day box
 * with a month.
 */
function isoDate(value: string | null): FillValue | null {
  const match = value === null ? null : ISO_DATE_PREFIX.exec(value)
  return match === null ? null : { type: 'date', iso: match[1] }
}

function textColumn(name: StringColumn): CanonicalKeySource {
  return { origin: 'profile', columns: [name], derived: false, resolve: (p) => text(p[name]) }
}

function boolColumn(name: BooleanColumn): CanonicalKeySource {
  return { origin: 'profile', columns: [name], derived: false, resolve: (p) => bool(p[name]) }
}

/** No column on user_profiles answers this key; nothing here can resolve it. */
function elsewhere(origin: Exclude<CanonicalKeyOrigin, 'profile'>): CanonicalKeySource {
  return { origin, columns: [], derived: false, resolve: () => null }
}

const VISA_STATUS_LABELS: Readonly<Record<VisaStatus, string>> = {
  citizen: 'Citizen',
  permanent_resident: 'Permanent Resident',
  work_visa_h1b: 'H-1B',
  work_visa_other: 'Work Visa',
  student_opt: 'F-1 OPT',
  student_cpt: 'F-1 CPT',
  tn: 'TN',
  e3: 'E-3',
  other: 'Other',
  decline_to_state: 'Decline to state',
}

const REMOTE_PREFERENCE_LABELS: Readonly<Record<RemotePreference, string>> = {
  onsite: 'On-site',
  hybrid: 'Hybrid',
  remote: 'Remote',
  flexible: 'Flexible',
}

// ---------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------

/**
 * The exhaustiveness check the spec asks for, at the type level: Record over
 * ProfileKey means adding a key to PROFILE_KEYS (shared/autofill/types.ts:31-84)
 * without deciding where its value comes from is a `tsc` error, not a key that
 * silently resolves to nothing at fill time. Same guard as taxonomy.ts:58-63.
 */
export const CANONICAL_KEY_SOURCES: Readonly<Record<ProfileKey, CanonicalKeySource>> = {
  // Identity ----------------------------------------------------------------
  legal_first_name: textColumn('legal_first_name'),
  legal_last_name: textColumn('legal_last_name'),
  preferred_name: textColumn('preferred_first_name'),

  full_name: {
    origin: 'profile',
    // Owns nothing: legal_first_name and legal_last_name own their columns, and
    // no canonical key exists for the middle name or suffix.
    columns: [],
    derived: true,
    // Both halves are required. A "Full legal name" field holding only "Ada"
    // is a wrong answer on a legal form, where a blank field is merely an
    // unfinished one the human is shown.
    resolve: (p) => {
      const first = p.legal_first_name?.trim() ?? ''
      const last = p.legal_last_name?.trim() ?? ''
      if (first === '' || last === '') return null
      const parts = [first, p.legal_middle_name?.trim() ?? '', last, p.name_suffix?.trim() ?? '']
      return { type: 'text', text: parts.filter((part) => part !== '').join(' ') }
    },
  },

  pronouns: textColumn('pronouns'),

  // Contact -----------------------------------------------------------------
  email: textColumn('contact_email'),

  // The number alone. phone_country_code is its own key because most ATS split
  // them; concatenating '+1' here would double-write the code on every form
  // that has both controls.
  phone: textColumn('phone_number'),
  phone_country_code: textColumn('phone_country_code'),

  address_line1: textColumn('address_line1'),
  address_line2: textColumn('address_line2'),
  city: textColumn('address_city'),
  state_region: textColumn('address_state'),
  postal_code: textColumn('address_postal_code'),

  // Stored as ISO alpha-2 (033:108). Not emitted as an option: this layer does
  // not know whether the target lists "US", "United States" or "USA", and
  // guessing a label here would defeat the executor's own option matching.
  country: textColumn('address_country'),

  // Links -------------------------------------------------------------------
  linkedin_url: textColumn('linkedin_url'),
  github_url: textColumn('github_url'),
  portfolio_url: textColumn('portfolio_url'),

  other_url: {
    origin: 'profile',
    columns: ['other_links'],
    derived: false,
    // One link is unambiguous. With several, choosing between "Dribbble" and
    // "Stack Overflow" needs the field's own label, which lives in the
    // descriptor the matcher holds — not in a per-key lookup.
    resolve: (p) => (p.other_links.length === 1 ? text(p.other_links[0].url) : null),
  },

  // Employment --------------------------------------------------------------
  // user_work_history (034), ordered by the user's own sort_order. A profile
  // row cannot answer these, which is why they are absent from the core metric.
  current_employer: elsewhere('career'),
  current_title: elsewhere('career'),
  years_experience: elsewhere('career'),

  // Eligibility -------------------------------------------------------------
  work_authorized: boolColumn('work_authorized'),
  requires_sponsorship: boolColumn('requires_sponsorship'),
  visa_status: {
    origin: 'profile',
    columns: ['visa_status'],
    derived: false,
    resolve: (p) => option(p.visa_status, VISA_STATUS_LABELS),
  },

  security_clearance: {
    origin: 'profile',
    columns: ['has_security_clearance', 'security_clearance_level'],
    derived: false,
    // The level wins when it exists, because a form that asks for it wants the
    // words. A yes/no control handed "Top Secret" matches no option and is
    // reported verify_failed — visible, and the opposite of answering "no" to a
    // clearance question the user can actually answer.
    resolve: (p) => text(p.security_clearance_level) ?? bool(p.has_security_clearance),
  },

  // Logistics ---------------------------------------------------------------
  desired_salary: {
    origin: 'profile',
    columns: [
      'desired_salary_min',
      'desired_salary_max',
      'desired_salary_currency',
      'desired_salary_period',
    ],
    derived: false,
    // The bare number, currency and period omitted: a number input rejects
    // "120000 USD/annual" outright, and this key is 'compensation', which is
    // never pre-accepted (types.ts:111-114) — a human reads the value before it
    // lands either way.
    resolve: (p) => {
      const amount = p.desired_salary_min ?? p.desired_salary_max
      return amount === null || !Number.isFinite(amount)
        ? null
        : { type: 'text', text: String(amount) }
    },
  },

  earliest_start_date: {
    origin: 'profile',
    columns: ['earliest_start_date'],
    derived: false,
    resolve: (p) => isoDate(p.earliest_start_date),
  },

  notice_period: {
    origin: 'profile',
    columns: ['notice_period_days'],
    derived: false,
    // Days, unlabelled. "2 weeks" vs "14" is the form's vocabulary, not ours.
    resolve: (p) =>
      p.notice_period_days === null ? null : { type: 'text', text: String(p.notice_period_days) },
  },

  willing_to_relocate: boolColumn('willing_to_relocate'),
  remote_preference: {
    origin: 'profile',
    columns: ['remote_preference'],
    derived: false,
    resolve: (p) => option(p.remote_preference, REMOTE_PREFERENCE_LABELS),
  },

  // Source ------------------------------------------------------------------
  // "Who referred you" is a person's name, a different question from "how did
  // you hear about us" — default_how_did_you_hear answers the second only.
  referral_source: elsewhere('none'),

  // Per-employer, not per-user: answered at fill time by matching the target
  // company against user_work_history.company (section 9.1).
  previously_employed_here: elsewhere('career'),

  how_heard: textColumn('default_how_did_you_hear'),

  // EEO ---------------------------------------------------------------------
  // public.user_profile_eeo, and deliberately unreachable from here:
  // `authenticated` holds no privilege on the table and no EXECUTE on the RPCs
  // (033:749-757). The engine receives these only through the consent-gated
  // get_autofill_bundle() (034). A profile row must never resolve one.
  gender: elsewhere('eeo'),
  race_ethnicity: elsewhere('eeo'),
  hispanic_latino: elsewhere('eeo'),
  veteran_status: elsewhere('eeo'),
  disability_status: elsewhere('eeo'),

  // Documents ---------------------------------------------------------------
  // The column is owned here — that is what setDefaultResumeDocument writes and
  // what completeness counts — but the FillValue needs fileName/mimeType from
  // public.documents and bytes from the relay, so resolve() stops short.
  resume_file: {
    origin: 'profile',
    columns: ['default_resume_document_id'],
    derived: false,
    resolve: () => null,
  },
  cover_letter_file: {
    origin: 'profile',
    columns: ['default_cover_letter_document_id'],
    derived: false,
    resolve: () => null,
  },

  // Written per application (applications.ai_cover_letter / manual_cover_letter),
  // never stored once on the profile.
  cover_letter_text: elsewhere('application'),

  // Terminal ----------------------------------------------------------------
  unmapped: elsewhere('none'),
}

// ---------------------------------------------------------------------------
// Derived indexes
// ---------------------------------------------------------------------------

/**
 * Pairs with ProvenanceKey (types/database.ts). PROTECTED_KEYS is derived from
 * KEY_SENSITIVITY (types.ts:178-180), so this test cannot drift from the
 * sensitivity table the way a second hand-written list would. It filters
 * nothing today — no EEO key owns a user_profiles column — and exists so that
 * a key which starts owning one still cannot reach field_provenance, which the
 * database rejects with 22023 (033:497-507).
 */
export function isProvenanceKey(key: ProfileKey): key is ProvenanceKey {
  return !PROTECTED_KEYS.includes(key)
}

function buildColumnIndex(): ReadonlyMap<keyof UserProfile, ProvenanceKey> {
  const index = new Map<keyof UserProfile, ProvenanceKey>()

  for (const key of PROFILE_KEYS) {
    const source = CANONICAL_KEY_SOURCES[key]
    if (source.derived || !isProvenanceKey(key)) continue

    for (const column of source.columns) {
      const owner = index.get(column)
      if (owner !== undefined) {
        // Two keys claiming one column means a write to it would be stamped
        // under whichever was iterated last — a wrong record of who asserted a
        // value on a legal form. Thrown at import, so the first test that
        // touches this module fails, rather than discovered in production.
        throw new Error(`canonical-keys: column ${column} is claimed by both ${owner} and ${key}`)
      }
      index.set(column, key)
    }
  }

  return index
}

/** Column -> the canonical key that owns it. The reverse of `columns` above. */
export const COLUMN_TO_KEY: ReadonlyMap<keyof UserProfile, ProvenanceKey> = buildColumnIndex()

/**
 * The keys M0 is measured on: "≥ 70% of the core profile keys populated for
 * ≥ 50% of weekly-active users" (section 13).
 *
 * This is what an ordinary Greenhouse or Lever application asks for before it
 * will accept a submission. Deliberately absent: compensation and EEO keys,
 * which are never pre-accepted and would make the metric reward collecting data
 * the engine may not use on its own; and anything sourced from work history,
 * which a UserProfile row cannot answer at all.
 */
export const CORE_PROFILE_KEYS: ReadonlyArray<ProfileKey> = [
  'legal_first_name',
  'legal_last_name',
  'email',
  'phone',
  'address_line1',
  'city',
  'state_region',
  'postal_code',
  'country',
  'linkedin_url',
  'work_authorized',
  'requires_sponsorship',
  'resume_file',
]

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (Array.isArray(value)) return value.length > 0
  // Everything else — including `false`, which is an answer, and 0, which is a
  // notice period of "none".
  return true
}

/**
 * Whether the profile row holds an answer for this key.
 *
 * Deliberately column-based rather than `resolve() !== null`: resume_file is
 * populated the moment default_resume_document_id is set, even though resolving
 * it to a FillValue needs the documents row.
 */
export function isKeyPopulated(profile: UserProfile, key: ProfileKey): boolean {
  return CANONICAL_KEY_SOURCES[key].columns.some((column) => hasValue(profile[column]))
}
