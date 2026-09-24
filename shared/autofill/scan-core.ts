/**
 * DOM walk -> FieldDescriptor[] + element bindings.
 *
 * Spec: extension/AUTOFILL_ARCHITECTURE.md sections 3, 5.3 and 7.5.
 *
 * This replaces `QuestionExtractor` (extension/src/content/question-extractor.ts)
 * for the autofill path. Three things that implementation does are not
 * survivable here:
 *
 *  - it pushes a label-only object with no element reference
 *    (question-extractor.ts:25-30), so nothing downstream can ever WRITE to the
 *    field it described. Hence `bindings`;
 *  - `document.getElementById(ariaLabelledBy)` (question-extractor.ts:57-60)
 *    treats `aria-labelledby` as a single id. It is an ID REFERENCE LIST, and
 *    Greenhouse's React widgets routinely use two ids (question + hint), so the
 *    lookup returns null and the label degrades to a placeholder;
 *  - `getOptions` keeps `opt.text` and throws `opt.value` away
 *    (question-extractor.ts:118-125). An ATS `<select>` submits an opaque id,
 *    so a text-only option list cannot fill anything.
 *
 * And one more, from section 7.5: `document.querySelector('label[for=id]')`
 * cannot see a shadow-scoped id. Every id reference here resolves against
 * `el.getRootNode()`.
 *
 * CONSTRAINTS ON THIS DIRECTORY (see AUTOFILL_ARCHITECTURE.md section 0.3):
 * relative imports only, no `chrome.*`, no Node builtins, no `server-only`,
 * and nothing that ends up on a descriptor may be a DOM node — descriptors are
 * JSON, the live elements stay in `bindings`.
 */

import { tokenize } from './tokenize'
import type { FieldDescriptor, FieldKind, FieldOption, LabelSource } from './types'
import { isFillable, isNotRendered, type VisibilityProbe } from './visibility'

// ---------------------------------------------------------------------------
// Budgets and guards
// ---------------------------------------------------------------------------

/** types.ts:288 — wrapper text is clipped before it is ever stored or sent. */
const WRAPPER_TEXT_LIMIT = 240
const LABEL_TEXT_LIMIT = 300

/**
 * Nesting guard for section 7.5's depth-first walk. Ten levels of nested open
 * shadow roots is already twice what any shipped design system uses; the guard
 * exists so a component that (re)hosts itself cannot spin the scan forever.
 */
const MAX_SHADOW_DEPTH = 10

/** How far up to look for the container that supplies wrapper text / legend. */
const MAX_WRAPPER_HOPS = 4

/** How far up to look for a repeater row before giving up. */
const MAX_REPEAT_HOPS = 6

/** Ancestor hops allowed when hunting for the container of a segmented date. */
const MAX_DATE_GROUP_HOPS = 4

/** How many preceding siblings may supply a label of last resort. */
const MAX_PREVIOUS_SIBLINGS = 3

const MAX_PATH_DEPTH = 40

/**
 * Input types that are never autofill targets.
 *
 * `submit`/`button`/`reset`/`image` are the section 1 invariant expressed in the
 * scanner: a control the engine must never touch does not get a binding, so no
 * later bug can dispatch a click at one. `password` is excluded because no
 * PROFILE_KEY maps to a credential — an ATS "create your account" step would
 * otherwise put a descriptor for it in front of the resolver.
 */
const SKIP_INPUT_TYPES: ReadonlySet<string> = new Set([
  'hidden',
  'submit',
  'button',
  'reset',
  'image',
  'password',
])

/** Page furniture. A site search box is not part of the application form. */
const PAGE_CHROME_SELECTOR = 'nav, header, footer'

/** Subtrees whose text is noise inside a label or wrapper. */
const SKIP_TEXT_TAGS: ReadonlySet<string> = new Set([
  'SELECT',
  'OPTION',
  'OPTGROUP',
  'DATALIST',
  'TEXTAREA',
  'SCRIPT',
  'STYLE',
  'TEMPLATE',
  'SVG',
  'NOSCRIPT',
])

/** data-automation-id is Workday's; the rest are the common test-hook attributes. */
const ATS_HINT_ATTRS = ['data-automation-id', 'data-qa', 'data-testid', 'data-test'] as const

// ---------------------------------------------------------------------------
// Public shape
// ---------------------------------------------------------------------------

export type ScanRoot = Element | Document | DocumentFragment

export interface ScanOptions {
  /** Injected because jsdom runs no layout — see visibility.ts. */
  probe: VisibilityProbe
  /** `${tabId}:${frameId}`, stamped by the executor host. Empty in tests. */
  frameKey?: string
  /** Prefix for scan-local ids. Distinguishes rescans while debugging. */
  idPrefix?: string
  /**
   * Keep fields the human cannot see, with `visible: false`.
   *
   * Off by default: a honeypot that reaches the plan is a honeypot that can be
   * filled. On, it is a diagnostic — "we found 12 fields and hid 9 of them" is
   * a very different bug report from "we found 3 fields".
   */
  includeHidden?: boolean
}

export interface ScanResult {
  descriptors: FieldDescriptor[]
  /** Keyed by `FieldDescriptor.id`. Never serialized — these are live nodes. */
  bindings: Map<string, Element>
}

// ---------------------------------------------------------------------------
// Tiny DOM helpers
// ---------------------------------------------------------------------------

function tagOf(el: Element): string {
  return el.tagName.toUpperCase()
}

function asInput(el: Element): HTMLInputElement | null {
  // tagName rather than `instanceof`: elements from a same-origin iframe live in
  // another realm, where `instanceof HTMLInputElement` is false for a plain input.
  return tagOf(el) === 'INPUT' ? (el as HTMLInputElement) : null
}

function asSelect(el: Element): HTMLSelectElement | null {
  return tagOf(el) === 'SELECT' ? (el as HTMLSelectElement) : null
}

function asTextArea(el: Element): HTMLTextAreaElement | null {
  return tagOf(el) === 'TEXTAREA' ? (el as HTMLTextAreaElement) : null
}

function isNativeControl(el: Element): boolean {
  const tag = tagOf(el)
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA'
}

function attr(el: Element, name: string): string | null {
  const value = el.getAttribute(name)
  return value !== null && value.trim() !== '' ? value : null
}

function roleOf(el: Element): string {
  return (el.getAttribute('role') ?? '').trim().toLowerCase()
}

function inputTypeOf(el: Element): string {
  return (el.getAttribute('type') ?? '').trim().toLowerCase()
}

function atsHintOf(el: Element): string | null {
  for (const name of ATS_HINT_ATTRS) {
    const value = attr(el, name)
    if (value !== null) return value
  }
  return null
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function clip(text: string, limit: number): string {
  return text.length <= limit ? text : text.slice(0, limit)
}

/**
 * Visible text of a subtree.
 *
 * Text nodes are joined with a SPACE rather than concatenated. Lever renders its
 * required marker as its own element — `<span>Full name</span><span>✱</span>` —
 * and plain `textContent` welds it onto the word ("Full name✱"), which
 * `normalizeText` does not strip (tokenize.ts:24 covers `*` and `∗`, not `✱`),
 * so the tokenizer never produces the token `name` and the resolver misses a
 * field it should have matched trivially.
 */
function textOf(el: Element, limit: number): string {
  const parts: string[] = []
  let budget = limit * 2

  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (budget <= 0) return
      if (child.nodeType === 3) {
        const value = child.nodeValue ?? ''
        parts.push(value)
        budget -= value.length
        continue
      }
      if (child.nodeType !== 1) continue
      const element = child as Element
      // An entire country list inside a wrapper would otherwise become the
      // field's "wrapper text" and drown every real signal in it.
      if (SKIP_TEXT_TAGS.has(tagOf(element))) continue
      walk(element)
    }
  }

  walk(el)
  return clip(collapse(parts.join(' ')), limit)
}

/** Escape for an attribute selector. `CSS.escape` does not exist in jsdom (verified). */
function escapeAttrValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

interface RootLike {
  querySelector(selectors: string): Element | null
  querySelectorAll(selectors: string): NodeListOf<Element>
}

/**
 * The node id references resolve against.
 *
 * Section 7.5: for an element inside a shadow root this is the ShadowRoot, not
 * the document — `document.querySelector('label[for=x]')` cannot see a
 * shadow-scoped id, which is precisely how a web-component-based ATS ends up
 * with every field labelled "none".
 */
function scopeOf(el: Element): RootLike {
  const root = el.getRootNode() as Partial<RootLike>
  if (typeof root.querySelector === 'function' && typeof root.querySelectorAll === 'function') {
    return root as RootLike
  }
  return el.ownerDocument
}

function elementById(el: Element, id: string): Element | null {
  return scopeOf(el).querySelector(`[id="${escapeAttrValue(id)}"]`)
}

/**
 * Resolve an id REFERENCE LIST to its combined text.
 *
 * `aria-labelledby="question_7_label question_7_hint"` is one attribute naming
 * two elements. Passing the whole string to `getElementById` — what
 * question-extractor.ts:57-60 does — always returns null.
 */
function textOfIdRefs(el: Element, attribute: string): string | null {
  const raw = attr(el, attribute)
  if (raw === null) return null

  const parts: string[] = []
  for (const id of raw.split(/\s+/)) {
    if (id === '') continue
    const target = elementById(el, id)
    if (target === null) continue
    const text = textOf(target, LABEL_TEXT_LIMIT)
    if (text !== '') parts.push(text)
  }
  return parts.length > 0 ? clip(parts.join(' '), LABEL_TEXT_LIMIT) : null
}

/**
 * A CSS path for re-acquisition after a re-render.
 *
 * Shadow boundaries are written as ` >>> `, which is NOT a selector any engine
 * accepts — it is a marker the re-acquisition helper splits on, because a single
 * selector string genuinely cannot cross a shadow root.
 */
function domPath(el: Element, hostDepth = 0): string {
  const local = localPath(el)
  if (hostDepth >= MAX_SHADOW_DEPTH) return local

  // Crossing the boundary is handled HERE, in one place, rather than inside the
  // walk. The walk terminates early on an id, and an id is unique only within
  // ITS OWN root — so a shadow-scoped id short-circuiting the walk would
  // otherwise yield a bare `input[id="x"]`, which document.querySelector can
  // never find because it does not descend into shadow roots.
  const host = (el.getRootNode() as Partial<ShadowRoot>).host
  if (host === undefined || host === null) return local
  return `${domPath(host, hostDepth + 1)} >>> ${local}`
}

/** Path to `el` within its own root. Never crosses a shadow boundary. */
function localPath(el: Element): string {
  const segments: string[] = []
  let node: Element | null = el
  let depth = 0

  while (node !== null && depth < MAX_PATH_DEPTH) {
    depth++
    const tag = node.tagName.toLowerCase()
    const id = node.getAttribute('id')
    if (id !== null && id.trim() !== '') {
      // Unique within this root, so it terminates the path for this root.
      segments.unshift(`${tag}[id="${escapeAttrValue(id)}"]`)
      return segments.join(' > ')
    }

    // Annotated because `parent` is assigned back into `node` below, which makes
    // its inferred type circular under strict control-flow analysis (TS7022).
    const parent: HTMLElement | null = node.parentElement
    if (parent === null) {
      segments.unshift(tag)
      break
    }

    const index = Array.from(parent.children).indexOf(node) + 1
    segments.unshift(`${tag}:nth-child(${index})`)
    node = parent
  }

  return segments.join(' > ')
}

/**
 * FNV-1a. Not a security primitive and not the cache key: the cross-user cache
 * key is SHA-256 in fingerprint.ts, which takes this value as one input. All
 * this has to do is be stable for the same page structure and cheap enough to
 * run synchronously inside a MutationObserver callback.
 */
function hash32(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function* ancestors(el: Element, limit: number): Generator<Element> {
  let node = el.parentElement
  let depth = 0
  while (node !== null && depth < limit) {
    yield node
    node = node.parentElement
    depth++
  }
}

// ---------------------------------------------------------------------------
// Candidate collection
// ---------------------------------------------------------------------------

/**
 * Custom widgets worth scanning: a `[role=combobox]` is a select the framework
 * built out of divs, and a `[role=radiogroup]` is a choice question. Anything
 * else without a native control behind it cannot be filled reliably enough to
 * be worth the misfire risk.
 */
function isCustomWidget(el: Element): boolean {
  const role = roleOf(el)
  return role === 'combobox' || role === 'radiogroup'
}

function isCandidate(el: Element): boolean {
  const input = asInput(el)
  if (input !== null) return !SKIP_INPUT_TYPES.has(inputTypeOf(el))
  if (asSelect(el) !== null || asTextArea(el) !== null) return true
  return isCustomWidget(el)
}

/**
 * Depth-first, document order, descending into OPEN shadow roots.
 *
 * `mode: 'closed'` roots report `shadowRoot === null` from outside (verified in
 * jsdom, and true in every engine) and are genuinely unreachable — section 7.5
 * says report those fields as `not_found` rather than pretending otherwise.
 */
function collectCandidates(root: ScanRoot, out: Element[], depth: number): void {
  for (const child of Array.from(root.children)) {
    if (isCandidate(child)) out.push(child)

    const shadow = child.shadowRoot
    if (shadow !== null && depth < MAX_SHADOW_DEPTH) {
      collectCandidates(shadow, out, depth + 1)
    }
    collectCandidates(child, out, depth)
  }
}

/** True when page furniture INSIDE the scan root encloses the element. */
function isPageChrome(el: Element, root: ScanRoot): boolean {
  const chrome = el.closest(PAGE_CHROME_SELECTOR)
  // Scoped to the root: an adapter that narrowed `formRoot` to a form which
  // happens to sit inside a <header> must not have every field discarded.
  return chrome !== null && chrome !== root && root.contains(chrome)
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

interface LabelHit {
  text: string
  source: LabelSource
}

function nearestWrapper(el: Element): Element | null {
  for (const ancestor of ancestors(el, MAX_WRAPPER_HOPS)) {
    const text = textOf(ancestor, WRAPPER_TEXT_LIMIT)
    if (text !== '') return ancestor
  }
  return null
}

function legendOf(el: Element): string | null {
  // Self included: a radio group's label is resolved against its CONTAINER, and
  // that container usually IS the fieldset carrying the legend. Starting at the
  // parent walks straight past it and the group ends up labelled with the
  // wrapper text — i.e. the question with every option glued to the end.
  for (const ancestor of [el, ...ancestors(el, MAX_WRAPPER_HOPS)]) {
    if (tagOf(ancestor) !== 'FIELDSET') continue
    const legend = ancestor.querySelector('legend')
    if (legend === null) continue
    const text = textOf(legend, LABEL_TEXT_LIMIT)
    if (text !== '') return text
  }
  return null
}

function previousSiblingText(el: Element): string | null {
  let sibling = el.previousElementSibling
  let seen = 0
  while (sibling !== null && seen < MAX_PREVIOUS_SIBLINGS) {
    seen++
    if (!isNativeControl(sibling)) {
      const text = textOf(sibling, LABEL_TEXT_LIMIT)
      if (text !== '') return text
    }
    sibling = sibling.previousElementSibling
  }
  return null
}

function labelForText(el: Element): string | null {
  const id = attr(el, 'id')
  if (id === null) return null
  const label = scopeOf(el).querySelector(`label[for="${escapeAttrValue(id)}"]`)
  if (label === null) return null
  const text = textOf(label, LABEL_TEXT_LIMIT)
  return text !== '' ? text : null
}

function wrappingLabelText(el: Element): string | null {
  const label = el.closest('label')
  if (label === null) return null
  // The control contributes no text of its own (inputs have no children, and
  // SKIP_TEXT_TAGS drops a wrapped <select>'s options), so the label's text is
  // already the question.
  const text = textOf(label, LABEL_TEXT_LIMIT)
  return text !== '' ? text : null
}

/**
 * Last resort: the field's own identifiers, read as words.
 *
 * `job_application[first_name]` is not a label, but the resolver's tokenizer
 * turns it into ['job','application','first','name'], which is a great deal
 * more than `none`.
 */
function nameTokenText(el: Element): string | null {
  const source = attr(el, 'name') ?? attr(el, 'id') ?? atsHintOf(el)
  if (source === null) return null
  const tokens = tokenize(source)
  return tokens.length > 0 ? tokens.join(' ') : null
}

/**
 * The cascade, in ARIA's own accessible-name order.
 *
 * `aria-labelledby` then `aria-label` then the native label is what the browser
 * itself announces, which is the name the employer tested against — following
 * anything else means the engine and the screen reader disagree about what the
 * field is called.
 *
 * `allowSelfLabel: false` is for a GROUP: a radio group's name comes from its
 * legend or its container, never from the `<label>Yes</label>` wrapped around
 * its first member.
 */
function resolveLabel(el: Element, allowSelfLabel: boolean): LabelHit {
  const labelledBy = textOfIdRefs(el, 'aria-labelledby')
  if (labelledBy !== null) return { text: labelledBy, source: 'aria_labelledby' }

  const ariaLabel = attr(el, 'aria-label')
  if (ariaLabel !== null) return { text: collapse(ariaLabel), source: 'aria_label' }

  if (allowSelfLabel) {
    const forText = labelForText(el)
    if (forText !== null) return { text: forText, source: 'label_for' }

    const wrapping = wrappingLabelText(el)
    if (wrapping !== null) return { text: wrapping, source: 'wrapping_label' }
  }

  const legend = legendOf(el)
  if (legend !== null) return { text: legend, source: 'fieldset_legend' }

  const previous = previousSiblingText(el)
  if (previous !== null) return { text: previous, source: 'previous_sibling' }

  const wrapper = nearestWrapper(el)
  if (wrapper !== null) {
    const text = textOf(wrapper, WRAPPER_TEXT_LIMIT)
    if (text !== '') return { text, source: 'wrapper_text' }
  }

  if (allowSelfLabel) {
    const placeholder = attr(el, 'placeholder')
    if (placeholder !== null) return { text: collapse(placeholder), source: 'placeholder' }
  }

  const nameText = nameTokenText(el)
  if (nameText !== null) return { text: nameText, source: 'name_token' }

  return { text: '', source: 'none' }
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * `opt.value` is the IDL property, which falls back to the option's text when
 * the element carries no `value` attribute (DOM rule, verified in jsdom). That
 * fallback is exactly what `select.value = x` needs, so reading the attribute
 * instead would produce option lists that cannot be selected.
 */
function selectOptions(select: HTMLSelectElement): FieldOption[] {
  return Array.from(select.options).map((option) => ({
    value: option.value,
    text: collapse(option.text),
    disabled: option.disabled,
  }))
}

function datalistOptions(el: Element): FieldOption[] | null {
  const listId = attr(el, 'list')
  if (listId === null) return null
  const list = elementById(el, listId)
  if (list === null || tagOf(list) !== 'DATALIST') return null

  return Array.from(list.querySelectorAll('option')).map((option) => {
    const typed = option as HTMLOptionElement
    return {
      value: typed.value,
      text: collapse(typed.text !== '' ? typed.text : typed.value),
      disabled: typed.disabled,
    }
  })
}

/**
 * A radio's OWN text, from self-anchored rungs only.
 *
 * The full cascade is wrong here: its wrapper and sibling fallbacks would walk
 * out of the radio and return the whole question ("Are you authorized to
 * work…?") as the text of the *Yes* option, so every option in the group would
 * read identically and option matching would be a coin flip.
 */
function radioOptionText(radio: Element): string | null {
  return (
    textOfIdRefs(radio, 'aria-labelledby') ??
    attr(radio, 'aria-label') ??
    labelForText(radio) ??
    wrappingLabelText(radio)
  )
}

function radioOption(radio: Element): FieldOption {
  const input = asInput(radio)
  const value = input !== null ? input.value : (attr(radio, 'value') ?? attr(radio, 'data-value'))
  const text = radioOptionText(radio)
  return {
    value,
    // A radio with no value attribute submits "on"; its label is the only thing
    // that tells a human — or the resolver — which answer it is.
    text: text !== null ? collapse(text) : (value ?? ''),
    disabled: input !== null ? input.disabled : radio.getAttribute('aria-disabled') === 'true',
  }
}

function customChoiceOptions(container: Element): FieldOption[] {
  return Array.from(container.querySelectorAll('[role="radio"], [role="option"]')).map((node) => ({
    value: attr(node, 'data-value') ?? attr(node, 'value'),
    text: attr(node, 'aria-label') ?? textOf(node, LABEL_TEXT_LIMIT),
    disabled: node.getAttribute('aria-disabled') === 'true',
  }))
}

/**
 * A combobox's popup usually does not exist until it is opened, so `null` here
 * means "unknown", not "no choices" — the executor opens the widget and reads
 * the listbox then.
 */
function comboboxOptions(el: Element): FieldOption[] | null {
  const listId = attr(el, 'aria-controls') ?? attr(el, 'aria-owns')
  if (listId === null) return null
  const list = elementById(el, listId)
  if (list === null) return null
  const options = customChoiceOptions(list)
  return options.length > 0 ? options : null
}

// ---------------------------------------------------------------------------
// Kind
// ---------------------------------------------------------------------------

const INPUT_TYPE_KIND: Readonly<Record<string, FieldKind>> = {
  email: 'email',
  tel: 'tel',
  url: 'url',
  number: 'number',
  range: 'number',
  date: 'date',
  'datetime-local': 'date',
  month: 'date',
  week: 'date',
  file: 'file',
  checkbox: 'checkbox',
  search: 'text',
  text: 'text',
}

function isTypeahead(el: Element): boolean {
  const autocompleteRole = (el.getAttribute('aria-autocomplete') ?? '').toLowerCase()
  return autocompleteRole === 'list' || autocompleteRole === 'both' || attr(el, 'list') !== null
}

function kindOfSingle(el: Element): FieldKind {
  if (asTextArea(el) !== null) return 'textarea'
  if (asSelect(el) !== null) return 'select'

  const role = roleOf(el)
  if (role === 'radiogroup') return 'radio_group'
  if (role === 'combobox') return isTypeahead(el) ? 'typeahead' : 'combobox'

  const input = asInput(el)
  if (input !== null) return INPUT_TYPE_KIND[inputTypeOf(el)] ?? 'text'

  return 'unknown'
}

// ---------------------------------------------------------------------------
// Segmented dates
// ---------------------------------------------------------------------------

type DateSegment = 'month' | 'day' | 'year'

const SEGMENT_TOKENS: ReadonlyArray<readonly [DateSegment, ReadonlyArray<string>]> = [
  ['month', ['month', 'mm', 'mon']],
  ['day', ['day', 'dd']],
  ['year', ['year', 'yyyy', 'yy']],
]

/**
 * Workday splits a date into three inputs (`dateSectionMonth-input` and
 * friends) and so do several date pickers. Each part alone looks like a number
 * field, so the segments only become a `date_segmented` field once at least two
 * DIFFERENT parts share a container — which also keeps a lone "Graduation year"
 * from being mistaken for one.
 */
function dateSegmentOf(el: Element): DateSegment | null {
  const input = asInput(el)
  if (input === null) return null
  const type = inputTypeOf(el)
  if (type !== '' && type !== 'text' && type !== 'number' && type !== 'tel') return null

  const haystack = [
    attr(el, 'name'),
    attr(el, 'id'),
    atsHintOf(el),
    attr(el, 'placeholder'),
    attr(el, 'aria-label'),
  ]
    .filter((value): value is string => value !== null)
    .join(' ')

  const tokens = new Set(tokenize(haystack))
  for (const [segment, words] of SEGMENT_TOKENS) {
    if (words.some((word) => tokens.has(word))) return segment
  }
  return null
}

/** Nearest ancestor holding at least two distinct segments of the same date. */
function dateGroupContainer(el: Element, segments: ReadonlyMap<Element, DateSegment>): Element | null {
  for (const ancestor of ancestors(el, MAX_DATE_GROUP_HOPS)) {
    const kinds = new Set<DateSegment>()
    for (const [candidate, segment] of segments) {
      if (ancestor.contains(candidate)) kinds.add(segment)
    }
    if (kinds.size >= 2) return ancestor
  }
  return null
}

// ---------------------------------------------------------------------------
// Repeaters
// ---------------------------------------------------------------------------

/**
 * Structural identity of a row, with row numbers stripped.
 *
 * Workday numbers its repeater rows in the attribute itself
 * (`workExperience-1`, `workExperience-2`), so the trailing index has to come
 * off or no two rows ever look alike.
 */
function shapeSignature(el: Element): string {
  const classes = Array.from(el.classList)
    .map((name) => name.replace(/\d+$/, ''))
    .sort()
    .join('.')
  const hint = (atsHintOf(el) ?? '').replace(/[-_]?\d+$/, '')
  return `${el.tagName.toLowerCase()}|${classes}|${hint}`
}

/**
 * Identity of a FIELD within a row, independent of which row it is in.
 *
 * Returns '' when the control carries no stable identifier at all. That empty
 * signature must never match, because the cost of a false positive is high:
 * a wrongly-detected repeater writes a `repeatGroup` into `fieldKey`
 * (fingerprint.ts:89-105) and permanently splits one cache entry into several.
 */
function fieldSignature(el: Element): string {
  const name = attr(el, 'name')
  if (name !== null) return `n:${name.replace(/\[\d+\]/g, '[]').replace(/[-_]?\d+$/, '')}`
  const hint = atsHintOf(el)
  if (hint !== null) return `h:${hint.replace(/[-_]?\d+$/, '')}`
  const id = attr(el, 'id')
  if (id !== null) return `i:${id.replace(/[-_]?\d+$/, '')}`
  return ''
}

function containsFieldSignature(row: Element, signature: string): boolean {
  if (signature === '') return false
  return Array.from(row.querySelectorAll('input, select, textarea')).some(
    (control) => fieldSignature(control) === signature,
  )
}

interface RepeatPosition {
  repeatGroup: string
  occurrenceIndex: number
}

/**
 * Find the innermost repeater row the element sits in, or null.
 *
 * Shape alone is not enough: Greenhouse wraps every field in an identical
 * `<div class="field">`, so "two siblings look the same" would make first name
 * occurrence 0 and last name occurrence 1 of a repeater that does not exist. A
 * row only counts when a SIBLING row contains the same field — the same
 * `name` with its index collapsed, or the same automation id — which is what
 * actually distinguishes "row 2 of work experience" from "the next question".
 */
function detectRepeat(el: Element): RepeatPosition | null {
  const signature = fieldSignature(el)
  if (signature === '') return null

  let row = el.parentElement
  let hops = 0
  while (row !== null && hops < MAX_REPEAT_HOPS) {
    hops++
    const parent = row.parentElement
    if (parent === null) return null

    const rowSignature = shapeSignature(row)
    const peers = Array.from(parent.children).filter(
      (child) => shapeSignature(child) === rowSignature,
    )

    if (peers.length >= 2) {
      const twin = peers.some(
        (peer) => peer !== row && containsFieldSignature(peer, signature),
      )
      if (twin) {
        return {
          // Keyed on the CONTAINER, not the row, so every row of one repeater
          // shares a repeatGroup and only occurrenceIndex separates them.
          repeatGroup: hash32(`${domPath(parent)}|${rowSignature}`),
          occurrenceIndex: peers.indexOf(row),
        }
      }
    }
    row = parent
  }
  return null
}

// ---------------------------------------------------------------------------
// Existing value
// ---------------------------------------------------------------------------

/**
 * BOOLEAN ONLY. The value itself never leaves the page — section 3 and
 * redact.ts. This exists so the executor can refuse to clobber a draft the
 * applicant already started (section 7.3), and for nothing else.
 */
function hasExistingValue(el: Element): boolean {
  const input = asInput(el)
  if (input !== null) {
    const type = inputTypeOf(el)
    if (type === 'checkbox' || type === 'radio') return input.checked
    if (type === 'file') return (input.files?.length ?? 0) > 0
    return input.value.trim() !== ''
  }

  const textarea = asTextArea(el)
  if (textarea !== null) return textarea.value.trim() !== ''

  const select = asSelect(el)
  if (select !== null) {
    // A placeholder option ("Select…") carries value="" by convention, so an
    // untouched select reads as empty — which is what idempotency needs.
    if (select.multiple) {
      return Array.from(select.selectedOptions).some((option) => option.value !== '')
    }
    return select.value !== ''
  }

  // Custom widget: its state lives in the input it wraps, or in the option it
  // marks selected.
  const inner = el.querySelector('input, textarea, select')
  if (inner !== null) return hasExistingValue(inner)
  return el.querySelector('[aria-selected="true"], [aria-checked="true"]') !== null
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

type Unit =
  | { type: 'single'; el: Element }
  | { type: 'radio_group'; members: Element[]; container: Element | null }
  | { type: 'date_group'; container: Element; segments: Element[] }

function closestChoiceContainer(el: Element): Element | null {
  return el.closest('[role="radiogroup"], fieldset')
}

/**
 * Native radios group by `name` within their form; a nameless custom radio
 * groups by its `[role=radiogroup]`/`<fieldset>`. Scope matters as much as the
 * name: two Workday wizard steps in one document can both have a `name="yes_no"`
 * and they are not the same question.
 */
function radioGroupKey(radio: Element, scopeId: (node: object) => number): string {
  const input = asInput(radio)
  const name = attr(radio, 'name')
  const container = closestChoiceContainer(radio)

  if (name !== null) {
    const scope: object = input?.form ?? container ?? radio.getRootNode()
    return `name:${scopeId(scope)}:${name}`
  }
  if (container !== null) return `container:${scopeId(container)}`
  return `solo:${scopeId(radio)}`
}

function buildUnits(candidates: Element[]): Unit[] {
  const counters = new Map<object, number>()
  let next = 0
  const scopeId = (node: object): number => {
    const existing = counters.get(node)
    if (existing !== undefined) return existing
    counters.set(node, next)
    return next++
  }

  // Pass 1 — radio groups. One descriptor per group: a radio group is a single
  // question, and a FillValue of `{type:'option'}` answers all of it at once.
  const radioGroups = new Map<string, Element[]>()
  const singles: Element[] = []
  const orderOfUnit = new Map<string, number>()

  candidates.forEach((el, index) => {
    if (asInput(el) !== null && inputTypeOf(el) === 'radio') {
      const key = radioGroupKey(el, scopeId)
      const members = radioGroups.get(key)
      if (members === undefined) {
        radioGroups.set(key, [el])
        orderOfUnit.set(key, index)
      } else {
        members.push(el)
      }
      return
    }
    singles.push(el)
  })

  // Pass 2 — segmented dates among the remaining singles.
  const segmentOf = new Map<Element, DateSegment>()
  for (const el of singles) {
    const segment = dateSegmentOf(el)
    if (segment !== null) segmentOf.set(el, segment)
  }
  const dateGroups = new Map<Element, Element[]>()
  const consumed = new Set<Element>()
  for (const el of segmentOf.keys()) {
    const container = dateGroupContainer(el, segmentOf)
    if (container === null) continue
    const group = dateGroups.get(container)
    if (group === undefined) dateGroups.set(container, [el])
    else group.push(el)
    consumed.add(el)
  }

  // Emit in the document order of each unit's first element, so `order` stays
  // the overlay's reading order.
  const units: Array<{ at: number; unit: Unit }> = []
  const singleSet = new Set(singles)

  for (const [key, members] of radioGroups) {
    const first = members[0]
    if (first === undefined) continue
    units.push({
      at: orderOfUnit.get(key) ?? 0,
      unit: { type: 'radio_group', members, container: closestChoiceContainer(first) },
    })
  }

  const emittedDateGroups = new Set<Element>()
  candidates.forEach((el, index) => {
    if (consumed.has(el)) {
      const container = dateGroupContainer(el, segmentOf)
      if (container === null || emittedDateGroups.has(container)) return
      emittedDateGroups.add(container)
      units.push({
        at: index,
        unit: { type: 'date_group', container, segments: dateGroups.get(container) ?? [el] },
      })
      return
    }
    if (singleSet.has(el)) units.push({ at: index, unit: { type: 'single', el } })
  })

  return units.sort((a, b) => a.at - b.at).map((entry) => entry.unit)
}

// ---------------------------------------------------------------------------
// Descriptors
// ---------------------------------------------------------------------------

interface DescriptorInput {
  /** The element the executor writes to. */
  binding: Element
  /** The element the metadata is read from (a group's container, when it has one). */
  context: Element
  kind: FieldKind
  label: LabelHit
  options: FieldOption[] | null
  group: string | null
  required: boolean
  disabled: boolean
  readOnly: boolean
  existingValue: boolean
  visible: boolean
}

function maxLengthOf(el: Element): number | null {
  // The `maxLength` IDL property is -1 when unset (verified in jsdom), which is
  // not a length; read the attribute so "absent" stays null.
  const raw = attr(el, 'maxlength')
  if (raw === null) return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function isRequired(el: Element): boolean {
  return el.hasAttribute('required') || el.getAttribute('aria-required') === 'true'
}

function buildDescriptor(
  input: DescriptorInput,
  id: string,
  order: number,
  frameKey: string,
): FieldDescriptor {
  const { binding, context } = input
  const repeat = detectRepeat(binding)
  const wrapper = nearestWrapper(context)

  return {
    id,
    // Left empty on purpose: fieldKey() is async (SHA-256 via WebCrypto,
    // fingerprint.ts:89) and this walk must stay synchronous so it can run
    // inside a MutationObserver callback. The scanner host awaits the hashes and
    // stamps them before the descriptors reach the planner.
    fieldKey: '',
    frameKey,
    kind: input.kind,
    domPath: domPath(binding),
    name: attr(binding, 'name'),
    elementId: attr(binding, 'id'),
    autocomplete: attr(binding, 'autocomplete'),
    inputType: attr(binding, 'type'),
    label: input.label.text !== '' ? input.label.text : null,
    labelSource: input.label.source,
    placeholder: attr(binding, 'placeholder'),
    ariaLabel: attr(context, 'aria-label'),
    describedBy: textOfIdRefs(context, 'aria-describedby'),
    wrapperText: wrapper !== null ? textOf(wrapper, WRAPPER_TEXT_LIMIT) : null,
    required: input.required,
    disabled: input.disabled,
    readOnly: input.readOnly,
    maxLength: maxLengthOf(binding),
    options: input.options,
    group: input.group,
    atsHint: atsHintOf(binding) ?? atsHintOf(context),
    repeatGroup: repeat?.repeatGroup ?? null,
    occurrenceIndex: repeat?.occurrenceIndex ?? null,
    hasExistingValue: input.existingValue,
    visible: input.visible,
    order,
  }
}

function describeSingle(el: Element, visible: boolean): DescriptorInput {
  const kind = kindOfSingle(el)
  const select = asSelect(el)
  const control = el as Partial<HTMLInputElement>

  let options: FieldOption[] | null = null
  if (select !== null) options = selectOptions(select)
  else if (kind === 'combobox' || kind === 'typeahead') {
    options = comboboxOptions(el) ?? datalistOptions(el)
  } else if (kind === 'radio_group') options = customChoiceOptions(el)
  else options = datalistOptions(el)

  return {
    binding: el,
    context: el,
    kind,
    label: resolveLabel(el, true),
    options: options !== null && options.length > 0 ? options : null,
    // Legend only. Copying `name` in here too would feed the same token stream
    // to the scorer's `name` (weight 26) and `group` (weight 14) channels and
    // silently double-count it (section 5).
    group: legendOf(el),
    required: isRequired(el),
    disabled: control.disabled === true || el.getAttribute('aria-disabled') === 'true',
    readOnly: control.readOnly === true || el.getAttribute('aria-readonly') === 'true',
    existingValue: hasExistingValue(el),
    visible,
  }
}

function describeRadioGroup(
  members: Element[],
  container: Element | null,
  first: Element,
  visible: boolean,
): DescriptorInput {
  const context = container ?? first
  const name = attr(first, 'name')

  return {
    // Bound to the first member: the executor needs a control to click, and
    // every other member is one `closest()` away from this one. A custom
    // radiogroup with no native radios never reaches here — it is a `single`.
    binding: first,
    context,
    kind: 'radio_group',
    label: resolveLabel(context, false),
    options: members.map(radioOption),
    group: name ?? legendOf(first),
    required: members.some(isRequired),
    disabled: members.every((member) => (member as Partial<HTMLInputElement>).disabled === true),
    readOnly: false,
    existingValue: members.some(hasExistingValue),
    visible,
  }
}

function describeDateGroup(
  container: Element,
  segments: Element[],
  first: Element,
  visible: boolean,
): DescriptorInput {
  return {
    // Bound to the CONTAINER: one `{type:'date'}` value fills all three
    // segments, and the executor re-queries them from here (strategy
    // `segmented_date`, types.ts:384).
    binding: container,
    context: container,
    kind: 'date_segmented',
    label: resolveLabel(container, false),
    options: null,
    group: legendOf(first),
    required: segments.some(isRequired),
    disabled: segments.every((segment) => (segment as Partial<HTMLInputElement>).disabled === true),
    readOnly: segments.every((segment) => (segment as Partial<HTMLInputElement>).readOnly === true),
    existingValue: segments.some(hasExistingValue),
    visible,
  }
}

// ---------------------------------------------------------------------------
// scanForm
// ---------------------------------------------------------------------------

/**
 * Walk `root` and describe every fillable field under it.
 *
 * Synchronous by design — it runs from a debounced MutationObserver (section
 * 7.1) where an await would let the page re-render underneath the walk and
 * bind descriptors to detached nodes.
 */
export function scanForm(root: ScanRoot, opts: ScanOptions): ScanResult {
  const { probe, frameKey = '', idPrefix = 'f', includeHidden = false } = opts

  const raw: Element[] = []
  collectCandidates(root, raw, 0)

  const candidates = raw.filter((el) => !isPageChrome(el, root))

  // A `[role=combobox]` wrapper around a real `<input>` is one field, not two.
  // Keep the input: it is the node the write path can actually set a value on.
  const deduped = candidates.filter((el) => {
    if (isNativeControl(el)) return true
    return !candidates.some((other) => other !== el && isNativeControl(other) && el.contains(other))
  })

  const visibility = new Map<Element, boolean>()
  const rendered = deduped.filter((el) => {
    const verdict = isFillable(el, probe)
    const visible = !isNotRendered(verdict.reason)
    visibility.set(el, visible)
    // Honeypots and `display:none` fields are dropped outright — a descriptor
    // that exists is a descriptor something can decide to fill.
    return includeHidden || visible
  })

  const descriptors: FieldDescriptor[] = []
  const bindings = new Map<string, Element>()

  buildUnits(rendered).forEach((unit, index) => {
    let described: DescriptorInput
    if (unit.type === 'single') {
      described = describeSingle(unit.el, visibility.get(unit.el) ?? true)
    } else if (unit.type === 'radio_group') {
      const first = unit.members[0]
      if (first === undefined) return
      const visible = unit.members.some((member) => visibility.get(member) ?? true)
      described = describeRadioGroup(unit.members, unit.container, first, visible)
    } else {
      const first = unit.segments[0]
      if (first === undefined) return
      const visible = unit.segments.some((segment) => visibility.get(segment) ?? true)
      described = describeDateGroup(unit.container, unit.segments, first, visible)
    }

    const id = `${idPrefix}${index}`
    descriptors.push(buildDescriptor(described, id, index, frameKey))
    bindings.set(id, described.binding)
  })

  return { descriptors, bindings }
}
