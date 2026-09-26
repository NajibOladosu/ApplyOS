import React, { useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/globals.css'
import { Loader2, LayoutGrid, LogOut, MousePointerClick, Settings } from 'lucide-react'

import { Login } from './components/Login'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ThisPage } from './views/ThisPage'
import { ApplicationsTab } from './tabs/ApplicationsTab'
import { AuthManager } from '../lib/auth/auth-manager'
import { initTheme, watchSystemTheme, type ThemePreference } from '../lib/theme'
import { cn } from '../lib/cn'

type ViewId = 'page' | 'applications'

const VIEWS: { id: ViewId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'page', label: 'This page', icon: MousePointerClick },
    { id: 'applications', label: 'Applications', icon: LayoutGrid },
]

function Popup() {
    const [session, setSession] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [activeView, setActiveView] = useState<ViewId>('page')
    const [focusAppId, setFocusAppId] = useState<string | null>(null)
    const [themeRef] = useState<{ current: ThemePreference }>({ current: 'system' })

    // Apply the stored theme before anything renders, so the popup never flashes
    // the wrong colour scheme.
    useEffect(() => {
        let cancelled = false
        void initTheme().then((preference) => {
            if (!cancelled) themeRef.current = preference
        })
        const stopWatching = watchSystemTheme(() => themeRef.current)
        return () => {
            cancelled = true
            stopWatching()
        }
    }, [themeRef])

    const checkAuth = useCallback(async () => {
        try {
            setSession(await AuthManager.getSession())
        } catch (error) {
            console.error('[ApplyOS] auth check failed', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void checkAuth()

        const { data: { subscription } } = AuthManager.onAuthStateChange((event, newSession) => {
            if (event === 'SIGNED_OUT' || event === 'USER_DELETED') setSession(null)
            else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') setSession(newSession)
        })

        return () => subscription.unsubscribe()
    }, [checkAuth])

    const handleLogout = async () => {
        await AuthManager.signOut()
        setSession(null)
    }

    /** Jump to the Applications view, optionally opening one application. */
    const goApplications = useCallback((appId?: string) => {
        if (appId) setFocusAppId(appId)
        setActiveView('applications')
    }, [])

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center bg-background">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        )
    }

    if (!session) {
        return (
            <ErrorBoundary>
                <Login onLoginSuccess={checkAuth} />
            </ErrorBoundary>
        )
    }

    const email: string = session?.user?.email ?? ''
    const initial = email.charAt(0).toUpperCase() || 'A'

    return (
        <div className="flex h-full flex-col bg-background text-foreground">
            {/* Header — logo lockup, account, actions */}
            <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-card/60 px-4 py-3 backdrop-blur-md">
                <div className="flex min-w-0 items-center gap-2">
                    <img src="icons/icon-48.png" alt="" className="h-6 w-6 rounded-md" />
                    <span className="font-display text-[15px] font-bold tracking-[-0.02em]">
                        <span className="text-primary">Apply</span>OS
                    </span>
                </div>

                <div className="flex items-center gap-1">
                    <div
                        className="mr-1 hidden items-center gap-1.5 sm:flex"
                        title={email}
                    >
                        <span
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary-strong dark:text-primary"
                            aria-hidden
                        >
                            {initial}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => chrome.runtime.openOptionsPage()}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        title="Settings"
                        aria-label="Settings"
                    >
                        <Settings className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        title="Sign out"
                        aria-label="Sign out"
                    >
                        <LogOut className="h-3.5 w-3.5" />
                    </button>
                </div>
            </header>

            {/* Two views: act on the current page, or manage the pipeline. */}
            <nav className="shrink-0 px-4 pt-3">
                <div className="segmented" role="tablist" aria-label="Extension sections">
                    {VIEWS.map((view) => {
                        const Icon = view.icon
                        const isActive = activeView === view.id
                        return (
                            <button
                                key={view.id}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => setActiveView(view.id)}
                                className={cn('segmented-item', isActive && 'segmented-item-active')}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {view.label}
                            </button>
                        )
                    })}
                </div>
            </nav>

            {/* Content */}
            <main className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
                <ErrorBoundary>
                    {activeView === 'page' ? (
                        <ThisPage onGoApplications={goApplications} />
                    ) : (
                        <ApplicationsTab
                            focusAppId={focusAppId}
                            onFocusHandled={() => setFocusAppId(null)}
                        />
                    )}
                </ErrorBoundary>
            </main>
        </div>
    )
}

const container = document.getElementById('root')
if (!container) throw new Error('ApplyOS popup: #root not found')
createRoot(container).render(<Popup />)
