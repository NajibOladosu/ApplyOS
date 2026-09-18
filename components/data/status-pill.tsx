import { cn } from "@/shared/lib/utils"
import type { ApplicationStatus, ApplicationPriority } from "@/types/database"

/**
 * The single source of truth for application status styling.
 * Previously `statusChip` was copy-pasted in app/applications/page.tsx,
 * app/dashboard/page.tsx and app/documents/[id]/page.tsx — three places to
 * keep in sync, and they had already drifted.
 */
export const STATUS_META: Record<
  ApplicationStatus,
  { label: string; dot: string; pill: string }
> = {
  draft: {
    label: "Draft",
    dot: "bg-muted-foreground/50",
    pill: "border-border/70 bg-muted/60 text-muted-foreground",
  },
  submitted: {
    label: "Submitted",
    dot: "bg-primary",
    pill: "border-primary/25 bg-primary/10 text-primary-strong dark:text-primary",
  },
  in_review: {
    label: "In review",
    dot: "bg-amber-500",
    pill: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  interview: {
    label: "Interview",
    dot: "bg-violet-500",
    pill: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  },
  offer: {
    label: "Offer",
    dot: "bg-primary",
    pill: "border-primary/40 bg-primary/15 font-semibold text-primary-strong dark:text-primary",
  },
  rejected: {
    label: "Rejected",
    dot: "bg-destructive",
    pill: "border-destructive/25 bg-destructive/10 text-destructive",
  },
}

export const PRIORITY_META: Record<ApplicationPriority, { label: string; dot: string; text: string }> = {
  high: { label: "High", dot: "bg-destructive", text: "text-destructive" },
  medium: { label: "Medium", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  low: { label: "Low", dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
}

export function StatusPill({
  status,
  size = "default",
  className,
}: {
  status: ApplicationStatus
  size?: "sm" | "default"
  className?: string
}) {
  const meta = STATUS_META[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        meta.pill,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </span>
  )
}

export function PriorityDot({ priority, showLabel = true }: { priority: ApplicationPriority; showLabel?: boolean }) {
  const meta = PRIORITY_META[priority]
  if (priority === "low" && !showLabel) return null
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", meta.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden />
      {showLabel ? meta.label : null}
    </span>
  )
}

/**
 * Score is displayed three different ways across the app (coloured text, a
 * circle, a big number). This is the one canonical treatment.
 */
export function scoreTone(score: number) {
  if (score >= 80) return { text: "text-primary-strong dark:text-primary", bg: "bg-primary/10", ring: "border-primary/30" }
  if (score >= 60) return { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", ring: "border-amber-500/30" }
  return { text: "text-destructive", bg: "bg-destructive/10", ring: "border-destructive/30" }
}

const PROGRESS_TONE = { text: "text-primary", bg: "bg-primary/10", ring: "border-primary/30" }

export function ScoreRing({
  score,
  size = 56,
  label,
  className,
  /** "score" grades the value (red under 60); "progress" is a neutral meter. */
  tone: toneKind = "score",
}: {
  score: number
  size?: number
  label?: string
  className?: string
  tone?: "score" | "progress"
}) {
  const tone = toneKind === "progress" ? PROGRESS_TONE : scoreTone(score)
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score)) / 100

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="4" className="stroke-muted" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c}`}
            className={cn("transition-[stroke-dasharray] duration-700", tone.text)}
            stroke="currentColor"
          />
        </svg>
        <span
          className={cn("absolute inset-0 flex items-center justify-center font-display font-bold tabular-nums", tone.text)}
          style={{ fontSize: size / 3.6 }}
        >
          {Math.round(score)}
        </span>
      </div>
      {label ? <span className="text-xs text-muted-foreground">{label}</span> : null}
    </div>
  )
}
