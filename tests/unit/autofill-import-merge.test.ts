import { describe, expect, it } from "vitest"
import { EMPTY_AUTOFILL_PROFILE, mergeImportedProfile } from "@/types/autofill"

describe("resume import into application details", () => {
  it("fills blank details while preserving existing contact and eligibility answers", () => {
    const current = structuredClone(EMPTY_AUTOFILL_PROFILE)
    current.contact.email = "account@example.com"
    current.eligibility.requiresSponsorship = false

    const { profile, filled, kept } = mergeImportedProfile(current, {
      identity: { firstName: "Ada" },
      contact: { email: "resume@example.com", phone: "+441234567890" },
      work: { currentTitle: "Engineer" },
    })

    expect(profile.identity.firstName).toBe("Ada")
    expect(profile.contact.phone).toBe("+441234567890")
    expect(profile.contact.email).toBe("account@example.com")
    expect(profile.eligibility.requiresSponsorship).toBe(false)
    expect(filled).toContain("contact.phone")
    expect(kept).toContain("contact.email")
    expect(current.identity.firstName).toBe("")
  })

  it("imports history only into an empty history and keeps existing entries", () => {
    const current = structuredClone(EMPTY_AUTOFILL_PROFILE)
    current.experience = [{ id: "manual", company: "Existing", title: "Developer" }]

    const { profile, filled, kept } = mergeImportedProfile(current, {
      experience: [{ company: "Resume Co", title: "Engineer" }],
      educationHistory: [{ school: "University", degree: "BSc" }],
    })

    expect(profile.experience).toEqual(current.experience)
    expect(profile.educationHistory).toMatchObject([{ school: "University", degree: "BSc" }])
    expect(profile.educationHistory[0].id).toBeTruthy()
    expect(kept).toContain("experience")
    expect(filled).toContain("educationHistory")
  })
})
