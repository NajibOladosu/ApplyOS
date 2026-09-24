import { describe, expect, it } from 'vitest'

import { fieldKey, formFingerprint } from './fingerprint'
import type { FieldDescriptor } from './types'

/**
 * Full descriptors, not FieldIdentity subsets: the stability test has to prove
 * that the per-user and per-scan fields (`id`, `domPath`, `frameKey`,
 * `hasExistingValue`, `order`) are absent from the hash, and it can only do
 * that if they are present on the object being hashed.
 */
function descriptor(over: Partial<FieldDescriptor> = {}): FieldDescriptor {
  return {
    id: 'f1',
    fieldKey: '',
    frameKey: '1:0',
    kind: 'text',
    domPath: 'form > div:nth-child(2) > input',
    name: 'job_application[first_name]',
    elementId: 'first_name',
    autocomplete: 'given-name',
    inputType: 'text',
    label: 'First Name *',
    labelSource: 'label_for',
    placeholder: null,
    ariaLabel: null,
    describedBy: null,
    wrapperText: null,
    required: true,
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
    order: 3,
    ...over,
  }
}

describe('fieldKey', () => {
  it('is a 32-char lowercase hex string', async () => {
    expect(await fieldKey('greenhouse', descriptor())).toMatch(/^[0-9a-f]{32}$/)
  })

  it('is stable across users: same employer attributes, different per-user state', async () => {
    // Everything that differs here is scan-local or user-derived. If any of it
    // reached the hash the global cache would never hit across accounts.
    const userA = descriptor({
      id: 'f1',
      frameKey: '17:0',
      domPath: 'form > div:nth-child(2) > input',
      hasExistingValue: false,
      order: 3,
      visible: true,
    })
    const userB = descriptor({
      id: 'f92',
      frameKey: '4051:3',
      domPath: '#app > form > section > div > input',
      hasExistingValue: true,
      order: 11,
      visible: false,
    })

    expect(await fieldKey('greenhouse', userA)).toBe(await fieldKey('greenhouse', userB))
  })

  it('separates the same field on two different ATS platforms', async () => {
    const d = descriptor()
    expect(await fieldKey('greenhouse', d)).not.toBe(await fieldKey('lever', d))
  })

  it('collapses per-requisition trailing digits in elementId', async () => {
    const a = descriptor({ elementId: 'question_12345', name: null, label: 'Why this role?' })
    const b = descriptor({ elementId: 'question_67890', name: null, label: 'Why this role?' })

    expect(await fieldKey('greenhouse', a)).toBe(await fieldKey('greenhouse', b))
  })

  it('collapses repeater indices in name', async () => {
    const a = descriptor({ name: 'answers[0][text]', elementId: null })
    const b = descriptor({ name: 'answers[3][text]', elementId: null })

    expect(await fieldKey('greenhouse', a)).toBe(await fieldKey('greenhouse', b))
  })

  it('still distinguishes ids whose difference is not the trailing digits', async () => {
    // Guards the stripping regex against over-reach: it must eat the requisition
    // suffix, not the field's actual name.
    const a = descriptor({ elementId: 'first_name_12345' })
    const b = descriptor({ elementId: 'last_name_12345' })

    expect(await fieldKey('greenhouse', a)).not.toBe(await fieldKey('greenhouse', b))
  })

  it('separates repeater rows by occurrenceIndex', async () => {
    // Regression test for the collision the index collapse above creates: once
    // `answers[0]` and `answers[3]` hash alike, occurrenceIndex is the only
    // thing keeping row 1's "Company" apart from row 3's "Company".
    const row0 = descriptor({
      name: 'workExperience[0][company]',
      elementId: null,
      label: 'Company',
      repeatGroup: 'work-experience',
      occurrenceIndex: 0,
    })
    const row2 = descriptor({ ...row0, occurrenceIndex: 2 })

    expect(await fieldKey('workday', row0)).not.toBe(await fieldKey('workday', row2))
  })

  it('separates identical rows in two different repeat groups', async () => {
    const work = descriptor({
      label: 'Start Date',
      name: null,
      elementId: null,
      repeatGroup: 'work-experience',
      occurrenceIndex: 0,
    })
    const education = descriptor({ ...work, repeatGroup: 'education' })

    expect(await fieldKey('workday', work)).not.toBe(await fieldKey('workday', education))
  })

  it('treats a null occurrenceIndex as distinct from index 0', async () => {
    const outside = descriptor({ repeatGroup: 'work-experience', occurrenceIndex: null })
    const firstRow = descriptor({ repeatGroup: 'work-experience', occurrenceIndex: 0 })

    expect(await fieldKey('workday', outside)).not.toBe(await fieldKey('workday', firstRow))
  })

  it('ignores label casing, spacing and required markers', async () => {
    const a = descriptor({ label: 'First Name *' })
    const b = descriptor({ label: '  first   name  ' })

    expect(await fieldKey('greenhouse', a)).toBe(await fieldKey('greenhouse', b))
  })

  it('distinguishes two fields whose only difference is the label', async () => {
    const a = descriptor({ name: null, elementId: null, label: 'Desired salary' })
    const b = descriptor({ name: null, elementId: null, label: 'Current salary' })

    expect(await fieldKey('greenhouse', a)).not.toBe(await fieldKey('greenhouse', b))
  })

  it('distinguishes the same label rendered as different control kinds', async () => {
    const select = descriptor({ label: 'Country', kind: 'select' })
    const typeahead = descriptor({ ...select, kind: 'typeahead' })

    expect(await fieldKey('workday', select)).not.toBe(await fieldKey('workday', typeahead))
  })

  it('distinguishes fields by atsHint', async () => {
    const a = descriptor({ name: null, elementId: null, atsHint: 'phoneNumber' })
    const b = descriptor({ name: null, elementId: null, atsHint: 'phoneExtension' })

    expect(await fieldKey('workday', a)).not.toBe(await fieldKey('workday', b))
  })

  it('does not let an employer-authored separator forge another field key', async () => {
    // A `data-automation-id` containing the join delimiter must not be able to
    // impersonate a different (name, id) split — in a globally shared cache that
    // is a poisoning primitive, see AUTOFILL_ARCHITECTURE.md section 10.2.
    const crafted = descriptor({ name: '', elementId: '', atsHint: 'a|b', label: null })
    const honest = descriptor({ name: '', elementId: 'a', atsHint: 'b', label: null })

    expect(await fieldKey('workday', crafted)).not.toBe(await fieldKey('workday', honest))
  })
})

describe('formFingerprint', () => {
  const keys = ['aaa', 'bbb', 'ccc']

  it('is a 32-char lowercase hex string', async () => {
    expect(await formFingerprint('greenhouse', keys)).toMatch(/^[0-9a-f]{32}$/)
  })

  it('is order-independent', async () => {
    const forward = await formFingerprint('greenhouse', keys)
    const reversed = await formFingerprint('greenhouse', [...keys].reverse())
    const shuffled = await formFingerprint('greenhouse', ['bbb', 'aaa', 'ccc'])

    expect(reversed).toBe(forward)
    expect(shuffled).toBe(forward)
  })

  it('accepts any iterable of keys, including a Set', async () => {
    expect(await formFingerprint('greenhouse', new Set(keys))).toBe(
      await formFingerprint('greenhouse', keys),
    )
  })

  it('changes when a field is added', async () => {
    expect(await formFingerprint('greenhouse', [...keys, 'ddd'])).not.toBe(
      await formFingerprint('greenhouse', keys),
    )
  })

  it('changes when a field is removed', async () => {
    expect(await formFingerprint('greenhouse', ['aaa', 'bbb'])).not.toBe(
      await formFingerprint('greenhouse', keys),
    )
  })

  it('changes when a field key is replaced', async () => {
    expect(await formFingerprint('greenhouse', ['aaa', 'bbb', 'zzz'])).not.toBe(
      await formFingerprint('greenhouse', keys),
    )
  })

  it('is scoped by ATS', async () => {
    expect(await formFingerprint('lever', keys)).not.toBe(
      await formFingerprint('greenhouse', keys),
    )
  })

  it('ignores a duplicated key: a field enumerated twice is still one field', async () => {
    expect(await formFingerprint('greenhouse', ['aaa', 'bbb', 'aaa', 'ccc'])).toBe(
      await formFingerprint('greenhouse', keys),
    )
  })

  it('does not collide with a different form via the join separator', async () => {
    expect(await formFingerprint('greenhouse', ['a|b'])).not.toBe(
      await formFingerprint('greenhouse', ['a', 'b']),
    )
  })

  it('survives requisition churn but not a changed form, end to end', async () => {
    const print = async (fields: readonly FieldDescriptor[]): Promise<string> =>
      formFingerprint('greenhouse', await Promise.all(fields.map((d) => fieldKey('greenhouse', d))))

    // Requisition 1 and requisition 2 of the same posting: the custom question's
    // element id is minted per requisition, and the fields come back in a
    // different scan order. Both must land on one cache entry.
    const firstName = descriptor({ elementId: 'first_name', label: 'First Name *' })
    const email = descriptor({ elementId: 'email', label: 'Email *', kind: 'email' })
    const question = (id: string): FieldDescriptor =>
      descriptor({ elementId: id, name: null, label: 'Why this role?', kind: 'textarea' })

    const req1 = [firstName, email, question('question_12345')]
    const req2 = [question('question_98765'), email, firstName]

    expect(await print(req2)).toBe(await print(req1))

    // One extra question added to the form invalidates the cached plan.
    const salary = descriptor({
      elementId: 'question_555',
      name: null,
      label: 'Salary expectations',
      kind: 'text',
    })
    expect(await print([...req1, salary])).not.toBe(await print(req1))
  })
})

describe('missing WebCrypto', () => {
  it('throws a diagnosable error rather than a TypeError', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })
    try {
      await expect(fieldKey('greenhouse', descriptor())).rejects.toThrow(/crypto\.subtle/)
    } finally {
      if (original) Object.defineProperty(globalThis, 'crypto', original)
      else Reflect.deleteProperty(globalThis, 'crypto')
    }
  })
})
