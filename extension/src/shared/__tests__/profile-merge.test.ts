import { describe, it, expect } from "vitest"
import {
  EMPTY_PROFILE,
  mergeImportedProfile,
  learnScreeningAnswers,
  type AutofillProfile,
} from "../profile"

function profileWith(overrides: Partial<AutofillProfile>): AutofillProfile {
  return { ...structuredClone(EMPTY_PROFILE), ...overrides }
}

describe("mergeImportedProfile", () => {
  it("fills empty fields from the import", () => {
    const { profile, filled } = mergeImportedProfile(EMPTY_PROFILE, {
      identity: { firstName: "Ada", lastName: "Lovelace" },
      contact: { email: "ada@example.com" },
      links: { linkedin: "https://linkedin.com/in/ada" },
    })

    expect(profile.identity.firstName).toBe("Ada")
    expect(profile.identity.lastName).toBe("Lovelace")
    expect(profile.contact.email).toBe("ada@example.com")
    expect(profile.links.linkedin).toBe("https://linkedin.com/in/ada")
    expect(filled).toContain("identity")
    expect(filled).toContain("contact")
    expect(filled).toContain("links")
  })

  it("never overwrites a value the user already set", () => {
    const current = profileWith({
      identity: { ...EMPTY_PROFILE.identity, firstName: "Grace" },
      contact: { ...EMPTY_PROFILE.contact, email: "grace@example.com" },
    })

    const { profile, filled, kept } = mergeImportedProfile(current, {
      identity: { firstName: "Ada", lastName: "Lovelace" },
      contact: { email: "ada@example.com" },
    })

    expect(profile.identity.firstName).toBe("Grace")
    expect(profile.contact.email).toBe("grace@example.com")
    expect(profile.identity.lastName).toBe("Lovelace")
    expect(filled).toContain("identity")
    expect(kept).toContain("contact")
  })

  it("imports experience into an empty history and stamps ids", () => {
    const { profile, filled } = mergeImportedProfile(EMPTY_PROFILE, {
      experience: [
        { company: "Analytical Engines", title: "Engineer", startDate: "2023-01", current: true },
      ],
    })

    expect(profile.experience).toHaveLength(1)
    expect(profile.experience[0].company).toBe("Analytical Engines")
    expect(profile.experience[0].id).toMatch(/^imported-/)
    expect(profile.experience[0].current).toBe(true)
    expect(profile.experience[0].endDate).toBe("")
    expect(filled).toContain("experience")
  })

  it("keeps an existing experience history instead of merging entries", () => {
    const current = profileWith({
      experience: [
        {
          id: "existing",
          company: "Old Co",
          title: "Engineer",
          startDate: "2020-01",
          endDate: "",
          current: true,
        },
      ],
    })

    const { profile, kept } = mergeImportedProfile(current, {
      experience: [{ company: "New Co", title: "Somewhere" }],
    })

    expect(profile.experience).toHaveLength(1)
    expect(profile.experience[0].company).toBe("Old Co")
    expect(kept).toContain("experience")
  })

  it("imports education history, skills, certifications and languages only when blank", () => {
    const current = profileWith({ skills: "existing skills" })

    const { profile, filled, kept } = mergeImportedProfile(current, {
      educationHistory: [{ school: "London University", degree: "BSc", endYear: "2019" }],
      skills: "imported skills",
      certifications: "AWS",
      languages: "English",
    })

    expect(profile.educationHistory[0].school).toBe("London University")
    expect(profile.educationHistory[0].id).toMatch(/^imported-edu-/)
    expect(profile.skills).toBe("existing skills")
    expect(profile.certifications).toBe("AWS")
    expect(profile.languages).toBe("English")
    expect(filled).toContain("education history")
    expect(kept).toContain("skills")
  })

  it("does not mutate the input profile", () => {
    const current = profileWith({})
    mergeImportedProfile(current, { skills: "something" })
    expect(current.skills).toBe("")
  })

  it("reports nothing when the import is empty", () => {
    const { filled, kept } = mergeImportedProfile(EMPTY_PROFILE, {})
    expect(filled).toEqual([])
    expect(kept).toEqual([])
  })
})

describe("learnScreeningAnswers", () => {
  it("adds clean question/answer pairs with metadata", () => {
    const profile = learnScreeningAnswers(EMPTY_PROFILE, [
      { question: "  Why this company?  ", answer: "  The engineering culture.  " },
    ])

    expect(profile.screening).toHaveLength(1)
    expect(profile.screening[0].question).toBe("Why this company?")
    expect(profile.screening[0].answer).toBe("The engineering culture.")
    expect(profile.screening[0].id).toMatch(/^learned-/)
    expect(profile.screening[0].updatedAt).toBeTruthy()
  })

  it("drops blank entries", () => {
    const profile = learnScreeningAnswers(EMPTY_PROFILE, [
      { question: "", answer: "orphan" },
      { question: "real question", answer: "" },
    ])
    expect(profile.screening).toHaveLength(0)
  })

  it("normalises duplicate questions so the newest answer wins", () => {
    const first = learnScreeningAnswers(EMPTY_PROFILE, [
      { question: "Why this company?", answer: "first" },
    ])
    const second = learnScreeningAnswers(first, [
      { question: "why  this   company?", answer: "second" },
    ])

    expect(second.screening).toHaveLength(1)
    expect(second.screening[0].answer).toBe("second")
  })

  it("caps learned entries and the total library", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      question: `Question ${i}`,
      answer: `Answer ${i}`,
    }))
    const profile = learnScreeningAnswers(EMPTY_PROFILE, many)
    expect(profile.screening).toHaveLength(25)

    const big = learnScreeningAnswers(profile, many.map((e) => ({ ...e, question: `${e.question} again` })))
    expect(big.screening.length).toBeLessThanOrEqual(200)
  })

  it("does not mutate the input profile", () => {
    const before = structuredClone(EMPTY_PROFILE)
    learnScreeningAnswers(EMPTY_PROFILE, [{ question: "q", answer: "a" }])
    expect(EMPTY_PROFILE).toEqual(before)
  })
})
