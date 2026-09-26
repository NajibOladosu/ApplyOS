import { describe, it, expect } from "vitest"
import { scoreNavLabel } from "../step-navigation"

describe("scoreNavLabel", () => {
  it("scores plain Next/Continue highest as next", () => {
    expect(scoreNavLabel("Next")).toEqual({ kind: "next", score: 100 })
    expect(scoreNavLabel("Continue")).toEqual({ kind: "next", score: 100 })
    expect(scoreNavLabel("Next »")).toEqual({ kind: "next", score: 100 })
    expect(scoreNavLabel("CONTINUE")).toEqual({ kind: "next", score: 100 })
  })

  it("scores submit phrases as submit", () => {
    expect(scoreNavLabel("Submit")).toEqual({ kind: "submit", score: 100 })
    expect(scoreNavLabel("Submit application")).toEqual({ kind: "submit", score: 100 })
    expect(scoreNavLabel("Send application")).toEqual({ kind: "submit", score: 90 })
    expect(scoreNavLabel("Apply now")).toEqual({ kind: "submit", score: 80 })
    expect(scoreNavLabel("Apply")).toEqual({ kind: "submit", score: 70 })
  })

  it("recognises weaker next phrasings", () => {
    // "continue" matches the strong word-boundary pattern even mid-phrase
    expect(scoreNavLabel("Save and continue")).toEqual({ kind: "next", score: 80 })
    expect(scoreNavLabel("Please proceed")).toEqual({ kind: "next", score: 60 })
    // A label that contains "next" scores as a strong next match
    expect(scoreNavLabel("Please proceed to the next part")).toEqual({ kind: "next", score: 80 })
    expect(scoreNavLabel("»")).toEqual({ kind: "next", score: 50 })
  })

  it("prefers next when both kinds match one label", () => {
    // "Next" also contains no submit phrase, but a label like
    // "Continue to apply" should be next, not submit.
    expect(scoreNavLabel("Continue to apply")?.kind).toBe("next")
  })

  it("refuses dangerous labels outright", () => {
    const forbidden = [
      "Back",
      "Previous",
      "Cancel",
      "Close",
      "Withdraw application",
      "Delete",
      "Discard changes",
      "Reset form",
      "Clear answers",
      "Save draft",
      "Share this job",
      "Log in",
      "Sign in",
      "Register",
      "Download application",
      "Print",
      "Preview",
      "Review your answers",
    ]
    for (const label of forbidden) {
      expect(scoreNavLabel(label), label).toBeNull()
    }
  })

  it("allows 'Save and continue' but refuses bare 'Save'", () => {
    expect(scoreNavLabel("Save")).toBeNull()
    expect(scoreNavLabel("Save & continue")).not.toBeNull()
    expect(scoreNavLabel("Save and continue")).not.toBeNull()
  })

  it("refuses empty and oversized labels", () => {
    expect(scoreNavLabel("")).toBeNull()
    expect(scoreNavLabel("   ")).toBeNull()
    expect(
      scoreNavLabel(
        "Next " + "very long marketing copy ".repeat(5)
      )
    ).toBeNull()
  })
})
