import React, { useCallback, useEffect, useState } from 'react'
import {
    ArrowUpRight,
    BookmarkPlus,
    Building,
    CheckCircle2,
    ChevronRight,
    Globe,
    Wand2,
} from 'lucide-react'

import { APIClient } from '../../lib/api/api-client'
import { extractActiveTab, isPosting, type ExtractedData } from '../../lib/page-detect'
import { cn } from '../../lib/cn'
import { Card, Skeleton, StatusPill } from '../components/ui'
import { SaveJobFlow } from '../flows/SaveJobFlow'
import { AutofillFlow } from '../flows/AutofillFlow'

type Mode = 'home' | 'save' | 'autofill'

interface ThisPageProps {
    /** Switch to the Applications view, optionally opening a specific app. */
    onGoApplications: (appId?: string) => void
}

interface SavedApp {
    id: string
    title: string
    status: string
}

/**
 * The "This page" view: one surface for everything the user can do with the
 * active tab.
 *
 * The user arrives here with a job posting open (or any form). They do not
 * think in terms of "autofill tab" vs "save tab" — they think "fill this" and
 * "remember this". So the view shows what the page contains, then offers
 * exactly those two actions, with a saved-state when the job is already in the
 * pipeline.
 */
export function ThisPage({ onGoApplications }: ThisPageProps) {
    const [mode, setMode] = useState<Mode>('home')
    const [tab, setTab] = useState<chrome.tabs.Tab | null>(null)
    const [posting, setPosting] = useState<ExtractedData | null>(null)
    const [detecting, setDetecting] = useState(true)
    const [saved, setSaved] = useState<SavedApp | null>(null)

    const detect = useCallback(async () => {
        setDetecting(true)
        try {
            const info = await extractActiveTab()
            setTab(info.tab)
            setPosting(isPosting(info.posting) ? info.posting : null)

            const url = info.posting?.url || info.tab?.url
            if (info.posting && url) {
                try {
                    const existing = await APIClient.findApplicationByUrl(url)
                    setSaved(existing ? { id: existing.id, title: existing.title, status: existing.status } : null)
                } catch {
                    setSaved(null)
                }
            } else {
                setSaved(null)
            }
        } catch (error) {
            console.warn('[ApplyOS] page detection failed', error)
        } finally {
            setDetecting(false)
        }
    }, [])

    useEffect(() => {
        void detect()
    }, [detect])

    if (mode === 'save') {
        return (
            <SaveJobFlow
                onBack={() => {
                    setMode('home')
                    void detect()
                }}
                onOpenApplication={(appId) => onGoApplications(appId)}
            />
        )
    }

    if (mode === 'autofill') {
        return <AutofillFlow onBack={() => setMode('home')} />
    }

    const host = tab?.url ? safeHost(tab.url) : ''
    const confidence =
        typeof posting?.confidence === 'number' && posting.confidence > 0
            ? Math.round(posting.confidence * 100)
            : null

    return (
        <div className="space-y-3 p-4 pb-6">
            {/* What this page is */}
            <Card className="overflow-hidden">
                <div className="border-b border-border/60 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary-strong dark:text-primary">
                            <Globe className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                            {detecting ? (
                                <>
                                    <Skeleton className="h-3.5 w-3/4" />
                                    <Skeleton className="mt-1.5 h-3 w-1/3" />
                                </>
                            ) : (
                                <>
                                    <h2 className="truncate font-display text-[13.5px] font-bold tracking-tight text-foreground">
                                        {tab?.title || 'Current page'}
                                    </h2>
                                    {host ? <p className="truncate text-[11px] text-muted-foreground">{host}</p> : null}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-3 p-4">
                    {detecting ? (
                        <>
                            <Skeleton className="h-3 w-1/3" />
                            <Skeleton className="h-8 w-full" />
                            <p className="text-center text-[11px] text-muted-foreground">Reading this page…</p>
                        </>
                    ) : posting ? (
                        <div>
                            <p className="text-[11px] font-medium text-muted-foreground">Job posting detected</p>
                            <div className="mt-1.5 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate text-[13px] font-semibold text-foreground">
                                        {posting.title || 'Untitled role'}
                                    </p>
                                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                                        <Building className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{posting.company || 'Company not found'}</span>
                                    </p>
                                </div>
                                {confidence !== null ? (
                                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                                        {confidence}% match
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    ) : (
                        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                            No job posting detected here. You can still autofill any form on this
                            page, or save it manually.
                        </p>
                    )}

                    {saved ? (
                        <div className="flex items-center gap-2.5 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2.5">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-strong dark:text-primary" />
                            <div className="min-w-0 flex-1">
                                <p className="text-[12px] font-semibold text-foreground">In your pipeline</p>
                                <p className="truncate text-[10.5px] text-muted-foreground">{saved.title}</p>
                            </div>
                            <StatusPill status={saved.status} className="!px-1.5 !text-[9px]" />
                            <button
                                type="button"
                                onClick={() => onGoApplications(saved.id)}
                                className="btn-ghost shrink-0"
                                aria-label="Open in applications"
                            >
                                Open
                                <ArrowUpRight className="h-3 w-3" />
                            </button>
                        </div>
                    ) : null}

                    {/* The two actions this page supports */}
                    <div className="grid gap-2 pt-1">
                        <ActionRow
                            onClick={() => setMode('autofill')}
                            icon={Wand2}
                            iconClassName="bg-primary text-primary-foreground shadow-[0_4px_14px_-4px_rgba(24,187,112,0.5)]"
                            title="Autofill this form"
                            sub="Review the answers, then let ApplyOS type them"
                        />
                        <ActionRow
                            onClick={() => setMode('save')}
                            icon={BookmarkPlus}
                            iconClassName="border border-primary/25 bg-primary/10 text-primary-strong dark:text-primary"
                            title={saved ? 'Update saved job' : 'Save this job'}
                            sub={saved ? 'Refresh the details on your application' : 'Track it in your pipeline'}
                        />
                    </div>
                </div>
            </Card>

            <ShortcutsCard />
        </div>
    )
}

function ActionRow({
    onClick,
    icon: Icon,
    iconClassName,
    title,
    sub,
}: {
    onClick: () => void
    icon: React.ComponentType<{ className?: string }>
    iconClassName: string
    title: string
    sub: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="group flex w-full items-center gap-3 rounded-xl border border-border/80 bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40"
        >
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconClassName)}>
                <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-foreground">{title}</span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{sub}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary-strong dark:group-hover:text-primary" />
        </button>
    )
}

function ShortcutsCard() {
    return (
        <Card className="p-4">
            <p className="mb-2 text-[11px] font-medium text-muted-foreground">Also available without the popup</p>
            <ul className="space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <li className="flex gap-2">
                    <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                    Right-click any field → <span className="text-foreground">Fill this field with ApplyOS</span>
                </li>
                <li className="flex gap-2">
                    <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                    <span className="text-foreground">Alt+Shift+F</span> fills the form on this page
                </li>
                <li className="flex gap-2">
                    <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                    <span className="text-foreground">Alt+Shift+S</span> saves the job from any page
                </li>
            </ul>
        </Card>
    )
}

function safeHost(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '')
    } catch {
        return url
    }
}
