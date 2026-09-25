/**
 * Canonical field registry — the heart of autofill.
 *
 * Every job application form, on every ATS, is asking one of a finite set of
 * questions. This registry names those questions once, and gives each one the
 * vocabulary that real forms use to ask it.
 *
 * Two rules keep this honest:
 *  1. Matching is deterministic first. The `autocomplete` token (an HTML
 *     standard) beats any heuristic, so it is consulted before aliases.
 *  2. Nothing here is filled speculatively. A field only gets a value when we
 *     are confident which question is being asked — see matcher.ts.
 */

export type FieldCategory =
  | "identity"
  | "contact"
  | "links"
  | "work"
  | "eligibility"
  | "education"
  | "documents"
  | "open-ended"
  | "equal-opportunity"
  | "attribution"

/** The HTML `<input>` shapes a canonical field can land on. */
export type FieldKind =
  | "text"
  | "email"
  | "tel"
  | "url"
  | "date"
  | "number"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox"
  | "file"

export type CanonicalFieldId =
  // ── identity ────────────────────────────────────────────────────────────
  | "firstName"
  | "middleName"
  | "lastName"
  | "fullName"
  | "preferredName"
  | "pronouns"
  // ── contact ─────────────────────────────────────────────────────────────
  | "email"
  | "confirmEmail"
  | "phone"
  | "phoneType"
  | "addressLine1"
  | "addressLine2"
  | "city"
  | "state"
  | "postalCode"
  | "country"
  | "location"
  // ── links ───────────────────────────────────────────────────────────────
  | "linkedinUrl"
  | "githubUrl"
  | "portfolioUrl"
  | "websiteUrl"
  | "twitterUrl"
  // ── work ────────────────────────────────────────────────────────────────
  | "currentCompany"
  | "currentTitle"
  | "yearsExperience"
  | "monthsExperience"
  | "noticePeriod"
  | "availableStartDate"
  | "desiredSalary"
  | "salaryCurrency"
  | "currentSalary"
  // ── eligibility ─────────────────────────────────────────────────────────
  | "workAuthorization"
  | "requiresSponsorship"
  | "willingToRelocate"
  | "isOver18"
  | "backgroundCheckConsent"
  | "securityClearance"
  | "nonCompete"
  // ── education ───────────────────────────────────────────────────────────
  | "school"
  | "degree"
  | "fieldOfStudy"
  | "graduationYear"
  | "gpa"
  | "educationLevel"
  // ── documents ───────────────────────────────────────────────────────────
  | "resumeFile"
  | "coverLetterFile"
  // ── open-ended ──────────────────────────────────────────────────────────
  | "coverLetterText"
  | "whyCompany"
  | "whyRole"
  | "additionalInfo"
  | "salaryExpectationText"
  | "skillsSummary"
  | "languages"
  | "certifications"
  // ── equal opportunity (opt-in only) ─────────────────────────────────────
  | "gender"
  | "race"
  | "hispanicLatino"
  | "veteranStatus"
  | "disabilityStatus"
  // ── attribution ─────────────────────────────────────────────────────────
  | "howDidYouHear"
  | "referralName"
  | "previousEmployee"
  | "previousApplicant"

export interface CanonicalField {
  id: CanonicalFieldId
  /** Human label, used in the review table and in settings. */
  label: string
  category: FieldCategory
  /**
   * Values of the HTML `autocomplete` attribute that identify this field.
   * Standardised and stable — when present they should win outright.
   * @see https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill
   */
  autocomplete: string[]
  /**
   * Lowercase phrases a form might use in a label, `name`, `id`, aria-label,
   * or placeholder. Longer entries score higher than short ones, so put the
   * most specific phrasings first.
   */
  aliases: string[]
  /** Input shapes this field is allowed to fill. */
  kinds: FieldKind[]
  /**
   * Demographic / EEO questions. Never filled unless the user explicitly opts
   * in — on many ATS platforms these are voluntary and answering wrongly is
   * worse than leaving blank.
   */
  sensitive?: boolean
  /** Wording shown in the review table when the field could not be filled. */
  hint?: string
}

/**
 * The registry. Order matters only for review-table grouping.
 */
export const CANONICAL_FIELDS: CanonicalField[] = [
  // ── identity ────────────────────────────────────────────────────────────
  {
    id: "firstName",
    label: "First name",
    category: "identity",
    autocomplete: ["given-name"],
    aliases: ["first name", "given name", "forename", "firstname", "legal first name", "first"],
    kinds: ["text"],
  },
  {
    id: "middleName",
    label: "Middle name",
    category: "identity",
    autocomplete: ["additional-name"],
    aliases: ["middle name", "middlename", "middle initial", "middle"],
    kinds: ["text"],
  },
  {
    id: "lastName",
    label: "Last name",
    category: "identity",
    autocomplete: ["family-name"],
    aliases: ["last name", "family name", "surname", "lastname", "legal last name", "last"],
    kinds: ["text"],
  },
  {
    id: "fullName",
    label: "Full name",
    category: "identity",
    autocomplete: ["name"],
    aliases: ["full name", "your name", "legal name", "name of applicant", "applicant name", "candidate name", "name"],
    kinds: ["text"],
  },
  {
    id: "preferredName",
    label: "Preferred name",
    category: "identity",
    autocomplete: ["nickname"],
    aliases: ["preferred name", "nickname", "name you go by", "display name", "chosen name"],
    kinds: ["text"],
  },
  {
    id: "pronouns",
    label: "Pronouns",
    category: "identity",
    autocomplete: [],
    aliases: ["pronouns", "preferred pronouns", "gender pronouns"],
    kinds: ["text", "select"],
  },

  // ── contact ─────────────────────────────────────────────────────────────
  {
    id: "email",
    label: "Email",
    category: "contact",
    autocomplete: ["email"],
    aliases: ["email", "email address", "e-mail", "mail address", "contact email", "personal email"],
    kinds: ["email", "text"],
  },
  {
    id: "confirmEmail",
    label: "Confirm email",
    category: "contact",
    autocomplete: [],
    aliases: ["confirm email", "re-enter email", "retype email", "verify email", "email confirmation", "repeat email"],
    kinds: ["email", "text"],
  },
  {
    id: "phone",
    label: "Phone",
    category: "contact",
    autocomplete: ["tel", "tel-national"],
    aliases: [
      "phone",
      "phone number",
      "mobile",
      "mobile number",
      "cell",
      "cell phone",
      "telephone",
      "contact number",
      "daytime phone",
      "primary phone",
    ],
    kinds: ["tel", "text", "number"],
  },
  {
    id: "phoneType",
    label: "Phone type",
    category: "contact",
    autocomplete: [],
    aliases: ["phone type", "phone device type", "type of phone", "device type"],
    kinds: ["select", "radio"],
  },
  {
    id: "addressLine1",
    label: "Address",
    category: "contact",
    autocomplete: ["address-line1", "street-address"],
    aliases: ["address", "street address", "address line 1", "address 1", "street", "mailing address", "home address"],
    kinds: ["text"],
  },
  {
    id: "addressLine2",
    label: "Address line 2",
    category: "contact",
    autocomplete: ["address-line2"],
    aliases: ["address line 2", "address 2", "apartment", "apt", "suite", "unit", "floor", "building"],
    kinds: ["text"],
  },
  {
    id: "city",
    label: "City",
    category: "contact",
    autocomplete: ["address-level2"],
    aliases: ["city", "town", "city of residence", "municipality", "locality", "address locality"],
    kinds: ["text"],
  },
  {
    id: "state",
    label: "State / Province",
    category: "contact",
    autocomplete: ["address-level1"],
    aliases: ["state", "province", "region", "county", "state or province", "address region", "territory"],
    kinds: ["text", "select"],
  },
  {
    id: "postalCode",
    label: "Postal code",
    category: "contact",
    autocomplete: ["postal-code"],
    aliases: ["zip", "zip code", "postal code", "postcode", "post code", "postal"],
    kinds: ["text", "number"],
  },
  {
    id: "country",
    label: "Country",
    category: "contact",
    autocomplete: ["country", "country-name"],
    aliases: ["country", "country of residence", "nation", "country or region"],
    kinds: ["text", "select"],
  },
  {
    id: "location",
    label: "Location",
    category: "contact",
    autocomplete: [],
    aliases: [
      "location",
      "current location",
      "where are you located",
      "where do you live",
      "city and state",
      "location city",
      "country of residence",
      "place of residence",
    ],
    kinds: ["text"],
  },

  // ── links ───────────────────────────────────────────────────────────────
  {
    id: "linkedinUrl",
    label: "LinkedIn",
    category: "links",
    autocomplete: [],
    aliases: ["linkedin", "linkedin profile", "linkedin url", "linkedin profile url", "linked in"],
    kinds: ["url", "text"],
  },
  {
    id: "githubUrl",
    label: "GitHub",
    category: "links",
    autocomplete: [],
    aliases: ["github", "github profile", "github url", "github username", "git hub"],
    kinds: ["url", "text"],
  },
  {
    id: "portfolioUrl",
    label: "Portfolio",
    category: "links",
    autocomplete: [],
    aliases: ["portfolio", "portfolio url", "portfolio link", "personal site", "work samples", "portfolio or website"],
    kinds: ["url", "text"],
  },
  {
    id: "websiteUrl",
    label: "Website",
    category: "links",
    autocomplete: ["url"],
    aliases: ["website", "personal website", "website url", "blog", "personal url", "homepage", "web page"],
    kinds: ["url", "text"],
  },
  {
    id: "twitterUrl",
    label: "X / Twitter",
    category: "links",
    autocomplete: [],
    aliases: ["twitter", "x profile", "twitter url", "twitter handle", "x handle", "social media"],
    kinds: ["url", "text"],
  },

  // ── work ────────────────────────────────────────────────────────────────
  {
    id: "currentCompany",
    label: "Current company",
    category: "work",
    autocomplete: ["organization"],
    aliases: [
      "current company",
      "current employer",
      "company",
      "employer",
      "present employer",
      "most recent employer",
      "employer name",
      "company name",
    ],
    kinds: ["text"],
  },
  {
    id: "currentTitle",
    label: "Current title",
    category: "work",
    autocomplete: ["organization-title"],
    aliases: [
      "current job title",
      "current title",
      "job title",
      "position",
      "current position",
      "title",
      "role",
      "current role",
      "designation",
      "most recent job title",
    ],
    kinds: ["text"],
  },
  {
    id: "yearsExperience",
    label: "Years of experience",
    category: "work",
    autocomplete: [],
    aliases: [
      "years of experience",
      "years experience",
      "total experience",
      "years of relevant experience",
      "how many years of experience",
      "experience in years",
      "relevant experience",
      "years working",
    ],
    kinds: ["text", "number", "select"],
  },
  {
    id: "monthsExperience",
    label: "Months of experience",
    category: "work",
    autocomplete: [],
    aliases: ["months of experience", "months experience", "experience in months"],
    kinds: ["text", "number"],
  },
  {
    id: "noticePeriod",
    label: "Notice period",
    category: "work",
    autocomplete: [],
    aliases: ["notice period", "notice", "availability to start", "how much notice", "time to start", "earliest start"],
    kinds: ["text", "select"],
  },
  {
    id: "availableStartDate",
    label: "Available start date",
    category: "work",
    autocomplete: [],
    aliases: [
      "available start date",
      "start date",
      "date available",
      "when can you start",
      "available from",
      "earliest start date",
      "availability date",
    ],
    kinds: ["date", "text"],
  },
  {
    id: "desiredSalary",
    label: "Desired salary",
    category: "work",
    autocomplete: [],
    aliases: [
      "desired salary",
      "expected salary",
      "salary expectation",
      "salary expectations",
      "expected compensation",
      "compensation expectation",
      "desired compensation",
      "salary requirement",
      "target salary",
      "expected pay",
    ],
    kinds: ["text", "number", "select"],
  },
  {
    id: "salaryCurrency",
    label: "Salary currency",
    category: "work",
    autocomplete: [],
    aliases: ["salary currency", "currency", "currency of salary", "pay currency"],
    kinds: ["select", "text"],
  },
  {
    id: "currentSalary",
    label: "Current salary",
    category: "work",
    autocomplete: [],
    aliases: ["current salary", "present salary", "current compensation", "current pay", "current ctc"],
    kinds: ["text", "number"],
  },

  // ── eligibility ─────────────────────────────────────────────────────────
  {
    id: "workAuthorization",
    label: "Work authorization",
    category: "eligibility",
    autocomplete: [],
    aliases: [
      "work authorization",
      "authorized to work",
      "legally authorized to work",
      "right to work",
      "work permit",
      "eligible to work",
      "employment eligibility",
      "visa status",
      "immigration status",
      "work eligibility",
    ],
    kinds: ["select", "radio", "text"],
    hint: "The form asks about your legal right to work in this country.",
  },
  {
    id: "requiresSponsorship",
    label: "Requires sponsorship",
    category: "eligibility",
    autocomplete: [],
    aliases: [
      "require sponsorship",
      "requires sponsorship",
      "need sponsorship",
      "visa sponsorship",
      "sponsorship required",
      "require visa sponsorship",
      "will you now or in the future require sponsorship",
      "immigration sponsorship",
    ],
    kinds: ["radio", "select", "checkbox"],
    hint: "The form asks whether you need visa sponsorship.",
  },
  {
    id: "willingToRelocate",
    label: "Willing to relocate",
    category: "eligibility",
    autocomplete: [],
    aliases: [
      "willing to relocate",
      "open to relocation",
      "relocation",
      "able to relocate",
      "willingness to relocate",
      "open to moving",
    ],
    kinds: ["radio", "select", "checkbox"],
  },
  {
    id: "isOver18",
    label: "Age 18 or over",
    category: "eligibility",
    autocomplete: [],
    aliases: ["over 18", "18 years of age", "at least 18", "legal age", "age requirement", "18 or older"],
    kinds: ["radio", "select", "checkbox"],
  },
  {
    id: "backgroundCheckConsent",
    label: "Background check consent",
    category: "eligibility",
    autocomplete: [],
    aliases: [
      "background check",
      "consent to background check",
      "willing to undergo a background check",
      "criminal background check",
      "background screening",
    ],
    kinds: ["radio", "checkbox", "select"],
  },
  {
    id: "securityClearance",
    label: "Security clearance",
    category: "eligibility",
    autocomplete: [],
    aliases: ["security clearance", "clearance level", "do you hold a clearance", "active clearance"],
    kinds: ["select", "radio", "text"],
  },
  {
    id: "nonCompete",
    label: "Non-compete agreement",
    category: "eligibility",
    autocomplete: [],
    aliases: ["non compete", "non-compete agreement", "restrictive covenant", "noncompete"],
    kinds: ["radio", "select", "checkbox"],
  },

  // ── education ───────────────────────────────────────────────────────────
  {
    id: "school",
    label: "School",
    category: "education",
    autocomplete: [],
    aliases: [
      "school",
      "school name",
      "university",
      "university name",
      "college",
      "college name",
      "institution",
      "educational institution",
      "alma mater",
    ],
    kinds: ["text", "select"],
  },
  {
    id: "degree",
    label: "Degree",
    category: "education",
    autocomplete: [],
    aliases: ["degree", "degree type", "degree obtained", "qualification", "level of degree", "diploma"],
    kinds: ["text", "select"],
  },
  {
    id: "fieldOfStudy",
    label: "Field of study",
    category: "education",
    autocomplete: [],
    aliases: ["field of study", "major", "discipline", "area of study", "concentration", "subject", "specialization"],
    kinds: ["text", "select"],
  },
  {
    id: "graduationYear",
    label: "Graduation year",
    category: "education",
    autocomplete: [],
    aliases: ["graduation year", "year of graduation", "graduated", "completion year", "year graduated", "end year"],
    kinds: ["select", "text", "number", "date"],
  },
  {
    id: "gpa",
    label: "GPA",
    category: "education",
    autocomplete: [],
    aliases: ["gpa", "grade point average", "grade average", "cgpa", "final grade"],
    kinds: ["text", "number"],
  },
  {
    id: "educationLevel",
    label: "Highest education",
    category: "education",
    autocomplete: [],
    aliases: [
      "highest education",
      "highest level of education",
      "education level",
      "highest degree",
      "highest qualification",
      "level of education",
      "degree level",
    ],
    kinds: ["select", "radio", "text"],
  },

  // ── documents ───────────────────────────────────────────────────────────
  {
    id: "resumeFile",
    label: "Resume",
    category: "documents",
    autocomplete: [],
    aliases: ["resume", "resume cv", "cv", "upload resume", "attach resume", "resume attachment", "curriculum vitae", "upload cv"],
    kinds: ["file"],
    hint: "Browsers block scripts from attaching files. Click the field and pick the file — ApplyOS highlights where it goes.",
  },
  {
    id: "coverLetterFile",
    label: "Cover letter",
    category: "documents",
    autocomplete: [],
    aliases: ["cover letter", "covering letter", "upload cover letter", "attach cover letter", "motivation letter"],
    kinds: ["file"],
    hint: "Browsers block scripts from attaching files. Click the field and pick the file.",
  },

  // ── open-ended ──────────────────────────────────────────────────────────
  {
    id: "coverLetterText",
    label: "Cover letter",
    category: "open-ended",
    autocomplete: [],
    aliases: [
      "cover letter",
      "covering letter",
      "write a cover letter",
      "cover letter text",
      "message to hiring manager",
      "letter of motivation",
    ],
    kinds: ["textarea", "text"],
  },
  {
    id: "whyCompany",
    label: "Why this company",
    category: "open-ended",
    autocomplete: [],
    aliases: [
      "why do you want to work here",
      "why this company",
      "why are you interested in this company",
      "why do you want to join",
      "what interests you about",
      "why us",
    ],
    kinds: ["textarea", "text"],
  },
  {
    id: "whyRole",
    label: "Why this role",
    category: "open-ended",
    autocomplete: [],
    aliases: [
      "why are you interested in this role",
      "why this role",
      "why are you a good fit",
      "why should we hire you",
      "what makes you a great fit",
      "why do you want this position",
    ],
    kinds: ["textarea", "text"],
  },
  {
    id: "additionalInfo",
    label: "Additional information",
    category: "open-ended",
    autocomplete: [],
    aliases: [
      "anything else",
      "additional information",
      "additional comments",
      "is there anything else",
      "other information",
      "anything we should know",
      "additional details",
    ],
    kinds: ["textarea", "text"],
  },
  {
    id: "salaryExpectationText",
    label: "Compensation notes",
    category: "open-ended",
    autocomplete: [],
    aliases: ["salary explanation", "compensation notes", "salary comments", "explain your salary expectation"],
    kinds: ["textarea", "text"],
  },
  {
    id: "skillsSummary",
    label: "Skills",
    category: "open-ended",
    autocomplete: [],
    aliases: ["skills", "key skills", "top skills", "technical skills", "core competencies", "areas of expertise"],
    kinds: ["textarea", "text"],
  },
  {
    id: "languages",
    label: "Languages",
    category: "open-ended",
    autocomplete: [],
    aliases: ["languages", "spoken languages", "language proficiency", "other languages"],
    kinds: ["textarea", "text"],
  },
  {
    id: "certifications",
    label: "Certifications",
    category: "open-ended",
    autocomplete: [],
    aliases: ["certifications", "certificates", "licenses", "professional certifications", "credentials"],
    kinds: ["textarea", "text"],
  },

  // ── equal opportunity (opt-in only) ─────────────────────────────────────
  {
    id: "gender",
    label: "Gender",
    category: "equal-opportunity",
    autocomplete: [],
    aliases: ["gender", "gender identity", "sex", "what is your gender"],
    kinds: ["select", "radio"],
    sensitive: true,
  },
  {
    id: "race",
    label: "Race / ethnicity",
    category: "equal-opportunity",
    autocomplete: [],
    aliases: ["race", "ethnicity", "race ethnicity", "racial background", "ethnic background"],
    kinds: ["select", "radio"],
    sensitive: true,
  },
  {
    id: "hispanicLatino",
    label: "Hispanic / Latino",
    category: "equal-opportunity",
    autocomplete: [],
    aliases: ["hispanic", "latino", "hispanic or latino", "are you hispanic"],
    kinds: ["select", "radio"],
    sensitive: true,
  },
  {
    id: "veteranStatus",
    label: "Veteran status",
    category: "equal-opportunity",
    autocomplete: [],
    aliases: ["veteran status", "protected veteran", "are you a veteran", "military status", "veteran"],
    kinds: ["select", "radio"],
    sensitive: true,
  },
  {
    id: "disabilityStatus",
    label: "Disability status",
    category: "equal-opportunity",
    autocomplete: [],
    aliases: ["disability", "disability status", "do you have a disability", "disabled", "accommodation"],
    kinds: ["select", "radio"],
    sensitive: true,
  },

  // ── attribution ─────────────────────────────────────────────────────────
  {
    id: "howDidYouHear",
    label: "How did you hear about us",
    category: "attribution",
    autocomplete: [],
    aliases: [
      "how did you hear about us",
      "how did you hear about this role",
      "how did you find us",
      "where did you hear about",
      "source",
      "referral source",
      "how were you referred",
    ],
    kinds: ["select", "text", "radio"],
  },
  {
    id: "referralName",
    label: "Referred by",
    category: "attribution",
    autocomplete: [],
    aliases: ["referred by", "referral name", "name of referrer", "employee who referred", "who referred you"],
    kinds: ["text"],
  },
  {
    id: "previousEmployee",
    label: "Previously employed here",
    category: "attribution",
    autocomplete: [],
    aliases: ["previously worked", "previous employee", "former employee", "have you worked here before", "boomerang"],
    kinds: ["radio", "select", "checkbox"],
  },
  {
    id: "previousApplicant",
    label: "Previously applied",
    category: "attribution",
    autocomplete: [],
    aliases: ["previously applied", "applied before", "have you applied to us before", "prior application"],
    kinds: ["radio", "select", "checkbox"],
  },
]

/** Fast lookup by id — built once, read everywhere. */
export const FIELD_BY_ID: Record<CanonicalFieldId, CanonicalField> = CANONICAL_FIELDS.reduce(
  (acc, field) => {
    acc[field.id] = field
    return acc
  },
  {} as Record<CanonicalFieldId, CanonicalField>
)

/** Fields a user may reasonably want to review before filling. */
export const SENSITIVE_FIELD_IDS: CanonicalFieldId[] = CANONICAL_FIELDS.filter((f) => f.sensitive).map((f) => f.id)

/** File inputs are reported but never scripted — browsers forbid it. */
export const FILE_FIELD_IDS: CanonicalFieldId[] = CANONICAL_FIELDS.filter((f) =>
  f.kinds.includes("file")
).map((f) => f.id)

export const FIELD_CATEGORY_LABELS: Record<FieldCategory, string> = {
  identity: "Identity",
  contact: "Contact",
  links: "Links",
  work: "Work",
  eligibility: "Eligibility",
  education: "Education",
  documents: "Documents",
  "open-ended": "Open-ended",
  "equal-opportunity": "Voluntary questions",
  attribution: "Attribution",
}
