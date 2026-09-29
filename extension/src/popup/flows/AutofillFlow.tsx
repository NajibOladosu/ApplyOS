import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    ArrowLeft,
    Check,
    ChevronRight,
    FileText,
    Lock,
    ScanSearch,
    Sparkles,
    Square,
    Wand2,
} from 'lucide-react'

import { sendToActiveTab } from '../../lib/messaging'
import { fetchDocumentBytes } from '../../lib/documents'
import { loadCachedProfile, saveLearnedAnswers } from '../../lib/profile/store'
import type { AutofillProfile } from '../../shared/profile'
import { cn } from '../../lib/cn'
import { Card, ErrorNote, Skeleton, Spinner } from '../components/ui'
import type { PlanRow, ScanResult, StepInfo } from '../../content/autofill-runtime'

/**
 * The autofill flow: the review-first fill experience.
 *
 * Scan -> review every decision the engine made -> edit anything -> fill ->
 * advance to the next step (copilot) -> repeat. The user always sees what will
 * be written before it is, which is the promise the whole engine is built on.
 *
 * It opens directly into a scan: the user arrived here by choosing "Autofill
 * this form", so there is no intermediate "click to scan" screen.
 */

type Phase = 'idle' | 'scanning' | 'review' | 'filling' | 'copilot' | 'done'

interface FillOutcome {
    filled: number
    failed: number
    learned: Array<{ question: string; answer: string }>
    savedAnswers: boolean
}

interface AutofillFlowProps {
    onBack: () => void
}

export function AutofillFlow({ onBack }: AutofillFlowProps) {
    const [phase, setPhase] = useState<Phase>('scanning')
    const [profile, setProfile] = useState<AutofillProfile | null>(null)
    const [rows, setRows] = useState<PlanRow[]>([])
    const [step, setStep] = useState<StepInfo | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Review-table state
    const [edits, setEdits] = useState<Record<number, string>>({})
    const [included, setIncluded] = useState<Record<number, boolean>>({})
    const [includeSensitive, setIncludeSensitive] = useState(false)
    const [fastMode, setFastMode] = useState(false)

    // Copilot state
    const [copilotRunning, setCopilotRunning] = useState(false)
    const [stepCount, setStepCount] = useState(1)
    const [copilotLog, setCopilotLog] = useState<string[]>([])
    const stopRef = useRef(false)

    // Fill results
    const [outcome, setOutcome] = useState<FillOutcome | null>(null)
    const [aiBusy, setAiBusy] = useState<number | null>(null)

    // Guards the initial scan against React 19 StrictMode's double-invoke.
    const hasScanned = useRef(false)
    const [profileReady, setProfileReady] = useState(false)

    useEffect(() => {
        void loadCachedProfile().then((loaded) => {
            setProfile(loaded)
            setProfileReady(true)
        })
    }, [])

    const sendScan = useCallback(async (): Promise<ScanResult | null> => {
        const result = await sendToActiveTab<ScanResult>({
            type: 'AUTOFILL_SCAN',
            profile,
            includeSensitive,
        })
        if (!result || (result as { success?: boolean }).success === false) {
            setError(
                'Could not read this page. If the application form is in an iframe, open it in its own tab and try again.'
            )
            return null
        }
        return result
    }, [profile, includeSensitive])

    const handleScan = useCallback(async () => {
        setPhase('scanning')
        setError(null)
        setOutcome(null)
        setCopilotLog([])

        const result = await sendScan()
        if (!result) {
            setPhase('idle')
            return
        }

        setRows(result.rows)
        setStep(result.step)
        setEdits({})
        setIncluded(Object.fromEntries(result.rows.map((row) => [row.index, row.status === 'ready'])))
        setStepCount(1)
        setPhase('review')
    }, [sendScan])

    // Wait for the profile: a scan that runs before it loads fills the review
    // table with nothing, and the user would see every field as "missing".
    useEffect(() => {
        if (!profileReady || hasScanned.current) return
        hasScanned.current = true
        void handleScan()
    }, [profileReady, handleScan])

    // ── Review table helpers ────────────────────────────────────────────────

    const selectedRows = useMemo(
        () => rows.filter((row) => included[row.index]),
        [rows, included]
    )

    const openQuestions = useMemo(
        () =>
            rows.filter(
                (row) =>
                    row.kind === 'textarea' &&
                    (row.status === 'unknown' || row.status === 'missing-value' || row.status === 'low-confidence')
            ),
        [rows]
    )

    const valueOf = useCallback(
        (row: PlanRow) => edits[row.index] ?? row.value ?? '',
        [edits]
    )

    // ── Filling ─────────────────────────────────────────────────────────────

    const applySelected = useCallback(async (): Promise<{ filled: number; failed: number } | null> => {
        if (selectedRows.length === 0) return { filled: 0, failed: 0 }

        const result = await sendToActiveTab<{
            success: boolean
            results?: Array<{ ok: boolean }>
        }>({
            type: 'AUTOFILL_APPLY',
            indexes: selectedRows.map((row) => row.index),
            edits,
            slow: !fastMode,
        })

        if (!result?.success) {
            setError('The fill did not run — the page may have changed. Scan again.')
            return null
        }

        const filled = (result.results ?? []).filter((r) => r.ok).length
        const failed = (result.results ?? []).length - filled
        return { filled, failed }
    }, [selectedRows, edits, fastMode])

    const learnAnswers = useCallback(async (): Promise<Array<{ question: string; answer: string }>> => {
        const result = await sendToActiveTab<{
            success: boolean
            learned?: Array<{ question: string; answer: string }>
        }>({ type: 'AUTOFILL_LEARN' })
        return result?.learned ?? []
    }, [])

    const handleFill = useCallback(async () => {
        setPhase('filling')
        setError(null)

        const result = await applySelected()
        if (!result) {
            setPhase('review')
            return
        }

        const learned = await learnAnswers()
        setOutcome({ ...result, learned, savedAnswers: false })
        setPhase('done')
    }, [applySelected, learnAnswers])

    // ── AI answers ──────────────────────────────────────────────────────────

    const generateAnswer = useCallback(
        async (row: PlanRow, previousAnswers: Array<{ question: string; answer: string }> = []): Promise<string | null> => {
            setAiBusy(row.index)
            try {
                const response = await chrome.runtime.sendMessage({
                    type: 'AI_ANSWER_REQUEST',
                    question: row.label,
                    previousAnswers,
                })
                const answer: string | null = response?.answer ?? null
                if (answer) {
                    setEdits((current) => ({ ...current, [row.index]: answer }))
                    setIncluded((current) => ({ ...current, [row.index]: true }))
                } else {
                    setError('The AI answer could not be generated. Check that you are signed in, then try again.')
                }
                return answer
            } finally {
                setAiBusy(null)
            }
        },
        []
    )

    const answerAllOpen = useCallback(async () => {
        // Sequential: each answer is grounded on the previous ones so one
        // application does not tell three different stories.
        const answered: Array<{ question: string; answer: string }> = []
        for (const row of openQuestions.slice(0, 6)) {
            const answer = await generateAnswer(row, answered)
            if (answer) answered.push({ question: row.label, answer })
        }
    }, [openQuestions, generateAnswer])

    // ── Auto-attach ─────────────────────────────────────────────────────────

    const attachDocument = useCallback(
        async (row: PlanRow) => {
            setAiBusy(row.index)
            try {
                const documentId =
                    row.fieldId === 'coverLetterFile' ? profile?.coverLetterDocumentId : profile?.resumeDocumentId
                if (!documentId) {
                    setError('Choose a resume in Settings → Profile first, then attach from here.')
                    return
                }

                const bytes = await fetchDocumentBytes(documentId)
                if (!bytes) {
                    setError('Could not download that document. Check your connection and try again.')
                    return
                }

                const result = await sendToActiveTab<{ ok: boolean; error?: string }>({
                    type: 'AUTOFILL_ATTACH',
                    index: row.index,
                    fileName: bytes.fileName,
                    mimeType: bytes.mimeType,
                    base64: bytes.base64,
                })

                if (result?.ok) {
                    setRows((current) =>
                        current.map((candidate) =>
                            candidate.index === row.index
                                ? { ...candidate, note: `Attached ${bytes.fileName}` }
                                : candidate
                        )
                    )
                } else {
                    setError(result?.error ?? 'The page refused the file — attach it by hand.')
                }
            } finally {
                setAiBusy(null)
            }
        },
        [profile]
    )

    // ── Copilot ─────────────────────────────────────────────────────────────

    const runCopilot = useCallback(async () => {
        setCopilotRunning(true)
        stopRef.current = false
        setPhase('copilot')
        setCopilotLog([])

        const log = (line: string) => setCopilotLog((current) => [...current.slice(-5), line])
        let currentStep = 1

        try {
            while (!stopRef.current) {
                const scan = await sendScan()
                if (!scan) break

                setRows(scan.rows)
                setStep(scan.step)
                setIncluded(Object.fromEntries(scan.rows.map((row) => [row.index, row.status === 'ready'])))
                setEdits({})

                const ready = scan.rows.filter((row) => row.status === 'ready')
                if (ready.length > 0) {
                    const result = await sendToActiveTab<{ success: boolean; results?: Array<{ ok: boolean }> }>({
                        type: 'AUTOFILL_APPLY',
                        indexes: ready.map((row) => row.index),
                        slow: !fastMode,
                    })
                    const filled = (result?.results ?? []).filter((r) => r.ok).length
                    log(`Step ${currentStep}: filled ${filled} of ${ready.length} fields`)
                } else {
                    log(`Step ${currentStep}: nothing new to fill`)
                }

                if (stopRef.current) break

                if (!scan.step.hasNext) {
                    log('Reached the review step — finish the application yourself.')
                    break
                }

                const nav = await sendToActiveTab<{ success: boolean; reason?: string }>({
                    type: 'AUTOFILL_NAVIGATE',
                    kind: 'next',
                })
                if (!nav?.success) {
                    log('Could not find the Next button — continue manually.')
                    break
                }

                currentStep += 1
                setStepCount(currentStep)
            }
        } finally {
            setCopilotRunning(false)
            setPhase('review')
        }
    }, [sendScan, fastMode])

    const stopCopilot = useCallback(() => {
        stopRef.current = true
    }, [])

    // ── Learning ────────────────────────────────────────────────────────────

    const saveLearned = useCallback(async () => {
        if (!outcome) return
        await saveLearnedAnswers(outcome.learned)
        setOutcome({ ...outcome, savedAnswers: true })
    }, [outcome])

    // ── Render ──────────────────────────────────────────────────────────────

    const heading = copilotRunning ? `Filling each step · ${stepCount}` : 'Autofill this form'

    if (phase === 'scanning') {
        return (
            <div className="flex h-full flex-col">
                <FlowHeader title={heading} onBack={onBack} />
                <div className="space-y-3 p-4">
                    <Card className="space-y-2 p-4">
                        {[0, 1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} className="h-8 w-full" />
                        ))}
                    </Card>
                    <p className="text-center text-[11px] text-muted-foreground">
                        Reading the form fields on this page.
                    </p>
                </div>
            </div>
        )
    }

    if (phase === 'idle') {
        // Only reached when the opening scan failed — offer a retry.
        return (
            <div className="flex h-full flex-col">
                <FlowHeader title={heading} onBack={onBack} />
                <div className="space-y-3 p-4">
                    {error ? <ErrorNote>{error}</ErrorNote> : null}
                    <Card className="flex flex-col items-center p-6 text-center">
                        <div className="icon-chip mb-3">
                            <ScanSearch className="h-5 w-5" />
                        </div>
                        <h2 className="font-display text-[15px] font-bold tracking-tight text-foreground">
                            Fill this application
                        </h2>
                        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                            Scan the form, review what ApplyOS would write, edit anything, then fill.
                        </p>
                        <button type="button" onClick={() => void handleScan()} className="btn-primary mt-4 h-10 w-full">
                            <ScanSearch className="h-4 w-4" />
                            Scan this page
                        </button>
                    </Card>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-full flex-col">
            <FlowHeader
                title={heading}
                onBack={onBack}
                action={
                    (phase === 'review' || phase === 'done') ? (
                        <button type="button" className="btn-ghost" onClick={() => void handleScan()}>
                            <ScanSearch className="h-3.5 w-3.5" /> Rescan
                        </button>
                    ) : null
                }
            />

            <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pb-6">
                {error ? <ErrorNote>{error}</ErrorNote> : null}

                {phase === 'filling' || phase === 'copilot' ? (
                    <Card className="space-y-2 p-4">
                        {[0, 1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-8 w-full" />
                        ))}
                    </Card>
                ) : null}

                {copilotRunning ? (
                    <Card className="p-4">
                        <div className="space-y-1 font-mono text-[11px] leading-relaxed text-muted-foreground">
                            {copilotLog.map((line, i) => (
                                <p key={i} className={i === copilotLog.length - 1 ? 'text-primary-strong dark:text-primary' : ''}>
                                    {line}
                                </p>
                            ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                            <button type="button" className="btn-secondary flex-1" onClick={stopCopilot}>
                                <Square className="h-3.5 w-3.5" /> Stop
                            </button>
                        </div>
                    </Card>
                ) : null}

                {phase === 'review' || phase === 'done' ? (
                    <>
                        {outcome && phase === 'done' ? (
                            <Card className="p-4">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary-strong dark:text-primary">
                                        <Check className="h-3.5 w-3.5" />
                                    </span>
                                    <p className="text-[13px] font-semibold text-foreground">
                                        Filled {outcome.filled} field{outcome.filled === 1 ? '' : 's'}
                                        {outcome.failed > 0 ? (
                                            <span className="text-muted-foreground"> · {outcome.failed} needs a look</span>
                                        ) : null}
                                    </p>
                                </div>
                                {outcome.learned.length > 0 && !outcome.savedAnswers ? (
                                    <div className="mt-3 rounded-lg border border-primary/25 bg-primary/10 p-3">
                                        <p className="text-[12px] font-medium text-foreground">
                                            Remember {outcome.learned.length} answer
                                            {outcome.learned.length === 1 ? '' : 's'} you typed by hand?
                                        </p>
                                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                                            {outcome.learned
                                                .slice(0, 2)
                                                .map((entry) => entry.question)
                                                .join(' · ')}
                                            {outcome.learned.length > 2 ? ` +${outcome.learned.length - 2} more` : ''}
                                        </p>
                                        <div className="mt-2 flex gap-2">
                                            <button type="button" className="btn-primary flex-1 !py-1.5 !text-xs" onClick={() => void saveLearned()}>
                                                <Wand2 className="h-3 w-3" /> Save answers
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-ghost"
                                                onClick={() => setOutcome({ ...outcome, savedAnswers: true })}
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                                {outcome.savedAnswers ? (
                                    <p className="mt-2 text-[11px] text-muted-foreground">
                                        Saved to your answer library — future forms fill these automatically.
                                    </p>
                                ) : null}
                            </Card>
                        ) : null}

                        <button
                            type="button"
                            onClick={onBack}
                            className="btn-ghost"
                            aria-label="Back to this page"
                        >
                            <ArrowLeft className="h-3 w-3" />
                            Back to this page
                        </button>

                        <ReviewSummary rows={rows} openCount={openQuestions.length} />

                        <div className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-2">
                            <ToggleChip checked={fastMode} onChange={setFastMode} label="Fast mode" title="Skip typing simulation — faster, but some forms validate on keystrokes" />
                            <ToggleChip
                                checked={includeSensitive}
                                onChange={setIncludeSensitive}
                                label="Voluntary questions"
                                title="Also fill demographic (EEO) questions from your profile"
                            />
                        </div>

                        <Card className="divide-y divide-border/50">
                            {rows.map((row) => (
                                <ReviewRow
                                    key={row.index}
                                    row={row}
                                    value={valueOf(row)}
                                    included={Boolean(included[row.index])}
                                    includeSensitive={includeSensitive}
                                    busy={aiBusy === row.index}
                                    onToggle={() =>
                                        setIncluded((current) => ({ ...current, [row.index]: !current[row.index] }))
                                    }
                                    onEdit={(value) => setEdits((current) => ({ ...current, [row.index]: value }))}
                                    onGenerate={() => void generateAnswer(row)}
                                    onAttach={() => void attachDocument(row)}
                                />
                            ))}
                        </Card>

                        {openQuestions.length > 0 ? (
                            <button type="button" className="btn-secondary w-full" onClick={() => void answerAllOpen()}>
                                <Sparkles className="h-3.5 w-3.5" />
                                Answer {Math.min(openQuestions.length, 6)} open question
                                {Math.min(openQuestions.length, 6) === 1 ? '' : 's'} with AI
                            </button>
                        ) : null}

                        <div className="flex gap-2">
                            <button
                                type="button"
                                className="btn-primary flex-1"
                                disabled={selectedRows.length === 0}
                                onClick={() => void handleFill()}
                            >
                                Fill {selectedRows.length} field{selectedRows.length === 1 ? '' : 's'}
                            </button>
                            {step?.hasNext ? (
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    title="Fill each step and advance until the review page"
                                    onClick={() => void runCopilot()}
                                >
                                    <ChevronRight className="h-3.5 w-3.5" /> All steps
                                </button>
                            ) : null}
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    )
}

function FlowHeader({
    title,
    onBack,
    action,
}: {
    title: string
    onBack: () => void
    action?: React.ReactNode
}) {
    return (
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
    )
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function ReviewSummary({ rows, openCount }: { rows: PlanRow[]; openCount: number }) {
    const ready = rows.filter((r) => r.status === 'ready').length
    const files = rows.filter((r) => r.status === 'file').length
    const filled = rows.filter((r) => r.status === 'already-filled').length

    return (
        <div className="grid grid-cols-4 gap-2">
            <SummaryStat value={ready} label="Ready" tone="primary" />
            <SummaryStat value={openCount} label="Open" />
            <SummaryStat value={files} label="Files" />
            <SummaryStat value={filled} label="Done" />
        </div>
    )
}

function SummaryStat({
    value,
    label,
    tone = 'default',
}: {
    value: number
    label: string
    tone?: 'default' | 'primary'
}) {
    return (
        <div className="rounded-xl border border-border/70 bg-card px-2 py-1.5 text-center">
            <p
                className={cn(
                    'font-display text-base font-bold leading-none tabular-nums text-foreground',
                    tone === 'primary' && 'text-primary-strong dark:text-primary'
                )}
            >
                {value}
            </p>
            <p className="mt-1 text-[9px] font-medium text-muted-foreground">{label}</p>
        </div>
    )
}

function ToggleChip({
    checked,
    onChange,
    label,
    title,
}: {
    checked: boolean
    onChange: (value: boolean) => void
    label: string
    title?: string
}) {
    return (
        <button
            type="button"
            title={title}
            onClick={() => onChange(!checked)}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                checked
                    ? 'border-primary/40 bg-primary/10 text-primary-strong dark:text-primary'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
            )}
        >
            <span
                className={cn('h-1.5 w-1.5 rounded-full', checked ? 'bg-primary' : 'bg-muted-foreground/40')}
                aria-hidden
            />
            {label}
        </button>
    )
}

const STATUS_BADGES: Partial<Record<PlanRow['status'], string>> = {
    'missing-value': 'Missing',
    unknown: 'Unknown',
    'low-confidence': 'Unsure',
    sensitive: 'Voluntary',
    file: 'File',
    'already-filled': 'Filled',
}

function ReviewRow({
    row,
    value,
    included,
    includeSensitive,
    busy,
    onToggle,
    onEdit,
    onGenerate,
    onAttach,
}: {
    row: PlanRow
    value: string
    included: boolean
    includeSensitive: boolean
    busy: boolean
    onToggle: () => void
    onEdit: (value: string) => void
    onGenerate: () => void
    onAttach: () => void
}) {
    const locked = row.status === 'sensitive' && !includeSensitive
    const isFile = row.status === 'file'
    const isDone = row.status === 'already-filled'
    const canEdit = !isFile && !isDone && !locked
    const openEnded = row.kind === 'textarea'

    return (
        <div
            className={cn(
                'flex items-start gap-2.5 px-3 py-2.5',
                (isDone || locked) && 'opacity-55',
                isFile && 'bg-muted/40'
            )}
        >
            {isFile ? (
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-primary">
                    <FileText className="h-3.5 w-3.5" />
                </span>
            ) : locked ? (
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
                    <Lock className="h-3 w-3" />
                </span>
            ) : (
                <input
                    type="checkbox"
                    checked={included}
                    onChange={onToggle}
                    disabled={isDone || locked}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded accent-primary"
                    aria-label={`Include ${row.label}`}
                />
            )}

            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[12px] font-medium text-foreground" title={row.label}>
                        {row.label}
                    </p>
                    {STATUS_BADGES[row.status] ? (
                        <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-px text-[9px] font-semibold text-muted-foreground">
                            {STATUS_BADGES[row.status]}
                        </span>
                    ) : null}
                </div>

                {isFile ? (
                    <div className="mt-1.5">
                        {row.fieldId === 'resumeFile' || row.fieldId === 'coverLetterFile' ? (
                            <button type="button" className="btn-secondary !py-1 !text-[11px]" onClick={onAttach}>
                                {busy ? <Spinner className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                                Attach automatically
                            </button>
                        ) : (
                            <p className="text-[11px] text-muted-foreground">{row.note ?? 'Attach a file by hand.'}</p>
                        )}
                    </div>
                ) : isDone ? (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={value}>
                        {value || 'Already answered on the page'}
                    </p>
                ) : (
                    <div className="mt-1 flex items-center gap-1.5">
                        {canEdit ? (
                            row.kind === 'textarea' ? (
                                <textarea
                                    value={value}
                                    onChange={(event) => onEdit(event.target.value)}
                                    rows={2}
                                    placeholder={row.status === 'ready' ? row.value ?? '' : 'Add your answer…'}
                                    className="input-field !py-1.5 !text-[11px]"
                                />
                            ) : (
                                <input
                                    type="text"
                                    value={value}
                                    onChange={(event) => onEdit(event.target.value)}
                                    placeholder={row.status === 'ready' ? row.value ?? '' : 'Add a value…'}
                                    className="input-field !py-1 !text-[11px]"
                                />
                            )
                        ) : null}
                        {canEdit && (openEnded || row.status !== 'ready') ? (
                            <button
                                type="button"
                                onClick={onGenerate}
                                disabled={busy}
                                title="Generate with AI"
                                className="shrink-0 rounded-lg border border-border bg-card p-1.5 text-primary-strong transition-colors hover:border-primary/40 disabled:opacity-50 dark:text-primary"
                            >
                                {busy ? <Spinner className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                            </button>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    )
}
