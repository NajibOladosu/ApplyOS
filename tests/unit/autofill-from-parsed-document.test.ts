import { describe, expect, it } from "vitest"
import { importedProfileFromParsedDocument, hasImportedProfileDetails } from "@/lib/autofill/from-parsed-document"
import { EMPTY_AUTOFILL_PROFILE, mergeImportedProfile } from "@/types/autofill"

describe("cached document details", () => {
  it("reuses older analyses without inventing contact or eligibility answers", () => {
    const imported = importedProfileFromParsedDocument({
      education: [{ institution: "Lagos State University", degree: "BSc", field: "Computer Science", end_date: "2020" }],
      experience: [{ company: "Acme", role: "Engineer", start_date: "2021-02", end_date: "Present" }],
      skills: { technical: ["TypeScript", "React"], soft: ["Communication"] },
      certifications: [{ name: "AWS Associate" }],
    })

    expect(imported.education).toMatchObject({ school: "Lagos State University", graduationYear: "2020" })
    expect(imported.work).toEqual({ currentCompany: "Acme", currentTitle: "Engineer" })
    expect(imported.skills).toBe("TypeScript, React, Communication")
    expect(imported.certifications).toBe("AWS Associate")
    expect(imported.contact).toBeUndefined()
    expect(Object.keys(imported)).not.toContain("eligibility")
    expect(hasImportedProfileDetails({ education: [], experience: [], skills: {} })).toBe(false)
  })

  it("uses the richer details saved on new analyses while keeping manual profile values", () => {
    const imported = importedProfileFromParsedDocument({
      application_details: {
        identity: { firstName: "Ada", lastName: "Okafor" },
        contact: { email: "ada@example.com", phone: "+23412345678" },
        links: { linkedin: "https://linkedin.com/in/ada" },
        eligibility: { requiresSponsorship: false },
      },
      skills: { technical: ["Python"], soft: [], other: [] },
    })
    const current = structuredClone(EMPTY_AUTOFILL_PROFILE)
    current.contact.email = "account@example.com"
    current.work.currentCompany = "Manual company"
    const { profile, filled } = mergeImportedProfile(current, imported)

    expect(profile.identity.firstName).toBe("Ada")
    expect(profile.contact.email).toBe("account@example.com")
    expect(profile.contact.phone).toBe("+23412345678")
    expect(profile.work.currentCompany).toBe("Manual company")
    expect(profile.links.linkedin).toBe("https://linkedin.com/in/ada")
    expect(profile.eligibility.requiresSponsorship).toBeNull()
    expect(filled).toContain("contact.phone")
  })

  it("can fill different blank fields from multiple documents without replacing prior values", () => {
    const first = importedProfileFromParsedDocument({ application_details: { contact: { phone: "+234111" } } })
    const second = importedProfileFromParsedDocument({ application_details: { contact: { phone: "+234222" }, links: { github: "https://github.com/ada" } } })
    const afterFirst = mergeImportedProfile(structuredClone(EMPTY_AUTOFILL_PROFILE), first).profile
    const afterSecond = mergeImportedProfile(afterFirst, second).profile

    expect(afterSecond.contact.phone).toBe("+234111")
    expect(afterSecond.links.github).toBe("https://github.com/ada")
    expect(afterFirst.links.github).toBe("")
  })
})
