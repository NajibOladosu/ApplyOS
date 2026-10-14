import { coerceImportedProfile } from "@/app/api/extension/_lib/profile-import"
import type { ImportedProfile } from "@/types/autofill"

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function month(value: unknown): string | undefined {
  const match = text(value).match(/^(19|20)\d{2}-(0[1-9]|1[0-2])(?:-\d{2})?$/)
  return match ? match[0].slice(0, 7) : undefined
}

function year(value: unknown): string | undefined {
  const match = text(value).match(/\b(19|20)\d{2}\b/)
  return match?.[0]
}

function mergeMissing<T extends Record<string, string | undefined>>(
  preferred: T | undefined,
  fallback: T | undefined
): T | undefined {
  if (!fallback) return preferred
  return { ...fallback, ...preferred } as T
}

/** Use only facts already stored in a document's analysis; never call AI here. */
export function importedProfileFromParsedDocument(raw: unknown): ImportedProfile {
  const parsed = record(raw)
  if (!parsed) return {}

  const detailed = coerceImportedProfile(parsed.application_details)
  const fallback: ImportedProfile = {}

  const experience = Array.isArray(parsed.experience)
    ? parsed.experience.map(record).filter((entry): entry is Record<string, unknown> => entry !== null)
    : []
  const roles = experience
    .map((entry) => ({
      company: text(entry.company),
      title: text(entry.role),
      startDate: month(entry.start_date),
      endDate: month(entry.end_date),
      current: /^(present|current|now)$/i.test(text(entry.end_date)),
      description: text(entry.description) || undefined,
    }))
    .filter((entry) => entry.company || entry.title)
  if (roles.length) fallback.experience = roles

  const currentRole = roles.find((entry) => entry.current)
  if (currentRole) {
    fallback.work = {
      currentCompany: currentRole.company,
      currentTitle: currentRole.title,
    }
  }

  const education = Array.isArray(parsed.education)
    ? parsed.education.map(record).filter((entry): entry is Record<string, unknown> => entry !== null)
    : []
  const schools = education
    .map((entry) => ({
      school: text(entry.institution),
      degree: text(entry.degree) || undefined,
      fieldOfStudy: text(entry.field) || undefined,
      startYear: year(entry.start_date),
      endYear: year(entry.end_date),
    }))
    .filter((entry) => entry.school)
  if (schools.length) {
    fallback.educationHistory = schools
    const latest = schools.find((entry) => entry.endYear) ?? schools[0]
    fallback.education = {
      school: latest.school,
      degree: latest.degree,
      fieldOfStudy: latest.fieldOfStudy,
      graduationYear: latest.endYear,
    }
  }

  const skills = record(parsed.skills)
  if (skills) {
    const values = [skills.technical, skills.soft, skills.other]
      .flatMap((value) => Array.isArray(value) ? value : [])
      .map(text)
      .filter(Boolean)
    const unique = [...new Set(values)]
    if (unique.length) fallback.skills = unique.join(", ")
  }

  if (Array.isArray(parsed.certifications)) {
    const names = parsed.certifications.map((entry) => text(record(entry)?.name)).filter(Boolean)
    if (names.length) fallback.certifications = [...new Set(names)].join(", ")
  }

  const combined: ImportedProfile = {
    ...fallback,
    ...detailed,
    work: mergeMissing(detailed.work, fallback.work),
    education: mergeMissing(detailed.education, fallback.education),
    experience: detailed.experience?.length ? detailed.experience : fallback.experience,
    educationHistory: detailed.educationHistory?.length ? detailed.educationHistory : fallback.educationHistory,
  }
  for (const key of Object.keys(combined) as Array<keyof ImportedProfile>) {
    const value = combined[key]
    if (value === undefined ||
      (Array.isArray(value) && value.length === 0) ||
      (record(value) && !Object.values(record(value)!).some(Boolean))) {
      delete combined[key]
    }
  }
  return combined
}

export function hasImportedProfileDetails(raw: unknown): boolean {
  const profile = importedProfileFromParsedDocument(raw)
  return Object.values(profile).some((value) =>
    Array.isArray(value) ? value.length > 0 :
      value && typeof value === "object" ? Object.values(value).some(Boolean) : Boolean(value)
  )
}
