import { beforeEach, describe, expect, it, vi } from 'vitest'
import { profileCompleteness, updateProfile } from './profile.service'
import { CORE_PROFILE_KEYS } from '@/modules/profile/lib/canonical-keys'
import type { UserProfile } from '@/types/database'

// One shared mock, shaped like the fluent PostgREST builder the service uses.
const captured: { update?: Record<string, unknown> } = {}
let selectResult: { data: unknown; error: unknown } = { data: null, error: null }

const builder = {
  select: vi.fn(() => builder),
  eq: vi.fn(() => builder),
  maybeSingle: vi.fn(async () => selectResult),
  single: vi.fn(async () => selectResult),
  update: vi.fn((patch: Record<string, unknown>) => {
    captured.update = patch
    return builder
  }),
  upsert: vi.fn(() => builder),
}

vi.mock('@/shared/db/supabase/client', () => ({
  createClient: () => ({ from: () => builder }),
}))

const USER = '11111111-1111-1111-1111-111111111111'

function profile(over: Partial<UserProfile> = {}): UserProfile {
  return {
    user_id: USER,
    legal_first_name: null,
    legal_middle_name: null,
    legal_last_name: null,
    preferred_first_name: null,
    name_suffix: null,
    pronouns: null,
    contact_email: null,
    phone_country_code: null,
    phone_number: null,
    phone_type: null,
    address_line1: null,
    address_line2: null,
    address_city: null,
    address_state: null,
    address_postal_code: null,
    address_country: null,
    linkedin_url: null,
    github_url: null,
    portfolio_url: null,
    other_links: [],
    work_authorization_country: null,
    work_authorized: null,
    requires_sponsorship: null,
    visa_status: null,
    additional_work_authorizations: [],
    willing_to_relocate: null,
    remote_preference: null,
    earliest_start_date: null,
    notice_period_days: null,
    is_over_18: null,
    desired_salary_min: null,
    desired_salary_max: null,
    desired_salary_currency: null,
    desired_salary_period: null,
    has_security_clearance: null,
    security_clearance_level: null,
    languages: [],
    default_how_did_you_hear: null,
    default_resume_document_id: null,
    default_cover_letter_document_id: null,
    autofill_enabled: true,
    autofill_never_submit: true,
    autofill_overrides: {},
    field_provenance: {},
    resume_import_document_id: null,
    resume_imported_at: null,
    created_at: null,
    updated_at: null,
    ...over,
  } as UserProfile
}

beforeEach(() => {
  vi.clearAllMocks()
  captured.update = undefined
  selectResult = { data: null, error: null }
})

describe('profileCompleteness', () => {
  it('reports every core key missing for an empty profile', () => {
    const r = profileCompleteness(profile())
    expect(r.populated).toEqual([])
    expect(r.missing).toHaveLength(CORE_PROFILE_KEYS.length)
    expect(r.total).toBe(CORE_PROFILE_KEYS.length)
    expect(r.ratio).toBe(0)
  })

  it('counts a populated key and keeps populated/missing disjoint and complete', () => {
    const r = profileCompleteness(profile({ legal_first_name: 'Ada', phone_number: '5550134' }))
    expect(r.populated).toContain('legal_first_name')
    expect(r.missing).not.toContain('legal_first_name')
    expect(r.populated.length + r.missing.length).toBe(CORE_PROFILE_KEYS.length)
    expect(r.ratio).toBeGreaterThan(0)
    expect(r.ratio).toBeLessThan(1)
  })

  it('does not count whitespace as a populated value', () => {
    // A form that posts empty strings would otherwise inflate the M0 ship metric.
    const r = profileCompleteness(profile({ legal_first_name: '   ' }))
    expect(r.populated).not.toContain('legal_first_name')
  })
})

describe('updateProfile provenance merge — the user always wins', () => {
  it('refuses a resume_import write to a key the user set, and keeps the user value', async () => {
    const current = profile({
      legal_first_name: 'Ada',
      field_provenance: {
        legal_first_name: { source: 'user', confidence: 1, updated_at: 'x', verified: true },
      },
    })
    selectResult = { data: current, error: null }

    await updateProfile(
      USER,
      { legal_first_name: 'ADA LOVELACE', phone_number: '5550134' },
      { source: 'resume_import', confidence: 0.82 },
    )

    // The user-owned column must not appear in the patch at all; the untouched
    // one must. Asserting on the wire payload rather than a return value is the
    // point — a merge that "returns" the right thing but still writes the column
    // has already lost the data.
    expect(captured.update).toBeDefined()
    expect(captured.update).not.toHaveProperty('legal_first_name')
    expect(captured.update).toHaveProperty('phone_number', '5550134')
  })

  it('lets a resume_import write a key with no prior provenance', async () => {
    selectResult = { data: profile(), error: null }
    await updateProfile(USER, { legal_last_name: 'Lovelace' }, { source: 'resume_import', confidence: 0.9 })
    expect(captured.update).toHaveProperty('legal_last_name', 'Lovelace')
  })

  it('lets a user overwrite a resume_import value', async () => {
    selectResult = {
      data: profile({
        legal_first_name: 'A.',
        field_provenance: {
          legal_first_name: { source: 'resume_import', confidence: 0.6, updated_at: 'x', verified: false },
        },
      }),
      error: null,
    }
    await updateProfile(USER, { legal_first_name: 'Ada' }, { source: 'user' })
    expect(captured.update).toHaveProperty('legal_first_name', 'Ada')
  })

  it('stamps provenance for accepted columns', async () => {
    selectResult = { data: profile(), error: null }
    await updateProfile(USER, { phone_number: '5550134' }, { source: 'resume_import', confidence: 0.77 })
    const prov = captured.update?.field_provenance as Record<string, { source: string; confidence: number }>
    expect(prov.phone).toMatchObject({ source: 'resume_import', confidence: 0.77 })
  })

  it('writes nothing when every column was refused', async () => {
    selectResult = {
      data: profile({
        legal_first_name: 'Ada',
        field_provenance: {
          legal_first_name: { source: 'user', confidence: 1, updated_at: 'x', verified: true },
        },
      }),
      error: null,
    }
    await updateProfile(USER, { legal_first_name: 'nope' }, { source: 'resume_import', confidence: 0.5 })
    // An empty patch would still fire the updated_at trigger and report a change
    // that never happened.
    expect(captured.update).toBeUndefined()
  })
})
