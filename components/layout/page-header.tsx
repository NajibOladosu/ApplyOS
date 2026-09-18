import type { ReactNode } from "react"
import { cn } from "@/shared/lib/utils"

interface PageHeaderProps {
  /** Small uppercase label above the title — establishes section hierarchy. */
  overline?: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

/**
 * One page title treatment for the whole app: overline → display title →
 * one-line description, with actions pinned right. Previously every page
 * invented its own (some h1 + p + buttons in a flex row, some inside a card,
 * some with a subtitle that repeated the sidebar label).
 */
export function PageHeader({ overline, title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {overline ? (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
            {overline}
          </p>
        ) : null}
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
