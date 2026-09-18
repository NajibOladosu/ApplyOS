import type { ReactNode } from "react"
import { cn } from "@/shared/lib/utils"

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  /** "inline" sits inside a card; "page" fills a route's content area. */
  variant?: "inline" | "page"
  className?: string
}

/**
 * One empty-state treatment. Before this, empty results were written inline
 * (the interview report literally printed "No areas for improvement
 * identified" as body copy) or omitted entirely.
 */
export function EmptyState({ icon, title, description, action, variant = "inline", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        variant === "page" ? "min-h-[320px] rounded-2xl border border-dashed border-border/70 bg-card/40 px-6 py-16" : "px-6 py-10",
        className
      )}
    >
      {icon ? (
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-border/70 bg-muted/60 text-muted-foreground">
          {icon}
        </span>
      ) : null}
      <p className={cn("font-display font-bold tracking-tight text-foreground", variant === "page" ? "text-lg" : "text-sm")}>
        {title}
      </p>
      {description ? <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
