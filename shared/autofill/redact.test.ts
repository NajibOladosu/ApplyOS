/**
 * The redaction boundaries are the only thing standing between a job
 * application form and a telemetry table, so these tests are written as leak
 * hunts rather than shape checks: build the input out of recognisable
 * sentinels, serialize the output, and assert the sentinel is nowhere in it.
 *
 * A shape check ("the result has no `values` key") passes against a redactor
 * that nests the value one level deeper. `JSON.stringify(...).includes(...)`
 * does not.
 */

import { describe, expect, it } from 'vitest'

import {
  WIRE_LIMITS,
  redactForWire,
  redactOutcome,
  safePageUrl,
  toAuditPlan,
  type AuditPlan,
} from './redact'
import type {
  FieldDescriptor,
  FillOutcome,
  FillPlanPreview,
  FillValue,
  PlannedField,
} from './types'

/** Strings that must never survive a boundary. Distinctive enough to grep a blob for. */
const PHONE = 'SENTINEL_PHONE_5550134'
const EMAIL = 'SENTINEL_EMAIL@x.test'
const STREET = 'SENTINEL_STREET'
const ALL_VALUE_SENTINELS = [PHONE, EMAIL, STREET]

function descriptor(over: Partial<FieldDescriptor> = {}): FieldDescriptor {
  return {
    id: 'f_1',
    fieldKey: 'a1b2c3',
    frameKey: '99:0',
    kind: 'tel',
    domPath: 'form > div:nth-child(2) > input',
    name: 'job_application[phone]',
    elementId: 'phone_field',
    autocomplete: 'tel',
    inputType: 'tel',
    label: 'Phone',
    labelSource: 'label_for',
    placeholder: '(555) 555-5555',
    ariaLabel: null,
    describedBy: 'We will text you about interviews.',
    wrapperText: 'Contact details',
    required: true,
    disabled: false,
    readOnly: false,
    maxLength: null,
    options: null,
    group: null,
    atsHint: 'data-qa-phone',
    repeatGroup: null,
    occurrenceIndex: null,
    hasExistingValue: false,
    visible: true,
    order: 2,
    ...over,
  }
}

function planned(over: Partial<PlannedField> = {}): PlannedField {
  const d = over.descriptor ?? descriptor()
  return {
    fieldId: d.id,
    descriptor: d,
    profileKey: 'phone',
    confidence: 0.94,
    source: 'adapter',
    rationale: 'adapter selector match',
    sensitivity: 'contact',
    requiresConfirm: false,
    accepted: true,
    ...over,
  }
}

/** A preview whose every VALUE is a sentinel — the thing toAuditPlan exists to drop. */
function previewWithSentinelValues(): FillPlanPreview {
  const phone = descriptor({ id: 'f_phone' })
  const email = descriptor({
    id: 'f_email',
    fieldKey: 'e1e1e1',
    kind: 'email',
    name: 'job_application[email]',
    elementId: 'email_field',
    label: 'Email',
  })
  const street = descriptor({
    id: 'f_street',
    fieldKey: 's1s1s1',
    kind: 'text',
    name: 'job_application[address]',
    elementId: 'address_field',
    label: 'Street address',
  })
  const resume = descriptor({
    id: 'f_resume',
    fieldKey: 'r1r1r1',
    kind: 'file',
    name: 'job_application[resume]',
    elementId: 'resume_field',
    label: 'Resume',
  })

  const values: Record<string, FillValue> = {
    f_phone: { type: 'text', text: PHONE },
    f_email: { type: 'text', text: EMAIL },
    f_street: { type: 'text', text: STREET },
    // A file value smuggles the same content through a different member of the
    // FillValue union: the uploaded filename carries the applicant's legal name.
    f_resume: { type: 'file', assetId: 'asset_1', fileName: `${STREET}_resume.pdf`, mimeType: 'application/pdf' },
  }

  return {
    planId: 'plan_1',
    createdAt: '2026-09-19T12:00:00.000Z',
    ats: 'greenhouse',
    adapterConfidence: 'unverified',
    formFingerprint: 'ff00ff00',
    url: 'https://boards.greenhouse.io/acme/jobs/4242?token=SENTINEL_STREET',
    frameKey: '99:0',
    fields: [
      planned({ fieldId: 'f_phone', descriptor: phone, profileKey: 'phone' }),
      planned({ fieldId: 'f_email', descriptor: email, profileKey: 'email', sensitivity: 'contact' }),
      planned({ fieldId: 'f_street', descriptor: street, profileKey: 'address_line1' }),
      planned({ fieldId: 'f_resume', descriptor: resume, profileKey: 'resume_file', sensitivity: 'public' }),
    ],
    unresolved: [
      descriptor({
        id: 'f_unresolved',
        fieldKey: 'u1u1u1',
        kind: 'textarea',
        label: 'Why do you want to work here?',
        // An unresolved descriptor is still a descriptor: it carries page-local
        // handles that have no business in a persisted row.
        domPath: `form > div[data-applicant="${EMAIL}"] > textarea`,
      }),
    ],
    stats: { total: 5, resolved: 4, sensitive: 3, unresolved: 1 },
    values,
  }
}

describe('toAuditPlan', () => {
  it('drops every value, including the ones nested in a file FillValue', () => {
    const serialized = JSON.stringify(toAuditPlan(previewWithSentinelValues()))

    for (const sentinel of ALL_VALUE_SENTINELS) {
      expect(serialized).not.toContain(sentinel)
    }
  })

  it('drops the unresolved descriptors but keeps their count', () => {
    const audit = toAuditPlan(previewWithSentinelValues())

    expect(JSON.stringify(audit)).not.toContain('domPath')
    expect(audit.stats.unresolved).toBe(1)
  })

  it('narrows the plan url, so a requisition token in the query never reaches the row', () => {
    const audit = toAuditPlan(previewWithSentinelValues())

    expect(audit.url).toBe('https://boards.greenhouse.io/acme/jobs/4242')
  })

  it('keeps the facts the audit trail exists for', () => {
    // Without this, a redactor that returns {} would pass every leak test above.
    const audit = toAuditPlan(previewWithSentinelValues())

    expect(audit.fields.map((f) => f.profileKey)).toEqual([
      'phone',
      'email',
      'address_line1',
      'resume_file',
    ])
    expect(audit.fields[0]).toMatchObject({
      fieldId: 'f_phone',
      kind: 'tel',
      label: 'Phone',
      required: true,
      confidence: 0.94,
      sensitivity: 'contact',
    })
    expect(audit.planId).toBe('plan_1')
    expect(audit.formFingerprint).toBe('ff00ff00')
  })

  it('clips an absurdly long employer label', () => {
    const preview = previewWithSentinelValues()
    const shouting = 'A'.repeat(50_000)
    preview.fields[0] = planned({
      fieldId: 'f_phone',
      descriptor: descriptor({ id: 'f_phone', label: shouting }),
      profileKey: 'phone',
    })

    const label = toAuditPlan(preview).fields[0].label

    expect(label).not.toBeNull()
    expect(label?.length).toBe(WIRE_LIMITS.label)
  })

  it('refuses at compile time to accept a plan that still carries values', () => {
    const preview = previewWithSentinelValues()

    // The whole point of `values?: never` on AuditPlan: the "just log the plan"
    // shortcut must not compile. If this line ever stops erroring, the type has
    // lost the guarantee and the comments are all that is left.
    // @ts-expect-error FillPlanPreview.values is not assignable to AuditPlan.values
    const leaked: AuditPlan = preview
    expect(leaked).toBeDefined()
  })
})

describe('redactForWire', () => {
  /** Sentinels in every field redactForWire is supposed to drop (section 10.1). */
  function leakyDescriptor(): FieldDescriptor {
    return descriptor({
      id: `id_${PHONE}`,
      frameKey: `77:${EMAIL}`,
      domPath: `form > input[value="${PHONE}"]`,
      describedBy: `Confirming ${EMAIL}`,
      inputType: STREET,
      repeatGroup: `repeat_${STREET}`,
      hasExistingValue: true,
      options: [
        { value: `opt_${PHONE}`, text: 'Yes', disabled: false },
        { value: `opt_${EMAIL}`, text: 'No', disabled: false },
      ],
    })
  }

  it('drops every field that is not employer-authored form metadata', () => {
    const serialized = JSON.stringify(redactForWire(leakyDescriptor()))

    for (const sentinel of ALL_VALUE_SENTINELS) {
      expect(serialized).not.toContain(sentinel)
    }
  })

  it('drops hasExistingValue, which leaks how far into the application the user is', () => {
    const wire = redactForWire(leakyDescriptor())

    expect(Object.keys(wire)).not.toContain('hasExistingValue')
    expect(Object.keys(wire)).not.toContain('domPath')
    expect(Object.keys(wire)).not.toContain('frameKey')
    expect(Object.keys(wire)).not.toContain('id')
  })

  it('keeps the employer-authored metadata the classifier runs on', () => {
    const wire = redactForWire(descriptor({ ariaLabel: 'Phone number', group: 'Contact' }))

    expect(wire).toMatchObject({
      fieldKey: 'a1b2c3',
      kind: 'tel',
      name: 'job_application[phone]',
      elementId: 'phone_field',
      autocomplete: 'tel',
      label: 'Phone',
      placeholder: '(555) 555-5555',
      ariaLabel: 'Phone number',
      wrapperText: 'Contact details',
      group: 'Contact',
      atsHint: 'data-qa-phone',
      required: true,
    })
  })

  it('keeps option text but not option values', () => {
    const wire = redactForWire(leakyDescriptor())

    expect(wire.optionTexts).toEqual(['Yes', 'No'])
  })

  it('preserves null rather than coercing it to an empty string', () => {
    // '' and null are different signals to the resolver: '' is an attribute
    // present and blank, null is an attribute that does not exist.
    const wire = redactForWire(descriptor({ ariaLabel: null, group: null, options: null }))

    expect(wire.ariaLabel).toBeNull()
    expect(wire.group).toBeNull()
    expect(wire.optionTexts).toBeNull()
  })

  it('bounds every free-text field, so 40 fields cannot become a megabyte prompt', () => {
    const wire = redactForWire(
      descriptor({
        label: 'L'.repeat(50_000),
        wrapperText: 'W'.repeat(50_000),
        placeholder: 'P'.repeat(50_000),
        name: 'N'.repeat(50_000),
        options: Array.from({ length: 500 }, (_, i) => ({
          value: String(i),
          text: 'O'.repeat(500),
          disabled: false,
        })),
      }),
    )

    expect(wire.label?.length).toBe(WIRE_LIMITS.label)
    expect(wire.wrapperText?.length).toBe(WIRE_LIMITS.wrapperText)
    expect(wire.placeholder?.length).toBe(WIRE_LIMITS.attr)
    expect(wire.name?.length).toBe(WIRE_LIMITS.attr)
    expect(wire.optionTexts?.length).toBe(WIRE_LIMITS.options)
    expect(wire.optionTexts?.every((t) => t.length <= WIRE_LIMITS.optionText)).toBe(true)
  })
})

describe('redactOutcome', () => {
  function outcome(over: Partial<FillOutcome> = {}): FillOutcome {
    return {
      fieldId: 'f_phone',
      profileKey: 'phone',
      status: 'filled',
      strategy: 'native_setter',
      attempts: 1,
      observed: PHONE,
      error: null,
      elapsedMs: 12,
      ...over,
    }
  }

  it('drops the read-back value', () => {
    const serialized = JSON.stringify(redactOutcome(outcome()))

    expect(serialized).not.toContain(PHONE)
    expect(Object.keys(redactOutcome(outcome()))).not.toContain('observed')
  })

  it('drops the error string, which quotes the rejected input back', () => {
    const redacted = redactOutcome(
      outcome({ status: 'verify_failed', observed: null, error: `'${PHONE}' is not a valid phone number` }),
    )

    expect(JSON.stringify(redacted)).not.toContain(PHONE)
    expect(redacted.hasError).toBe(true)
  })

  it('keeps the outcome facts the funnel is measured on', () => {
    const redacted = redactOutcome(outcome({ attempts: 3, elapsedMs: 240 }))

    expect(redacted).toEqual({
      fieldId: 'f_phone',
      profileKey: 'phone',
      status: 'filled',
      strategy: 'native_setter',
      attempts: 3,
      elapsedMs: 240,
      hasError: false,
    })
  })
})

describe('safePageUrl', () => {
  it('strips the query string and the fragment', () => {
    expect(
      safePageUrl('https://myworkdayjobs.com/en-US/acme/job/Engineer_R-42?candidate=abc123#step=3'),
    ).toBe('https://myworkdayjobs.com/en-US/acme/job/Engineer_R-42')
  })

  it('strips a Greenhouse embed token', () => {
    expect(safePageUrl('https://boards.greenhouse.io/embed/job_app?token=6172817&utm=x')).toBe(
      'https://boards.greenhouse.io/embed/job_app',
    )
  })

  it('keeps the port, which is part of the origin', () => {
    expect(safePageUrl('http://localhost:3000/apply?x=1')).toBe('http://localhost:3000/apply')
  })

  it('returns empty for schemes whose href IS the payload', () => {
    expect(safePageUrl(`javascript:alert("${PHONE}")`)).toBe('')
    expect(safePageUrl(`file:///Users/jane/Desktop/${STREET}.pdf`)).toBe('')
    expect(safePageUrl(`data:text/plain,${EMAIL}`)).toBe('')
  })

  it('returns empty rather than throwing on junk', () => {
    expect(safePageUrl('not a url')).toBe('')
    expect(safePageUrl('')).toBe('')
  })
})
