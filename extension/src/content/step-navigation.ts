/**
 * Multi-step form navigation — the "Copilot" half of multi-page autofill.
 *
 * Real applications (Workday, LinkedIn Easy Apply, SmartRecruiters) spread one
 * application across many pages. After filling a step, the runtime needs to
 * find the button that advances the form — and must never click "Back",
 * "Cancel", "Withdraw" or a social share button on the way.
 *
 * `scoreNavLabel` is pure and unit-tested; `findNavTargets` is the DOM half
 * that applies it to visible, enabled candidates.
 */

export interface NavTarget {
  kind: "next" | "submit"
  label: string
  el: HTMLElement
}

/** Phrases that advance a form, strongest first. */
const NEXT_PATTERNS: Array<[RegExp, number]> = [
  [/^(next|continue|forward)(\s|$|»)/i, 100],
  [/\b(next|continue)\b/i, 80],
  [/\bproceed\b/i, 60],
  [/^»$|^›$|^>$|^→$/i, 50],
]

/** Phrases that submit the application. */
const SUBMIT_PATTERNS: Array<[RegExp, number]> = [
  [/^submit\b/i, 100],
  [/\bsubmit (your )?(application|form|profile)\b/i, 100],
  [/\bsend (your )?(application|application form)\b/i, 90],
  [/\bapply (now|for this job|for this role)\b/i, 80],
  [/^apply$/i, 70],
]

/** Never click these, however similar they look. */
const FORBIDDEN_PATTERNS = [
  /\bback\b/i,
  /\bprevious\b/i,
  /\bprev\b/i,
  /\bcancel\b/i,
  /\bclose\b/i,
  /\bwithdraw\b/i,
  /\bdelete\b/i,
  /\bremove\b/i,
  /\bdiscard\b/i,
  /\breset\b/i,
  /\bclear\b/i,
  /\bsave(?! (and|&) (continue|next))/i, // "Save" alone, not "Save and continue"
  /\bdraft\b/i,
  /\bshare\b/i,
  /\blog ?in\b/i,
  /\bsign ?in\b/i,
  /\bregister\b/i,
  /\bdownload\b/i,
  /\bprint\b/i,
  /\bpreview\b/i,
  /\breview (your|the)? ?(answers?|application)?\b/i,
]

/**
 * Score a button label for "advances the form" (positive) or "do not click"
 * (0). Ties break toward `next`, because on a mid-form step the submit button
 * is usually hidden and a "Next" mis-click costs one page, not an application.
 */
export function scoreNavLabel(label: string): { kind: "next" | "submit"; score: number } | null {
  const text = (label || "").trim()
  if (!text || text.length > 60) return null

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) return null
  }

  let best: { kind: "next" | "submit"; score: number } | null = null
  for (const [pattern, score] of NEXT_PATTERNS) {
    if (pattern.test(text) && (!best || score > best.score)) best = { kind: "next", score }
  }
  for (const [pattern, score] of SUBMIT_PATTERNS) {
    if (pattern.test(text) && (!best || score > best.score)) best = { kind: "submit", score }
  }
  return best
}

function isVisible(el: HTMLElement): boolean {
  if (el.hasAttribute("hidden")) return false
  if (el.getAttribute("aria-hidden") === "true") return false
  if (el.getAttribute("aria-disabled") === "true") return false
  if ((el as HTMLButtonElement).disabled) return false
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function labelOf(el: HTMLElement): string {
  return (
    el.getAttribute("aria-label") ||
    el.getAttribute("title") ||
    el.textContent ||
    (el as HTMLInputElement).value ||
    ""
  )
}

/**
 * Every visible, enabled element on the page that looks like a form-advance
 * button, ordered best-first within each kind.
 */
export function findNavTargets(root: ParentNode = document): NavTarget[] {
  const candidates = root.querySelectorAll<HTMLElement>(
    [
      "button",
      "input[type='submit']",
      "input[type='button']",
      "[role='button']",
      "a[data-testid*='next' i]",
    ].join(", ")
  )

  const targets: Array<NavTarget & { score: number }> = []
  for (const el of Array.from(candidates)) {
    if (!isVisible(el)) continue
    const scored = scoreNavLabel(labelOf(el))
    if (!scored) continue
    targets.push({ ...scored, label: labelOf(el).trim(), el })
  }

  targets.sort((a, b) => b.score - a.score)

  const next = targets.find((t) => t.kind === "next")
  const submit = targets.find((t) => t.kind === "submit")

  const out: NavTarget[] = []
  if (next) out.push({ kind: "next", label: next.label, el: next.el })
  if (submit) out.push({ kind: "submit", label: submit.label, el: submit.el })
  return out
}

/**
 * Wait for a SPA step transition to settle: resolve once the DOM has been
 * quiet for `quietMs`, or after `timeoutMs` regardless.
 */
export function waitForDomSettle(quietMs = 400, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const finish = () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
      resolve()
    }
    const observer = new MutationObserver(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(finish, quietMs)
    })
    observer.observe(document.documentElement, { childList: true, subtree: true })
    timer = setTimeout(finish, quietMs)
    setTimeout(finish, timeoutMs)
  })
}
