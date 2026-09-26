import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Building, Check, CheckCircle2, ExternalLink, RefreshCw, Save } from 'lucide-react'

import { APIClient } from '../../lib/api/api-client'
import { AuthManager } from '../../lib/auth/auth-manager'
import { extractActiveTab, type ExtractedData } from '../../lib/page-detect'
import { cn } from '../../lib/cn'
import { Card, ErrorNote, Skeleton, Spinner } from '../components/ui'

interface SaveJobFlowProps {
    onBack: () => void
    /** Open the just-saved/updated application in the Applications view. */
    onOpenApplication: (appId: string) => void
}

type Step = 'scanning' | 'review' | 'saving' | 'saved'

/**
 * The save-job flow: read the posting from the active tab, let the user
 * confirm or correct the details, then create (or update) the application.
 * Scans automatically when it opens — the user already said "save this job".
 */
export function SaveJobFlow({ onBack, onOpenApplication }: SaveJobFlowProps) {
    const [step, setStep] = useState<Step>('scanning')
    const [data, setData] = useState<ExtractedData>({})
    const [error, setError] = useState<string | null>(null)
    const [existingId, setExistingId] = useState<string | null>(null)
    const [duplicateOf, setDuplicateOf] = useState<{ id: string; title: string } | null>(null)

    // Guards the initial scan against React 19 StrictMode's double-invoke, which
    // would otherwise inject the content script twice and race two extractions.
    const hasScanned = useRef(false)

    const scan = useCallback(async () => {
        setStep('scanning')
        setError(null)
        setDuplicateOf(null)

        try {
            const { tab, posting } = await extractActiveTab()
            if (posting && (posting.title || posting.company)) {
                setData({ ...posting })
            } else {
                setData({
                    manual_entry: true,
                    platform: 'unknown',
                    title: tab?.title || null,
                    url: tab?.url || null,
                })
            }
            setStep('review')
        } catch (caught) {
            console.warn('[ApplyOS] scan failed, falling back to manual entry', caught)
            setData({ manual_entry: true, platform: 'unknown' })
            setStep('review')
        }
    }, [])

    useEffect(() => {
        if (hasScanned.current) return
        hasScanned.current = true
        void scan()
    }, [scan])

    const title = data.title?.trim() ?? ''
    const canSave = title.length > 0

    const confidence = useMemo(() => {
        if (typeof data.confidence !== 'number') return null
        return Math.round(data.confidence * 100)
    }, [data.confidence])

    const handleSave = async () => {
        if (!canSave) return
        setStep('saving')
        setError(null)

        try {
            const user = await AuthManager.getCurrentUser()
            if (!user) throw new Error('Your session expired. Sign in again.')

            // Duplicate guard. Applying to the same posting twice is the most
            // common data-quality problem in a job tracker, and the popup is the
            // only place that can catch it before it is written.
            if (!existingId && data.url) {
                const existing = await APIClient.findApplicationByUrl(data.url)
                if (existing) {
                    setDuplicateOf({ id: existing.id, title: existing.title })
                    setExistingId(existing.id)
                }
            }

            // Only columns that exist on public.applications. PostgREST rejects
            // the entire insert if any key is unknown, so a stray field here
            // silently breaks saving.
            const payload = {
                user_id: user.id,
                title,
                company: data.company?.trim() || null,
                url: data.url || null,
                job_description: data.description || null,
                status: (existingId ? 'submitted' : 'draft') as 'submitted' | 'draft',
            }

            if (existingId) {
                await APIClient.updateApplication(existingId, payload)
            } else {
                await APIClient.createApplication(payload)
            }

            chrome.runtime.sendMessage({ type: 'BADGE_REFRESH' }).catch(() => {})
            setStep('saved')
        } catch (caught: any) {
            console.error('[ApplyOS] save failed', caught)
            setError(caught?.message || 'Could not save this application.')
            setStep('review')
        }
    }

    const cap = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value)

    // ---- Scanning -----------------------------------------------------------
    if (step === 'scanning') {
        return (
            <FlowShell title="Save this job" onBack={onBack}>
                <Card className="space-y-2.5 p-4">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-3 w-1/4" />
                    <Skeleton className="h-8 w-2/3" />
                    <Skeleton className="mt-1 h-20 w-full" />
                </Card>
                <p className="text-center text-[11px] text-muted-foreground">
                    Reading the title, company and description from the page.
                </p>
            </FlowShell>
        )
    }

    // ---- Saved --------------------------------------------------------------
    if (step === 'saved') {
        return (
            <FlowShell title="Save this job" onBack={onBack}>
                <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                    <div className="icon-chip mb-3">
                        <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <h2 className="font-display text-[17px] font-bold tracking-tight text-foreground">
                        {existingId ? 'Application updated' : 'Saved to your pipeline'}
                    </h2>
                    <p className="mt-1.5 max-w-[260px] text-[11.5px] leading-relaxed text-muted-foreground">
                        {existingId
                            ? 'We matched this posting to an application you already had, so it was updated rather than duplicated.'
                            : 'It is now in your pipeline, ready for analysis and a cover letter.'}
                    </p>

                    <div className="mt-5 flex w-full flex-col gap-2">
                        {existingId ? (
                            <button
                                type="button"
                                onClick={() => onOpenApplication(existingId!)}
                                className="btn-primary h-10 w-full"
                            >
                                <Check className="h-4 w-4" />
                                Open in your pipeline
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.applyos.io'
                                    chrome.tabs.create({ url: `${base}/applications` })
                                }}
                                className="btn-primary h-10 w-full"
                            >
                                Open ApplyOS
                                <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                        )}
                        <button type="button" onClick={onBack} className="btn-secondary h-10 w-full">
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Back to this page
                        </button>
                    </div>
                </div>
            </FlowShell>
        )
    }

    // ---- Review -------------------------------------------------------------
    const platformLabel = data.manual_entry ? 'Entered by you' : cap(data.platform ?? 'Detected')

    return (
        <FlowShell
            title="Save this job"
            onBack={onBack}
            action={
                <button type="button" onClick={() => void scan()} className="btn-ghost" disabled={step === 'saving'}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Re-scan
                </button>
            }
            footer={
                <>
                    <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={!canSave || step === 'saving'}
                        className="btn-primary h-10 w-full"
                    >
                        {step === 'saving' ? (
                            <Spinner className="h-4 w-4" />
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                {existingId ? 'Update application' : 'Save to ApplyOS'}
                            </>
                        )}
                    </button>
                    {!canSave ? (
                        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                            A job title is required.
                        </p>
                    ) : null}
                </>
            }
        >
            {/* Where the data came from — the trust question a user has when a
                tool reads a page for them. */}
            <div className="flex items-center gap-2">
                <span
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                        data.manual_entry
                            ? 'border-border/70 bg-muted/60 text-muted-foreground'
                            : 'border-primary/25 bg-primary/10 text-primary-strong dark:text-primary'
                    )}
                >
                    <span
                        className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            data.manual_entry ? 'bg-muted-foreground/50' : 'bg-primary'
                        )}
                        aria-hidden
                    />
                    {platformLabel}
                </span>
                {confidence !== null && !data.manual_entry && confidence > 0 ? (
                    <span className="text-[10px] text-muted-foreground">
                        {confidence}% match
                    </span>
                ) : null}
            </div>

            {duplicateOf ? (
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                    You already have <strong>{duplicateOf.title}</strong> for this URL. Saving will
                    update it and mark it as submitted.
                </div>
            ) : null}

            {error ? <ErrorNote>{error}</ErrorNote> : null}

            <Card className="p-3.5">
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <label htmlFor="job-title" className="block text-[11px] font-medium text-muted-foreground">
                            Job title <span className="text-destructive">*</span>
                        </label>
                        <input
                            id="job-title"
                            value={data.title ?? ''}
                            onChange={(event) => setData({ ...data, title: event.target.value })}
                            className="input-field font-semibold"
                            placeholder="Senior Frontend Engineer"
                            autoFocus={data.manual_entry}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="job-company" className="block text-[11px] font-medium text-muted-foreground">
                            Company
                        </label>
                        <div className="relative">
                            <Building className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <input
                                id="job-company"
                                value={data.company ?? ''}
                                onChange={(event) => setData({ ...data, company: event.target.value })}
                                className="input-field pl-8"
                                placeholder="Acme Inc."
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="job-description" className="block text-[11px] font-medium text-muted-foreground">
                            Job description
                        </label>
                        <textarea
                            id="job-description"
                            value={data.description ?? ''}
                            onChange={(event) => setData({ ...data, description: event.target.value })}
                            className="input-field h-32 resize-none py-2 text-[11px] leading-relaxed"
                            placeholder="Paste the job description, or let ApplyOS read it from the page."
                        />
                        {data.description ? (
                            <p className="text-right text-[10px] text-muted-foreground">
                                {data.description.length.toLocaleString()} characters
                            </p>
                        ) : null}
                    </div>
                </div>
            </Card>
        </FlowShell>
    )
}

/** Fixed header (back + title + optional action) over a scrollable body and,
    when `footer` is given, a sticky action bar. */
function FlowShell({
    title,
    onBack,
    action,
    footer,
    children,
}: {
    title: string
    onBack: () => void
    action?: React.ReactNode
    footer?: React.ReactNode
    children: React.ReactNode
}) {
    return (
        <div className="flex h-full flex-col">
            <div className="flex shrink-0 items-center gap-2 border-b border-border/70 bg-card/60 px-3 py-2.5 backdrop-blur-md">
                <button
                    type="button"
                    onClick={onBack}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label="Back"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <h2 className="min-w-0 flex-1 truncate font-display text-[13.5px] font-bold tracking-tight text-foreground">
                    {title}
                </h2>
                {action}
            </div>
            <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pb-3">
                {children}
            </div>
            {footer ? (
                <div className="shrink-0 border-t border-border/70 bg-card/80 p-4 backdrop-blur-md">{footer}</div>
            ) : null}
        </div>
    )
}
