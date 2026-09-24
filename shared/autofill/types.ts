/**
 * Universal Autofill Engine — core contracts.
 *
 * Spec: extension/AUTOFILL_ARCHITECTURE.md section 3.
 *
 * CONSTRAINTS ON THIS DIRECTORY (see AUTOFILL_ARCHITECTURE.md section 0.3):
 *  - Relative imports only. The root tsconfig maps `@/*` to the repo root while
 *    extension/tsconfig.json maps it to extension/src — a `@/` import here
 *    compiles in the Next app and breaks the extension build.
 *  - No `chrome.*`, no Node builtins, no `import 'server-only'`.
 *  - Everything must survive JSON.stringify: chrome.runtime serializes messages
 *    as JSON, not structured clone, so a DOM node would silently become {}.
 */

// ---------------------------------------------------------------------------
// Profile keys
// ---------------------------------------------------------------------------

/**
 * Single source of truth for the canonical key space.
 *
 * The AI escalation prompt's allowed-key list, the server-side validator that
 * drops anything the model invents, and the taxonomy signatures all derive from
 * this array so they cannot drift apart.
 *
 * `answer_bank` is deliberately absent: there is no reusable answer bank in this
 * repo (`questions` is application-scoped, 001_initial_schema.sql:30-38), so
 * free-text essay questions resolve to `unmapped` and surface as "finish by
 * hand" rather than silently resolving to nothing.
 */
export const PROFILE_KEYS = [
  // identity
  'legal_first_name',
  'legal_last_name',
  'preferred_name',
  'full_name',
  'pronouns',
  // contact
  'email',
  'phone',
  'phone_country_code',
  'address_line1',
  'address_line2',
  'city',
  'state_region',
  'postal_code',
  'country',
  // links
  'linkedin_url',
  'github_url',
  'portfolio_url',
  'other_url',
  // employment
  'current_employer',
  'current_title',
  'years_experience',
  // eligibility
  'work_authorized',
  'requires_sponsorship',
  'visa_status',
  'security_clearance',
  // logistics
  'desired_salary',
  'earliest_start_date',
  'notice_period',
  'willing_to_relocate',
  'remote_preference',
  // provenance
  'referral_source',
  'previously_employed_here',
  'how_heard',
  // EEO — always sensitive, never pre-accepted, gated by an explicit opt-in
  'gender',
  'race_ethnicity',
  'hispanic_latino',
  'veteran_status',
  'disability_status',
  // documents
  'resume_file',
  'cover_letter_file',
  'cover_letter_text',
  // terminal
  'unmapped',
] as const

export type ProfileKey = (typeof PROFILE_KEYS)[number]

const PROFILE_KEY_SET: ReadonlySet<string> = new Set<string>(PROFILE_KEYS)

/** Type guard for anything crossing a trust boundary (AI output, cached mappings, the wire). */
export function isProfileKey(value: unknown): value is ProfileKey {
  return typeof value === 'string' && PROFILE_KEY_SET.has(value)
}

// ---------------------------------------------------------------------------
// Sensitivity
// ---------------------------------------------------------------------------

/**
 * `protected` and `compensation` are NEVER pre-accepted, at any confidence.
 * `protected` additionally requires the per-run opt-in.
 */
export type Sensitivity =
  | 'public'
  | 'contact'
  | 'compensation'
  | 'eligibility'
  | 'protected'

/** Keys that can never be pre-accepted regardless of how confident the resolver is. */
export const NEVER_PRE_ACCEPT: ReadonlySet<Sensitivity> = new Set<Sensitivity>([
  'protected',
  'compensation',
])

/** Keys that require the explicit per-run sensitive opt-in before they are even planned. */
export const REQUIRES_OPT_IN: ReadonlySet<Sensitivity> = new Set<Sensitivity>(['protected'])

const KEY_SENSITIVITY: Readonly<Record<ProfileKey, Sensitivity>> = {
  legal_first_name: 'public',
  legal_last_name: 'public',
  preferred_name: 'public',
  full_name: 'public',
  pronouns: 'public',

  email: 'contact',
  phone: 'contact',
  phone_country_code: 'contact',
  address_line1: 'contact',
  address_line2: 'contact',
  city: 'contact',
  state_region: 'contact',
  postal_code: 'contact',
  country: 'contact',

  linkedin_url: 'public',
  github_url: 'public',
  portfolio_url: 'public',
  other_url: 'public',

  current_employer: 'public',
  current_title: 'public',
  years_experience: 'public',

  work_authorized: 'eligibility',
  requires_sponsorship: 'eligibility',
  visa_status: 'eligibility',
  security_clearance: 'eligibility',

  desired_salary: 'compensation',
  earliest_start_date: 'public',
  notice_period: 'public',
  willing_to_relocate: 'public',
  remote_preference: 'public',

  referral_source: 'public',
  previously_employed_here: 'public',
  how_heard: 'public',

  gender: 'protected',
  race_ethnicity: 'protected',
  hispanic_latino: 'protected',
  veteran_status: 'protected',
  disability_status: 'protected',

  resume_file: 'public',
  cover_letter_file: 'public',
  cover_letter_text: 'public',

  unmapped: 'public',
}

export function sensitivityOf(key: ProfileKey): Sensitivity {
  return KEY_SENSITIVITY[key] ?? 'contact'
}

/** The EEO subset, for the consent gate and for asserting it in tests. */
export const PROTECTED_KEYS: ReadonlyArray<ProfileKey> = PROFILE_KEYS.filter(
  (k) => KEY_SENSITIVITY[k] === 'protected',
)

// ---------------------------------------------------------------------------
// ATS identity
// ---------------------------------------------------------------------------

/**
 * NOT the same union as PageDetectionResult.platform
 * (extension/src/content/page-detector.ts:3), which is a closed set of six job
 * BOARDS and cannot express ashby/workable/smartrecruiters/icims/taleo. The ATS
 * identity for autofill comes from the adapter registry's matches(), not from
 * PageDetector — which keeps doing its own job: "is this a job posting worth
 * scraping".
 */
export const ATS_IDS = [
  'greenhouse',
  'greenhouse_embed',
  'lever',
  'workday',
  'ashby',
  'smartrecruiters',
  'workable',
  'icims',
  'taleo',
  'jobvite',
  'successfactors',
  'generic',
] as const

export type AtsId = (typeof ATS_IDS)[number]

export function isAtsId(value: unknown): value is AtsId {
  return typeof value === 'string' && (ATS_IDS as readonly string[]).includes(value)
}

/** Whether an adapter's selectors have been checked against a live page (section 4.2). */
export type AdapterConfidence = 'verified' | 'unverified' | 'heuristic_only'

// ---------------------------------------------------------------------------
// Field description
// ---------------------------------------------------------------------------

export type FieldKind =
  | 'text'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'textarea'
  | 'select'
  | 'combobox'
  | 'typeahead'
  | 'radio_group'
  | 'checkbox'
  | 'checkbox_group'
  | 'date'
  | 'date_segmented'
  | 'file'
  | 'unknown'

export type LabelSource =
  | 'label_for'
  | 'aria_label'
  | 'aria_labelledby'
  | 'wrapping_label'
  | 'fieldset_legend'
  | 'wrapper_text'
  | 'previous_sibling'
  | 'placeholder'
  | 'name_token'
  | 'none'

export type ResolutionSource = 'adapter' | 'heuristic' | 'cached_ai' | 'ai' | 'user'

export interface FieldOption {
  /**
   * The submitted value, which is often an opaque id rather than the visible
   * text. QuestionExtractor.getOptions (question-extractor.ts:118-125) keeps
   * only the text and throws this away, which makes its output unusable for
   * filling a <select>.
   */
  value: string | null
  text: string
  disabled: boolean
}

export interface FieldDescriptor {
  /** Scan-local handle into the binding registry. NOT stable across scans. */
  id: string
  /** Cache/AI identity. Stable across users and page loads. See fingerprint.ts. */
  fieldKey: string
  /** `${tabId}:${frameId}`, stamped by the executor host. */
  frameKey: string
  kind: FieldKind
  /** CSS path, for re-acquisition after a re-render. */
  domPath: string
  name: string | null
  elementId: string | null
  autocomplete: string | null
  /** Raw [type] attribute. */
  inputType: string | null
  label: string | null
  labelSource: LabelSource
  placeholder: string | null
  ariaLabel: string | null
  /** Resolved TEXT of aria-describedby, not the id. */
  describedBy: string | null
  /** Nearest container's own text, clipped. */
  wrapperText: string | null
  required: boolean
  disabled: boolean
  readOnly: boolean
  maxLength: number | null
  options: FieldOption[] | null
  /** Radio group name, or fieldset legend text. */
  group: string | null
  /** data-automation-id | data-qa | data-testid | data-test. */
  atsHint: string | null
  /**
   * Hash of the enclosing repeater container, when the field sits inside one.
   * Without this, row 1's "Company" and row 3's "Company" in a Workday
   * work-experience widget produce identical fieldKeys and collide.
   */
  repeatGroup: string | null
  /** Row index inside that repeater. */
  occurrenceIndex: number | null
  /** Idempotency signal ONLY. The VALUE never leaves the page — see redact.ts. */
  hasExistingValue: boolean
  visible: boolean
  /** Document order, for stable overlay ordering. */
  order: number
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

/**
 * Discriminated deliberately. A boolean or a choice must NEVER travel as a
 * string: routing the profile value "Yes" through a `checked` setter coerces to
 * false and answers **No** to "Are you legally authorized to work in the US?".
 */
export type FillValue =
  | { type: 'text'; text: string }
  | { type: 'option'; optionValue: string | null; optionText: string }
  | { type: 'multi'; optionTexts: string[] }
  | { type: 'bool'; checked: boolean }
  | { type: 'date'; iso: string } // always YYYY-MM-DD
  | { type: 'file'; assetId: string; fileName: string; mimeType: string }

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

/** One planned field. Carries NO value — see FillPlanPublic. */
export interface PlannedField {
  fieldId: string
  descriptor: FieldDescriptor
  profileKey: ProfileKey
  confidence: number
  source: ResolutionSource
  rationale: string
  sensitivity: Sensitivity
  /** True whenever the step is not pre-accepted. */
  requiresConfirm: boolean
  accepted: boolean
}

/**
 * What the content script is allowed to see. Structurally cannot carry a value —
 * not even a masked preview, because masking "only the sensitive ones" leaves
 * phone and street address in the clear.
 */
export interface FillPlanPublic {
  planId: string
  createdAt: string
  ats: AtsId
  adapterConfidence: AdapterConfidence
  formFingerprint: string
  /** origin + pathname ONLY. Query strings carry requisition and session tokens. */
  url: string
  frameKey: string
  fields: PlannedField[]
  /** Below REVIEW_THRESHOLD — AI escalation candidates. */
  unresolved: FieldDescriptor[]
  stats: { total: number; resolved: number; sensitive: number; unresolved: number }
}

/** Popup / side panel only — extension chrome, never the page. */
export interface FillPlanPreview extends FillPlanPublic {
  values: Record<string, FillValue>
}

// ---------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------

export type FillStrategy =
  | 'native_setter'
  | 'main_world_props'
  | 'select_option'
  | 'click_option'
  | 'combobox_sequence'
  | 'segmented_date'
  | 'typeahead_commit'
  | 'datatransfer_input'
  | 'datatransfer_drop'
  | 'noop'

export type FillStatus =
  | 'filled'
  | 'skipped_by_user'
  | 'skipped_already_filled'
  | 'skipped_disabled'
  | 'not_found'
  | 'verify_failed'
  | 'aborted'
  | 'error'

export interface FillOutcome {
  fieldId: string
  profileKey: ProfileKey
  status: FillStatus
  strategy: FillStrategy
  attempts: number
  /**
   * Read back off the live element AFTER the write, and compared against intent
   * before `filled` is recorded. LOCAL ONLY — stripped by toAuditPlan().
   */
  observed: string | null
  error: string | null
  elapsedMs: number
}

export interface FillResult {
  planId: string
  ats: AtsId
  frameKey: string
  startedAt: string
  finishedAt: string
  outcomes: FillOutcome[]
  filled: number
  failed: number
  skipped: number
  undoToken: string | null
}

// ---------------------------------------------------------------------------
// Adapter contract
// ---------------------------------------------------------------------------

export interface PageContext {
  href: string
  hostname: string
  pathname: string
  doc: Document
  isTopFrame: boolean
}

export interface SelectorRule {
  selector: string
  key: ProfileKey
  kind?: FieldKind
  /** Confidence that the SELECTOR hits the right element — not in the value. */
  confidence: number
  /** True ONLY after a live check recorded in adapters/VERIFICATION.md. */
  verified: boolean
  note?: string
}

export interface WizardState {
  stepId: string
  stepIndex: number | null
  totalSteps: number | null
  /** Selector for the control that advances the wizard. The engine NEVER clicks it. */
  advanceSelector: string | null
}

export interface WriteContext {
  signal: AbortSignal
  /** Resolves a file asset to raw bytes, via the background relay. */
  getFileBytes(assetId: string): Promise<{ bytes: Uint8Array; mimeType: string; fileName: string }>
  /** MAIN-world RPC. Rejects if the bridge was never injected. */
  mainWorld<TReq, TRes>(op: string, payload: TReq): Promise<TRes>
}

export interface AtsAdapter {
  readonly id: AtsId
  readonly confidence: AdapterConfidence
  matches(ctx: PageContext): boolean
  /** Root to scan. Narrowing this is the single biggest precision win. */
  formRoot(ctx: PageContext): Element | null
  readonly selectorMap: ReadonlyArray<SelectorRule>
  /** Classification for what selectorMap missed. null defers to the heuristic tier. */
  classify?(d: FieldDescriptor, el: Element): ProfileKey | null
  wizard?(ctx: PageContext): WizardState | null
  /** Selectors the executor must NEVER dispatch a click on. Enforced in clickSafe(). */
  readonly submitGuards: ReadonlyArray<string>
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export interface Resolution {
  key: ProfileKey
  confidence: number
  source: ResolutionSource
  rationale: string
  sensitivity: Sensitivity
  /** False means: push this descriptor onto FillPlanPublic.unresolved. */
  actionable: boolean
}
