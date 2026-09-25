/**
 * Resume → autofill profile import ("auto profile builder").
 *
 * JobJet's most-loved onboarding step: upload a resume once, never retype
 * your history again. The AI returns a JSON document shaped like the
 * extension's AutofillProfile; these helpers make that safe:
 *
 *  - buildImportPrompt instructs the model to emit only fields it actually
 *    found, as JSON, with no markdown fences.
 *  - extractJsonObject recovers the object even when the model fences it
 *    anyway or adds prose around it.
 *  - coerceImportedProfile keeps only known keys with plausible types, so a
 *    hallucinated or malformed response can never poison the stored profile.
 *
 * Demographic (EEO) fields are deliberately not importable: the model cannot
 * infer them from a resume, and guessing on voluntary questions is worse than
 * leaving them blank.
 */

export interface ImportedProfile {
  identity?: Partial<{
    firstName: string
    middleName: string
    lastName: string
    preferredName: string
  }>
  contact?: Partial<{
    email: string
    phone: string
    addressLine1: string
    addressLine2: string
    city: string
    state: string
    postalCode: string
    country: string
  }>
  links?: Partial<{
    linkedin: string
    github: string
    portfolio: string
    website: string
    twitter: string
  }>
  work?: Partial<{
    currentCompany: string
    currentTitle: string
    yearsExperience: string
    noticePeriod: string
    desiredSalary: string
  }>
  education?: Partial<{
    school: string
    degree: string
    fieldOfStudy: string
    graduationYear: string
    gpa: string
  }>
  experience?: Array<{
    company: string
    title: string
    location?: string
    startDate?: string
    endDate?: string
    current?: boolean
    description?: string
  }>
  educationHistory?: Array<{
    school: string
    degree?: string
    fieldOfStudy?: string
    startYear?: string
    endYear?: string
    gpa?: string
  }>
  skills?: string
  certifications?: string
  languages?: string
}

export function buildImportPrompt(resumeText: string): string {
  return `You are building an autofill profile for job applications from a candidate's resume.

Resume:
"""
${resumeText}
"""

Extract structured data and return ONLY a JSON object with this exact shape (omit any key you cannot find in the resume — never invent values):

{
  "identity": { "firstName": "", "middleName": "", "lastName": "", "preferredName": "" },
  "contact": { "email": "", "phone": "", "addressLine1": "", "addressLine2": "", "city": "", "state": "", "postalCode": "", "country": "" },
  "links": { "linkedin": "", "github": "", "portfolio": "", "website": "", "twitter": "" },
  "work": { "currentCompany": "", "currentTitle": "", "yearsExperience": "", "noticePeriod": "", "desiredSalary": "" },
  "education": { "school": "", "degree": "", "fieldOfStudy": "", "graduationYear": "", "gpa": "" },
  "experience": [ { "company": "", "title": "", "location": "", "startDate": "YYYY-MM", "endDate": "YYYY-MM", "current": false, "description": "" } ],
  "educationHistory": [ { "school": "", "degree": "", "fieldOfStudy": "", "startYear": "", "endYear": "", "gpa": "" } ],
  "skills": "comma-separated skills from the resume",
  "certifications": "comma-separated certifications",
  "languages": "comma-separated languages with level if stated"
}

Rules:
- Dates: "startDate"/"endDate" as YYYY-MM; use "current": true and empty "endDate" for the present role.
- yearsExperience: derive from the earliest to latest work dates, e.g. "6" or "6+".
- Full URLs for links (https://...). Use the exact phone format from the resume.
- "description" for experience: 1-2 sentences summarising the most relevant accomplishments, in the resume's own words.
- Return raw JSON only. No markdown fences, no commentary.`
}

/**
 * Recover a JSON object from a model response that may be fenced, wrapped in
 * prose, or both. Returns null when no parseable object is present.
 */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  if (!text || typeof text !== 'string') return null

  let candidate = text.trim()

  // Strip a code fence if present (```json ... ``` or ``` ... ```)
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fence) candidate = fence[1].trim()

  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null

  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function bool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function pickStrings(
  source: unknown,
  keys: string[]
): Record<string, string> {
  const out: Record<string, string> = {}
  if (!source || typeof source !== 'object') return out
  for (const key of keys) {
    const value = str((source as Record<string, unknown>)[key])
    if (value) out[key] = value
  }
  return out
}

const IDENTITY_KEYS = ['firstName', 'middleName', 'lastName', 'preferredName']
const CONTACT_KEYS = [
  'email',
  'phone',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'postalCode',
  'country',
]
const LINK_KEYS = ['linkedin', 'github', 'portfolio', 'website', 'twitter']
const WORK_KEYS = ['currentCompany', 'currentTitle', 'yearsExperience', 'noticePeriod', 'desiredSalary']
const EDUCATION_KEYS = ['school', 'degree', 'fieldOfStudy', 'graduationYear', 'gpa']

interface ImportedExperience {
  company: string
  title: string
  location?: string
  startDate?: string
  endDate?: string
  current?: boolean
  description?: string
}

interface ImportedEducation {
  school: string
  degree?: string
  fieldOfStudy?: string
  startYear?: string
  endYear?: string
  gpa?: string
}

/**
 * Reduce an arbitrary parsed object to an ImportedProfile with only known keys
 * and plausible types. Unknown keys are dropped, never passed through.
 */
export function coerceImportedProfile(raw: unknown): ImportedProfile {
  if (!raw || typeof raw !== 'object') return {}

  const source = raw as Record<string, unknown>
  const profile: ImportedProfile = {}

  const identity = pickStrings(source.identity, IDENTITY_KEYS)
  if (Object.keys(identity).length) profile.identity = identity

  const contact = pickStrings(source.contact, CONTACT_KEYS)
  if (Object.keys(contact).length) profile.contact = contact

  const links = pickStrings(source.links, LINK_KEYS)
  if (Object.keys(links).length) profile.links = links

  const work = pickStrings(source.work, WORK_KEYS)
  if (Object.keys(work).length) profile.work = work

  const education = pickStrings(source.education, EDUCATION_KEYS)
  if (Object.keys(education).length) profile.education = education

  const skills = str(source.skills)
  if (skills) profile.skills = skills
  const certifications = str(source.certifications)
  if (certifications) profile.certifications = certifications
  const languages = str(source.languages)
  if (languages) profile.languages = languages

  if (Array.isArray(source.experience)) {
    const experience = source.experience
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
      .map((entry): ImportedExperience | null => {
        const company = str(entry.company) ?? ''
        const title = str(entry.title) ?? ''
        if (!company && !title) return null
        const out: ImportedExperience = { company, title }
        const location = str(entry.location)
        if (location) out.location = location
        const startDate = normalizeMonth(entry.startDate)
        if (startDate) out.startDate = startDate
        const endDate = normalizeMonth(entry.endDate)
        if (endDate) out.endDate = endDate
        const current = bool(entry.current)
        if (current !== undefined) out.current = current
        const description = str(entry.description)
        if (description) out.description = description
        return out
      })
      .filter((entry): entry is ImportedExperience => entry !== null)
    if (experience.length) profile.experience = experience
  }

  if (Array.isArray(source.educationHistory)) {
    const educationHistory = source.educationHistory
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
      .map((entry): ImportedEducation | null => {
        const school = str(entry.school) ?? ''
        if (!school) return null
        const out: ImportedEducation = { school }
        const degree = str(entry.degree)
        if (degree) out.degree = degree
        const fieldOfStudy = str(entry.fieldOfStudy)
        if (fieldOfStudy) out.fieldOfStudy = fieldOfStudy
        const startYear = normalizeYear(entry.startYear)
        if (startYear) out.startYear = startYear
        const endYear = normalizeYear(entry.endYear)
        if (endYear) out.endYear = endYear
        const gpa = str(entry.gpa)
        if (gpa) out.gpa = gpa
        return out
      })
      .filter((entry): entry is ImportedEducation => entry !== null)
    if (educationHistory.length) profile.educationHistory = educationHistory
  }

  return profile
}

/** Accept YYYY-MM, YYYY/MM, or YYYY-MM-DD; emit YYYY-MM. */
function normalizeMonth(value: unknown): string | undefined {
  const raw = str(value)
  if (!raw) return undefined
  const match = raw.match(/^(\d{4})[-/](\d{1,2})/)
  if (!match) return undefined
  const month = Number(match[2])
  if (month < 1 || month > 12) return undefined
  return `${match[1]}-${String(month).padStart(2, '0')}`
}

/** Accept a 4-digit year anywhere in the value. */
function normalizeYear(value: unknown): string | undefined {
  const raw = str(value)
  if (!raw) return undefined
  const match = raw.match(/\b(19|20)\d{2}\b/)
  return match ? match[0] : undefined
}
