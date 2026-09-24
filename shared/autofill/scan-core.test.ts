/**
 * Scanner tests, written as regression traps rather than shape checks.
 *
 * Every fixture here is a minimal reconstruction of something a real ATS does,
 * and each one pins a specific way the current `QuestionExtractor`
 * (extension/src/content/question-extractor.ts) or a naive visibility test gets
 * it wrong. Asserting "scanForm returned some descriptors" would pass against
 * all of those bugs, so nothing below stops at a count.
 *
 * jsdom runs no layout — `getBoundingClientRect()` is all zeros,
 * `offsetParent` is permanently null — so geometry arrives through a stubbed
 * VisibilityProbe. Real geometry is Playwright's job (section 12).
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { fieldKey } from './fingerprint'
import { scanForm, type ScanOptions } from './scan-core'
import { tokenize } from './tokenize'
import { isFillable, type ProbeRect, type VisibilityProbe } from './visibility'

// ---------------------------------------------------------------------------
// Probe stub
// ---------------------------------------------------------------------------

const VIEWPORT = { width: 1200, height: 800 }
const DOC_SIZE = { width: 1200, height: 5000 }
const DEFAULT_RECT: ProbeRect = { x: 24, y: 120, width: 320, height: 40 }

/**
 * Geometry comes from the fixture itself: `data-rect="x,y,w,h"` when a test
 * needs an exact box, otherwise the element's inline `left`/`top` so that
 * writing `style="left:-9999px"` in the HTML produces the honeypot geometry it
 * describes. Everything else gets one ordinary in-flow box.
 */
function rectOf(el: Element): ProbeRect {
  const data = el.getAttribute('data-rect')
  if (data !== null) {
    const [x, y, width, height] = data.split(',').map((part) => Number.parseFloat(part))
    return {
      x: x ?? DEFAULT_RECT.x,
      y: y ?? DEFAULT_RECT.y,
      width: width ?? DEFAULT_RECT.width,
      height: height ?? DEFAULT_RECT.height,
    }
  }

  const inline = (el as HTMLElement).style
  const left = Number.parseFloat(inline.left)
  const top = Number.parseFloat(inline.top)
  return {
    x: Number.isFinite(left) ? left : DEFAULT_RECT.x,
    y: Number.isFinite(top) ? top : DEFAULT_RECT.y,
    width: DEFAULT_RECT.width,
    height: DEFAULT_RECT.height,
  }
}

const probe: VisibilityProbe = {
  rect: rectOf,
  // jsdom does apply inline styles and the default stylesheet to
  // getComputedStyle, so `style="visibility:hidden"` in a fixture is real.
  style(el) {
    const cs = window.getComputedStyle(el)
    return {
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      position: cs.position,
    }
  },
  scroll: () => ({ x: 0, y: 0 }),
  docSize: () => DOC_SIZE,
  viewport: () => VIEWPORT,
  // jsdom's own offsetParent is hardcoded null, which would mean "no layout box"
  // for every element on the page; the stub says "laid out" and lets the
  // display/visibility checks do the deciding.
  offsetParent: (el) => (window.getComputedStyle(el).display === 'none' ? null : document.body),
}

const OPTS: ScanOptions = { probe, frameKey: '7:0' }

function mount(html: string): void {
  document.body.innerHTML = html
}

function scan(root: Element | Document = document, opts: ScanOptions = OPTS) {
  return scanForm(root, opts)
}

beforeEach(() => {
  document.body.innerHTML = ''
})

// ---------------------------------------------------------------------------

describe('scanForm — Greenhouse-shaped form', () => {
  const GREENHOUSE = `
    <form id="application_form">
      <div class="field">
        <label for="first_name">First Name <span class="required">*</span></label>
        <input type="text" id="first_name" name="job_application[first_name]" required>
      </div>
      <div class="field">
        <label for="last_name">Last Name</label>
        <input type="text" id="last_name" name="job_application[last_name]">
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input type="email" id="email" name="job_application[email]" autocomplete="email">
      </div>
      <div class="field">
        <label for="resume">Resume</label>
        <input type="file" id="resume" name="job_application[resume]">
      </div>
      <input type="hidden" name="authenticity_token" value="secret-csrf-token">
      <button type="submit">Submit Application</button>
      <input type="submit" value="Submit Application">
    </form>`

  it('describes every real field and no control the engine must never touch', () => {
    mount(GREENHOUSE)
    const { descriptors } = scan()

    // The hidden CSRF input and BOTH submit controls are absent: section 1 says
    // the human submits, and a control with no binding cannot be clicked.
    expect(descriptors.map((d) => d.elementId)).toEqual([
      'first_name',
      'last_name',
      'email',
      'resume',
    ])
    expect(descriptors.map((d) => d.kind)).toEqual(['text', 'text', 'email', 'file'])
    expect(descriptors.map((d) => d.order)).toEqual([0, 1, 2, 3])
  })

  it('reads the <label for> of each field and keeps the submitted name verbatim', () => {
    mount(GREENHOUSE)
    const { descriptors } = scan()

    expect(descriptors.map((d) => d.label)).toEqual([
      'First Name *',
      'Last Name',
      'Email',
      'Resume',
    ])
    expect(descriptors.every((d) => d.labelSource === 'label_for')).toBe(true)
    // fingerprint.ts collapses `[N]` but nothing else — the bracketed Rails name
    // has to survive the scan intact or the cache key is computed on a fiction.
    expect(descriptors[0]?.name).toBe('job_application[first_name]')
    expect(descriptors[2]?.autocomplete).toBe('email')
    expect(descriptors.map((d) => d.required)).toEqual([true, false, false, false])
  })

  it('binds each descriptor to the element that will be written to', () => {
    mount(GREENHOUSE)
    const { descriptors, bindings } = scan()

    for (const descriptor of descriptors) {
      expect(bindings.get(descriptor.id)).toBe(document.getElementById(descriptor.elementId ?? ''))
    }
    expect(descriptors[0]?.frameKey).toBe('7:0')
  })

  it('does not mistake identical field wrappers for a repeater', () => {
    mount(GREENHOUSE)
    const { descriptors } = scan()

    // All four fields sit in an identical <div class="field">. Shape-only
    // repeater detection would call first_name row 0 and last_name row 1, which
    // writes a bogus repeatGroup into every fieldKey on the page.
    expect(descriptors.map((d) => d.repeatGroup)).toEqual([null, null, null, null])
    expect(descriptors.map((d) => d.occurrenceIndex)).toEqual([null, null, null, null])
  })

  it('reports an existing value as a boolean and never carries the value', () => {
    mount(GREENHOUSE)
    expect(scan().descriptors.map((d) => d.hasExistingValue)).toEqual([false, false, false, false])

    const email = document.getElementById('email') as HTMLInputElement
    email.value = 'applicant@example.test'
    const { descriptors } = scan()

    expect(descriptors[2]?.hasExistingValue).toBe(true)
    expect(JSON.stringify(descriptors)).not.toContain('applicant@example.test')
    expect(JSON.stringify(descriptors)).not.toContain('secret-csrf-token')
  })
})

// ---------------------------------------------------------------------------

describe('scanForm — Lever-shaped form', () => {
  const LEVER = `
    <form class="application-form">
      <ul class="application-additional">
        <li class="application-question">
          <label class="application-label">
            <span class="text">Full name</span> <span class="required">✱</span>
            <input type="text" name="name" placeholder="Full name" required>
          </label>
        </li>
        <li class="application-question">
          <label class="application-label">
            <span class="text">Email</span>
            <input type="email" name="email" required>
          </label>
        </li>
        <li class="application-question">
          <label class="application-label">
            <span class="text">LinkedIn URL</span>
            <input type="url" name="urls[LinkedIn]">
          </label>
        </li>
      </ul>
    </form>`

  it('labels a field from the <label> wrapped around it', () => {
    mount(LEVER)
    const { descriptors } = scan()

    expect(descriptors).toHaveLength(3)
    expect(descriptors.every((d) => d.labelSource === 'wrapping_label')).toBe(true)
    expect(descriptors.map((d) => d.kind)).toEqual(['text', 'email', 'url'])
    // No ids in this markup, and the scanner must not invent any.
    expect(descriptors.every((d) => d.elementId === null)).toBe(true)
    expect(descriptors[2]?.name).toBe('urls[LinkedIn]')
  })

  it('keeps the required marker from being welded onto the last word', () => {
    mount(LEVER)
    const label = scan().descriptors[0]?.label ?? ''

    // textContent would give "Full name✱": Lever's marker is its own element and
    // U+2731 is not in normalizeText's punctuation class (tokenize.ts:24), so
    // the resolver would tokenize `name✱` and never match the `name` phrase.
    expect(label).toBe('Full name ✱')
    expect(tokenize(label)).toContain('name')
  })

  it('does not mistake sibling question rows for a repeater', () => {
    mount(LEVER)
    // Three structurally identical <li class="application-question"> rows: only
    // the per-row field signatures (name / email / urls) say they are different
    // questions rather than three rows of one.
    expect(scan().descriptors.every((d) => d.repeatGroup === null)).toBe(true)
  })
})

// ---------------------------------------------------------------------------

describe('scanForm — radio group', () => {
  const RADIOS = `
    <form>
      <fieldset id="work_auth_set">
        <legend>Are you legally authorized to work in the United States?</legend>
        <label for="wa_yes"><input type="radio" id="wa_yes" name="work_auth" value="1"> Yes</label>
        <label for="wa_no"><input type="radio" id="wa_no" name="work_auth" value="0"> No</label>
      </fieldset>
    </form>`

  it('collapses the members into one question labelled by the legend', () => {
    mount(RADIOS)
    const { descriptors, bindings } = scan()

    expect(descriptors).toHaveLength(1)
    const [group] = descriptors
    expect(group?.kind).toBe('radio_group')
    expect(group?.label).toBe('Are you legally authorized to work in the United States?')
    expect(group?.labelSource).toBe('fieldset_legend')
    expect(group?.group).toBe('work_auth')
    // Bound to a member, not the fieldset: the write path clicks a radio.
    expect(bindings.get(group?.id ?? '')).toBe(document.getElementById('wa_yes'))
  })

  it('carries each option as submitted value plus human text', () => {
    mount(RADIOS)
    const [group] = scan().descriptors

    // Without the text, "Yes" is unmatchable; without the value, nothing can be
    // submitted. Section 3's FillValue for a choice needs both.
    expect(group?.options).toEqual([
      { value: '1', text: 'Yes', disabled: false },
      { value: '0', text: 'No', disabled: false },
    ])
  })

  it('reports the group as answered when any member is checked', () => {
    mount(RADIOS)
    expect(scan().descriptors[0]?.hasExistingValue).toBe(false)

    const no = document.getElementById('wa_no') as HTMLInputElement
    no.checked = true

    expect(scan().descriptors[0]?.hasExistingValue).toBe(true)
  })
})

// ---------------------------------------------------------------------------

describe('scanForm — select with opaque option values', () => {
  const SELECT = `
    <div class="field">
      <label for="gh_source">How did you hear about us?</label>
      <select id="gh_source" name="job_application[source]">
        <option value="">Please select</option>
        <option value="4f3b2a1c">LinkedIn</option>
        <option value="9d8e7f6a" disabled>Employee Referral</option>
        <option>Other</option>
      </select>
    </div>`

  it('keeps the value alongside the text', () => {
    mount(SELECT)
    const [field] = scan().descriptors

    expect(field?.kind).toBe('select')
    expect(field?.options).toEqual([
      { value: '', text: 'Please select', disabled: false },
      { value: '4f3b2a1c', text: 'LinkedIn', disabled: false },
      { value: '9d8e7f6a', text: 'Employee Referral', disabled: true },
      // No value attribute: the DOM falls back to the option's text, which is
      // exactly what `select.value = x` must be set to.
      { value: 'Other', text: 'Other', disabled: false },
    ])

    // The regression this pins: question-extractor.ts:118-125 returns
    // ['Please select','LinkedIn',…] and nothing can select an opaque id from that.
    const linkedin = field?.options?.[1]
    expect(linkedin?.value).not.toBe(linkedin?.text)
  })

  it('treats the empty placeholder option as unanswered', () => {
    mount(SELECT)
    expect(scan().descriptors[0]?.hasExistingValue).toBe(false)

    const select = document.getElementById('gh_source') as HTMLSelectElement
    select.value = '4f3b2a1c'

    expect(scan().descriptors[0]?.hasExistingValue).toBe(true)
  })
})

// ---------------------------------------------------------------------------

describe('scanForm — shadow DOM', () => {
  it('resolves label[for] inside the shadow root, not against the document', () => {
    mount(`
      <label for="preferred">DECOY light-DOM label</label>
      <div id="host"></div>`)

    const host = document.getElementById('host') as HTMLElement
    host.attachShadow({ mode: 'open' }).innerHTML = `
      <label for="preferred">Preferred Name</label>
      <input id="preferred" name="preferred_name">`

    const { descriptors, bindings } = scan()
    const [field] = descriptors

    expect(descriptors).toHaveLength(1)
    // `document.querySelector('label[for=preferred]')` finds the decoy — that is
    // the section 7.5 bug. Resolution has to go through el.getRootNode().
    expect(field?.label).toBe('Preferred Name')
    expect(field?.labelSource).toBe('label_for')
    expect(bindings.get(field?.id ?? '')).toBe(host.shadowRoot?.getElementById('preferred'))
    // The path is not a single selector; it names the boundary it crosses.
    expect(field?.domPath).toContain(' >>> ')
  })

  it('cannot see into a closed root, and does not pretend otherwise', () => {
    mount(`<div id="open"></div><div id="closed"></div>`)

    const open = document.getElementById('open') as HTMLElement
    open.attachShadow({ mode: 'open' }).innerHTML = `<input id="visible_field" name="a">`
    const closed = document.getElementById('closed') as HTMLElement
    closed.attachShadow({ mode: 'closed' }).innerHTML = `<input id="unreachable" name="b">`

    const { descriptors } = scan()

    expect(descriptors.map((d) => d.name)).toEqual(['a'])
  })
})

// ---------------------------------------------------------------------------

describe('scanForm — aria-labelledby with two ids', () => {
  it('joins every referenced element, not just the first id', () => {
    mount(`
      <div class="question">
        <span id="q7_label">Have you worked at Acme before?</span>
        <span id="q7_hint">(including internships)</span>
        <input id="q7" name="previously_employed" aria-labelledby="q7_label q7_hint">
      </div>`)

    // The bug being closed: aria-labelledby is an ID REFERENCE LIST, and
    // question-extractor.ts:57-60 passes the whole attribute to getElementById.
    expect(document.getElementById('q7_label q7_hint')).toBeNull()

    const [field] = scan().descriptors
    expect(field?.label).toBe('Have you worked at Acme before? (including internships)')
    expect(field?.labelSource).toBe('aria_labelledby')
  })
})

// ---------------------------------------------------------------------------

describe('scanForm — visibility in document coordinates', () => {
  it('keeps a field below the fold', () => {
    mount(`
      <div class="field">
        <label for="deep">Desired salary</label>
        <input id="deep" data-rect="24,3000,320,40">
      </div>`)

    const rect = rectOf(document.getElementById('deep') as Element)
    // A naive `rect.y > viewport.height` test rejects this, and a Greenhouse
    // form is several viewports tall — that is most of the form, gone.
    expect(rect.y).toBeGreaterThan(VIEWPORT.height)

    const [field] = scan().descriptors
    expect(field?.elementId).toBe('deep')
    expect(field?.visible).toBe(true)
  })

  it('excludes a left:-9999px honeypot', () => {
    mount(`
      <div class="field">
        <label for="real">Email</label>
        <input id="real" type="email" name="email">
      </div>
      <div class="field" style="position:absolute;left:-9999px">
        <label for="trap">Leave this field blank</label>
        <input id="trap" name="url_confirm" style="position:absolute;left:-9999px">
      </div>`)

    const { descriptors, bindings } = scan()

    expect(descriptors.map((d) => d.elementId)).toEqual(['real'])
    expect([...bindings.values()]).not.toContain(document.getElementById('trap'))
  })

  it('can surface hidden fields for diagnostics, flagged as not visible', () => {
    mount(`
      <input id="real" name="email">
      <input id="trap" name="url_confirm" style="position:absolute;left:-9999px">
      <input id="ghost" name="ghost" style="visibility:hidden">`)

    const { descriptors } = scan(document, { ...OPTS, includeHidden: true })

    expect(descriptors.map((d) => [d.elementId, d.visible])).toEqual([
      ['real', true],
      ['trap', false],
      ['ghost', false],
    ])
  })
})

// ---------------------------------------------------------------------------

describe('scanForm — repeater rows', () => {
  const REPEATER = `
    <div id="employment">
      <div class="repeat-row" data-automation-id="workExperience-1">
        <label for="c0">Company</label>
        <input id="c0" name="experience[0][company]" data-automation-id="company">
        <label for="t0">Title</label>
        <input id="t0" name="experience[0][title]" data-automation-id="title">
      </div>
      <div class="repeat-row" data-automation-id="workExperience-2">
        <label for="c1">Company</label>
        <input id="c1" name="experience[1][company]" data-automation-id="company">
        <label for="t1">Title</label>
        <input id="t1" name="experience[1][title]" data-automation-id="title">
      </div>
    </div>`

  it('gives each row a distinct occurrenceIndex under one repeatGroup', () => {
    mount(REPEATER)
    const byId = new Map(scan().descriptors.map((d) => [d.elementId, d]))

    const company0 = byId.get('c0')
    const company1 = byId.get('c1')
    const title0 = byId.get('t0')

    expect(company0?.occurrenceIndex).toBe(0)
    expect(company1?.occurrenceIndex).toBe(1)
    expect(company0?.repeatGroup).not.toBeNull()
    // One repeater, one group: rows are separated by index, not by group.
    expect(company1?.repeatGroup).toBe(company0?.repeatGroup)
    expect(title0?.repeatGroup).toBe(company0?.repeatGroup)
  })

  it('produces different fieldKeys for the same field in two rows', async () => {
    mount(REPEATER)
    const byId = new Map(scan().descriptors.map((d) => [d.elementId, d]))
    const company0 = byId.get('c0')
    const company1 = byId.get('c1')

    if (company0 === undefined || company1 === undefined) throw new Error('missing descriptors')

    // fieldKey collapses `experience[0][company]` and `experience[1][company]`
    // to the same string (fingerprint.ts:89-105); repeatGroup + occurrenceIndex
    // are the only thing left separating row 1's Company from row 2's.
    const [key0, key1] = await Promise.all([
      fieldKey('workday', company0),
      fieldKey('workday', company1),
    ])
    expect(key0).not.toBe(key1)
  })
})

// ---------------------------------------------------------------------------

describe('scanForm — custom widgets', () => {
  it('describes a react-select typeahead as one field, not an input plus a wrapper', () => {
    mount(`
      <div class="select-shell" role="combobox" aria-expanded="true">
        <label id="school_label" for="school">School</label>
        <input id="school" name="school" role="combobox" aria-autocomplete="list"
               aria-controls="school_listbox" aria-labelledby="school_label">
        <div id="school_listbox" role="listbox">
          <div role="option" data-value="24601">Acme University</div>
          <div role="option" data-value="24602">Beta College</div>
        </div>
      </div>`)

    const { descriptors, bindings } = scan()
    const [field] = descriptors

    // The outer div is also [role=combobox]; describing both would put two rows
    // in the overlay for one question and let the executor type into the div.
    expect(descriptors).toHaveLength(1)
    expect(field?.kind).toBe('typeahead')
    expect(bindings.get(field?.id ?? '')).toBe(document.getElementById('school'))
    expect(field?.options).toEqual([
      { value: '24601', text: 'Acme University', disabled: false },
      { value: '24602', text: 'Beta College', disabled: false },
    ])
  })

  it('groups a Workday-style month/day/year triple into one date field', () => {
    mount(`
      <div id="start_date" role="group" aria-label="Earliest start date">
        <input id="sd_m" data-automation-id="dateSectionMonth-input" placeholder="MM">
        <input id="sd_d" data-automation-id="dateSectionDay-input" placeholder="DD">
        <input id="sd_y" data-automation-id="dateSectionYear-input" placeholder="YYYY">
      </div>`)

    const { descriptors, bindings } = scan()
    const [field] = descriptors

    // Three inputs, one question: a FillValue of {type:'date'} answers all of
    // it, and three separate descriptors would ask the human three times.
    expect(descriptors).toHaveLength(1)
    expect(field?.kind).toBe('date_segmented')
    expect(field?.label).toBe('Earliest start date')
    expect(bindings.get(field?.id ?? '')).toBe(document.getElementById('start_date'))
  })

  it('does not group a lone year input as a segmented date', () => {
    mount(`
      <div class="field">
        <label for="grad_year">Graduation year</label>
        <input id="grad_year" name="graduation_year" placeholder="YYYY">
      </div>`)

    expect(scan().descriptors[0]?.kind).toBe('text')
  })
})

// ---------------------------------------------------------------------------

describe('isFillable', () => {
  it('rejects a control under an aria-hidden ancestor', () => {
    mount(`<div aria-hidden="true"><input id="ghost" name="ghost"></div>`)
    const verdict = isFillable(document.getElementById('ghost') as Element, probe)

    expect(verdict.fillable).toBe(false)
    expect(verdict.reason).toBe('aria_hidden')
  })

  it('reports a disabled control as rendered-but-unfillable so the plan can say so', () => {
    mount(`<input id="locked" name="locked" disabled>`)
    const verdict = isFillable(document.getElementById('locked') as Element, probe)

    expect(verdict).toEqual({ fillable: false, reason: 'disabled' })

    // It still reaches the scan: section 7.3 reports `skipped_disabled`, which
    // requires a descriptor to exist for it.
    const [field] = scan().descriptors
    expect(field?.elementId).toBe('locked')
    expect(field?.disabled).toBe(true)
    expect(field?.visible).toBe(true)
  })

  it('does not reject a position:fixed control for having no offsetParent', () => {
    mount(`<input id="sticky" name="sticky" style="position:fixed;left:40px;top:12px">`)
    const el = document.getElementById('sticky') as Element

    expect(probe.offsetParent(el)).not.toBeNull()
    // The real browser returns null here; prove the rule is the style check.
    const fixedProbe: VisibilityProbe = { ...probe, offsetParent: () => null }
    expect(isFillable(el, fixedProbe)).toEqual({ fillable: true, reason: 'ok' })

    const staticProbe: VisibilityProbe = { ...probe, offsetParent: () => null }
    mount(`<input id="detached" name="detached">`)
    expect(isFillable(document.getElementById('detached') as Element, staticProbe).reason).toBe(
      'not_rendered',
    )
  })
})
