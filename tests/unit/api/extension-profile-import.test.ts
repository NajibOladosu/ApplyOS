import { describe, it, expect } from 'vitest'
import {
  buildImportPrompt,
  coerceImportedProfile,
  extractJsonObject,
} from '@/app/api/extension/_lib/profile-import'

describe('extractJsonObject', () => {
  it('parses a plain JSON object', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 })
  })

  it('parses JSON inside a markdown fence', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(extractJsonObject('```\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('parses JSON wrapped in prose', () => {
    expect(extractJsonObject('Here is the profile you asked for: {"a":1} — hope it helps!')).toEqual({ a: 1 })
  })

  it('takes the outermost object when nested', () => {
    expect(extractJsonObject('{"outer":{"inner":2}}')).toEqual({ outer: { inner: 2 } })
  })

  it('returns null for non-objects and unparseable text', () => {
    expect(extractJsonObject('')).toBeNull()
    expect(extractJsonObject('no braces here')).toBeNull()
    expect(extractJsonObject('{broken json]')).toBeNull()
    expect(extractJsonObject('[1,2,3]')).toBeNull()
    // Two separate objects are not one valid JSON document
    expect(extractJsonObject('{"a":1} trailing {"b":2}')).toBeNull()
  })
})

describe('coerceImportedProfile', () => {
  it('returns an empty object for junk input', () => {
    expect(coerceImportedProfile(null)).toEqual({})
    expect(coerceImportedProfile('string')).toEqual({})
    expect(coerceImportedProfile({ nonsense: true })).toEqual({})
  })

  it('keeps known scalar fields and drops unknown ones', () => {
    const profile = coerceImportedProfile({
      identity: { firstName: 'Ada', lastName: 'Lovelace', favoriteColor: 'purple' },
      contact: { email: 'ada@example.com', phone: '+441234567890' },
      links: { linkedin: 'https://linkedin.com/in/ada' },
      work: { currentTitle: 'Mathematician', injected: '<script>' },
    })

    expect(profile.identity).toEqual({ firstName: 'Ada', lastName: 'Lovelace' })
    expect(profile.contact).toEqual({ email: 'ada@example.com', phone: '+441234567890' })
    expect(profile.links).toEqual({ linkedin: 'https://linkedin.com/in/ada' })
    expect(profile.work).toEqual({ currentTitle: 'Mathematician' })
  })

  it('normalises experience dates to YYYY-MM and drops empty entries', () => {
    const profile = coerceImportedProfile({
      experience: [
        { company: 'Analytical Engines', title: 'Engineer', startDate: '2023/7', endDate: '2024-01-15', current: 'yes' },
        { company: '', title: '', description: 'nothing identifiable' },
        { company: 'Babbage Co', title: 'Intern', startDate: '2022-06', current: true },
        { company: 'Bad Dates', title: 'Role', startDate: 'June 2022' },
      ],
    })

    expect(profile.experience).toEqual([
      { company: 'Analytical Engines', title: 'Engineer', startDate: '2023-07', endDate: '2024-01' },
      { company: 'Babbage Co', title: 'Intern', startDate: '2022-06', current: true },
      { company: 'Bad Dates', title: 'Role' },
    ])
  })

  it('normalises education years and requires a school', () => {
    const profile = coerceImportedProfile({
      educationHistory: [
        { school: 'London University', degree: 'BSc', endYear: 'graduated 2019', gpa: '3.9' },
        { degree: 'PhD', endYear: '2024' },
      ],
    })

    expect(profile.educationHistory).toEqual([
      { school: 'London University', degree: 'BSc', endYear: '2019', gpa: '3.9' },
    ])
  })

  it('rejects month 13 and years outside 1900-2099', () => {
    const profile = coerceImportedProfile({
      experience: [{ company: 'X', title: 'Y', startDate: '2023-13' }],
      educationHistory: [{ school: 'S', endYear: '3000' }],
    })

    expect(profile.experience).toEqual([{ company: 'X', title: 'Y' }])
    expect(profile.educationHistory).toEqual([{ school: 'S' }])
  })

  it('drops non-string scalars instead of coercing them', () => {
    const profile = coerceImportedProfile({
      identity: { firstName: 42, lastName: null },
      skills: ['a', 'b'],
      certifications: { a: 1 },
    })

    expect(profile).toEqual({})
  })
})

describe('buildImportPrompt', () => {
  it('embeds the resume text and asks for raw JSON', () => {
    const prompt = buildImportPrompt('ADA LOVELACE — Engineer')

    expect(prompt).toContain('ADA LOVELACE — Engineer')
    expect(prompt).toContain('Return raw JSON only')
    expect(prompt).toContain('"identity"')
    expect(prompt).toContain('"experience"')
  })
})
