import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { EMPTY_AUTOFILL_PROFILE } from "@/types/autofill"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  documents: vi.fn(),
  profile: vi.fn(),
  update: vi.fn(),
  rateLimit: vi.fn(),
}))

vi.mock("@/shared/db/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: (table: string) => {
      if (table === "documents") {
        return { select: () => ({ eq: () => ({ in: mocks.documents }) }) }
      }
      if (table === "users") {
        return {
          select: () => ({ eq: () => ({ single: mocks.profile }) }),
          update: mocks.update,
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  }),
}))
vi.mock("@/lib/middleware/rate-limit", () => ({
  rateLimitMiddleware: mocks.rateLimit,
  RATE_LIMITS: { general: {} },
}))

import { POST } from "@/app/api/profile/autofill-from-documents/route"

const firstId = "11111111-1111-4111-8111-111111111111"
const secondId = "22222222-2222-4222-8222-222222222222"

function request(documentIds: string[]): NextRequest {
  return new Request("http://localhost/api/profile/autofill-from-documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentIds }),
  }) as NextRequest
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
  mocks.rateLimit.mockResolvedValue(null)
  mocks.profile.mockResolvedValue({
    data: {
      id: "user-1",
      email: "account@example.com",
      name: "Existing Name",
      autofill_profile: { ...structuredClone(EMPTY_AUTOFILL_PROFILE), contact: { ...EMPTY_AUTOFILL_PROFILE.contact, phone: "+234000" } },
    },
    error: null,
  })
  mocks.update.mockImplementation(() => ({
    eq: () => ({ select: () => ({ single: async () => ({ data: { id: "user-1" }, error: null }) }) }),
  }))
})

describe("POST /api/profile/autofill-from-documents", () => {
  it("persists only blank fields from multiple owned cached analyses", async () => {
    mocks.documents.mockResolvedValue({ data: [
      { id: firstId, file_name: "first.pdf", parsed_data: { application_details: { contact: { phone: "+234111" }, identity: { firstName: "Ada" } } } },
      { id: secondId, file_name: "second.pdf", parsed_data: { application_details: { links: { github: "https://github.com/ada" } } } },
    ], error: null })

    const response = await POST(request([firstId, secondId]))
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.documentsUsed).toEqual(["first.pdf", "second.pdf"])
    expect(result.profile.contact.phone).toBe("+234000")
    expect(result.profile.contact.email).toBe("account@example.com")
    expect(result.profile.identity.firstName).toBe("Ada")
    expect(result.profile.links.github).toBe("https://github.com/ada")
    expect(mocks.update).toHaveBeenCalledOnce()
    expect(mocks.update.mock.calls[0][0].autofill_profile).toEqual(result.profile)
    expect(mocks.update.mock.calls[0][0].name).toBeUndefined()
  })

  it("does not write when a selected document is not owned by the user", async () => {
    mocks.documents.mockResolvedValue({ data: [], error: null })
    const response = await POST(request([firstId]))
    expect(response.status).toBe(404)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("does not write when every found detail is already filled", async () => {
    mocks.documents.mockResolvedValue({ data: [
      { id: firstId, file_name: "resume.pdf", parsed_data: { application_details: { contact: { phone: "+234111" } } } },
    ], error: null })
    const response = await POST(request([firstId]))
    const result = await response.json()
    expect(response.status).toBe(200)
    expect(result.filledCount).toBe(0)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("combines unique history from selected documents only when that history is blank", async () => {
    mocks.documents.mockResolvedValue({ data: [
      { id: firstId, file_name: "first.pdf", parsed_data: {
        experience: [{ company: "Acme", role: "Engineer", start_date: "2020-01", end_date: "2022-01" }],
        education: [{ institution: "University A", degree: "BSc" }],
      } },
      { id: secondId, file_name: "second.pdf", parsed_data: {
        experience: [
          { company: "Acme", role: "Engineer", start_date: "2020-01", end_date: "2022-01" },
          { company: "Beta", role: "Senior Engineer", start_date: "2023-02", end_date: "Present" },
        ],
        education: [{ institution: "University B", degree: "MSc" }],
      } },
    ], error: null })

    const response = await POST(request([firstId, secondId]))
    const result = await response.json()
    expect(response.status).toBe(200)
    expect(result.profile.experience).toHaveLength(2)
    expect(result.profile.educationHistory).toHaveLength(2)
    expect(result.profile.work.currentCompany).toBe("Beta")
    expect(mocks.update).toHaveBeenCalledOnce()
  })
})
