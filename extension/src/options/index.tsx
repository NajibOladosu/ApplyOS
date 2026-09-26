import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Bell, BellOff, Check, ExternalLink, Monitor, Moon, Palette, RefreshCw, Sun } from 'lucide-react'

import '../styles/globals.css'
import { cn } from '../lib/cn'
import { Spinner } from '../popup/components/ui'
import { initTheme, setThemePreference, type ThemePreference } from '../lib/theme'

interface Settings {
    enabledPlatforms: string[]
    autoDetect: boolean
    /**
     * Replaces the 1.0.0 `notifications` flag, which existed as a checkbox but
     * was never read by any code — the toggle could be flipped and nothing
     * happened. These three settings are what actually drives reminders.
     */
    followUpReminders: boolean
    staleReminders: boolean
    followUpAfterDays: number
}

const DEFAULT_SETTINGS: Settings = {
    enabledPlatforms: [
        'linkedin',
        'indeed',
        'workday',
        'greenhouse',
        'lever',
        'glassdoor',
        'ashby',
        'smartrecruiters',
    ],
    autoDetect: true,
    followUpReminders: true,
    staleReminders: true,
    followUpAfterDays: 7,
}

const PLATFORMS = [
    { id: 'linkedin', label: 'LinkedIn' },
    { id: 'indeed', label: 'Indeed' },
    { id: 'workday', label: 'Workday' },
    { id: 'greenhouse', label: 'Greenhouse' },
    { id: 'lever', label: 'Lever' },
    { id: 'glassdoor', label: 'Glassdoor' },
    { id: 'ashby', label: 'Ashby' },
    { id: 'smartrecruiters', label: 'SmartRecruiters' },
]

const THEME_OPTIONS: { id: ThemePreference; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'system', label: 'System', icon: Monitor },
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
]

function Toggle({
    checked,
    onChange,
    label,
    description,
    disabled,
}: {
    checked: boolean
    onChange: () => void
    label: string
    description: string
    disabled?: boolean
}) {
    return (
        <label
            className={cn(
                'flex cursor-pointer items-start gap-3 border-b border-border/50 py-3 last:border-b-0',
                disabled && 'cursor-not-allowed opacity-60'
            )}
        >
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                disabled={disabled}
                className="mt-0.5 h-4 w-4 shrink-0 rounded accent-primary"
            />
            <span className="min-w-0">
                <span className="block text-[13px] font-medium text-foreground">{label}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                    {description}
                </span>
            </span>
        </label>
    )
}

function Section({
    overline,
    title,
    description,
    children,
}: {
    overline: string
    title: string
    description?: string
    children: React.ReactNode
}) {
    return (
        <section className="rounded-2xl border border-border/70 bg-card p-5">
            <p className="overline mb-0.5">{overline}</p>
            <h2 className="font-display text-base font-bold tracking-[-0.02em]">{title}</h2>
            {description ? (
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
            <div className="mt-3">{children}</div>
        </section>
    )
}

function Options() {
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
    const [theme, setTheme] = useState<ThemePreference>('system')
    const [saved, setSaved] = useState(false)
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<string | null>(null)

    useEffect(() => {
        void initTheme().then(setTheme)

        chrome.storage.local.get(['settings'], (result) => {
            if (result.settings) {
                setSettings({ ...DEFAULT_SETTINGS, ...result.settings })
            }
        })
    }, [])

    const update = (patch: Partial<Settings>) => {
        setSettings((previous) => ({ ...previous, ...patch }))
        setSaved(false)
    }

    const handlePlatformToggle = (platformId: string) => {
        const enabled = settings.enabledPlatforms.includes(platformId)
        update({
            enabledPlatforms: enabled
                ? settings.enabledPlatforms.filter((id) => id !== platformId)
                : [...settings.enabledPlatforms, platformId],
        })
    }

    const handleThemeChange = async (next: ThemePreference) => {
        setTheme(next)
        await setThemePreference(next)
    }

    const handleSave = () => {
        chrome.storage.local.set({ settings }, () => {
            // Let the service worker re-evaluate the badge and reminder schedule.
            chrome.runtime.sendMessage({ type: 'SETTINGS_CHANGED' }).catch(() => {})
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        })
    }

    /** Fires the real sweep so the user can confirm notifications actually appear. */
    const handleTestReminders = async () => {
        setTesting(true)
        setTestResult(null)
        try {
            const response = await chrome.runtime.sendMessage({ type: 'REMINDERS_RUN_NOW' })
            if (!response?.success) {
                setTestResult(response?.error || 'The reminder check could not run.')
            } else if (response.skipped) {
                setTestResult(`Nothing to send (${response.skipped}).`)
            } else if (response.shown > 0) {
                setTestResult(`Sent ${response.shown} reminder${response.shown === 1 ? '' : 's'}.`)
            } else {
                setTestResult('No follow-ups are due right now.')
            }
        } catch (error: any) {
            setTestResult(error?.message || 'The reminder check could not run.')
        } finally {
            setTesting(false)
        }
    }

    const remindersEnabled = settings.followUpReminders || settings.staleReminders

    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="mx-auto max-w-3xl px-6 py-10">
                {/* Header */}
                <header className="mb-8">
                    <div className="mb-3 flex items-center gap-2">
                        <img src="../icons/icon-48.png" alt="" className="h-7 w-7 rounded-lg" />
                        <span className="font-display text-lg font-bold tracking-[-0.02em]">
                            <span className="text-primary">Apply</span>OS
                        </span>
                    </div>
                    <p className="overline mb-1">Extension</p>
                    <h1 className="font-display text-[26px] font-bold tracking-[-0.02em]">Settings</h1>
                    <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
                        Everything here is stored on your device. ApplyOS only reads a page when you ask
                        it to.
                    </p>
                </header>

                <div className="space-y-4">
                    <Section
                        overline="Appearance"
                        title="Theme"
                        description="The popup follows your system by default."
                    >
                        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/70 p-1">
                            {THEME_OPTIONS.map((option) => {
                                const Icon = option.icon
                                const isActive = theme === option.id
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => void handleThemeChange(option.id)}
                                        className={cn(
                                            'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-[12px] font-medium transition-all',
                                            isActive
                                                ? 'bg-card text-foreground shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground'
                                        )}
                                        aria-pressed={isActive}
                                    >
                                        <Icon className="h-3.5 w-3.5" />
                                        {option.label}
                                    </button>
                                )
                            })}
                        </div>
                    </Section>

                    <Section
                        overline="Notifications"
                        title="Follow-up reminders"
                        description="ApplyOS watches the applications you are waiting on and nudges you when it is worth chasing one."
                    >
                        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-2">
                            {remindersEnabled ? (
                                <Bell className="h-3.5 w-3.5 shrink-0 text-primary" />
                            ) : (
                                <BellOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <span className="text-[11px] text-muted-foreground">
                                {remindersEnabled
                                    ? 'Reminders are on. Each application is nudged once per threshold.'
                                    : 'Reminders are off. You will not receive any notifications.'}
                            </span>
                        </div>

                        <Toggle
                            checked={settings.followUpReminders}
                            onChange={() => update({ followUpReminders: !settings.followUpReminders })}
                            label="Follow-up nudges"
                            description={`Tell me when an application has been waiting ${
                                settings.followUpAfterDays
                            }+ days with no reply.`}
                        />
                        <Toggle
                            checked={settings.staleReminders}
                            onChange={() => update({ staleReminders: !settings.staleReminders })}
                            label="Long-silence alerts"
                            description="Tell me when it has been long enough that I should decide whether to move on."
                        />

                        <div className="mt-3 flex items-end gap-3 border-b border-border/50 pb-3">
                            <div>
                                <label htmlFor="followUpDays" className="overline mb-1 block">
                                    Follow up after
                                </label>
                                <select
                                    id="followUpDays"
                                    value={settings.followUpAfterDays}
                                    onChange={(event) =>
                                        update({ followUpAfterDays: Number(event.target.value) })
                                    }
                                    className="input-field h-9 w-28 py-0 text-[12px]"
                                >
                                    {[3, 5, 7, 10, 14].map((days) => (
                                        <option key={days} value={days}>
                                            {days} days
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <span className="pb-2 text-[11px] text-muted-foreground">
                                Applies to applications still Submitted or In review.
                            </span>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={() => void handleTestReminders()}
                                disabled={testing || !remindersEnabled}
                                className="btn-secondary h-9 text-[12px]"
                            >
                                {testing ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                Check now
                            </button>
                            {testResult ? (
                                <span className="text-[11px] text-muted-foreground">{testResult}</span>
                            ) : null}
                        </div>
                    </Section>

                    <Section
                        overline="Jobs"
                        title="Platforms"
                        description="Where ApplyOS reads postings automatically. Use the popup on any other site and it will scan on request."
                    >
                        <div className="grid grid-cols-2 gap-x-6">
                            {PLATFORMS.map((platform) => (
                                <label
                                    key={platform.id}
                                    className="flex cursor-pointer items-center gap-2.5 border-b border-border/50 py-2.5 text-[12px] text-foreground"
                                >
                                    <input
                                        type="checkbox"
                                        checked={settings.enabledPlatforms.includes(platform.id)}
                                        onChange={() => handlePlatformToggle(platform.id)}
                                        className="h-3.5 w-3.5 rounded accent-primary"
                                    />
                                    {platform.label}
                                </label>
                            ))}
                        </div>

                        <div className="mt-1">
                            <Toggle
                                checked={settings.autoDetect}
                                onChange={() => update({ autoDetect: !settings.autoDetect })}
                                label="Pre-fill in the popup"
                                description="Read the posting as soon as the popup opens, so the form is ready to confirm."
                            />
                        </div>
                    </Section>

                    {/* Anything written in the popup stays on the device; this states
                        plainly what leaves it, which is the question a permissions
                        reviewer is really asking. */}
                    <Section overline="Privacy" title="What leaves your device">
                        <ul className="space-y-2 text-[12px] leading-relaxed text-muted-foreground">
                            <li className="flex gap-2">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                                <span>
                                    <strong className="font-medium text-foreground">Stays local:</strong> your
                                    autofill profile, saved answers and note drafts are kept in this
                                    browser.
                                </span>
                            </li>
                            <li className="flex gap-2">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                                <span>
                                    <strong className="font-medium text-foreground">Sent to ApplyOS:</strong>{' '}
                                    the applications you save, and any posting text you ask to analyse or
                                    turn into a cover letter.
                                </span>
                            </li>
                            <li className="flex gap-2">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                                <span>
                                    <strong className="font-medium text-foreground">Reading pages:</strong>{' '}
                                    only when you open the popup, or on the job platforms listed above.
                                </span>
                            </li>
                        </ul>
                        <a
                            href="https://www.applyos.io/privacy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-primary-strong hover:underline dark:text-primary"
                        >
                            Read the full privacy policy
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </Section>
                </div>

                {/* Sticky save bar */}
                <div className="sticky bottom-6 mt-6 flex items-center gap-3 rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-md">
                    <button
                        type="button"
                        onClick={handleSave}
                        className="btn-primary h-10 px-6"
                    >
                        {saved ? (
                            <>
                                <Check className="h-4 w-4" />
                                Saved
                            </>
                        ) : (
                            'Save settings'
                        )}
                    </button>
                    <span className="text-[11px] text-muted-foreground">
                        Version {chrome.runtime.getManifest().version}
                    </span>
                </div>

                <p className="mt-6 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Palette className="h-3 w-3" />
                    ApplyOS Extension — same design system as the web app.
                </p>
            </div>
        </div>
    )
}

const container = document.getElementById('root')
if (!container) throw new Error('ApplyOS options: #root not found')
createRoot(container).render(<Options />)
