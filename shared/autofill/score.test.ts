import { describe, expect, it } from 'vitest'

import {
  ACCEPT_THRESHOLD,
  AMBIGUITY_FACTOR,
  AMBIGUITY_MARGIN,
  REVIEW_THRESHOLD,
  resolveField,
  scoreField,
} from './score'
import { classifyLabelSensitivity } from './sensitivity'
import { signatureFor } from './taxonomy'
import { NEVER_PRE_ACCEPT, PROFILE_KEYS, type FieldDescriptor, type ProfileKey } from './types'

/**
 * A blank-slate descriptor. Every channel the resolver reads defaults to null so
 * a test states only the signals it is actually about: a fixture that quietly
 * carried `name: 'first_name'` into the "Company name" case would pass for the
 * wrong reason.
 */
function descriptor(over: Partial<FieldDescriptor> = {}): FieldDescriptor {
  return {
    id: 'f1',
    fieldKey: 'fk1',
    frameKey: '1:0',
    kind: 'text',
    domPath: 'form > input',
    name: null,
    elementId: null,
    autocomplete: null,
    inputType: null,
    label: null,
    labelSource: 'none',
    placeholder: null,
    ariaLabel: null,
    describedBy: null,
    wrapperText: null,
    required: false,
    disabled: false,
    readOnly: false,
    maxLength: null,
    options: null,
    group: null,
    atsHint: null,
    repeatGroup: null,
    occurrenceIndex: null,
    hasExistingValue: false,
    visible: true,
    order: 0,
    ...over,
  }
}

/** Confidence the named key reached before the ambiguity demotion, or 0 if it scored nothing. */
function confidenceOf(d: FieldDescriptor, key: ProfileKey): number {
  return scoreField(d).find((c) => c.key === key)?.confidence ?? 0
}

describe('resolveField', () => {
  /**
   * Greenhouse classic renders `<input id="first_name"
   * name="job_application[first_name]" autocomplete="given-name">` under a
   * "First Name *" label (section 4.3). Four agreeing channels is the easy case,
   * and it is the one that must come back pre-accepted — if this drops below
   * ACCEPT_THRESHOLD the engine confirms every field by hand and the feature is
   * pointless.
   */
  it('pre-accepts a Greenhouse first-name input', () => {
    const resolved = resolveField(
      descriptor({
        label: 'First Name *',
        labelSource: 'label_for',
        name: 'job_application[first_name]',
        elementId: 'first_name',
        autocomplete: 'given-name',
        inputType: 'text',
        required: true,
      }),
    )

    expect(resolved.key).toBe('legal_first_name')
    expect(resolved.confidence).toBeGreaterThanOrEqual(ACCEPT_THRESHOLD)
    expect(resolved.source).toBe('heuristic')
    expect(resolved.actionable).toBe(true)
  })

  /**
   * The collision the negatives exist for. "Company name" is the employer's own
   * name on a work-history row, and `full_name` lists the bare phrase ['name'];
   * without a per-channel penalty, label + name + id agreeing on "company name"
   * scores full_name at 30 + 26 + 22 = SATURATION and pre-fills the user's legal
   * name into the employer field.
   */
  it('does not read "Company name" as the applicant name', () => {
    const d = descriptor({
      label: 'Company name',
      labelSource: 'label_for',
      name: 'company_name',
      elementId: 'company_name',
    })

    expect(resolveField(d).key).not.toBe('full_name')
    expect(resolveField(d).key).not.toBe('legal_first_name')
    expect(confidenceOf(d, 'full_name')).toBeLessThan(REVIEW_THRESHOLD)
    expect(confidenceOf(d, 'legal_first_name')).toBeLessThan(REVIEW_THRESHOLD)
  })

  /** Same shape for links: `portfolio_url` claims the bare word "website". */
  it('does not read "Company website" as the portfolio link', () => {
    const d = descriptor({
      kind: 'url',
      label: 'Company website',
      labelSource: 'label_for',
      name: 'company_website',
      elementId: 'company_website',
    })

    expect(confidenceOf(d, 'portfolio_url')).toBeLessThan(REVIEW_THRESHOLD)
    expect(resolveField(d).key).not.toBe('portfolio_url')
  })

  /**
   * The rest of the negatives section 5 names by hand. Each label below is one a
   * real form asks next to the applicant's own version of the same field, so a
   * regression here writes the user's PII into somebody else's row.
   */
  it.each<[string, Partial<FieldDescriptor>, ProfileKey]>([
    // Kind 'text', not 'date': plenty of forms render the start date as a text
    // input with a JS picker, and with kind 'date' the KIND_MISMATCH multiplier
    // would carry this case on its own and the negative would go untested.
    [
      'first day',
      { label: 'First day available', name: 'first_day_available', kind: 'text' },
      'legal_first_name',
    ],
    ['employer phone', { label: 'Employer phone', name: 'employer_phone', kind: 'tel' }, 'phone'],
    ['manager name', { label: "Manager's last name", name: 'manager_last_name' }, 'legal_last_name'],
    ['reference name', { label: 'Reference last name', name: 'reference_last_name' }, 'legal_last_name'],
  ])('keeps "%s" away from the applicant field', (_label, over, forbidden) => {
    const d = descriptor({ labelSource: 'label_for', ...over })

    expect(resolveField(d).key).not.toBe(forbidden)
    expect(confidenceOf(d, forbidden)).toBeLessThan(REVIEW_THRESHOLD)
  })

  /**
   * Section 5: two plausible keys within AMBIGUITY_MARGIN is exactly when a wrong
   * guess is most expensive, so the winner is multiplied down into the human's
   * hands rather than coin-flipped. A combined "Phone / Email" control scores
   * both keys identically off every channel.
   */
  it('demotes a near-tie below what the winner alone would score', () => {
    const unambiguous = descriptor({ label: 'Email', name: 'email', elementId: 'email' })
    const tied = descriptor({
      label: 'Phone / Email',
      name: 'phone_email',
      elementId: 'phone_email',
    })

    const solo = scoreField(unambiguous)[0]
    const candidates = scoreField(tied)
    expect(solo.key).toBe('email')
    expect(resolveField(unambiguous).confidence).toBe(solo.confidence)

    expect(candidates.length).toBeGreaterThan(1)
    expect(candidates[0].confidence - candidates[1].confidence).toBeLessThan(AMBIGUITY_MARGIN)

    const resolved = resolveField(tied)
    expect(resolved.confidence).toBeCloseTo(candidates[0].confidence * AMBIGUITY_FACTOR, 10)
    expect(resolved.confidence).toBeLessThan(solo.confidence)
    // The whole point of the demotion: it stops being pre-accepted.
    expect(resolved.confidence).toBeLessThan(ACCEPT_THRESHOLD)
    expect(resolved.confidence).toBeGreaterThanOrEqual(REVIEW_THRESHOLD)
  })

  /**
   * cover_letter_file and cover_letter_text carry identical phrases on purpose
   * (taxonomy.ts, Documents section); only KIND_MISMATCH separates them. Without
   * it the pair ties and the ambiguity demotion sends every cover-letter field to
   * manual review.
   */
  it('separates the cover-letter upload from the cover-letter textarea by kind', () => {
    const upload = descriptor({
      kind: 'file',
      label: 'Cover Letter',
      name: 'cover_letter',
      elementId: 'cover_letter',
    })
    const paste = descriptor({
      kind: 'textarea',
      label: 'Cover Letter',
      name: 'cover_letter',
      elementId: 'cover_letter',
    })

    expect(resolveField(upload).key).toBe('cover_letter_file')
    expect(resolveField(paste).key).toBe('cover_letter_text')
    expect(resolveField(upload).confidence).toBeGreaterThanOrEqual(ACCEPT_THRESHOLD)
    expect(resolveField(paste).confidence).toBeGreaterThanOrEqual(ACCEPT_THRESHOLD)
  })

  /**
   * Workday labels its inputs through data-automation-id, which tokenizes to
   * ['legal','name','section','last','name'] — and 'legal name' is a full_name
   * phrase. The per-channel negative is what stops the section wrapper's
   * vocabulary from outvoting the field's own.
   */
  it('reads a Workday legalNameSection_lastName hint as the last name', () => {
    const resolved = resolveField(
      descriptor({
        label: 'Last Name',
        labelSource: 'label_for',
        atsHint: 'legalNameSection_lastName',
      }),
    )

    expect(resolved.key).toBe('legal_last_name')
    expect(resolved.confidence).toBeGreaterThanOrEqual(ACCEPT_THRESHOLD)
  })

  /**
   * There is no reusable answer bank in this repo (types.ts:25-29), so an essay
   * prompt has to come back unmapped and surface as "finish by hand" instead of
   * receiving a stored cover letter.
   */
  it('leaves an essay prompt unmapped', () => {
    const resolved = resolveField(
      descriptor({
        kind: 'textarea',
        label: 'Why do you want to work here?',
        name: 'question_8812',
      }),
    )

    expect(resolved.key).toBe('unmapped')
    expect(resolved.actionable).toBe(false)
    expect(resolved.confidence).toBeLessThan(REVIEW_THRESHOLD)
  })

  /**
   * sensitivityOf('unmapped') is 'public' (types.ts:170). A date-of-birth field
   * the resolver cannot map must still come back protected, because that verdict
   * is what keeps its label out of the AI-escalation payload.
   */
  it('marks an unmapped date-of-birth field protected from its label alone', () => {
    const resolved = resolveField(
      descriptor({ kind: 'date', label: 'What is your date of birth?', name: 'applicant_dob' }),
    )

    expect(resolved.key).toBe('unmapped')
    expect(resolved.sensitivity).toBe('protected')
  })

  it('classifies a salary field as compensation, which is never pre-accepted', () => {
    const resolved = resolveField(
      descriptor({
        label: 'Desired salary',
        labelSource: 'label_for',
        name: 'desired_salary',
        elementId: 'desired_salary',
      }),
    )

    expect(resolved.key).toBe('desired_salary')
    expect(resolved.sensitivity).toBe('compensation')
    expect(NEVER_PRE_ACCEPT.has('compensation')).toBe(true)
  })
})

/**
 * Section 5.2. Every one of these labels contains a sensitive term as a
 * SUBSTRING and none of them as a token: 'age' inside manager/average/page/
 * package, 'opt' inside optional, 'sex' inside Middlesex, 'race' inside trace,
 * 'gender' nowhere near "preferred language". A false `protected` verdict
 * hard-blocks an ordinary field behind the EEO opt-in, so String.includes here
 * would quietly break filling on every form that has a hiring-manager field.
 */
describe('classifyLabelSensitivity', () => {
  it.each([
    'Hiring manager',
    'Preferred language',
    'Average GPA',
    'Cover letter (Optional)',
    'Middlesex',
    'Message to the hiring team',
    'Package',
    'Page 2 of 3',
    'Manage your subscriptions',
  ])('does not call %j protected', (label) => {
    expect(classifyLabelSensitivity(label)).not.toBe('protected')
  })

  it.each([
    'Gender',
    'Race/Ethnicity',
    'Veteran status',
    'Voluntary Self-Identification of Disability',
    'Date of birth',
    'Are you Hispanic or Latino?',
    'Are you 18 years of age or older?',
  ])('calls %j protected', (label) => {
    expect(classifyLabelSensitivity(label)).toBe('protected')
  })

  it.each(['Desired salary', 'Salary expectations', 'Expected compensation', 'Hourly rate'])(
    'calls %j compensation',
    (label) => {
      expect(classifyLabelSensitivity(label)).toBe('compensation')
    },
  )

  /**
   * "Cover letter (Optional)" must not read as eligibility either — 'opt' is a
   * substring of "Optional" and the eligibility table anchors it as
   * 'optional practical training'.
   */
  it('keeps an optional cover letter out of the eligibility bucket', () => {
    expect(classifyLabelSensitivity('Cover letter (Optional)')).toBe('public')
  })

  it('classifies the eligibility questions it is meant to flag', () => {
    expect(classifyLabelSensitivity('Are you legally authorized to work in the US?')).toBe(
      'eligibility',
    )
    expect(classifyLabelSensitivity('Will you require visa sponsorship?')).toBe('eligibility')
  })
})

/**
 * The drift guard section 5 asks for. SPECS is typed as a Record over
 * MappableProfileKey so a missing key is a tsc error, but tsc does not run in
 * CI on this path yet and `as const` on PROFILE_KEYS is the only thing keeping
 * the union honest — assert it at runtime too.
 */
describe('taxonomy coverage', () => {
  it('has a signature for every profile key except unmapped', () => {
    const missing = PROFILE_KEYS.filter((key) => key !== 'unmapped' && signatureFor(key) === null)

    expect(missing).toEqual([])
    expect(signatureFor('unmapped')).toBeNull()
  })

  it('pins the thresholds section 5 fixes', () => {
    expect(ACCEPT_THRESHOLD).toBe(0.62)
    expect(REVIEW_THRESHOLD).toBe(0.45)
  })
})
