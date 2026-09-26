/**
 * Web-app mirror of `AutofillProfile` from extension/src/shared/profile.ts
 * (the extension folder is excluded from this tsconfig, so the shape is
 * duplicated here — keep the two in sync; both sides run normalizeProfile,
 * so drift degrades to "missing field" rather than a crash).
 *
 * Stored whole on `users.autofill_profile` (jsonb) and consumed by the
 * browser extension's autofill engine. The Profile page is where the user
 * enters it: identity, contact, address, links and everything else a job
 * application tends to ask for.
 */

export interface WorkExperienceEntry {
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

  experience: WorkExperienceEntry[]
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

export const EMPTY_AUTOFILL_PROFILE: AutofillProfile = {
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
 * Coerce whatever came back from JSONB into a complete profile — same rules
 * as the extension's normalizeProfile: arrays replace wholesale, object
 * branches merge key-by-key, primitives never clobber branches.
 */
export function normalizeAutofillProfile(raw: unknown): AutofillProfile {
  if (!raw || typeof raw !== "object") return structuredClone(EMPTY_AUTOFILL_PROFILE)
  const input = raw as Record<string, unknown>
  const merged = structuredClone(EMPTY_AUTOFILL_PROFILE)

  for (const key of Object.keys(EMPTY_AUTOFILL_PROFILE) as Array<keyof AutofillProfile>) {
    if (key === "version") continue
    const incoming = input[key]
    if (incoming === undefined || incoming === null) continue

    const target = merged[key]

    if (Array.isArray(target)) {
      if (Array.isArray(incoming)) {
        ;(merged as unknown as Record<string, unknown>)[key] = incoming
      }
      continue
    }

    if (target && typeof target === "object") {
      if (typeof incoming === "object" && !Array.isArray(incoming)) {
        Object.assign(target, incoming)
      }
      continue
    }

    if (typeof incoming === "string" || typeof incoming === "number" || typeof incoming === "boolean") {
      ;(merged as unknown as Record<string, unknown>)[key] = incoming
    }
  }

  merged.version = 1
  return merged
}

/**
 * Fields the Profile form edits, flattened for the completion meter.
 * The meter counts the things a typical application actually asks for.
 */
export function countAutofillFields(profile: AutofillProfile): { filled: number; total: number } {
  const checks: Array<() => boolean> = [
    // Identity
    () => Boolean(profile.identity.firstName.trim()),
    () => Boolean(profile.identity.lastName.trim()),
    // Contact
    () => Boolean(profile.contact.phone.trim()),
    () => Boolean(profile.contact.addressLine1.trim()),
    () => Boolean(profile.contact.city.trim()),
    () => Boolean(profile.contact.postalCode.trim()),
    () => Boolean(profile.contact.country.trim()),
    // Links
    () => Boolean(profile.links.linkedin.trim()),
    () => Boolean(profile.links.github.trim()),
    () => Boolean(profile.links.portfolio.trim() || profile.links.website.trim()),
    // Work
    () => Boolean(profile.work.currentCompany.trim()),
    () => Boolean(profile.work.currentTitle.trim()),
    () => Boolean(profile.work.yearsExperience.trim()),
    () => Boolean(profile.work.availableStartDate.trim()),
    () => Boolean(profile.work.desiredSalary.trim()),
    // Eligibility
    () => Boolean(profile.eligibility.workAuthorization.trim()),
    () => profile.eligibility.requiresSponsorship !== null,
    () => profile.eligibility.willingToRelocate !== null,
    () => profile.eligibility.isOver18 !== null,
    // Education
    () => Boolean(profile.education.school.trim()),
    () => Boolean(profile.education.degree.trim()),
    () => Boolean(profile.education.graduationYear.trim()),
  ]
  const filled = checks.filter((check) => check()).length
  return { filled, total: checks.length }
}
