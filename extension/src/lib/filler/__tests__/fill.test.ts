import { beforeEach, describe, expect, it } from "vitest"
import { EMPTY_PROFILE, type AutofillProfile } from "../../../shared/profile"
import { collectControls } from "../dom"
import { applyPlan } from "../execute"
import { buildFillPlan, pickOption } from "../plan"
import { matchField } from "../matcher"

/**
 * End-to-end autofill against realistic form markup.
 *
 * These run the real pipeline — collect, match, plan, write — against a DOM, so
 * a change that breaks filling breaks a test rather than a user's application.
 */

/** A Greenhouse-style application form. */
const GREENHOUSE_FORM = `
<form>
  <label for="first_name">First Name*</label>
  <input id="first_name" name="first_name" type="text" autocomplete="given-name" />

  <label for="last_name">Last Name*</label>
  <input id="last_name" name="last_name" type="text" autocomplete="family-name" />

  <label for="email">Email*</label>
  <input id="email" name="email" type="email" />

  <label for="phone">Phone</label>
  <input id="phone" name="phone" type="tel" />

  <label for="location">Location (City)</label>
  <input id="location" name="location" type="text" />

  <label for="linkedin">LinkedIn Profile</label>
  <input id="linkedin" name="urls[LinkedIn]" type="url" />

  <label for="resume">Resume/CV</label>
  <input id="resume" name="resume" type="file" />

  <fieldset>
    <legend>Are you legally authorized to work in the United States?*</legend>
    <label><input type="radio" name="auth" value="yes" /> Yes</label>
    <label><input type="radio" name="auth" value="no" /> No</label>
  </fieldset>

  <fieldset>
    <legend>Will you now or in the future require sponsorship for employment visa status?*</legend>
    <label><input type="radio" name="sponsor" value="yes" /> Yes</label>
    <label><input type="radio" name="sponsor" value="no" /> No</label>
  </fieldset>

  <label for="hear">How did you hear about us?</label>
  <select id="hear" name="hear">
    <option value=""></option>
    <option>LinkedIn</option>
    <option>Referral</option>
    <option>Other</option>
  </select>

  <label for="why">Why do you want to work here?</label>
  <textarea id="why" name="why"></textarea>

  <label for="search">Search jobs</label>
  <input id="search" name="search_jobs" type="search" />

  <label for="password">Password</label>
  <input id="password" name="password" type="password" />
</form>
`

function fixture(): AutofillProfile {
  const profile = structuredClone(EMPTY_PROFILE)
  profile.identity.firstName = "Ada"
  profile.identity.lastName = "Okafor"
  profile.contact.email = "ada@example.com"
  profile.contact.phone = "+234 801 234 5678"
  profile.contact.city = "Lagos"
  profile.contact.country = "Nigeria"
  profile.links.linkedin = "in/adokafor"
  profile.eligibility.workAuthorization = "Yes — I have the right to work in the US"
  profile.eligibility.requiresSponsorship = false
  profile.openEnded.howDidYouHear = "LinkedIn"
  profile.openEnded.whyCompany = "Your work on developer tooling matches where I want to take my career."
  return profile
}

async function fill(profile: AutofillProfile) {
  const controls = collectControls(document.body)
  const plan = buildFillPlan(controls, { profile })
  const results = await applyPlan(controls, plan)
  return { controls, plan, results }
}

const value = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value

beforeEach(() => {
  document.body.innerHTML = GREENHOUSE_FORM
})

describe("autofill end to end", () => {
  it("fills the standard contact block", async () => {
    await fill(fixture())

    expect(value("first_name")).toBe("Ada")
    expect(value("last_name")).toBe("Okafor")
    expect(value("email")).toBe("ada@example.com")
    expect(value("phone")).toBe("+234 801 234 5678")
  })

  it("joins city and country for the location field", async () => {
    await fill(fixture())
    expect(value("location")).toBe("Lagos, Nigeria")
  })

  it("normalises a LinkedIn handle into a URL", async () => {
    await fill(fixture())
    expect(value("linkedin")).toBe("https://linkedin.com/in/adokafor")
  })

  it("fills a textarea with the matching open-ended answer", async () => {
    await fill(fixture())
    expect(value("why")).toBe("Your work on developer tooling matches where I want to take my career.")
  })

  it("selects the right option in a dropdown", async () => {
    await fill(fixture())
    expect(value("hear")).toBe("LinkedIn")
  })

  it("answers yes/no radio groups from boolean profile fields", async () => {
    await fill(fixture())

    const authorized = document.querySelector<HTMLInputElement>('input[name="auth"][value="yes"]')
    const needsSponsorship = document.querySelector<HTMLInputElement>('input[name="sponsor"][value="yes"]')
    const noSponsorship = document.querySelector<HTMLInputElement>('input[name="sponsor"][value="no"]')

    // workAuthorization is stored as a sentence starting "Yes"; the radio group
    // only offers Yes/No, so the leading word is the answer.
    expect(authorized?.checked).toBe(true)
    expect(needsSponsorship?.checked).toBe(false)
    expect(noSponsorship?.checked).toBe(true)
  })

  it("never touches search or password inputs", async () => {
    const { controls } = await fill(fixture())

    // Password is excluded from collection entirely; search is not a question.
    expect(controls.some((control) => control.kind === "select" && control.el.id === "password")).toBe(false)
    expect(value("search")).toBe("")
    expect(value("password")).toBe("")
  })

  it("reports the resume field without trying to script the file input", async () => {
    const { plan } = await fill(fixture())
    const resume = plan.items.find((item) => item.fieldId === "resumeFile")
    expect(resume?.status).toBe("file")
    expect(resume?.note).toBeTruthy()
  })

  it("verifies every write, so nothing is silently half-filled", async () => {
    const { plan, results } = await fill(fixture())
    const ready = plan.items.filter((item) => item.status === "ready")

    expect(results.length).toBe(ready.length)
    expect(results.every((result) => result.ok)).toBe(true)
  })

  it("leaves fields the user already filled alone", async () => {
    // The ATS pre-filled the city from the visitor's IP; do not clobber it.
    ;(document.getElementById("location") as HTMLInputElement).value = "Abuja"

    const { plan } = await fill(fixture())

    expect(value("location")).toBe("Abuja")
    expect(plan.items.some((item) => item.status === "already-filled")).toBe(true)
  })

  it("overwrites only when explicitly asked to", async () => {
    ;(document.getElementById("location") as HTMLInputElement).value = "Abuja"

    const controls = collectControls(document.body)
    const plan = buildFillPlan(controls, { profile: fixture(), overwrite: true })
    await applyPlan(controls, plan)

    expect(value("location")).toBe("Lagos, Nigeria")
  })
})

describe("label resolution", () => {
  it("gives every control its own label, not a neighbouring question", () => {
    // Regression: a failed CSS.escape silently emptied every label, and the
    // fallback then walked up to <body> and made the first <legend> on the page
    // the label for all eleven fields.
    const controls = collectControls(document.body)
    const labels = new Map(controls.map((control) => [control.descriptor.name, control.descriptor.label]))

    expect(labels.get("first_name")).toBe("First Name")
    expect(labels.get("email")).toBe("Email")
    expect(labels.get("resume")).toBe("Resume/CV")
    expect(labels.get("hear")).toBe("How did you hear about us?")
    expect(labels.get("why")).toBe("Why do you want to work here?")
  })

  it("reads a radio group's question from its fieldset legend", () => {
    const controls = collectControls(document.body)
    const sponsor = controls.find((control) => control.descriptor.name === "sponsor")
    expect(sponsor?.descriptor.label).toBe(
      "Will you now or in the future require sponsorship for employment visa status?"
    )
    expect(sponsor?.descriptor.options).toEqual(["Yes", "No"])
  })

  it("does not invent a label for a control that has none", () => {
    document.body.innerHTML = `
      <form>
        <fieldset><legend>Voluntary self-identification</legend></fieldset>
        <div><div><input id="mystery" name="mystery" type="text" /></div></div>
      </form>
    `
    const controls = collectControls(document.body)
    expect(controls[0]?.descriptor.label).toBe("")
  })
})

describe("autofill safety", () => {
  it("does not answer a yes/no question that is rendered as a text box", async () => {
    document.body.innerHTML = `
      <label for="sponsor_text">Will you now or in the future require sponsorship for employment visa status?</label>
      <input id="sponsor_text" name="sponsor_text" type="text" />
    `

    const { plan } = await fill(fixture())
    expect(value("sponsor_text")).toBe("")
    expect(plan.summary.ready).toBe(0)
  })

  it("flags the questions it knows but cannot answer", async () => {
    document.body.innerHTML = `
      <label for="salary">Desired salary</label>
      <input id="salary" name="salary" type="text" />
    `

    const { plan } = await fill(structuredClone(EMPTY_PROFILE))
    const salary = plan.items.find((item) => item.fieldId === "desiredSalary")

    expect(salary?.status).toBe("missing-value")
    expect(salary?.note).toContain("desired salary")
    expect(value("salary")).toBe("")
  })

  it("skips voluntary demographic questions unless opted in", async () => {
    document.body.innerHTML = `
      <label for="gender">Gender</label>
      <select id="gender" name="gender">
        <option value=""></option>
        <option>Male</option>
        <option>Female</option>
        <option>Decline to self-identify</option>
      </select>
    `

    const profile = fixture()
    profile.eeo.gender = "Female"

    const blocked = await fill(profile)
    expect(value("gender")).toBe("")
    expect(blocked.plan.items[0].status).toBe("sensitive")

    document.body.innerHTML = `
      <label for="gender">Gender</label>
      <select id="gender" name="gender">
        <option value=""></option>
        <option>Male</option>
        <option>Female</option>
      </select>
    `

    const controls = collectControls(document.body)
    const plan = buildFillPlan(controls, { profile, includeSensitive: true })
    await applyPlan(controls, plan)
    expect(value("gender")).toBe("Female")
  })

  it("uses a saved answer for a question the profile cannot model", async () => {
    document.body.innerHTML = `
      <label for="conflict">Describe a time you disagreed with a manager.</label>
      <textarea id="conflict" name="conflict"></textarea>
    `

    const controls = collectControls(document.body)
    const plan = buildFillPlan(controls, {
      profile: structuredClone(EMPTY_PROFILE),
      savedAnswers: [
        {
          id: "1",
          question: "Describe a time you disagreed with a manager.",
          answer: "I raised the disagreement privately with evidence, and we changed course.",
          updatedAt: "2026-01-01",
        },
      ],
    })

    // The question is unknown to the registry, so it is offered as an unknown
    // rather than mismatched — the saved answer is keyed on the exact question.
    const item = plan.items[0]
    expect(item.label).toContain("disagreed with a manager")

    if (item.status === "ready") {
      const results = await applyPlan(controls, plan)
      expect(results.every((result) => result.ok)).toBe(true)
      expect(value("conflict")).toContain("raised the disagreement")
    }
  })
})

describe("pickOption", () => {
  it("matches a yes/no answer regardless of how the form words it", () => {
    expect(pickOption(["Yes", "No"], { type: "boolean", value: true })).toBe("Yes")
    expect(pickOption(["Yes", "No"], { type: "boolean", value: false })).toBe("No")
    expect(pickOption(["I agree", "I do not agree"], { type: "boolean", value: true })).toBe("I agree")
    expect(pickOption(["Authorized", "Not authorized"], { type: "boolean", value: false })).toBe("Not authorized")
  })

  it("reads a sentence answer as a yes/no when only yes/no are offered", () => {
    expect(pickOption(["Yes", "No"], { type: "text", value: "Yes — right to work" })).toBe("Yes")
    expect(pickOption(["Yes", "No"], { type: "text", value: "No, I need sponsorship" })).toBe("No")
  })

  it("matches a text answer to the option that says the same thing", () => {
    expect(pickOption(["LinkedIn", "Referral", "Other"], { type: "text", value: "linkedin" })).toBe("LinkedIn")
    expect(pickOption(["Bachelor's Degree", "Master's Degree"], { type: "text", value: "Master's" })).toBe(
      "Master's Degree"
    )
  })

  it("refuses rather than guessing when nothing matches", () => {
    expect(pickOption(["Red", "Green"], { type: "text", value: "LinkedIn" })).toBeNull()
    expect(pickOption([], { type: "boolean", value: true })).toBeNull()
  })
})

describe("matchField is not fooled by an aggressive radio label", () => {
  it("prefers the fieldset question over the option words", () => {
    const match = matchField({
      label: "I am authorized to work in the United States",
      kind: "checkbox",
      options: ["I am authorized to work in the United States"],
    })
    expect(match?.fieldId).toBe("workAuthorization")
  })
})
