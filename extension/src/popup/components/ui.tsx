import React from 'react'
import { cn } from '../../lib/cn'
import { statusMeta } from '../../lib/design/status'

/**
 * Shared primitives for the popup.
 *
 * These are the extension's equivalent of the web app's components/data kit.
 * Kept in one file because the popup only needs a handful of them and three
 * one-export files would be more indirection than the surface deserves.
 */

export function Card({
    className,
    children,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={cn('rounded-2xl border border-border/70 bg-card', className)} {...props}>
            {children}
        </div>
    )
}

export function SectionHeading({
    title,
    sub,
    action,
    className,
}: {
    title: string
    sub?: string
    action?: React.ReactNode
    className?: string
}) {
    return (
        <div className={cn('flex items-end justify-between gap-3', className)}>
            <div className="min-w-0">
                <h2 className="font-display text-[15px] font-bold tracking-tight text-foreground">{title}</h2>
                {sub ? <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p> : null}
            </div>
            {action}
        </div>
    )
}

export function StatusPill({ status, className }: { status: string | null | undefined; className?: string }) {
    const meta = statusMeta(status)
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                meta.pill,
                className
            )}
        >
            <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden />
            {meta.label}
        </span>
    )
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}: {
    icon?: React.ComponentType<{ className?: string }>
    title: string
    description?: string
    action?: React.ReactNode
    className?: string
}) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/40 px-5 py-8 text-center',
                className
            )}
        >
            {Icon ? (
                <div className="icon-chip mb-3 h-10 w-10">
                    <Icon className="h-5 w-5" />
                </div>
            ) : null}
            <p className="text-[13px] font-semibold text-foreground">{title}</p>
            {description ? (
                <p className="mt-1 max-w-[240px] text-[11px] leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
            {action ? <div className="mt-3">{action}</div> : null}
        </div>
    )
}

/** Skeleton block; the sheen animation is defined in globals.css. */
export function Skeleton({ className }: { className?: string }) {
    return <div className={cn('skeleton rounded-lg', className)} aria-hidden />
}

export function Stat({
    label,
    value,
    tone = 'default',
}: {
    label: string
    value: React.ReactNode
    tone?: 'default' | 'primary' | 'warning'
}) {
    return (
        <div className="rounded-xl border border-border/70 bg-card px-3 py-2">
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">{label}</p>
            <p
                className={cn(
                    'font-display text-lg font-bold leading-none tabular-nums',
                    tone === 'primary' && 'text-primary-strong dark:text-primary',
                    tone === 'warning' && 'text-amber-600 dark:text-amber-400'
                )}
            >
                {value}
            </p>
        </div>
    )
}

/**
 * A single labelled field row. Used by the review step, where the point is to
 * show the user exactly what will be written into the form.
 */
export function FieldRow({
    label,
    value,
    confidence,
}: {
    label: string
    value: string | null | undefined
    confidence?: number
}) {
    return (
        <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
            <span className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">{label}</span>
            <span className="min-w-0 flex-1 text-right text-[11px] font-medium text-foreground">
                {value ? (
                    <span className="break-words">{value}</span>
                ) : (
                    <span className="text-muted-foreground/60">Not found</span>
                )}
                {typeof confidence === 'number' && value ? (
                    <span className="ml-1.5 text-[10px] font-normal text-muted-foreground/70">
                        {Math.round(confidence * 100)}%
                    </span>
                ) : null}
            </span>
        </div>
    )
}

/**
 * Circular score meter — a mirror of ScoreRing in components/data/status-pill.tsx
 * so a 74 on the popup and a 74 on the dashboard are the same green/amber/red.
 */
export function ScoreRing({
    score,
    size = 64,
    label,
    className,
}: {
    score: number
    size?: number
    label?: string
    className?: string
}) {
    if (score >= 80) {
        const tone = 'text-primary-strong dark:text-primary'
        return <ScoreRingBase score={score} size={size} label={label} tone={tone} className={className} />
    }
    if (score >= 60) {
        const tone = 'text-amber-600 dark:text-amber-400'
        return <ScoreRingBase score={score} size={size} label={label} tone={tone} className={className} />
    }
    return <ScoreRingBase score={score} size={size} label={label} tone="text-destructive" className={className} />
}

function ScoreRingBase({
    score,
    size,
    label,
    tone,
    className,
}: {
    score: number
    size: number
    label?: string
    tone: string
    className?: string
}) {
    const r = (size - 6) / 2
    const c = 2 * Math.PI * r
    const pct = Math.max(0, Math.min(100, score)) / 100

    return (
        <div className={cn('inline-flex flex-col items-center gap-2', className)}>
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
                        stroke="currentColor"
                        className={cn('transition-[stroke-dasharray] duration-700', tone)}
                    />
                </svg>
                <span
                    className={cn('absolute inset-0 flex items-center justify-center font-display font-bold tabular-nums', tone)}
                    style={{ fontSize: size / 3.4 }}
                >
                    {Math.round(score)}
                </span>
            </div>
            {label ? <p className="text-[10px] font-medium text-muted-foreground">{label}</p> : null}
        </div>
    )
}

export function Spinner({ className }: { className?: string }) {
    return (
        <svg
            className={cn('animate-spin', className)}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
        >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
    )
}

/** Inline error banner that matches the destructive token. */
export function ErrorNote({ children }: { children: React.ReactNode }) {
    return (
        <div
            role="alert"
            className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-[11px] leading-relaxed text-destructive"
        >
            {children}
        </div>
    )
}
