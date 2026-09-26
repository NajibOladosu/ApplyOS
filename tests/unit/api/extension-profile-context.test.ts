import { describe, it, expect } from 'vitest'
import { profileToBackground } from '@/app/api/extension/_lib/profile-context'

describe('profileToBackground', () => {
  it('returns an empty string for null, undefined and non-objects', () => {
    expect(profileToBackground(null)).toBe('')
    expect(profileToBackground(undefined)).toBe('')
    expect(profileToBackground('resume')).toBe('')
    expect(profileToBackground(42)).toBe('')
  })

  it('returns an empty string for an empty profile', () => {
    expect(profileToBackground({})).toBe('')
    expect(profileToBackground({ identity: {}, contact: {} })).toBe('')
  })

  it('renders identity, contact and links', () => {
    const text = profileToBackground({
      identity: { firstName: 'Ada', lastName: 'Lovelace', preferredName: 'Ada' },
      contact: { email: 'ada@example.com', phone: '+44 20 7946 0958', city: 'London', country: 'UK' },
      links: { linkedin: 'https://linkedin.com/in/ada', github: '' },
    })

    expect(text).toContain('Name: Ada Lovelace')
    expect(text).toContain('Email: ada@example.com')
    expect(text).toContain('Location: London, UK')
    expect(text).toContain('LinkedIn: https://linkedin.com/in/ada')
    // Empty link values drop out entirely
    expect(text).not.toContain('GitHub')
  })

  it('renders structured work history and work facts', () => {
    const text = profileToBackground({
      experience: [
        {
          title: 'Engineer',
          company: 'Analytical Engines',
          startDate: '2023-01',
          current: true,
          description: 'Built difference engines.',
        },
        { title: 'Intern', company: 'Babbage Co', startDate: '2022-06', endDate: '2022-12' },
      ],
      work: { currentTitle: 'Engineer', yearsExperience: '4+' },
    })

    expect(text).toContain('Engineer at Analytical Engines (2023-01 - present): Built difference engines.')
    expect(text).toContain('Intern at Babbage Co (2022-06 - 2022-12)')
    expect(text).toContain('Current title: Engineer')
    expect(text).toContain('Years of experience: 4+')
  })

  it('skips experience entries with neither title nor company', () => {
    const text = profileToBackground({
      experience: [{ description: 'mystery role', startDate: '2020-01' }],
    })
    expect(text).toBe('')
  })

  it('renders education history and school facts, merging both', () => {
    const text = profileToBackground({
      educationHistory: [{ degree: 'BSc', fieldOfStudy: 'Mathematics', school: 'London University', endYear: '2019' }],
      education: { gpa: '3.9' },
    })

    expect(text).toContain('BSc, Mathematics, London University (2019)')
    expect(text).toContain('GPA: 3.9')
  })

  it('renders booleans in eligibility as Yes/No and strings verbatim', () => {
    const text = profileToBackground({
      eligibility: {
        workAuthorization: 'UK citizen',
        requiresSponsorship: false,
        willingToRelocate: true,
      },
    })

    expect(text).toContain('Work authorization: UK citizen')
    expect(text).toContain('Requires sponsorship: No')
    expect(text).toContain('Willing to relocate: Yes')
  })

  it('renders the saved-answers library as Q/A pairs', () => {
    const text = profileToBackground({
      screening: [
        { question: 'Why this company?', answer: 'I admire the engineering culture.' },
        { question: '', answer: 'orphan' },
        { question: 'no answer', answer: 7 },
      ],
    })

    expect(text).toContain('Q: Why this company?')
    expect(text).toContain('A: I admire the engineering culture.')
    expect(text).not.toContain('orphan')
    expect(text).not.toContain('no answer')
  })

  it('ignores wrong-typed values instead of throwing', () => {
    const text = profileToBackground({
      identity: { firstName: 123, lastName: null },
      contact: { email: { hacked: true } },
      skills: ['a', 'b'],
      experience: 'not-an-array',
      screening: 'nope',
    })

    expect(text).toBe('')
  })

  it('includes skills, certifications and languages when present', () => {
    const text = profileToBackground({
      skills: 'TypeScript, Go, Postgres',
      certifications: 'AWS Solutions Architect',
      languages: 'English (native), French (B1)',
    })

    expect(text).toContain('Skills: TypeScript, Go, Postgres')
    expect(text).toContain('Certifications: AWS Solutions Architect')
    expect(text).toContain('Languages: English (native), French (B1)')
  })
})
