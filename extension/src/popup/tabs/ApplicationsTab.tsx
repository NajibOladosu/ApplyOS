import React, { useEffect, useMemo, useState } from 'react'
import { Building, ExternalLink, LayoutGrid, Search } from 'lucide-react'

import { APIClient, type Application } from '../../lib/api/api-client'
import { cn } from '../../lib/cn'
import { STATUS_ORDER, relativeDays } from '../../lib/design/status'
import { Card, EmptyState, SectionHeading, Skeleton, StatusPill } from '../components/ui'
import { ApplicationDetail } from '../components/ApplicationDetail'

type Filter = 'all' | 'active' | 'closed'

const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'closed', label: 'Closed' },
]

const ACTIVE_STATUSES = new Set(['submitted', 'in_review', 'interview'])
const CLOSED_STATUSES = new Set(['offer', 'rejected'])

export function ApplicationsTab({
    focusAppId,
    onFocusHandled,
}: {
    /** When set, open this application as soon as the list has loaded. */
    focusAppId?: string | null
    onFocusHandled?: () => void
}) {
    const [apps, setApps] = useState<Application[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [filter, setFilter] = useState<Filter>('all')
    const [selectedApp, setSelectedApp] = useState<Application | null>(null)

    useEffect(() => {
        void loadApps()
    }, [])

    useEffect(() => {
        if (!focusAppId || loading || selectedApp) return
        const app = apps.find((candidate) => candidate.id === focusAppId)
        if (app) setSelectedApp(app)
        onFocusHandled?.()
    }, [focusAppId, loading, selectedApp, apps, onFocusHandled])

    const loadApps = async () => {
        try {
            const data = await APIClient.getApplications()
            setApps(data as Application[])
        } catch (caught: any) {
            console.error('[ApplyOS] failed to load applications', caught)
            setError(caught?.message || 'Could not load your applications.')
        } finally {
            setLoading(false)
        }
    }

    const handleUpdate = (updated: Application) => {
        setApps((current) => current.map((app) => (app.id === updated.id ? updated : app)))
        setSelectedApp(updated)
    }

    const handleDelete = (id: string) => {
        setApps((current) => current.filter((app) => app.id !== id))
        setSelectedApp(null)
    }

    const counts = useMemo(
        () => ({
            all: apps.length,
            active: apps.filter((app) => ACTIVE_STATUSES.has(app.status)).length,
            closed: apps.filter((app) => CLOSED_STATUSES.has(app.status)).length,
        }),
        [apps]
    )

    const filtered = useMemo(() => {
        const needle = searchTerm.trim().toLowerCase()

        return apps
            .filter((app) => {
                if (filter === 'active') return ACTIVE_STATUSES.has(app.status)
                if (filter === 'closed') return CLOSED_STATUSES.has(app.status)
                return true
            })
            .filter((app) => {
                if (!needle) return true
                return (
                    app.title?.toLowerCase().includes(needle) ||
                    app.company?.toLowerCase().includes(needle)
                )
            })
            // Newest first — the list is a recency-sorted feed, not an index.
            .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    }, [apps, filter, searchTerm])

    if (selectedApp) {
        return (
            <ApplicationDetail
                application={selectedApp}
                onBack={() => setSelectedApp(null)}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
            />
        )
    }

    if (loading) {
        return (
            <div className="space-y-3 p-4">
                <Skeleton className="h-9 w-full rounded-lg" />
                <div className="space-y-2">
                    {[0, 1, 2, 3].map((index) => (
                        <Card key={index} className="space-y-2 p-3">
                            <Skeleton className="h-3.5 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </Card>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-3 p-4">
            <SectionHeading
                title="Applications"
                action={
                    <span className="text-[11px] text-muted-foreground">
                        {counts.active} active
                    </span>
                }
            />

            {/* Search */}
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="input-field h-9 pl-8 text-[12px]"
                    placeholder="Search title or company…"
                    aria-label="Search applications"
                />
            </div>

            {/* Filters with live counts */}
            <div className="flex gap-1">
                {FILTERS.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => setFilter(option.id)}
                        className={cn('chip', filter === option.id && 'chip-active')}
                    >
                        {option.label}
                        <span className="tabular-nums opacity-60">{counts[option.id]}</span>
                    </button>
                ))}
            </div>

            {error ? (
                <EmptyState
                    icon={Building}
                    title="Could not load applications"
                    description={error}
                />
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon={LayoutGrid}
                    title={apps.length === 0 ? 'No applications yet' : 'Nothing matches'}
                    description={
                        apps.length === 0
                            ? 'Open a job posting and use "This page" → Save this job to add your first one.'
                            : 'Try a different search term or filter.'
                    }
                />
            ) : (
                <div className="space-y-2 pb-2">
                    {filtered.map((app) => (
                        <Card
                            key={app.id}
                            onClick={() => setSelectedApp(app)}
                            className="group cursor-pointer p-3 transition-colors hover:border-primary/40"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
                                    {app.title}
                                </h3>
                                <StatusPill status={app.status} />
                            </div>

                            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span className="flex min-w-0 items-center gap-1">
                                    <Building className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{app.company || 'Unknown company'}</span>
                                </span>
                                <span aria-hidden>·</span>
                                <span className="shrink-0">{relativeDays(app.created_at)}</span>

                                {app.url ? (
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            chrome.tabs.create({ url: app.url! })
                                        }}
                                        className="ml-auto shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-primary group-hover:opacity-100"
                                        title="Open the posting"
                                        aria-label={`Open the ${app.title} posting`}
                                    >
                                        <ExternalLink className="h-3 w-3" />
                                    </button>
                                ) : null}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
