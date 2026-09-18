"use client"

import { useMemo, useState } from "react"
import { cn } from "@/shared/lib/utils"

/**
 * Activity heatmap, rebuilt.
 *
 * The previous version was invisible in dark mode (its cells used values that
 * matched the dark surface) and carried no labels, so it communicated nothing.
 * This one uses theme tokens, labels the weekdays and months, and shows a
 * value for the hovered day.
 */

const WEEKDAYS = ["Mon", "", "Wed", "", "Fri", "", "Sun"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

interface Day {
  date: string // yyyy-mm-dd
  count: number
}

function buildDays(counts: Map<string, number>, weeks: number) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // end the grid on the Saturday of the current week so columns are full weeks
  const start = new Date(today)
  start.setDate(start.getDate() - (weeks - 1) * 7)
  // rewind to the Monday of that week
  const day = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - day)

  const cols: Day[][] = []
  const cursor = new Date(start)
  for (let w = 0; w < weeks; w++) {
    const col: Day[] = []
    for (let d = 0; d < 7; d++) {
      const key = cursor.toISOString().slice(0, 10)
      col.push({ date: key, count: counts.get(key) ?? 0 })
      cursor.setDate(cursor.getDate() + 1)
    }
    cols.push(col)
  }
  return cols
}

/** intensity ramp — transparent toward the surface, brand green at the top */
const LEVELS = [
  "bg-muted/70",
  "bg-primary/25",
  "bg-primary/45",
  "bg-primary/70",
  "bg-primary",
]

function level(count: number, max: number) {
  if (count <= 0) return 0
  if (max <= 0) return 0
  const ratio = count / max
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

export function ActivityHeatmap({
  /** Map of yyyy-mm-dd → count. Missing keys are empty days. */
  data,
  weeks = 26,
  title = "Application activity",
  subtitle,
}: {
  data: Record<string, number> | Map<string, number>
  weeks?: number
  title?: string
  subtitle?: string
}) {
  const counts = useMemo(() => (data instanceof Map ? data : new Map(Object.entries(data))), [data])
  const cols = useMemo(() => buildDays(counts, weeks), [counts, weeks])
  const [hover, setHover] = useState<{ date: string; count: number } | null>(null)

  const max = Math.max(0, ...counts.values())
  const total = counts.size ? [...counts.values()].reduce((a, b) => a + b, 0) : 0
  const activeDays = [...counts.values()].filter((v) => v > 0).length

  // month labels: show a label on the first column whose week contains the 1st
  const monthLabels = cols.map((col, i) => {
    const first = new Date(col[0].date)
    const prev = i > 0 ? new Date(cols[i - 1][0].date) : null
    if (!prev || first.getMonth() !== prev.getMonth()) return MONTHS[first.getMonth()]
    return ""
  })

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-bold leading-none text-foreground tabular-nums">
            {total}
            <span className="ml-1 text-xs font-medium text-muted-foreground">activities</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {activeDays} active {activeDays === 1 ? "day" : "days"}
          </p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto pb-1">
        <div className="inline-flex min-w-full gap-2">
          {/* weekday gutter */}
          <div className="flex flex-col justify-between pt-[18px]">
            {WEEKDAYS.map((d, i) => (
              <span key={i} className="h-[13px] text-[10px] leading-[13px] text-muted-foreground/70">
                {d}
              </span>
            ))}
          </div>

          <div className="flex-1">
            {/* month row */}
            <div className="mb-1 flex gap-[3px]">
              {monthLabels.map((m, i) => (
                <span key={i} className="w-[13px] text-[10px] text-muted-foreground/70">
                  <span className="block w-8 whitespace-nowrap">{m}</span>
                </span>
              ))}
            </div>

            <div className="flex gap-[3px]" onMouseLeave={() => setHover(null)}>
              {cols.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-[3px]">
                  {col.map((d) => {
                    const l = level(d.count, max)
                    return (
                      <div
                        key={d.date}
                        onMouseEnter={() => setHover(d)}
                        title={`${d.count} on ${d.date}`}
                        className={cn(
                          "h-[13px] w-[13px] rounded-[3px] ring-1 ring-inset ring-black/[0.04] transition-colors dark:ring-white/[0.06]",
                          LEVELS[l],
                          hover?.date === d.date && "ring-2 ring-foreground/40"
                        )}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {hover ? (
            <>
              <span className="font-semibold text-foreground">{hover.count}</span>{" "}
              {hover.count === 1 ? "activity" : "activities"} on{" "}
              {new Date(hover.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </>
          ) : (
            "Hover a day for detail"
          )}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Less</span>
          <div className="flex gap-1">
            {LEVELS.map((l, i) => (
              <span
                key={i}
                className={cn("h-[11px] w-[11px] rounded-[3px] ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06]", l)}
              />
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground">More</span>
        </div>
      </div>
    </div>
  )
}
