import { cn } from "@/shared/lib/utils"
import { LucideIcon } from "lucide-react"

interface MetricsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  subtitle?: string
}

/**
 * KPI card for the analytics view — same card language as the rest of the
 * app (rounded-2xl, hairline border, icon chip). The previous shadcn Card
 * wrapper rendered with a different title size and padding from every other
 * card on the page.
 */
export function MetricsCard({ title, value, icon: Icon, trend, subtitle }: MetricsCardProps) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 transition-colors hover:border-border">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium leading-snug text-muted-foreground">{title}</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-strong dark:text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>

      <p className="mt-3 font-display text-[30px] font-bold leading-none tracking-[-0.03em] text-foreground tabular-nums">
        {value}
      </p>

      {trend ? (
        <div className="mt-2.5 flex items-center gap-1.5">
          <span
            className={cn(
              "text-xs font-semibold",
              trend.isPositive ? "text-primary-strong dark:text-primary" : "text-destructive"
            )}
          >
            {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
          </span>
          <span className="text-xs text-muted-foreground">vs previous period</span>
        </div>
      ) : null}

      {subtitle ? <p className="mt-2 text-xs text-muted-foreground/80">{subtitle}</p> : null}
    </div>
  )
}
