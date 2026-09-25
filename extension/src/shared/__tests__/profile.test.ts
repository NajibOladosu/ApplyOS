import { describe, expect, it } from "vitest"
import {
  EMPTY_PROFILE,
  applyOverrides,
  mergeScreening,
  normalizeProfile,
  profileCompleteness,
  resolveAnswer,
  seedFromUser,
  splitName,
  type AutofillProfile,
} from "../profile"

/** A profile holding the fields most application forms ask for. */
function fixture(): AutofillProfile {
  const profile = structuredClone(EMPTY_PROFILE)
  profile.identity = {
    firstName: "Ada",
    middleName: "",
    lastName: "Okafor",
    preferredName: "Ada",
    pronouns: "she/her",
  }
  profile.contact = {
    email: "ada@example.com",
    phone: "+234 801 234 5678",
    phoneCountryCode: "234",
    addressLine1: "1 Broad Street",
    addressLine2: "",
    city: "Lagos",
    state: "",
    postalCode: "100001",
    country: "Nigeria",
  }
  profile.links = { linkedin: "in/adokafor", github: "adokafor", portfolio: "", website: "", twitter: "" }
  profile.work = {
    currentCompany: "Paystack",
    currentTitle: "Senior Frontend Engineer",
    yearsExperience: "8",
    monthsExperience: "",
    noticePeriod: "1 month",
    availableStartDate: "",
    desiredSalary: "90000",
    salaryCurrency: "USD",
    currentSalary: "",
  }
  profile.eligibility = {
    workAuthorization: "Yes — right to work in Nigeria",
    requiresSponsorship: false,
    willingToRelocate: true,
    isOver18: true,
    backgroundCheckConsent: null,
    securityClearance: "",
    nonCompete: null,
  }
  profile.skills = "React, TypeScript, Next.js"
  return profile
}

describe("resolveAnswer", () => {
  it("composes a full name from its parts", () => {
    expect(resolveAnswer("fullName", fixture())).toEqual({ type: "text", value: "Ada Okafor" })
  })

  it("includes a middle name when there is one", () => {
    const profile = fixture()
    profile.identity.middleName = "Ngozi"
    expect(resolveAnswer("fullName", profile)).toEqual({ type: "text", value: "Ada Ngozi Okafor" })
  })

  it("joins city and country when there is no state", () => {
    expect(resolveAnswer("location", fixture())).toEqual({ type: "text", value: "Lagos, Nigeria" })
  })

  it("prefers city and state when a state exists", () => {
    const profile = fixture()
    profile.contact.state = "Lagos State"
    expect(resolveAnswer("location", profile)).toEqual({ type: "text", value: "Lagos, Lagos State" })
  })

  it("keeps booleans as booleans so the filler can match the form's own vocabulary", () => {
    expect(resolveAnswer("requiresSponsorship", fixture())).toEqual({ type: "boolean", value: false })
    expect(resolveAnswer("willingToRelocate", fixture())).toEqual({ type: "boolean", value: true })
  })

  it("returns null for a question the user never answered", () => {
    // Never guess at a legal question.
    expect(resolveAnswer("backgroundCheckConsent", fixture())).toBeNull()
    expect(resolveAnswer("securityClearance", fixture())).toBeNull()
  })

  it("turns a bare LinkedIn handle into a usable URL without doubling the path", () => {
    expect(resolveAnswer("linkedinUrl", fixture())).toEqual({
      type: "text",
      value: "https://linkedin.com/in/adokafor",
    })
  })

  it("fills in the domain hint for a bare handle", () => {
    expect(resolveAnswer("githubUrl", fixture())).toEqual({
      type: "text",
      value: "https://github.com/adokafor",
    })
  })

  it("leaves an absolute URL alone", () => {
    const profile = fixture()
    profile.links.linkedin = "https://www.linkedin.com/in/ada"
    expect(resolveAnswer("linkedinUrl", profile)).toEqual({
      type: "text",
      value: "https://www.linkedin.com/in/ada",
    })
  })

  it("upgrades a bare domain to https", () => {
    const profile = fixture()
    profile.links.website = "ada.dev"
    expect(resolveAnswer("websiteUrl", profile)).toEqual({ type: "text", value: "https://ada.dev" })
  })

  it("resolves the same email for the confirmation field", () => {
    expect(resolveAnswer("confirmEmail", fixture())).toEqual({ type: "text", value: "ada@example.com" })
  })

  it("never resolves the file fields to a string", () => {
    expect(resolveAnswer("resumeFile", fixture())).toBeNull()
    expect(resolveAnswer("coverLetterFile", fixture())).toBeNull()
  })
})

describe("normalizeProfile", () => {
  it("fills every gap so callers never null-check a branch", () => {
    const profile = normalizeProfile({ identity: { firstName: "Ada" } })
    expect(profile.identity.firstName).toBe("Ada")
    expect(profile.identity.lastName).toBe("")
    expect(profile.contact.city).toBe("")
    expect(profile.experience).toEqual([])
  })

  it("survives junk from storage without throwing", () => {
    expect(normalizeProfile(null).version).toBe(1)
    expect(normalizeProfile("nonsense").identity.firstName).toBe("")
    expect(normalizeProfile({ contact: "not an object" }).contact.city).toBe("")
    expect(normalizeProfile({ unknownKey: 5 }).contact.city).toBe("")
  })
})

describe("applyOverrides", () => {
  it("writes local overrides into the right nested fields", () => {
    const merged = applyOverrides(fixture(), {
      fields: {
        phone: "+234 809 000 0000",
        currentCompany: "Freelance",
        skillsSummary: "React only",
        linkedinUrl: "https://linkedin.com/in/local",
      },
      screening: [],
    })

    expect(merged.contact.phone).toBe("+234 809 000 0000")
    expect(merged.work.currentCompany).toBe("Freelance")
    expect(merged.skills).toBe("React only")
    expect(merged.links.linkedin).toBe("https://linkedin.com/in/local")
    // Untouched fields must survive the merge.
    expect(merged.contact.email).toBe("ada@example.com")
  })

  it("writes every mapped field without drifting into a sibling", () => {
    const merged = applyOverrides(fixture(), {
      fields: {
        firstName: "A",
        lastName: "B",
        city: "C",
        state: "D",
        postalCode: "E",
        country: "F",
        currentTitle: "G",
        yearsExperience: "H",
        noticePeriod: "I",
        school: "J",
        degree: "K",
        graduationYear: "L",
        whyCompany: "M",
        additionalInfo: "N",
        gender: "O",
      },
      screening: [],
    })

    expect(merged.identity.firstName).toBe("A")
    expect(merged.identity.lastName).toBe("B")
    expect(merged.contact.city).toBe("C")
    expect(merged.contact.state).toBe("D")
    expect(merged.contact.postalCode).toBe("E")
    expect(merged.contact.country).toBe("F")
    expect(merged.work.currentTitle).toBe("G")
    expect(merged.work.yearsExperience).toBe("H")
    expect(merged.work.noticePeriod).toBe("I")
    expect(merged.education.school).toBe("J")
    expect(merged.education.degree).toBe("K")
    expect(merged.education.graduationYear).toBe("L")
    expect(merged.openEnded.whyCompany).toBe("M")
    expect(merged.openEnded.additionalInfo).toBe("N")
    expect(merged.eeo.gender).toBe("O")
    // Nothing bled into the email field.
    expect(merged.contact.email).toBe("ada@example.com")
  })

  it("does not mutate the original profile", () => {
    const original = fixture()
    applyOverrides(original, { fields: { phone: "changed" }, screening: [] })
    expect(original.contact.phone).toBe("+234 801 234 5678")
  })

  it("ignores blank and unknown overrides", () => {
    const merged = applyOverrides(fixture(), {
      fields: { phone: "   ", notAField: "x" } as never,
      screening: [],
    })
    expect(merged.contact.phone).toBe("+234 801 234 5678")
  })

  it("merges locally-saved answers into the library", () => {
    const merged = applyOverrides(fixture(), {
      fields: {},
      screening: [
        { id: "1", question: "Do you have a driving licence?", answer: "Yes", updatedAt: "2026-01-01" },
      ],
    })
    expect(merged.screening).toHaveLength(1)
  })
})

describe("mergeScreening", () => {
  it("keeps one answer per question, newest wins", () => {
    const merged = mergeScreening(
      [{ id: "1", question: "Notice period?", answer: "One month", updatedAt: "2026-01-01" }],
      [{ id: "2", question: "notice period", answer: "Two months", updatedAt: "2026-02-01" }]
    )
    expect(merged).toHaveLength(1)
    expect(merged[0].answer).toBe("Two months")
  })

  it("ignores entries with no question", () => {
    expect(mergeScreening([], [{ id: "1", question: "", answer: "x", updatedAt: "" }])).toHaveLength(0)
  })
})

describe("profileCompleteness", () => {
  it("reports 100% for a fully answered core profile", () => {
    const profile = fixture()
    profile.education.educationLevel = "Bachelor's"
    profile.education.school = "University of Lagos"
    profile.openEnded.howDidYouHear = "LinkedIn"
    expect(profileCompleteness(profile).percent).toBe(100)
  })

  it("names what is missing so the UI can say what to add next", () => {
    const result = profileCompleteness(structuredClone(EMPTY_PROFILE))
    expect(result.percent).toBe(0)
    expect(result.missing).toContain("firstName")
    expect(result.missing).toContain("requiresSponsorship")
  })

  it("weights contact details above nice-to-haves", () => {
    const withEmail = structuredClone(EMPTY_PROFILE)
    withEmail.contact.email = "ada@example.com"

    const withHearAbout = structuredClone(EMPTY_PROFILE)
    withHearAbout.openEnded.howDidYouHear = "LinkedIn"

    expect(profileCompleteness(withEmail).percent).toBeGreaterThan(
      profileCompleteness(withHearAbout).percent
    )
  })
})

describe("name helpers", () => {
  it("splits a two-part name", () => {
    expect(splitName("Ada Okafor")).toEqual({ firstName: "Ada", lastName: "Okafor", middleName: "" })
  })

  it("treats everything between first and last as the middle name", () => {
    expect(splitName("Ada Ngozi Okafor")).toEqual({
      firstName: "Ada",
      lastName: "Okafor",
      middleName: "Ngozi",
    })
  })

  it("handles a single-word name without producing undefined", () => {
    expect(splitName("Prince")).toEqual({ firstName: "Prince", lastName: "", middleName: "" })
    expect(splitName("   ")).toEqual({ firstName: "", lastName: "", middleName: "" })
  })

  it("seeds from the account without overwriting existing answers", () => {
    const profile = fixture()
    const seeded = seedFromUser(profile, { email: "other@example.com", name: "Someone Else" })
    expect(seeded.contact.email).toBe("ada@example.com")
    expect(seeded.identity.firstName).toBe("Ada")
  })

  it("seeds a blank profile from the account", () => {
    const seeded = seedFromUser(structuredClone(EMPTY_PROFILE), {
      email: "new@example.com",
      name: "New User",
    })
    expect(seeded.contact.email).toBe("new@example.com")
    expect(seeded.identity.firstName).toBe("New")
    expect(seeded.identity.lastName).toBe("User")
  })
})
