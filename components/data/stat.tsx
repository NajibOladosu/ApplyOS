"use client"

import type { ReactNode } from "react"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { cn } from "@/shared/lib/utils"

export interface StatTrend {
  value: number
  /** What the delta is measured against, e.g. "vs last week". */
  label?: string
  /** Direction that reads as positive for this metric. */
  goodDirection?: "up" | "down"
}

interface StatProps {
  label: string
  value: ReactNode
  icon: ReactNode
  trend?: StatTrend
  /** Optional micro-visual: a sparkline or mini bar chart. */
  visual?: ReactNode
  hint?: string
  accent?: "primary" | "muted" | "warning" | "danger"
  href?: string
}

const ACCENT: Record<NonNullable<StatProps["accent"]>, { ring: string; icon: string }> = {
  primary: { ring: "before:bg-primary", icon: "bg-primary/10 text-primary-strong dark:text-primary" },
  muted: { ring: "before:bg-border", icon: "bg-muted text-muted-foreground" },
  warning: { ring: "before:bg-amber-500", icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  danger: { ring: "before:bg-destructive", icon: "bg-destructive/10 text-destructive" },
}

/**
 * A stat that carries information beyond its number: direction, comparison
 * basis and a micro-visual. The old dashboard shipped four identical
 * icon/label/number boxes, which is what made it read as a template.
 */
export function Stat({ label, value, icon, trend, visual, hint, accent = "muted" }: StatProps) {
  const a = ACCENT[accent]
  const direction =
    !trend || trend.value === 0
      ? "flat"
      : trend.value > 0
        ? "up"
        : "down"
  const good = trend?.goodDirection ?? "up"
  const tone =
    direction === "flat" ? "text-muted-foreground" : direction === good ? "text-primary-strong dark:text-primary" : "text-destructive"

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 transition-colors hover:border-border",
        // a left stripe only when the value is asking for attention — four
        // tinted stripes in a row read as four simultaneous alerts
        accent !== "primary" && "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']",
        a.ring,
        accent === "primary" && "before:hidden"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium leading-snug text-muted-foreground">{label}</p>
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", a.icon)}>{icon}</span>
      </div>

      <div className="mt-3 flex items-end gap-2">
        <span className="font-display text-[34px] font-bold leading-none tracking-[-0.03em] text-foreground tabular-nums">
          {value}
        </span>
        {trend ? (
          <span className={cn("mb-1 inline-flex items-center gap-0.5 text-xs font-semibold", tone)}>
            {direction === "up" ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : direction === "down" ? (
              <ArrowDownRight className="h-3.5 w-3.5" />
            ) : (
              <Minus className="h-3.5 w-3.5" />
            )}
            {Math.abs(trend.value)}
          </span>
        ) : null}
      </div>

      {visual ? <div className="mt-4">{visual}</div> : null}
      {hint || trend?.label ? (
        <p className="mt-2 text-xs text-muted-foreground/80">{hint ?? trend?.label}</p>
      ) : null}
    </div>
  )
}

/** Sparkline for a small series — no chart library, just a normalised polyline. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const w = 100
  const h = 28
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / span) * (h - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-7 w-full", className)} aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/** Minimal proportional bar used for distribution rows. */
export function MiniBar({ ratio, tone = "primary" }: { ratio: number; tone?: "primary" | "muted" | "danger" | "warning" }) {
  const tones = {
    primary: "bg-primary",
    muted: "bg-muted-foreground/40",
    danger: "bg-destructive",
    warning: "bg-amber-500",
  } as const
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", tones[tone])}
        style={{ width: `${Math.max(ratio * 100, 2)}%` }}
      />
    </div>
  )
}
