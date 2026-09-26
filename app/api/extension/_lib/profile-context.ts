/**
 * Turn the extension's autofill profile into a grounding text block for AI.
 *
 * The profile (users.autofill_profile) is untrusted JSON: it round-trips
 * through Postgres jsonb and chrome.storage, and may be stale or hand-edited.
 * Everything here is read defensively — a missing or wrong-typed value simply
 * drops out of the text rather than throwing.
 *
 * Kept pure so it can be unit-tested without a server.
 */

/** Local, structural view of the profile — matches extension AutofillProfile. */
interface ProfileLike {
  identity?: Record<string, unknown>
  contact?: Record<string, unknown>
  links?: Record<string, unknown>
  work?: Record<string, unknown>
  education?: Record<string, unknown>
  eligibility?: Record<string, unknown>
  openEnded?: Record<string, unknown>
  experience?: Array<Record<string, unknown>>
  educationHistory?: Array<Record<string, unknown>>
  skills?: unknown
  certifications?: unknown
  languages?: unknown
  screening?: Array<{ question?: unknown; answer?: unknown }>
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function yn(value: unknown): string | undefined {
  if (value === true) return "Yes"
  if (value === false) return "No"
  return undefined
}

const LINK_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  github: "GitHub",
  portfolio: "Portfolio",
  website: "Website",
  twitter: "X/Twitter",
}

const WORK_LABELS: Record<string, string> = {
  currentCompany: "Current company",
  currentTitle: "Current title",
  yearsExperience: "Years of experience",
  noticePeriod: "Notice period",
  availableStartDate: "Available start date",
  desiredSalary: "Desired salary",
  salaryCurrency: "Salary currency",
}

const ELIGIBILITY_LABELS: Record<string, string> = {
  workAuthorization: "Work authorization",
  requiresSponsorship: "Requires sponsorship",
  willingToRelocate: "Willing to relocate",
  securityClearance: "Security clearance",
}

const OPEN_ENDED_LABELS: Record<string, string> = {
  whyCompany: "Why this company (user's own words)",
  whyRole: "Why this role (user's own words)",
  additionalInfo: "Additional information (user's own words)",
}

function section(heading: string, lines: string[]): string | null {
  if (lines.length === 0) return null
  return `${heading}:\n${lines.map((line) => `- ${line}`).join("\n")}`
}

function recordLines(
  source: Record<string, unknown> | undefined,
  labels: Record<string, string>
): string[] {
  if (!source) return []
  const lines: string[] = []
  for (const [key, label] of Object.entries(labels)) {
    const value = str(source[key]) ?? yn(source[key])
    if (value) lines.push(`${label}: ${value}`)
  }
  return lines
}

/**
 * Render the profile as a resume-style background block.
 * Empty string when the profile has nothing usable — the caller should then
 * fall back to document-derived context only.
 */
export function profileToBackground(raw: unknown): string {
  if (!raw || typeof raw !== "object") return ""
  const profile = raw as ProfileLike

  const blocks: string[] = []

  // Identity + contact
  const identity = profile.identity ?? {}
  const contact = profile.contact ?? {}
  const name = [str(identity.firstName), str(identity.lastName)]
    .filter(Boolean)
    .join(" ")
    .trim()
  const contactLines: string[] = []
  if (name) contactLines.push(`Name: ${name}`)
  if (str(identity.preferredName)) contactLines.push(`Preferred name: ${str(identity.preferredName)}`)
  if (str(contact.email)) contactLines.push(`Email: ${str(contact.email)}`)
  if (str(contact.phone)) contactLines.push(`Phone: ${str(contact.phone)}`)
  const place = [str(contact.city), str(contact.state), str(contact.country)]
    .filter(Boolean)
    .join(", ")
  if (place) contactLines.push(`Location: ${place}`)
  const block = section("Candidate", contactLines)
  if (block) blocks.push(block)

  // Links
  const links = recordLines(profile.links, LINK_LABELS)
  const linksBlock = section("Profiles", links)
  if (linksBlock) blocks.push(linksBlock)

  // Work history from the structured experience array
  const experienceLines: string[] = []
  for (const entry of profile.experience ?? []) {
    const role = str(entry.title)
    const company = str(entry.company)
    if (!role && !company) continue
    const dates = [str(entry.startDate), str(entry.endDate) || (entry.current ? "present" : "")]
      .filter(Boolean)
      .join(" - ")
    const head = [role, company ? `at ${company}` : "", dates ? `(${dates})` : ""]
      .filter(Boolean)
      .join(" ")
    experienceLines.push(str(entry.description) ? `${head}: ${str(entry.description)}` : head)
  }
  const workLines = [...experienceLines, ...recordLines(profile.work, WORK_LABELS)]
  const workBlock = section("Work", workLines)
  if (workBlock) blocks.push(workBlock)

  // Education
  const educationLines: string[] = []
  for (const entry of profile.educationHistory ?? []) {
    const parts = [str(entry.degree), str(entry.fieldOfStudy), str(entry.school)]
      .filter(Boolean)
      .join(", ")
    const years = [str(entry.startYear), str(entry.endYear)].filter(Boolean).join("-")
    educationLines.push(years ? `${parts} (${years})` : parts)
  }
  const educationLinesAll = [...educationLines, ...recordLines(profile.education, {
    school: "School",
    degree: "Degree",
    fieldOfStudy: "Field of study",
    graduationYear: "Graduation year",
    gpa: "GPA",
  })]
  const educationBlock = section("Education", educationLinesAll)
  if (educationBlock) blocks.push(educationBlock)

  // Skills and qualifications
  const skillsLines: string[] = []
  if (str(profile.skills)) skillsLines.push(`Skills: ${str(profile.skills)}`)
  if (str(profile.certifications)) skillsLines.push(`Certifications: ${str(profile.certifications)}`)
  if (str(profile.languages)) skillsLines.push(`Languages: ${str(profile.languages)}`)
  const skillsBlock = section("Qualifications", skillsLines)
  if (skillsBlock) blocks.push(skillsBlock)

  // Eligibility facts — answers must stay consistent with these
  const eligibilityBlock = section(
    "Eligibility (treat as fact)",
    recordLines(profile.eligibility, ELIGIBILITY_LABELS)
  )
  if (eligibilityBlock) blocks.push(eligibilityBlock)

  // Saved answers — the user's own phrasing for recurring questions
  const screeningLines: string[] = []
  for (const saved of profile.screening ?? []) {
    const question = str(saved.question)
    const answer = str(saved.answer)
    if (question && answer) screeningLines.push(`Q: ${question}\n  A: ${answer}`)
  }
  const screeningBlock = section("Previously saved answers (reuse phrasing where relevant)", screeningLines)
  if (screeningBlock) blocks.push(screeningBlock)

  // Open-ended notes the user wrote about themselves
  const openEndedBlock = section("Notes", recordLines(profile.openEnded, OPEN_ENDED_LABELS))
  if (openEndedBlock) blocks.push(openEndedBlock)

  return blocks.join("\n\n")
}
