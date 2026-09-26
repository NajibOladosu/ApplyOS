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
    overline,
    title,
    action,
    className,
}: {
    overline?: string
    title: string
    action?: React.ReactNode
    className?: string
}) {
    return (
        <div className={cn('flex items-end justify-between gap-3', className)}>
            <div className="min-w-0">
                {overline ? <p className="overline mb-0.5">{overline}</p> : null}
                <h2 className="display-title truncate">{title}</h2>
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
                <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
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
            <p className="overline mb-1">{label}</p>
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
