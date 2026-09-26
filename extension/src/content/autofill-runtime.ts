/**
 * The autofill runtime: everything the filler engine needs to actually touch a
 * live page, exposed as message handlers.
 *
 * The engine (fields -> matcher -> plan -> execute) is deliberately pure so it
 * can be unit-tested; this module is the impure half that owns element
 * references, reacts to the DOM changing between steps, and remembers what the
 * last scan saw so a fill can be applied seconds later.
 *
 * Handlers are registered by index.tsx alongside the extraction handlers, so
 * the popup, the background worker (context menu, keyboard shortcut) and the
 * floating capture button all drive the same code path.
 */

import { collectControls, type RawControl } from "../lib/filler/dom"
import { buildFillPlan, type FillPlan, type FillPlanItem, type PlanStatus } from "../lib/filler/plan"
import { applyItem, clearHighlights } from "../lib/filler/execute"
import { findNavTargets, waitForDomSettle } from "./step-navigation"
import { normalizeProfile, type AutofillProfile } from "../shared/profile"
import type { CanonicalFieldId, FieldKind } from "../shared/fields"

// ────────────────────────────────────────────────────────────────────────────
// Wire types (everything crossing a message boundary)
// ────────────────────────────────────────────────────────────────────────────

/** One review-table row: the plan item plus the bits of context the UI shows. */
export interface PlanRow {
  index: number
  label: string
  kind: FieldKind
  status: PlanStatus
  value: string | null
  confidence: number
  reason: string
  fieldId?: CanonicalFieldId
  note?: string
  options?: string[]
}

export interface StepInfo {
  hasNext: boolean
  nextLabel: string | null
  hasSubmit: boolean
  submitLabel: string | null
}

export interface ScanResult {
  success: true
  rows: PlanRow[]
  summary: FillPlan["summary"]
  step: StepInfo
}

// ────────────────────────────────────────────────────────────────────────────
// Runtime state
// ────────────────────────────────────────────────────────────────────────────

/** Controls + plan from the most recent scan. Indexes in messages refer here. */
let lastControls: RawControl[] = []
let lastPlan: FillPlan | null = null
/** The element under the most recent right-click (for context-menu fills). */
let contextTarget: Element | null = null

// ────────────────────────────────────────────────────────────────────────────
// Scanning
// ────────────────────────────────────────────────────────────────────────────

function toRow(control: RawControl, item: FillPlanItem): PlanRow {
  return {
    index: item.index,
    label: item.label,
    kind: item.kind,
    status: item.status,
    value: item.value ?? null,
    confidence: item.confidence,
    reason: item.reason,
    fieldId: item.fieldId,
    note: item.note,
    options: control.descriptor.options,
  }
}

function stepInfo(): StepInfo {
  const targets = findNavTargets()
  return {
    hasNext: Boolean(targets.find((t) => t.kind === "next")),
    nextLabel: targets.find((t) => t.kind === "next")?.label ?? null,
    hasSubmit: Boolean(targets.find((t) => t.kind === "submit")),
    submitLabel: targets.find((t) => t.kind === "submit")?.label ?? null,
  }
}

export function handleScan(message: {
    profile: unknown
    includeSensitive?: boolean
    overwrite?: boolean
}): ScanResult {
    const profile: AutofillProfile = normalizeProfile(message.profile)
    lastControls = collectControls(document)
    lastPlan = buildFillPlan(lastControls, {
        profile,
        includeSensitive: Boolean(message.includeSensitive),
        overwrite: Boolean(message.overwrite),
        savedAnswers: [],
    })

    const rows = lastPlan.items.map((item) => toRow(lastControls[item.index], item))
    return { success: true, rows, summary: lastPlan.summary, step: stepInfo() }
}

// ────────────────────────────────────────────────────────────────────────────
// Filling
// ────────────────────────────────────────────────────────────────────────────

/**
 * Apply (a subset of) the last plan, with optional per-index value edits from
 * the review table.
 *
 * `ready` items fill with their planned value. Any other item fills only when
 * the user typed an explicit edit for it in the review table — that edit is
 * the confirmation. `file` items are never written here (see handleAttach).
 */
export async function handleApply(message: {
    indexes?: number[]
    edits?: Record<string, string>
    slow?: boolean
}): Promise<{ success: boolean; results: Array<{ index: number; label: string; ok: boolean; error?: string }> }> {
    if (!lastPlan) return { success: false, results: [] }

    const edits = message.edits ?? {}
    const wanted = message.indexes
    const results: Array<{ index: number; label: string; ok: boolean; error?: string }> = []

    for (const item of lastPlan.items) {
        if (item.status === "file") continue

        const edited = edits[String(item.index)]
        const isWanted = wanted ? wanted.includes(item.index) : true
        if (!isWanted) continue

        // Ready rows fill as planned; everything else needs an explicit edit.
        if (item.status !== "ready" && !(typeof edited === "string" && edited.trim())) continue

        const value = typeof edited === "string" && edited.trim() ? edited : item.value
        if (value === undefined || value === null) {
            results.push({ index: item.index, label: item.label, ok: false, error: "No value" })
            continue
        }

        const control = lastControls[item.index]
        if (!control || !control.el.isConnected) {
            results.push({ index: item.index, label: item.label, ok: false, error: "Field is no longer on the page" })
            continue
        }

        const result = await applyItem(control, { ...item, value, status: "ready" }, { highlight: true, slow: Boolean(message.slow) })
        results.push({ index: result.index, label: result.label, ok: result.ok, error: result.error })
    }

    return { success: true, results }
}

/** Fill a single control (right-click -> "Fill this field"). */
export async function handleFillField(message: { index: number; value: string }): Promise<{ ok: boolean; error?: string }> {
    if (!lastPlan) return { ok: false, error: "Scan the page first" }

    const item = lastPlan.items.find((candidate) => candidate.index === message.index)
    const control = lastControls[message.index]
    if (!item || !control) return { ok: false, error: "Field not found" }

    const result = await applyItem(control, { ...item, value: message.value, status: "ready" }, { highlight: true })
    return result.ok ? { ok: true } : { ok: false, error: result.error }
}

// ────────────────────────────────────────────────────────────────────────────
// Context menu target tracking
// ────────────────────────────────────────────────────────────────────────────

/**
 * Record the element the user right-clicked. The element — not an index — is
 * stored, because indexes only mean something against the scan they came from
 * and the DOM may have changed since.
 */
export function rememberContextTarget(event: Event): void {
    contextTarget = event.target instanceof Element ? event.target : null
}

/**
 * Fill the right-clicked field ("Fill this field with ApplyOS").
 *
 * Runs a fresh scan so the target resolves against the page as it is now.
 * If the engine knows the answer, it is used; otherwise, when `answer` is
 * provided (the background fetched an AI answer), that is written instead.
 */
export async function handleFillContext(message: {
    profile: unknown
    answer?: string
}): Promise<{
    filled: boolean
    label: string | null
    value: string | null
    needsAnswer: boolean
    error?: string
}> {
    const target = contextTarget
    if (!target || !target.isConnected) {
        return { filled: false, label: null, value: null, needsAnswer: false, error: "Right-click the field again — the page changed" }
    }

    const profile: AutofillProfile = normalizeProfile(message.profile)
    const controls = collectControls(document)
    const plan = buildFillPlan(controls, { profile, savedAnswers: [] })

    const index = controls.findIndex((control) => {
        const el = control.el
        if (el === target) return true
        if (control.members?.includes(target as never)) return true
        return el.contains(target)
    })
    if (index === -1) {
        return { filled: false, label: null, value: null, needsAnswer: false, error: "That field is not fillable" }
    }

    // Remember this scan so subsequent messages share its indexes.
    lastControls = controls
    lastPlan = plan

    const item = plan.items.find((candidate) => candidate.index === index)
    if (!item) {
        return { filled: false, label: null, value: null, needsAnswer: false, error: "Field not found" }
    }

    if (item.status === "ready" && item.value !== undefined) {
        const result = await applyItem(controls[index], item, { highlight: true })
        return { filled: result.ok, label: item.label, value: item.value, needsAnswer: false, error: result.error }
    }

    if (message.answer?.trim()) {
        const result = await applyItem(controls[index], { ...item, value: message.answer, status: "ready" }, { highlight: true })
        return { filled: result.ok, label: item.label, value: message.answer, needsAnswer: false, error: result.error }
    }

    // The engine has nothing — tell the caller so it can fetch an AI answer
    // and call back with it.
    return { filled: false, label: item.label, value: null, needsAnswer: true }
}

// ────────────────────────────────────────────────────────────────────────────
// Navigation (multi-page copilot)
// ────────────────────────────────────────────────────────────────────────────

export async function handleNavigate(message: { kind: "next" | "submit" }): Promise<{ success: boolean; reason?: string }> {
    const targets = findNavTargets()
    const target = targets.find((t) => t.kind === message.kind)
    if (!target) return { success: false, reason: `No ${message.kind} button on this page` }

    target.el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior })
    target.el.click()
    await waitForDomSettle()

    // A step transition invalidates every element reference we hold.
    lastControls = []
    lastPlan = null
    contextTarget = null

    return { success: true }
}

// ────────────────────────────────────────────────────────────────────────────
// Answer learning
// ────────────────────────────────────────────────────────────────────────────

/**
 * Read back the questions the plan could not answer, to offer saving whatever
 * the user typed by hand. Only statuses that meant "we don't know" are
 * collected — a `ready` value was ours, not the user's knowledge.
 */
export function handleLearn(): { success: true; learned: Array<{ question: string; answer: string }> } {
    if (!lastPlan) return { success: true, learned: [] }

    const learnable = new Set<PlanStatus>(["missing-value", "unknown", "low-confidence"])
    const learned: Array<{ question: string; answer: string }> = []

    for (const item of lastPlan.items) {
        if (!learnable.has(item.status)) continue
        const control = lastControls[item.index]
        if (!control) continue

        let answer = ""
        if (control.kind === "radio" || control.kind === "checkbox") {
            answer = control.members
                .filter((member) => (member as HTMLInputElement).checked)
                .map((member) => member.getAttribute("aria-label") || (member as HTMLInputElement).value || "checked")
                .join(", ")
        } else if (control.kind === "select") {
            const select = control.el as HTMLSelectElement
            answer = select.selectedIndex > 0 ? select.value : ""
        } else {
            answer = (control.el as HTMLInputElement).value?.trim() ?? ""
        }

        if (answer && item.label && item.label !== "(unlabelled field)") {
            learned.push({ question: item.label, answer })
        }
    }

    return { success: true, learned }
}

// ────────────────────────────────────────────────────────────────────────────
// File attachment
// ────────────────────────────────────────────────────────────────────────────

/**
 * Attach a file to a file input.
 *
 * The plan reports file inputs as `file` status because the page's own file
 * picker cannot be driven — but the DOM can accept a programmatically-built
 * File through DataTransfer, which is exactly how a drag-and-drop upload
 * works. React/Angular ATS forms listen for `change`, so that is dispatched
 * after the files are set.
 */
export function handleAttach(message: {
    index: number
    fileName: string
    mimeType: string
    base64: string
}): { ok: boolean; error?: string } {
    const control = lastControls[message.index]
    if (!control || control.kind !== "file") return { ok: false, error: "Not a file field" }

    const input = control.el as HTMLInputElement
    if (input.disabled) return { ok: false, error: "Field is disabled" }

    try {
        const binary = atob(message.base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const file = new File([bytes], message.fileName, { type: message.mimeType || "application/pdf" })

        const transfer = new DataTransfer()
        transfer.items.add(file)
        input.files = transfer.files

        input.dispatchEvent(new Event("input", { bubbles: true }))
        input.dispatchEvent(new Event("change", { bubbles: true }))

        return input.files?.length ? { ok: true } : { ok: false, error: "The page rejected the file" }
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Attach failed" }
    }
}

/** Remove our highlights (used when the user undoes a fill). */
export function handleClearHighlights(): { success: true } {
    clearHighlights()
    return { success: true }
}

/** Forget the last scan (used when leaving copilot mode). */
export function handleReset(): { success: true } {
    lastControls = []
    lastPlan = null
    contextTarget = null
    clearHighlights()
    return { success: true }
}
