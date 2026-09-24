/**
 * Is this element a real, fillable control — or a honeypot?
 *
 * Spec: extension/AUTOFILL_ARCHITECTURE.md section 5.3.
 *
 * Two things this module exists to prevent:
 *
 *  1. Writing PII into a trap. Bot-detection honeypots are ordinary `<input>`
 *     elements parked at `left: -9999px`, behind `opacity: 0`, or under an
 *     `aria-hidden="true"` wrapper. Filling one is how a real applicant gets
 *     flagged as a bot by the employer's own anti-spam.
 *  2. Discarding two thirds of the form. `getBoundingClientRect()` is
 *     VIEWPORT-relative, so the obvious `rect.y > viewport.height` test throws
 *     away everything below the fold — and a Greenhouse application form is
 *     several viewports tall. Every bounds test here runs in DOCUMENT
 *     coordinates and rejects only absurd offsets, never "below the current
 *     scroll position".
 *
 * CONSTRAINTS ON THIS DIRECTORY (see AUTOFILL_ARCHITECTURE.md section 0.3):
 * relative imports only, no `chrome.*`, no Node builtins, no `server-only`.
 */

// ---------------------------------------------------------------------------
// The probe
// ---------------------------------------------------------------------------

/** Viewport-relative box, the subset of DOMRect this module reads. */
export interface ProbeRect {
  x: number
  y: number
  width: number
  height: number
}

/** The four computed properties that decide renderedness. */
export interface ProbeStyle {
  display: string
  visibility: string
  /** Raw computed string. jsdom returns `''` for an unset property — see `opacityOf`. */
  opacity: string
  position: string
}

export interface ProbePoint {
  x: number
  y: number
}

export interface ProbeSize {
  width: number
  height: number
}

/**
 * Every layout read, behind one injectable interface.
 *
 * This is not dependency-injection ceremony. Under `environment: 'jsdom'`
 * (vitest.unit.config.ts:9) no layout ever runs: `getBoundingClientRect()`
 * returns all zeros, `documentElement.scrollHeight` is 0, and
 * `HTMLElement.offsetParent` is defined but hardcoded to null. Read directly
 * off the element, every one of those says "invisible", so an un-injected
 * version of this module would reject every field in every test — and the
 * test suite would be asserting nothing at all. Real geometry is covered by
 * Playwright (section 12).
 */
export interface VisibilityProbe {
  rect(el: Element): ProbeRect
  style(el: Element): ProbeStyle
  /** Document scroll offset, for converting a viewport rect to document coordinates. */
  scroll(): ProbePoint
  /** Full scrollable size of the document — the bounds an element must fall inside. */
  docSize(): ProbeSize
  viewport(): ProbeSize
  /**
   * Null means the element has no layout box (`display: none` on it or on an
   * ancestor, or a detached tree) — with `position: fixed` as the one false
   * positive, which `isFillable` handles.
   *
   * Part of the probe for the same reason as the geometry above: jsdom's
   * `offsetParent` is permanently null, so this cannot be read off the element
   * in a test.
   */
  offsetParent(el: Element): Element | null
}

function requireView(el: Element): Window {
  const view = el.ownerDocument.defaultView
  // Without this the failure surfaces as "Cannot read properties of null
  // (reading 'getComputedStyle')" from inside a field scan, which says nothing
  // about the cause: an element from a document that was never attached to a
  // window (a DOMParser result, a torn-down iframe).
  if (!view) {
    throw new Error('autofill/visibility: element belongs to a document with no window')
  }
  return view
}

function globalView(): Window {
  const view = (globalThis as { window?: Window }).window
  // Deliberately a throw rather than a zeroed fallback. Zeros would make
  // docSize 0x0, and every field below y=1000 would then read as "absurdly
  // offset" and be silently dropped — a scanner that finds nothing and
  // explains nothing.
  if (!view) {
    throw new Error(
      'autofill/visibility: domVisibilityProbe needs a window. ' +
        'Inject a VisibilityProbe instead (tests, workers, SSR).',
    )
  }
  return view
}

/** The real browser implementation. Content script only; tests inject a stub. */
export const domVisibilityProbe: VisibilityProbe = {
  rect(el) {
    const r = el.getBoundingClientRect()
    return { x: r.left, y: r.top, width: r.width, height: r.height }
  },
  style(el) {
    const cs = requireView(el).getComputedStyle(el)
    return {
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      position: cs.position,
    }
  },
  scroll() {
    const view = globalView()
    const root = view.document.documentElement
    return { x: view.scrollX || root.scrollLeft, y: view.scrollY || root.scrollTop }
  },
  docSize() {
    const doc = globalView().document
    const root = doc.documentElement
    const body = doc.body
    // scrollWidth/Height on <html> misses content in a body that establishes its
    // own scroll container, which is common on ATS pages with a fixed chrome.
    return {
      width: Math.max(root.scrollWidth, body ? body.scrollWidth : 0),
      height: Math.max(root.scrollHeight, body ? body.scrollHeight : 0),
    }
  },
  viewport() {
    const view = globalView()
    return { width: view.innerWidth, height: view.innerHeight }
  },
  offsetParent(el) {
    // Structural typing rather than `instanceof HTMLElement`: an element from a
    // same-origin iframe belongs to another realm, where the instanceof check is
    // false for a perfectly ordinary <input>. SVG and MathML elements have no
    // offsetParent at all, hence `?? null`.
    return (el as Partial<HTMLElement>).offsetParent ?? null
  },
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

export const FILLABLE_REASONS = {
  ok: 'ok',
  /** `input[type=hidden]` — never rendered, frequently a CSRF or tracking field. */
  hiddenInput: 'hidden_input',
  /** `hidden` attribute, `display: none`, or no layout box. */
  notRendered: 'not_rendered',
  visibilityHidden: 'visibility_hidden',
  /** `opacity <= 0.05` on the element or any composed ancestor. */
  transparent: 'transparent',
  zeroSize: 'zero_size',
  /** Parked outside the document box — the `left: -9999px` trick. */
  offscreen: 'offscreen',
  /** Inside an `aria-hidden="true"` subtree: not part of the form a human sees. */
  ariaHidden: 'aria_hidden',
  disabled: 'disabled',
  readOnly: 'read_only',
} as const

export type FillableReason = (typeof FILLABLE_REASONS)[keyof typeof FILLABLE_REASONS]

export interface FillableVerdict {
  fillable: boolean
  reason: FillableReason
}

/**
 * Reasons that mean "the human cannot see this control".
 *
 * The scanner drops these entirely (a honeypot must not reach the plan, the AI
 * escalation payload, or the overlay) but KEEPS a merely `disabled` or
 * `readOnly` field, because section 7.3's `shouldSkip` reports it as
 * `skipped_disabled` — which it can only do if the descriptor exists.
 */
export const NOT_RENDERED_REASONS: ReadonlySet<FillableReason> = new Set<FillableReason>([
  FILLABLE_REASONS.hiddenInput,
  FILLABLE_REASONS.notRendered,
  FILLABLE_REASONS.visibilityHidden,
  FILLABLE_REASONS.transparent,
  FILLABLE_REASONS.zeroSize,
  FILLABLE_REASONS.offscreen,
  FILLABLE_REASONS.ariaHidden,
])

export function isNotRendered(reason: FillableReason): boolean {
  return NOT_RENDERED_REASONS.has(reason)
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Section 5.3. Above this an element is considered legible, not a ghost. */
const MIN_OPACITY = 0.05

/**
 * How far outside the document box counts as "absurd".
 *
 * The honeypot idiom is `-9999px`, so anything in that neighbourhood must be
 * rejected; 1000px of slack keeps legitimately-clipped controls — a field
 * inside a `transform: translateX(-100%)` wizard step mid-transition, an
 * off-canvas drawer being opened — from being mistaken for one. The bound is
 * the DOCUMENT box, never the viewport.
 */
const ABSURD_MARGIN = 1000

/** Composed-ancestor walk cap. Depth is a guard against a pathological tree, not a filter. */
const MAX_ANCESTOR_DEPTH = 64

// ---------------------------------------------------------------------------
// isFillable
// ---------------------------------------------------------------------------

function opacityOf(style: ProbeStyle): number {
  // jsdom returns '' for an unset property (verified: getComputedStyle(input).opacity
  // === ''), and a real browser can return 'auto' inside a will-change context.
  // Anything unparseable means "not explicitly faded", i.e. fully opaque.
  const value = Number.parseFloat(style.opacity)
  return Number.isFinite(value) ? value : 1
}

/**
 * Walk up through shadow boundaries.
 *
 * `el.closest()` stops at the shadow root, so a field inside a web component
 * whose HOST carries `aria-hidden="true"` would otherwise look perfectly
 * visible — see section 7.5.
 */
function* composedAncestors(el: Element): Generator<Element> {
  let node: Node | null = el.parentNode
  let depth = 0
  while (node !== null && depth < MAX_ANCESTOR_DEPTH) {
    depth++
    // Numeric literal rather than `Node.ELEMENT_NODE`: this file is also
    // type-checked by the Next build, where the `Node` global does not exist.
    if (node.nodeType === 1) {
      const element = node as Element
      yield element
      node = element.parentNode
      continue
    }
    // A DocumentFragment with a `host` is a ShadowRoot; step over the boundary.
    const host = (node as Partial<ShadowRoot>).host
    node = host ?? null
  }
}

/** True when the box sits outside the document (or, for fixed elements, the viewport). */
function isAbsurdlyOffset(rect: ProbeRect, style: ProbeStyle, probe: VisibilityProbe): boolean {
  const viewport = probe.viewport()
  const fixed = style.position === 'fixed'

  // A fixed element's rect is already in its own reference frame: adding the
  // scroll offset would march it "down the document" as the user scrolls and
  // eventually read as offscreen.
  const offset = fixed ? { x: 0, y: 0 } : probe.scroll()
  const doc = probe.docSize()
  const bounds = fixed
    ? viewport
    : {
        // scrollWidth/Height can be reported as 0 before first layout; the
        // document is never smaller than the viewport, so this floor keeps a
        // pre-layout read from condemning every field on the page.
        width: Math.max(doc.width, viewport.width),
        height: Math.max(doc.height, viewport.height),
      }

  const x = rect.x + offset.x
  const y = rect.y + offset.y

  return (
    x + rect.width <= -ABSURD_MARGIN ||
    y + rect.height <= -ABSURD_MARGIN ||
    x >= bounds.width + ABSURD_MARGIN ||
    y >= bounds.height + ABSURD_MARGIN
  )
}

function isHiddenInput(el: Element): boolean {
  return el.tagName === 'INPUT' && (el.getAttribute('type') ?? '').toLowerCase() === 'hidden'
}

function verdict(reason: FillableReason): FillableVerdict {
  return { fillable: reason === FILLABLE_REASONS.ok, reason }
}

/**
 * Section 5.3's checklist, in one pass.
 *
 * Renderedness is tested BEFORE interactivity so that the reason a caller gets
 * for a hidden-and-disabled element is `not_rendered` — the scanner branches on
 * exactly that distinction (see NOT_RENDERED_REASONS).
 */
export function isFillable(el: Element, probe: VisibilityProbe): FillableVerdict {
  if (isHiddenInput(el)) return verdict(FILLABLE_REASONS.hiddenInput)
  if (el.hasAttribute('hidden')) return verdict(FILLABLE_REASONS.notRendered)

  const style = probe.style(el)
  if (style.display === 'none') return verdict(FILLABLE_REASONS.notRendered)
  if (style.visibility === 'hidden' || style.visibility === 'collapse') {
    return verdict(FILLABLE_REASONS.visibilityHidden)
  }
  if (opacityOf(style) <= MIN_OPACITY) return verdict(FILLABLE_REASONS.transparent)

  // offsetParent is null for `position: fixed` in every engine, so the check
  // has to be conditional or every sticky "Apply" drawer field disappears.
  if (style.position !== 'fixed' && probe.offsetParent(el) === null) {
    return verdict(FILLABLE_REASONS.notRendered)
  }

  let inDisabledFieldset = false
  for (const ancestor of composedAncestors(el)) {
    if (ancestor.getAttribute('aria-hidden') === 'true') {
      return verdict(FILLABLE_REASONS.ariaHidden)
    }
    // Opacity is not inherited, but it composites: a wrapper at opacity 0 makes
    // its subtree invisible while each child still computes to opacity 1.
    if (opacityOf(probe.style(ancestor)) <= MIN_OPACITY) {
      return verdict(FILLABLE_REASONS.transparent)
    }
    // `input.disabled` reflects the input's OWN attribute, so a control inside
    // `<fieldset disabled>` — how Workday greys out a wizard section the user
    // has not reached — reports false while being genuinely unwritable.
    if (ancestor.tagName === 'FIELDSET' && ancestor.hasAttribute('disabled')) {
      inDisabledFieldset = true
    }
  }

  const rect = probe.rect(el)
  if (rect.width <= 0 || rect.height <= 0) return verdict(FILLABLE_REASONS.zeroSize)
  if (isAbsurdlyOffset(rect, style, probe)) return verdict(FILLABLE_REASONS.offscreen)

  const control = el as Partial<HTMLInputElement>
  if (control.disabled === true || inDisabledFieldset || el.getAttribute('aria-disabled') === 'true') {
    return verdict(FILLABLE_REASONS.disabled)
  }
  if (control.readOnly === true || el.getAttribute('aria-readonly') === 'true') {
    return verdict(FILLABLE_REASONS.readOnly)
  }

  return verdict(FILLABLE_REASONS.ok)
}
