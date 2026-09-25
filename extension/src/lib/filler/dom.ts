import type { FieldKind } from "../../shared/fields"
import type { FieldDescriptor } from "./matcher"

/**
 * Reading a form.
 *
 * Real ATS forms are hostile to naive `querySelectorAll`:
 *  - Workday renders inside open shadow roots.
 *  - Greenhouse and Lever hide the real input behind a styled label.
 *  - Radios carry no label of their own; the question lives on the fieldset.
 *
 * So collection pierces shadow roots, groups radios, and resolves labels
 * through every mechanism the platform offers.
 */

export type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

export interface RawControl {
  /** The element to write to. For radio/checkbox groups: the first member. */
  el: Control
  kind: FieldKind
  /** Every element in the group (radio/checkbox); otherwise `[el]`. */
  members: Control[]
  /** Group key — `name` for grouped controls, otherwise a unique index. */
  key: string
  descriptor: FieldDescriptor
}

/**
 * Input types that are never job-application questions. `search` and `file` are
 * handled specially below; the rest are pure UI.
 */
const IGNORED_INPUT_TYPES = new Set([
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
  "search",
  "password",
  "color",
  "range",
])

/**
 * Visible-but-not-in-layout elements. Style-based rather than
 * `getBoundingClientRect` so behaviour is identical in a browser and in tests.
 */
function isHidden(el: Element): boolean {
  if (el.hasAttribute("hidden")) return true
  if (el.getAttribute("aria-hidden") === "true") return true
  const style = window.getComputedStyle(el)
  if (style.display === "none" || style.visibility === "hidden") return true
  return false
}

/** True when any ancestor hides the subtree. */
function hasHiddenAncestor(el: Element, stopAt: Element | null): boolean {
  let node: Element | null = el
  while (node && node !== stopAt) {
    if (isHidden(node)) return true
    node = node.parentElement
  }
  return false
}

export function getKind(el: Control): FieldKind | null {
  const tag = el.tagName.toLowerCase()
  if (tag === "textarea") return "textarea"
  if (tag === "select") return "select"

  const input = el as HTMLInputElement
  const type = (input.type || "text").toLowerCase()
  if (IGNORED_INPUT_TYPES.has(type)) return null
  if (type === "file") return "file"
  if (type === "radio") return "radio"
  if (type === "checkbox") return "checkbox"
  if (type === "email") return "email"
  if (type === "tel") return "tel"
  if (type === "url") return "url"
  if (type === "date" || type === "month") return "date"
  if (type === "number") return "number"
  return "text"
}

/** Walk the tree including open shadow roots. */
function collectElements(root: ParentNode, out: Control[], depth = 0): void {
  if (depth > 12) return // guard against pathological nesting

  const selector = "input, textarea, select"
  for (const el of Array.from(root.querySelectorAll<Control>(selector))) {
    out.push(el)
  }

  // Pierce open shadow roots — Workday's form controls live here.
  for (const host of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    const shadow = host.shadowRoot
    if (shadow) collectElements(shadow, out, depth + 1)
  }
}

/** Text of `<label for="id">` or a wrapping `<label>`. */
function labelFromLabelElement(el: Control): string {
  if (el.id) {
    try {
      const root = el.getRootNode() as ParentNode
      const explicit = root.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(el.id)}"]`)
      if (explicit?.textContent?.trim()) return cleanLabelText(explicit.textContent)
    } catch {
      // CSS.escape can throw on exotic ids; fall through to the wrapping label.
    }
  }

  const wrapping = el.closest("label")
  if (wrapping) {
    const clone = wrapping.cloneNode(true) as HTMLElement
    // Strip the control's own text and any nested option labels.
    for (const nested of Array.from(clone.querySelectorAll("input, textarea, select, option"))) {
      nested.remove()
    }
    const text = cleanLabelText(clone.textContent ?? "")
    if (text) return text
  }

  return ""
}

/** Remove the asterisks, "(optional)" and trailing noise forms add to labels. */
export function cleanLabelText(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/[*✱✳]/g, "")
    .replace(/\((required|optional)\)/gi, "")
    .replace(/\b(required|optional)\b:?\s*$/gi, "")
    .trim()
}

function labelFromAria(el: Control): string {
  const labelledBy = el.getAttribute("aria-labelledby")
  if (labelledBy) {
    const texts = labelledBy
      .split(/\s+/)
      .map((id) => {
        try {
          const scope = el.getRootNode() as ParentNode
          return scope.querySelector(`#${CSS.escape(id)}`)?.textContent ?? ""
        } catch {
          return document.getElementById(id)?.textContent ?? ""
        }
      })
      .filter(Boolean)
    const joined = cleanLabelText(texts.join(" "))
    if (joined) return joined
  }
  return el.getAttribute("aria-label")?.trim() ?? ""
}

/** The `<legend>` of the enclosing `<fieldset>` — how radios get their question. */
function labelFromFieldset(el: Control): string {
  const fieldset = el.closest("fieldset")
  const legend = fieldset?.querySelector("legend")
  const text = legend?.textContent?.trim()
  return text ? cleanLabelText(text) : ""
}

/**
 * Nearest preceding heading or table row label. Last resort, used on forms that
 * put the question in a `<div>` above the control with no `for` attribute.
 */
function labelFromNeighbourhood(el: Control): string {
  const container =
    el.closest<HTMLElement>("[data-automation-id]")?.parentElement ??
    el.parentElement?.parentElement ??
    el.parentElement
  if (!container) return ""

  // A row that holds exactly one control: its other text is the label.
  const controlsInRow = container.querySelectorAll("input, textarea, select").length
  if (controlsInRow === 1) {
    const clone = container.cloneNode(true) as HTMLElement
    for (const nested of Array.from(clone.querySelectorAll("input, textarea, select, option, button"))) {
      nested.remove()
    }
    const text = cleanLabelText(clone.textContent ?? "")
    // Only trust it when it reads like a question, not like generated copy.
    if (text && text.length <= 200) return text
  }

  const heading = container.querySelector("h1, h2, h3, h4, legend, dt")
  const headingText = heading?.textContent?.trim()
  return headingText ? cleanLabelText(headingText) : ""
}

/** Section heading above the control — identifies EEO blocks and essay prompts. */
function findSectionHeading(el: Control): string {
  const root = el.getRootNode() as ParentNode
  let node: Element | null = el

  while (node && node !== (root as unknown as Element)) {
    let sibling: Element | null = node.previousElementSibling
    while (sibling) {
      const heading = /^h[1-6]$/i.test(sibling.tagName)
        ? sibling
        : sibling.querySelector?.("h1, h2, h3, h4, legend")
      if (heading?.textContent?.trim()) return cleanLabelText(heading.textContent)
      sibling = sibling.previousElementSibling
    }
    node = node.parentElement
    if (node && node.tagName === "FORM") break
  }

  return ""
}

/** Label of a single radio/checkbox member ("Yes", "No", "I am authorized…"). */
export function optionLabel(el: Control): string {
  const fromLabel = labelFromLabelElement(el)
  if (fromLabel) return fromLabel
  const aria = labelFromAria(el)
  if (aria) return aria
  const value = (el as HTMLInputElement).value
  return value ? cleanLabelText(value) : ""
}

function buildDescriptor(el: Control, kind: FieldKind, groupLabel: string): FieldDescriptor {
  const input = el as HTMLInputElement
  return {
    label: groupLabel || labelFromLabelElement(el) || labelFromFieldset(el) || labelFromNeighbourhood(el),
    ariaLabel: labelFromAria(el),
    name: el.getAttribute("name") ?? "",
    id: el.id ?? "",
    placeholder: el.getAttribute("placeholder") ?? "",
    autocomplete: el.getAttribute("autocomplete") ?? "",
    kind,
    sectionHeading: findSectionHeading(el),
    value: input.value ?? (el as HTMLSelectElement).selectedIndex > 0 ? input.value : input.value,
  }
}

export interface CollectOptions {
  /** Skip controls the user has already filled in. */
  skipFilled?: boolean
  /** Include controls the page has hidden (used when re-scanning after a step). */
  includeHidden?: boolean
}

/**
 * Walk the page (or a subtree) and return every question it is asking.
 *
 * Radios and checkboxes sharing a `name` collapse into a single logical field
 * whose options are the member labels — which is how a human reads the form.
 */
export function collectControls(root: ParentNode = document, options: CollectOptions = {}): RawControl[] {
  const elements: Control[] = []
  collectElements(root, elements)

  const controls: RawControl[] = []
  const radioGroups = new Map<string, RawControl>()
  let fallbackIndex = 0

  for (const el of elements) {
    const kind = getKind(el)
    if (!kind) continue

    const input = el as HTMLInputElement
    if (input.disabled) continue
    // `readonly` is a real answer the user (or the ATS) already gave.
    if ("readOnly" in el && el.readOnly) continue

    // File inputs are frequently styled invisible; they are still fillable by
    // hand, and we report them rather than writing to them.
    const isGrouped = kind === "radio" || kind === "checkbox"
    if (!options.includeHidden && !isGrouped && kind !== "file" && hasHiddenAncestor(el, null)) continue
    if (kind !== "radio" && kind !== "checkbox" && kind !== "file" && isHidden(el)) continue

    const name = el.getAttribute("name") ?? ""

    if (isGrouped && name) {
      const existing = radioGroups.get(`${kind}:${name}`)
      if (existing) {
        existing.members.push(el)
        continue
      }
      // First member of a new group: the question comes from the fieldset or
      // the shared container, not from the member's own "Yes"/"No" label.
      const groupLabel = labelFromFieldset(el) || labelFromNeighbourhood(el)
      const control: RawControl = {
        el,
        kind,
        members: [el],
        key: `${kind}:${name}`,
        descriptor: buildDescriptor(el, kind, groupLabel),
      }
      radioGroups.set(`${kind}:${name}`, control)
      controls.push(control)
      continue
    }

    controls.push({
      el,
      kind,
      members: [el],
      key: `${kind}:${name || el.id || `field-${fallbackIndex++}`}`,
      descriptor: buildDescriptor(el, kind, ""),
    })
  }

  // Attach option labels to grouped controls so the filler can choose.
  for (const control of controls) {
    if (control.kind === "radio" || control.kind === "checkbox") {
      control.descriptor.options = control.members.map(optionLabel).filter(Boolean)
      control.descriptor.value = control.members.some((m) => (m as HTMLInputElement).checked)
        ? "checked"
        : ""
    } else if (control.kind === "select") {
      const select = control.el as HTMLSelectElement
      control.descriptor.options = Array.from(select.options).map((o) => o.textContent?.trim() ?? "")
      control.descriptor.value = select.value
      // A `<select>` whose first option is blank has not really been answered.
      if (control.descriptor.options[0] === "" || select.selectedIndex <= 0) {
        control.descriptor.value = ""
      }
    } else {
      control.descriptor.value = (control.el as HTMLInputElement).value
    }
  }

  return controls
}

/** True when the element is disabled, readonly, or otherwise not ours to touch. */
export function isWritable(el: Control): boolean {
  if ((el as HTMLInputElement).disabled) return false
  if ("readOnly" in el && (el as HTMLInputElement).readOnly) return false
  return true
}
