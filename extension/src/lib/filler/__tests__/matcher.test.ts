import { describe, expect, it } from "vitest"
import { matchField, matchSavedAnswer, type FieldDescriptor } from "../matcher"
import { isNegated, normalize, similarity, tokenize } from "../normalize"

/**
 * These descriptors are transcribed from real application forms. The labels are
 * the actual label text Greenhouse, Lever, Workday, Ashby and SmartRecruiters
 * render — because the matcher's job is to survive real forms, not tidy ones.
 */

const input = (label: string, extra: Partial<FieldDescriptor> = {}): FieldDescriptor => ({
  label,
  kind: "text",
  ...extra,
})

describe("normalize", () => {
  it("splits camelCase so name attributes are matchable", () => {
    expect(normalize("firstName")).toBe("first name")
    expect(normalize("phoneNumber")).toBe("phone number")
    expect(normalize("Applicant_LastName")).toBe("applicant last name")
  })

  it("strips form punctuation and politeness", () => {
    expect(tokenize("Please enter your first name *")).toEqual(["first", "name"])
    expect(tokenize("Email Address (required)")).toEqual(["email", "address"])
  })

  it("does not over-stem words that merely end in s", () => {
    expect(tokenize("address")).toEqual(["address"])
    expect(tokenize("status")).toEqual(["status"])
    expect(tokenize("skills")).toEqual(["skill"])
  })

  it("detects negated phrasing", () => {
    expect(isNegated("I am not authorized to work in the US")).toBe(true)
    expect(isNegated("I do not require sponsorship")).toBe(true)
    expect(isNegated("Are you authorized to work in the US?")).toBe(false)
  })

  it("scores near-identical phrases higher than loosely related ones", () => {
    expect(similarity("Email Address", "email address")).toBeGreaterThan(
      similarity("Email Address", "email your references")
    )
  })
})

describe("matchField — autocomplete", () => {
  it("trusts the HTML autocomplete token over a vague label", () => {
    const match = matchField(input("Field 1", { autocomplete: "given-name", name: "q_12" }))
    expect(match?.fieldId).toBe("firstName")
    expect(match?.reason).toBe("autocomplete")
    expect(match?.confidence).toBe(1)
  })

  it("reads multi-token autocomplete values", () => {
    expect(matchField(input("", { autocomplete: "shipping postal-code" }))?.fieldId).toBe("postalCode")
  })
})

describe("matchField — Greenhouse", () => {
  it("matches the standard contact block", () => {
    expect(matchField(input("First Name", { name: "first_name" }))?.fieldId).toBe("firstName")
    expect(matchField(input("Last Name", { name: "last_name" }))?.fieldId).toBe("lastName")
    expect(matchField(input("Email", { name: "email" }))?.fieldId).toBe("email")
    expect(matchField(input("Phone", { name: "phone" }))?.fieldId).toBe("phone")
    expect(matchField(input("Location (City)", { name: "location" }))?.fieldId).toBe("city")
  })

  it("matches the signup links", () => {
    expect(matchField(input("LinkedIn Profile", { name: "urls[LinkedIn]" }))?.fieldId).toBe("linkedinUrl")
    expect(matchField(input("Website", { name: "urls[Website]" }))?.fieldId).toBe("websiteUrl")
  })

  it("distinguishes authorization from sponsorship in one sentence pair", () => {
    const authorization = matchField(
      input("Are you legally authorized to work in the United States?")
    )
    const sponsorship = matchField(
      input("Will you now or in the future require sponsorship for employment visa status?")
    )

    expect(authorization?.fieldId).toBe("workAuthorization")
    expect(sponsorship?.fieldId).toBe("requiresSponsorship")
  })
})

describe("matchField — Lever", () => {
  it("matches Lever's single full-name field", () => {
    expect(matchField(input("Full name", { name: "name" }))?.fieldId).toBe("fullName")
  })

  it("matches bracketed URL names", () => {
    expect(matchField(input("", { name: "urls[LinkedIn]" }))?.fieldId).toBe("linkedinUrl")
    expect(matchField(input("", { name: "urls[GitHub]", kind: "url" }))?.fieldId).toBe("githubUrl")
    expect(matchField(input("", { name: "urls[Portfolio]", kind: "url" }))?.fieldId).toBe("portfolioUrl")
  })

  it("treats the current company field correctly", () => {
    expect(matchField(input("Current company", { name: "org" }))?.fieldId).toBe("currentCompany")
  })

  it("maps the comments box to additional information, not a profile field", () => {
    expect(matchField(input("Additional information", { name: "comments", kind: "textarea" }))?.fieldId).toBe(
      "additionalInfo"
    )
  })
})

describe("matchField — Workday", () => {
  it("matches automation-id derived names", () => {
    expect(matchField(input("Legal First Name", { id: "legalNameSection_firstName" }))?.fieldId).toBe("firstName")
    expect(matchField(input("Email Address", { id: "email" }))?.fieldId).toBe("email")
    expect(matchField(input("Phone Number", { id: "phone-number" }))?.fieldId).toBe("phone")
  })

  it("matches the address block", () => {
    expect(matchField(input("Address Line 1", { id: "addressSection_addressLine1" }))?.fieldId).toBe("addressLine1")
    expect(matchField(input("City", { id: "addressSection_city" }))?.fieldId).toBe("city")
    expect(matchField(input("Postal Code", { id: "addressSection_postalCode" }))?.fieldId).toBe("postalCode")
  })

  it("matches its attribution question", () => {
    expect(
      matchField(input("How Did You Hear About Us?", { kind: "select", options: ["", "LinkedIn", "Referral"] }))
        ?.fieldId
    ).toBe("howDidYouHear")
  })
})

describe("matchField — Ashby and SmartRecruiters", () => {
  it("matches system field names", () => {
    expect(matchField(input("", { name: "_systemfield_name" }))?.fieldId).toBe("fullName")
    expect(matchField(input("", { name: "_systemfield_email", kind: "email" }))?.fieldId).toBe("email")
    expect(matchField(input("", { name: "_systemfield_location" }))?.fieldId).toBe("location")
  })

  it("matches camelCase ids", () => {
    expect(matchField(input("", { id: "firstName" }))?.fieldId).toBe("firstName")
    expect(matchField(input("", { id: "phoneNumber" }))?.fieldId).toBe("phone")
  })
})

describe("matchField — refusals", () => {
  it("ignores search and filter controls", () => {
    expect(matchField(input("Search", { name: "q" }))).toBeNull()
    expect(matchField(input("Search jobs", { name: "search" }))).toBeNull()
    expect(matchField(input("Filter by location", { name: "filter" }))).toBeNull()
    expect(matchField(input("Sort by", { kind: "select", options: ["Newest", "Oldest"] }))).toBeNull()
  })

  it("ignores credentials and payment fields", () => {
    expect(matchField(input("Password", { kind: "text", name: "password" }))).toBeNull()
    expect(matchField(input("Confirm password", { kind: "text" }))).toBeNull()
    expect(matchField(input("Card number", { name: "card_number" }))).toBeNull()
    expect(matchField(input("CVV", { name: "cvv" }))).toBeNull()
  })

  it("does not let 'research' trip the search filter", () => {
    // Regression: a token in "search" must not swallow "research experience".
    const match = matchField(input("Describe your research experience", { kind: "textarea" }))
    expect(match?.fieldId).not.toBe("skillsSummary")
    expect(match).toBeNull()
  })

  it("returns null rather than guessing on an unknown question", () => {
    expect(matchField(input("What is the airspeed velocity of an unladen swallow?"))).toBeNull()
    expect(matchField(input("", { kind: "text" }))).toBeNull()
  })
})

describe("matchField — kind discrimination", () => {
  it("does not put a company name in an essay box", () => {
    // "Why this company" is a textarea; currentCompany only accepts text/select.
    const match = matchField(input("Why do you want to work at this company?", { kind: "textarea" }))
    expect(match?.fieldId).toBe("whyCompany")
  })

  it("does not put years of experience into a phone field", () => {
    const match = matchField(input("Years of experience", { kind: "tel" }))
    // tel is text-shaped, so this may match — but never as a phone number.
    expect(match?.fieldId).not.toBe("phone")
  })

  it("allows a number input to take a numeric profile answer", () => {
    expect(matchField(input("Years of experience", { kind: "number" }))?.fieldId).toBe("yearsExperience")
  })

  it("recognises file inputs as documents", () => {
    expect(matchField(input("Resume/CV", { kind: "file" }))?.fieldId).toBe("resumeFile")
    expect(matchField(input("Cover Letter", { kind: "file" }))?.fieldId).toBe("coverLetterFile")
  })
})

describe("matchField — grouped controls", () => {
  it("reads the question from the fieldset, not the Yes/No options", () => {
    const match = matchField(
      input("Are you legally authorized to work in the United States?", {
        kind: "radio",
        options: ["Yes", "No"],
      })
    )
    expect(match?.fieldId).toBe("workAuthorization")
  })

  it("handles the sponsorship radio group", () => {
    const match = matchField(
      input("Will you require sponsorship to work in this country?", {
        kind: "radio",
        options: ["Yes", "No"],
      })
    )
    expect(match?.fieldId).toBe("requiresSponsorship")
  })
})

describe("matchField — EEO", () => {
  it("identifies voluntary demographic questions", () => {
    expect(matchField(input("Gender", { kind: "select", options: ["", "Male", "Female"] }))?.fieldId).toBe("gender")
    expect(matchField(input("Veteran Status", { kind: "select", options: ["", "I am a veteran"] }))?.fieldId).toBe(
      "veteranStatus"
    )
    expect(
      matchField(input("Race / Ethnicity", { kind: "select", options: ["", "White", "Asian"] }))?.fieldId
    ).toBe("race")
  })
})

describe("matchSavedAnswer", () => {
  const saved = [
    { question: "Do you have the right to work in the UK?", answer: "Yes, I hold indefinite leave to remain." },
    { question: "What is your notice period?", answer: "One month" },
  ]

  it("matches an identical question exactly", () => {
    const hit = matchSavedAnswer("What is your notice period?", saved)
    expect(hit?.answer).toBe("One month")
    expect(hit?.confidence).toBe(1)
  })

  it("tolerates punctuation and casing differences", () => {
    expect(matchSavedAnswer("what is your NOTICE PERIOD", saved)?.answer).toBe("One month")
  })

  it("refuses a loose match rather than answering wrongly", () => {
    // A wrong saved answer is worse than leaving the field for the user.
    expect(matchSavedAnswer("What is your salary expectation?", saved)).toBeNull()
    expect(matchSavedAnswer("", saved)).toBeNull()
  })
})
