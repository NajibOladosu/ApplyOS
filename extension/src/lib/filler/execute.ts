import type { RawControl } from "./dom"
import { pickOption, type FillPlan, type FillPlanItem } from "./plan"
import { normalize } from "./normalize"

/**
 * Writing to the page.
 *
 * The hard part of autofill is not finding the field, it is making the page
 * *believe* a person typed into it. React, Vue and Angular each track the last
 * value they rendered and ignore `element.value = x`; the ATS frameworks also
 * validate on `input`, `change` and `blur`. Hence native setters plus real
 * events, and a read-back to confirm the write landed.
 */

export interface FillResult {
  index: number
  label: string
  ok: boolean
  /** What we attempted, for the popup's summary. */
  value?: string
  error?: string
}

export interface ExecuteOptions {
  /** Visually mark what we filled so the user can spot-check it. */
  highlight?: boolean
  /** Simulates typing delays — some ATS debounce-validate on each keystroke. */
  slow?: boolean
}

const HIGHLIGHT_ATTRIBUTE = "data-applyos-filled"

/**
 * Set a value the way a user would, so framework state stays in sync.
 *
 * Calling the prototype's setter bypasses the framework's own value tracker,
 * which is what makes React notice the change at all.
 */
function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value")

  if (descriptor?.set) {
    descriptor.set.call(element, value)
  } else {
    element.value = value
  }

  element.dispatchEvent(new Event("input", { bubbles: true }))
  element.dispatchEvent(new Event("change", { bubbles: true }))
}

function setNativeSelectValue(element: HTMLSelectElement, option: HTMLOptionElement): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")
  if (descriptor?.set) {
    descriptor.set.call(element, option.value)
  } else {
    element.value = option.value
  }

  element.dispatchEvent(new Event("input", { bubbles: true }))
  element.dispatchEvent(new Event("change", { bubbles: true }))
}

/** Mark an element so the user can see what changed, and clear it later. */
function highlight(element: Element): void {
  const htmlElement = element as HTMLElement
  htmlElement.setAttribute(HIGHLIGHT_ATTRIBUTE, "true")
  htmlElement.style.outline = "2px solid #18bb70"
  htmlElement.style.outlineOffset = "1px"
  htmlElement.style.transition = "outline-color 200ms ease"
}

/** Remove every highlight this content script added. */
export function clearHighlights(root: ParentNode = document): void {
  for (const element of Array.from(root.querySelectorAll(`[${HIGHLIGHT_ATTRIBUTE}]`))) {
    const htmlElement = element as HTMLElement
    htmlElement.removeAttribute(HIGHLIGHT_ATTRIBUTE)
    htmlElement.style.outline = ""
    htmlElement.style.outlineOffset = ""
    htmlElement.style.transition = ""
  }
}

/** Read back what the control now holds, for verification. */
function readValue(control: RawControl): string {
  if (control.kind === "radio" || control.kind === "checkbox") {
    const checked = control.members.filter((member) => (member as HTMLInputElement).checked)
    if (checked.length === 0) return ""
    const input = checked[0] as HTMLInputElement
    return input.value || "checked"
  }
  if (control.kind === "select") {
    const select = control.el as HTMLSelectElement
    return select.selectedIndex > 0 ? select.value : ""
  }
  return (control.el as HTMLInputElement).value
}

/**
 * Fill one planned item.
 *
 * Returns whether the write can be verified — a field that silently rejects the
 * value is reported as a failure rather than counted as filled.
 */
export async function applyItem(
  control: RawControl,
  item: FillPlanItem,
  options: ExecuteOptions = {}
): Promise<FillResult> {
  const result: FillResult = { index: item.index, label: item.label, ok: false, value: item.value }

  if (item.status !== "ready" || item.value === undefined) {
    return { ...result, error: "Nothing to fill" }
  }

  try {
    if (control.kind === "radio" || control.kind === "checkbox") {
      const answer = { type: "text" as const, value: item.value }
      const wanted = pickOption(control.descriptor.options ?? [], answer)
      if (!wanted) return { ...result, error: "No matching option" }

      const target = control.members.find((member) => {
        const label = member.getAttribute("aria-label") || member.closest("label")?.textContent || ""
        return normalize(label) === normalize(wanted) || normalize((member as HTMLInputElement).value) === normalize(wanted)
      })
      if (!target) return { ...result, error: "Option not found on the page" }

      const input = target as HTMLInputElement
      if (input.checked) return { ...result, ok: true }

      // A real click runs the framework's own handlers.
      input.click()

      if (options.highlight) highlight(input.closest("label") ?? input)
      if (!input.checked) return { ...result, error: "The page rejected the selection" }

      return { ...result, ok: true }
    }

    if (control.kind === "select") {
      const select = control.el as HTMLSelectElement
      const labels = Array.from(select.options).map((option) => option.textContent?.trim() ?? "")
      const answer = { type: "text" as const, value: item.value }
      const wanted = pickOption(labels, answer)
      if (!wanted) return { ...result, error: "No matching option" }

      const option = Array.from(select.options).find((candidate) => (candidate.textContent?.trim() ?? "") === wanted)
      if (!option) return { ...result, error: "Option not found" }

      setNativeSelectValue(select, option)
      if (options.highlight) highlight(select)

      const landed = readValue(control)
      if (!landed) return { ...result, error: "The page rejected the selection" }

      return { ...result, ok: true, value: wanted }
    }

    // Text-shaped controls.
    const element = control.el as HTMLInputElement | HTMLTextAreaElement
    setNativeValue(element, item.value)
    if (options.highlight) highlight(element)

    const landed = readValue(control)
    if (normalize(landed) !== normalize(item.value)) {
      return { ...result, error: "The page rejected the value" }
    }

    // Some ATS validate on blur and only then accept the answer.
    element.dispatchEvent(new Event("blur", { bubbles: true }))
    return { ...result, ok: true }
  } catch (error) {
    return { ...result, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

/**
 * Apply a whole plan.
 *
 * Sequential rather than parallel: multi-step forms re-render between fields,
 * and a stale element reference is the most common way an autofiller breaks.
 */
export async function applyPlan(
  controls: RawControl[],
  plan: FillPlan,
  options: ExecuteOptions = {}
): Promise<FillResult[]> {
  const results: FillResult[] = []

  for (const item of plan.items) {
    if (item.status !== "ready") continue

    const control = controls[item.index]
    if (!control) {
      results.push({ index: item.index, label: item.label, ok: false, error: "Field is no longer on the page" })
      continue
    }

    results.push(await applyItem(control, item, options))

    if (options.slow) {
      // Give debounced validation a chance to run before the next field.
      await new Promise((resolve) => setTimeout(resolve, 120))
    }
  }

  return results
}

/** Document fields, reported so the user knows what to attach by hand. */
export function fileFields(controls: RawControl[], plan: FillPlan): Array<{ control: RawControl; item: FillPlanItem }> {
  return plan.items
    .filter((item) => item.status === "file")
    .map((item) => ({ control: controls[item.index], item }))
    .filter((entry): entry is { control: RawControl; item: FillPlanItem } => Boolean(entry.control))
}
