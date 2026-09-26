import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Building, Check, ExternalLink, RefreshCw, Save } from 'lucide-react'

import { APIClient } from '../../lib/api/api-client'
import { AuthManager } from '../../lib/auth/auth-manager'
import { cn } from '../../lib/cn'
import { Card, ErrorNote, SectionHeading, Skeleton, Spinner } from '../components/ui'

interface ExtractedData {
    title?: string | null
    company?: string | null
    location?: string | null
    description?: string | null
    url?: string | null
    salary?: string | null
    employmentType?: string | null
    platform?: string
    confidence?: number
    manual_entry?: boolean
}

type Step = 'scanning' | 'review' | 'saving' | 'saved'

export function QuickAddTab() {
    const [step, setStep] = useState<Step>('scanning')
    const [data, setData] = useState<ExtractedData>({})
    const [error, setError] = useState<string | null>(null)
    const [existingId, setExistingId] = useState<string | null>(null)
    const [duplicateOf, setDuplicateOf] = useState<{ id: string; title: string } | null>(null)

    // Guards the initial scan against React 19 StrictMode's double-invoke, which
    // would otherwise inject the content script twice and race two extractions.
    const hasScanned = useRef(false)

    const analyzePage = useCallback(async () => {
        setStep('scanning')
        setError(null)
        setDuplicateOf(null)

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
            if (!tab?.id) throw new Error('No active tab found.')

            const request = (): Promise<any> =>
                new Promise((resolve, reject) => {
                    chrome.tabs.sendMessage(tab.id!, { type: 'EXTRACT_PAGE' }, (response) => {
                        if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
                        else resolve(response)
                    })
                })

            let response: any
            try {
                response = await request()
            } catch {
                // The content script only auto-injects on supported hosts. On any
                // other site the user has explicitly asked us to scan, so inject
                // on demand via activeTab and retry.
                await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
                // The script registers its message listener synchronously, but give
                // the isolated world a beat to settle before the retry.
                await new Promise((resolve) => setTimeout(resolve, 400))
                response = await request()
            }

            applyExtraction(response?.success ? response.data : null, tab)
        } catch (caught: any) {
            console.warn('[ApplyOS] scan failed, falling back to manual entry', caught)
            setData({ manual_entry: true, platform: 'unknown' })
            setStep('review')
        }
    }, [])

    useEffect(() => {
        if (hasScanned.current) return
        hasScanned.current = true
        void analyzePage()
    }, [analyzePage])

    const applyExtraction = (extracted: ExtractedData | null, tab: chrome.tabs.Tab) => {
        if (extracted && (extracted.title || extracted.company)) {
            setData({ ...extracted, url: extracted.url || tab.url || null })
        } else {
            setData({
                manual_entry: true,
                platform: 'unknown',
                title: tab.title || null,
                url: tab.url || null,
            })
        }
        setStep('review')
    }

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

    // ---- Scanning -----------------------------------------------------------
    if (step === 'scanning') {
        return (
            <div className="space-y-3 p-4">
                <SectionHeading overline="This job" title="Reading the page…" />
                <Card className="space-y-2.5 p-4">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-3 w-1/4" />
                    <Skeleton className="h-8 w-2/3" />
                    <Skeleton className="mt-1 h-20 w-full" />
                </Card>
                <p className="text-center text-[11px] text-muted-foreground">
                    Looking for the title, company and description.
                </p>
            </div>
        )
    }

    // ---- Saved --------------------------------------------------------------
    if (step === 'saved') {
        return (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                <div className="icon-chip mb-3">
                    <Check className="h-5 w-5" />
                </div>
                <h2 className="display-title">
                    {existingId ? 'Application updated' : 'Saved to your pipeline'}
                </h2>
                <p className="mt-1 max-w-[260px] text-[11px] leading-relaxed text-muted-foreground">
                    {existingId
                        ? 'We matched this posting to an application you already had, so it was updated rather than duplicated.'
                        : 'It is now a draft in your ApplyOS pipeline, ready for analysis and a cover letter.'}
                </p>

                <div className="mt-5 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            hasScanned.current = true
                            setExistingId(null)
                            setDuplicateOf(null)
                            void analyzePage()
                        }}
                        className="btn-secondary h-9"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Add another
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.applyos.io'
                            chrome.tabs.create({ url: `${base}/applications` })
                        }}
                        className="btn-primary h-9"
                    >
                        Open ApplyOS
                        <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        )
    }

    // ---- Review -------------------------------------------------------------
    const platformLabel = data.manual_entry ? 'Manual entry' : (data.platform ?? 'Detected').toUpperCase()

    return (
        <div className="flex h-full flex-col">
            <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-4 pb-3">
                <SectionHeading
                    overline="This job"
                    title={data.manual_entry ? 'Enter the details' : 'Confirm the details'}
                    action={
                        <button type="button" onClick={() => void analyzePage()} className="btn-ghost">
                            <RefreshCw className="h-3 w-3" />
                            Re-scan
                        </button>
                    }
                />

                {/* Where the data came from — this is the trust question a user
                    actually has when a tool reads a page for them. */}
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
                            <label htmlFor="job-title" className="overline block">
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
                            <label htmlFor="job-company" className="overline block">
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
                            <label htmlFor="job-description" className="overline block">
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

            </div>

            {/* Sticky action bar */}
            <div className="shrink-0 border-t border-border/70 bg-card/80 p-4 backdrop-blur-md">
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
            </div>
        </div>
    )
}
