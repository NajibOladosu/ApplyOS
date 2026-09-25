/**
 * Application status presentation.
 *
 * This is a deliberate mirror of components/data/status-pill.tsx in the web app.
 * The two surfaces show the same applications, so a "Submitted" badge that is
 * blue in the popup and green on the dashboard reads as a bug. If the web app's
 * STATUS_META changes, change this too.
 */

export type ApplicationStatus = 'draft' | 'submitted' | 'in_review' | 'interview' | 'offer' | 'rejected'
export type ApplicationPriority = 'low' | 'medium' | 'high'

export interface StatusMeta {
    label: string
    dot: string
    pill: string
}

export const STATUS_META: Record<ApplicationStatus, StatusMeta> = {
    draft: {
        label: 'Draft',
        dot: 'bg-muted-foreground/50',
        pill: 'border-border/70 bg-muted/60 text-muted-foreground',
    },
    submitted: {
        label: 'Submitted',
        dot: 'bg-primary',
        pill: 'border-primary/25 bg-primary/10 text-primary-strong dark:text-primary',
    },
    in_review: {
        label: 'In review',
        dot: 'bg-amber-500',
        pill: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    },
    interview: {
        label: 'Interview',
        dot: 'bg-violet-500',
        pill: 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-400',
    },
    offer: {
        label: 'Offer',
        dot: 'bg-primary',
        pill: 'border-primary/40 bg-primary/15 font-semibold text-primary-strong dark:text-primary',
    },
    rejected: {
        label: 'Rejected',
        dot: 'bg-destructive',
        pill: 'border-destructive/25 bg-destructive/10 text-destructive',
    },
}

/** Order used when listing a status picker, matching the web app's pipeline order. */
export const STATUS_ORDER: ApplicationStatus[] = [
    'draft',
    'submitted',
    'in_review',
    'interview',
    'offer',
    'rejected',
]

export function statusMeta(status: string | null | undefined): StatusMeta {
    return STATUS_META[(status as ApplicationStatus) ?? 'draft'] ?? STATUS_META.draft
}

export const PRIORITY_META: Record<ApplicationPriority, { label: string; dot: string }> = {
    high: { label: 'High', dot: 'bg-destructive' },
    medium: { label: 'Medium', dot: 'bg-amber-500' },
    low: { label: 'Low', dot: 'bg-muted-foreground/50' },
}

/**
 * Relative time, e.g. "3d ago". The popup has no room for a full date column,
 * but "how long ago did I apply" is the question the list exists to answer.
 */
export function relativeDays(iso: string | null | undefined): string {
    if (!iso) return ''
    const then = new Date(iso)
    if (Number.isNaN(then.getTime())) return ''

    const days = Math.floor((Date.now() - then.getTime()) / 86_400_000)
    if (days <= 0) return 'today'
    if (days === 1) return '1d ago'
    if (days < 30) return `${days}d ago`
    const months = Math.floor(days / 30)
    return months === 1 ? '1mo ago' : `${months}mo ago`
}
