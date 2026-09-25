import type { CanonicalFieldId } from "./fields"

/**
 * The data autofill fills with.
 *
 * Lives in the web app (`users.autofill_profile`) as the source of truth so it
 * syncs across devices, with an extension-local override layer for one-off
 * answers that only make sense on this machine.
 */

export interface WorkExperience {
  id: string
  company: string
  title: string
  location?: string
  /** ISO `YYYY-MM`. */
  startDate?: string
  /** ISO `YYYY-MM`, or empty while this is the current role. */
  endDate?: string
  current?: boolean
  description?: string
}

export interface EducationEntry {
  id: string
  school: string
  degree?: string
  fieldOfStudy?: string
  startYear?: string
  endYear?: string
  gpa?: string
}

/** A remembered question → answer pair, for the questions that repeat. */
export interface ScreeningAnswer {
  id: string
  question: string
  answer: string
  /** Set when the answer is a "yes"/"no" style choice. */
  category?: string
  updatedAt: string
}

export interface AutofillProfile {
  version: 1

  identity: {
    firstName: string
    middleName: string
    lastName: string
    preferredName: string
    pronouns: string
  }

  contact: {
    email: string
    phone: string
    /** E.164 country code without the plus, e.g. "1", "44", "234". */
    phoneCountryCode: string
    addressLine1: string
    addressLine2: string
    city: string
    state: string
    postalCode: string
    country: string
  }

  links: {
    linkedin: string
    github: string
    portfolio: string
    website: string
    twitter: string
  }

  work: {
    currentCompany: string
    currentTitle: string
    /** Free text so "5+" and "10 years" both work. */
    yearsExperience: string
    monthsExperience: string
    noticePeriod: string
    availableStartDate: string
    desiredSalary: string
    salaryCurrency: string
    currentSalary: string
  }

  eligibility: {
    workAuthorization: string
    /** `null` = never answered, so we ask rather than guess. */
    requiresSponsorship: boolean | null
    willingToRelocate: boolean | null
    isOver18: boolean | null
    backgroundCheckConsent: boolean | null
    securityClearance: string
    nonCompete: boolean | null
  }

  education: {
    school: string
    degree: string
    fieldOfStudy: string
    graduationYear: string
    gpa: string
    educationLevel: string
  }

  /** Demographics. Only ever filled when the user opts in. */
  eeo: {
    gender: string
    race: string
    hispanicLatino: string
    veteranStatus: string
    disabilityStatus: string
    genderIdentity: string
    sexualOrientation: string
  }

  openEnded: {
    coverLetterText: string
    whyCompany: string
    whyRole: string
    additionalInfo: string
    salaryExpectationText: string
    howDidYouHear: string
    referralName: string
    previousEmployee: string
    previousApplicant: string
  }

  experience: WorkExperience[]
  educationHistory: EducationEntry[]
  skills: string
  certifications: string
  languages: string

  /** Locally-remembered answers, synced up as they accumulate. */
  screening: ScreeningAnswer[]

  /** Vault document ids to attach. `null` = nothing chosen yet. */
  resumeDocumentId: string | null
  coverLetterDocumentId: string | null
}

export const EMPTY_PROFILE: AutofillProfile = {
  version: 1,
  identity: { firstName: "", middleName: "", lastName: "", preferredName: "", pronouns: "" },
  contact: {
    email: "",
    phone: "",
    phoneCountryCode: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  },
  links: { linkedin: "", github: "", portfolio: "", website: "", twitter: "" },
  work: {
    currentCompany: "",
    currentTitle: "",
    yearsExperience: "",
    monthsExperience: "",
    noticePeriod: "",
    availableStartDate: "",
    desiredSalary: "",
    salaryCurrency: "",
    currentSalary: "",
  },
  eligibility: {
    workAuthorization: "",
    requiresSponsorship: null,
    willingToRelocate: null,
    isOver18: null,
    backgroundCheckConsent: null,
    securityClearance: "",
    nonCompete: null,
  },
  education: { school: "", degree: "", fieldOfStudy: "", graduationYear: "", gpa: "", educationLevel: "" },
  eeo: {
    gender: "",
    race: "",
    hispanicLatino: "",
    veteranStatus: "",
    disabilityStatus: "",
    genderIdentity: "",
    sexualOrientation: "",
  },
  openEnded: {
    coverLetterText: "",
    whyCompany: "",
    whyRole: "",
    additionalInfo: "",
    salaryExpectationText: "",
    howDidYouHear: "",
    referralName: "",
    previousEmployee: "",
    previousApplicant: "",
  },
  experience: [],
  educationHistory: [],
  skills: "",
  certifications: "",
  languages: "",
  screening: [],
  resumeDocumentId: null,
  coverLetterDocumentId: null,
}

/**
 * Coerce whatever came back from JSON into a complete profile.
 *
 * Profile data survives a round trip through Postgres `jsonb` and through
 * `chrome.storage`, so it can be partial, stale, or hand-edited. Filling the
 * gaps here means no caller ever has to null-check a nested branch.
 */
export function normalizeProfile(raw: unknown): AutofillProfile {
  if (!raw || typeof raw !== "object") return structuredClone(EMPTY_PROFILE)
  const input = raw as Record<string, unknown>

  const merged = structuredClone(EMPTY_PROFILE)

  for (const key of Object.keys(EMPTY_PROFILE) as Array<keyof AutofillProfile>) {
    if (key === "version") continue
    const incoming = (input as Record<string, unknown>)[key]
    if (incoming === undefined || incoming === null) continue

    const target = merged[key]

    // Arrays replace wholesale, but only with arrays.
    if (Array.isArray(target)) {
      if (Array.isArray(incoming)) (merged as unknown as Record<string, unknown>)[key] = incoming
      continue
    }

    // Object branches merge key-by-key, and a primitive must never be allowed
    // to overwrite one — corrupt storage would otherwise break every reader.
    if (target && typeof target === "object") {
      if (typeof incoming === "object" && !Array.isArray(incoming)) {
        Object.assign(target, incoming)
      }
      continue
    }

    // Plain values (the document ids, the version).
    if (typeof incoming === "string" || typeof incoming === "number" || typeof incoming === "boolean") {
      ;(merged as unknown as Record<string, unknown>)[key] = incoming
    }
  }

  merged.version = 1
  return merged
}

// ────────────────────────────────────────────────────────────────────────────
// Resolution: canonical field id → the answer to put in that field
// ────────────────────────────────────────────────────────────────────────────

/**
 * An answer before it meets a control. Booleans stay booleans so the filler can
 * turn them into whatever the form's own vocabulary is ("Yes", "Y", "True",
 * "I am authorized…") rather than us guessing the string here.
 */
export type ResolvedAnswer =
  | { type: "text"; value: string }
  | { type: "boolean"; value: boolean }

const text = (value: unknown): ResolvedAnswer | null => {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed ? { type: "text", value: trimmed } : null
}

const bool = (value: boolean | null): ResolvedAnswer | null =>
  value === null || value === undefined ? null : { type: "boolean", value }

/**
 * Build the human-readable location forms expect.
 *
 * Prefers "City, State" (what US forms want), falls back to "City, Country"
 * (what the rest of the world wants), then to whichever single part exists.
 */
function joinLocation(city: string, state: string, country: string): string {
  const trim = (value: string) => value.trim()
  const [c, s, n] = [trim(city), trim(state), trim(country)]

  if (c && s) return `${c}, ${s}`
  if (c && n) return `${c}, ${n}`
  if (c) return c
  if (s && n) return `${s}, ${n}`
  return s || n
}

/**
 * Where each canonical field's value comes from. Typed as a total map, so
 * adding a field to the registry without teaching the resolver about it is a
 * compile error rather than a silently-unfilled question.
 */
export const PROFILE_RESOLVERS: {
  [K in CanonicalFieldId]: (profile: AutofillProfile) => ResolvedAnswer | null
} = {
  // identity
  firstName: (p) => text(p.identity.firstName),
  middleName: (p) => text(p.identity.middleName),
  lastName: (p) => text(p.identity.lastName),
  fullName: (p) => {
    const full = [p.identity.firstName, p.identity.middleName, p.identity.lastName]
      .map((n) => n.trim())
      .filter(Boolean)
      .join(" ")
    return text(full)
  },
  preferredName: (p) => text(p.identity.preferredName),
  pronouns: (p) => text(p.identity.pronouns),

  // contact
  email: (p) => text(p.contact.email),
  confirmEmail: (p) => text(p.contact.email),
  phone: (p) => text(p.contact.phone),
  phoneType: () => null,
  addressLine1: (p) => text(p.contact.addressLine1),
  addressLine2: (p) => text(p.contact.addressLine2),
  city: (p) => text(p.contact.city),
  state: (p) => text(p.contact.state),
  postalCode: (p) => text(p.contact.postalCode),
  country: (p) => text(p.contact.country),
  location: (p) => text(joinLocation(p.contact.city, p.contact.state, p.contact.country)),

  // links — profiles often store a bare handle; make it a real URL.
  linkedinUrl: (p) => text(asUrl(p.links.linkedin, "linkedin.com/in")),
  githubUrl: (p) => text(asUrl(p.links.github, "github.com")),
  portfolioUrl: (p) => text(asUrl(p.links.portfolio)),
  websiteUrl: (p) => text(asUrl(p.links.website)),
  twitterUrl: (p) => text(asUrl(p.links.twitter, "x.com")),

  // work
  currentCompany: (p) => text(p.work.currentCompany),
  currentTitle: (p) => text(p.work.currentTitle),
  yearsExperience: (p) => text(p.work.yearsExperience),
  monthsExperience: (p) => text(p.work.monthsExperience),
  noticePeriod: (p) => text(p.work.noticePeriod),
  availableStartDate: (p) => text(p.work.availableStartDate),
  desiredSalary: (p) => text(p.work.desiredSalary),
  salaryCurrency: (p) => text(p.work.salaryCurrency),
  currentSalary: (p) => text(p.work.currentSalary),

  // eligibility
  workAuthorization: (p) => text(p.eligibility.workAuthorization),
  requiresSponsorship: (p) => bool(p.eligibility.requiresSponsorship),
  willingToRelocate: (p) => bool(p.eligibility.willingToRelocate),
  isOver18: (p) => bool(p.eligibility.isOver18),
  backgroundCheckConsent: (p) => bool(p.eligibility.backgroundCheckConsent),
  securityClearance: (p) => text(p.eligibility.securityClearance),
  nonCompete: (p) => bool(p.eligibility.nonCompete),

  // education
  school: (p) => text(p.education.school),
  degree: (p) => text(p.education.degree),
  fieldOfStudy: (p) => text(p.education.fieldOfStudy),
  graduationYear: (p) => text(p.education.graduationYear),
  gpa: (p) => text(p.education.gpa),
  educationLevel: (p) => text(p.education.educationLevel),

  // documents — resolved by the vault layer, not by a string value.
  resumeFile: () => null,
  coverLetterFile: () => null,

  // open-ended
  coverLetterText: (p) => text(p.openEnded.coverLetterText),
  whyCompany: (p) => text(p.openEnded.whyCompany),
  whyRole: (p) => text(p.openEnded.whyRole),
  additionalInfo: (p) => text(p.openEnded.additionalInfo),
  salaryExpectationText: (p) => text(p.openEnded.salaryExpectationText),
  skillsSummary: (p) => text(p.skills),
  languages: (p) => text(p.languages),
  certifications: (p) => text(p.certifications),

  // equal opportunity
  gender: (p) => text(p.eeo.gender),
  race: (p) => text(p.eeo.race),
  hispanicLatino: (p) => text(p.eeo.hispanicLatino),
  veteranStatus: (p) => text(p.eeo.veteranStatus),
  disabilityStatus: (p) => text(p.eeo.disabilityStatus),

  // attribution
  howDidYouHear: (p) => text(p.openEnded.howDidYouHear),
  referralName: (p) => text(p.openEnded.referralName),
  previousEmployee: (p) => text(p.openEnded.previousEmployee),
  previousApplicant: (p) => text(p.openEnded.previousApplicant),
}

/**
 * Accept `github.com/me`, `me`, `in/me`, or a full URL and return a usable URL.
 *
 * Profiles store handles in whatever form the user typed them, so the hint may
 * carry a path ("linkedin.com/in") that the value repeats ("in/ada") — that
 * must not become "/in/in/ada".
 */
function asUrl(value: string, domainHint?: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  const looksLikeDomain = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(trimmed) || trimmed.startsWith("www.")
  if (looksLikeDomain) return `https://${trimmed}`

  if (domainHint) {
    const [host, ...pathParts] = domainHint.split("/")
    const basePath = pathParts.join("/")
    const handle = trimmed.replace(/^\/+/, "")
    if (basePath && (handle === basePath || handle.startsWith(`${basePath}/`))) {
      return `https://${host}/${handle}`
    }
    return `https://${host}${basePath ? `/${basePath}` : ""}/${handle}`
  }

  return `https://${trimmed}`
}

export function resolveAnswer(
  fieldId: CanonicalFieldId,
  profile: AutofillProfile
): ResolvedAnswer | null {
  return PROFILE_RESOLVERS[fieldId]?.(profile) ?? null
}

// ────────────────────────────────────────────────────────────────────────────
// Extension-local overrides
// ────────────────────────────────────────────────────────────────────────────

/**
 * Answers that only apply on this machine — a different phone number for local
 * recruiters, an agency-specific salary figure. Layered on top of the synced
 * profile at fill time.
 */
export interface LocalOverrides {
  fields: Partial<Record<CanonicalFieldId, string>>
  /** Questions the user answered locally; merged into the answer library. */
  screening: ScreeningAnswer[]
}

export const EMPTY_OVERRIDES: LocalOverrides = { fields: {}, screening: [] }

export function normalizeOverrides(raw: unknown): LocalOverrides {
  if (!raw || typeof raw !== "object") return structuredClone(EMPTY_OVERRIDES)
  const input = raw as Partial<LocalOverrides>
  return {
    fields: typeof input.fields === "object" && input.fields !== null ? input.fields : {},
    screening: Array.isArray(input.screening) ? input.screening : [],
  }
}

export function applyOverrides(profile: AutofillProfile, overrides: LocalOverrides): AutofillProfile {
  const next = structuredClone(profile)
  for (const [key, value] of Object.entries(overrides.fields)) {
    if (typeof value !== "string" || !value.trim()) continue
    setFieldValue(next, key as CanonicalFieldId, value)
  }
  if (overrides.screening.length) {
    next.screening = mergeScreening(next.screening, overrides.screening)
  }
  return next
}

/** Write a plain string into the profile's nested shape by canonical id. */
function setFieldValue(profile: AutofillProfile, fieldId: CanonicalFieldId, value: string) {
  const write: Record<string, readonly [group: string, key?: string]> = {
    firstName: ["identity", "firstName"],
    middleName: ["identity", "middleName"],
    lastName: ["identity", "lastName"],
    preferredName: ["identity", "preferredName"],
    pronouns: ["identity", "pronouns"],
    email: ["contact", "email"],
    phone: ["contact", "phone"],
    addressLine1: ["contact", "addressLine1"],
    addressLine2: ["contact", "addressLine2"],
    city: ["contact", "city"],
    state: ["contact", "state"],
    postalCode: ["contact", "postalCode"],
    country: ["contact", "country"],
    linkedinUrl: ["links", "linkedin"],
    githubUrl: ["links", "github"],
    portfolioUrl: ["links", "portfolio"],
    websiteUrl: ["links", "website"],
    twitterUrl: ["links", "twitter"],
    currentCompany: ["work", "currentCompany"],
    currentTitle: ["work", "currentTitle"],
    yearsExperience: ["work", "yearsExperience"],
    monthsExperience: ["work", "monthsExperience"],
    noticePeriod: ["work", "noticePeriod"],
    availableStartDate: ["work", "availableStartDate"],
    desiredSalary: ["work", "desiredSalary"],
    salaryCurrency: ["work", "salaryCurrency"],
    currentSalary: ["work", "currentSalary"],
    workAuthorization: ["eligibility", "workAuthorization"],
    securityClearance: ["eligibility", "securityClearance"],
    school: ["education", "school"],
    degree: ["education", "degree"],
    fieldOfStudy: ["education", "fieldOfStudy"],
    graduationYear: ["education", "graduationYear"],
    gpa: ["education", "gpa"],
    educationLevel: ["education", "educationLevel"],
    coverLetterText: ["openEnded", "coverLetterText"],
    whyCompany: ["openEnded", "whyCompany"],
    whyRole: ["openEnded", "whyRole"],
    additionalInfo: ["openEnded", "additionalInfo"],
    salaryExpectationText: ["openEnded", "salaryExpectationText"],
    howDidYouHear: ["openEnded", "howDidYouHear"],
    referralName: ["openEnded", "referralName"],
    previousEmployee: ["openEnded", "previousEmployee"],
    previousApplicant: ["openEnded", "previousApplicant"],
    skillsSummary: ["skills"],
    languages: ["languages"],
    certifications: ["certifications"],
    gender: ["eeo", "gender"],
    race: ["eeo", "race"],
    hispanicLatino: ["eeo", "hispanicLatino"],
    veteranStatus: ["eeo", "veteranStatus"],
    disabilityStatus: ["eeo", "disabilityStatus"],
  }

  const target = write[fieldId]
  if (!target) return

  const [group, key] = target

  // Top-level string fields (skills, languages, certifications) have no branch.
  if (key === undefined) {
    ;(profile as unknown as Record<string, string>)[group] = value
    return
  }

  const container = profile[group as keyof AutofillProfile] as unknown as Record<string, string>
  if (container && typeof container === "object") container[key] = value
}

/** Merge two answer lists, newest answer wins per normalised question. */
export function mergeScreening(a: ScreeningAnswer[], b: ScreeningAnswer[]): ScreeningAnswer[] {
  const key = (q: string) => q.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  const map = new Map<string, ScreeningAnswer>()
  for (const answer of [...a, ...b]) {
    if (!answer?.question) continue
    map.set(key(answer.question), answer)
  }
  return [...map.values()]
}

// ────────────────────────────────────────────────────────────────────────────
// Completeness — drives the "profile strength" meter in the popup
// ────────────────────────────────────────────────────────────────────────────

/**
 * The fields that actually matter for filling the majority of forms. Weighted
 * by what shows up in real applications: every form asks for contact details,
 * many ask about eligibility, few ask for your GPA.
 */
const CORE_FIELD_WEIGHTS: Partial<Record<CanonicalFieldId, number>> = {
  firstName: 3,
  lastName: 3,
  email: 3,
  phone: 3,
  location: 2,
  city: 1,
  country: 1,
  linkedinUrl: 1,
  currentTitle: 2,
  currentCompany: 2,
  yearsExperience: 2,
  workAuthorization: 2,
  requiresSponsorship: 1,
  educationLevel: 1,
  school: 1,
  skillsSummary: 1,
  desiredSalary: 1,
  howDidYouHear: 1,
}

export interface ProfileCompleteness {
  percent: number
  filledWeight: number
  totalWeight: number
  missing: CanonicalFieldId[]
}

export function profileCompleteness(profile: AutofillProfile): ProfileCompleteness {
  const entries = Object.entries(CORE_FIELD_WEIGHTS) as Array<[CanonicalFieldId, number]>
  let filledWeight = 0
  let totalWeight = 0
  const missing: CanonicalFieldId[] = []

  for (const [fieldId, weight] of entries) {
    totalWeight += weight
    const answer = resolveAnswer(fieldId, profile)
    if (answer) filledWeight += weight
    else missing.push(fieldId)
  }

  return {
    percent: totalWeight === 0 ? 0 : Math.round((filledWeight / totalWeight) * 100),
    filledWeight,
    totalWeight,
    missing,
  }
}

/**
 * Seed the parts of a profile we can derive from the account itself, so a new
 * user never starts at zero.
 */
export function seedFromUser(
  profile: AutofillProfile,
  user: { email?: string | null; name?: string | null } | null
): AutofillProfile {
  if (!user) return profile
  const next = structuredClone(profile)

  if (!next.contact.email && user.email) next.contact.email = user.email

  if (user.name?.trim()) {
    const parts = user.name.trim().split(/\s+/)
    if (!next.identity.firstName && parts.length > 0) next.identity.firstName = parts[0]
    if (!next.identity.lastName && parts.length > 1) next.identity.lastName = parts[parts.length - 1]
  }

  return next
}

/** A person's name split the way forms want it. */
export function splitName(fullName: string): { firstName: string; lastName: string; middleName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: "", lastName: "", middleName: "" }
  if (parts.length === 1) return { firstName: parts[0], lastName: "", middleName: "" }
  return {
    firstName: parts[0],
    lastName: parts[parts.length - 1],
    middleName: parts.slice(1, -1).join(" "),
  }
}
