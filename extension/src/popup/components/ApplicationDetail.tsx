import React, { useState, useEffect } from 'react'
import { APIClient, type Application } from '../../lib/api/api-client'
import {
    AlertTriangle,
    ArrowLeft,
    Building,
    Trash2,
    Save,
    Bot,
    Wand2,
    Target,
    Copy,
    RefreshCw,
    FileText,
    Paperclip,
    Loader2,
    ChevronDown,
    ExternalLink,
    Check,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react'

import { cn } from '../../lib/cn'
import { statusMeta, STATUS_ORDER } from '../../lib/design/status'
import { Card, ScoreRing, Skeleton, Spinner, StatusPill } from '../components/ui'
import { NoteEditor } from './NoteEditor'

interface ApplicationDetailProps {
    application: Application
    onBack: () => void
    onUpdate: (app: Application) => void
    onDelete: (id: string) => void
}

type Tab = 'overview' | 'questions' | 'analysis' | 'cover-letter' | 'notes'

const TABS: { id: Tab, label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'questions', label: 'Questions' },
    { id: 'cover-letter', label: 'Cover Letter' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'notes', label: 'Notes' },
]

/**
 * Small card header, mirroring the web app's section headers: an icon chip +
 * bold display title + muted sub. (No overline — the web only uses those on
 * the page title.)
 */
function BlockHead({
    icon: Icon,
    title,
    sub,
    action,
}: {
    icon: React.ComponentType<{ className?: string }>
    title: string
    sub?: string
    action?: React.ReactNode
}) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary-strong dark:text-primary">
                    <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                    <h3 className="truncate font-display text-[13.5px] font-bold tracking-tight text-foreground">
                        {title}
                    </h3>
                    {sub ? <p className="truncate text-[11px] text-muted-foreground">{sub}</p> : null}
                </div>
            </div>
            {action}
        </div>
    )
}

/** Plain sentence-case field label — the web app never uppercases field labels. */
function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
    return (
        <label htmlFor={htmlFor} className="mb-1 block text-[11px] font-medium text-muted-foreground">
            {children}
        </label>
    )
}

export function ApplicationDetail({ application, onBack, onUpdate, onDelete }: ApplicationDetailProps) {
    const [activeTab, setActiveTab] = useState<Tab>('overview')
    const [viewStart, setViewStart] = useState(0)
    const [notes, setNotes] = useState(application.notes || '')
    const [noteCategory, setNoteCategory] = useState(application.note_category || '')
    const [noteIsPinned, setNoteIsPinned] = useState(application.note_is_pinned || false)
    const [status, setStatus] = useState<Application['status']>(application.status)
    const [saving, setSaving] = useState(false)
    const [jobDescriptionExpanded, setJobDescriptionExpanded] = useState(false)

    // AI State
    const [questions, setQuestions] = useState<any[]>([])
    const [scanning, setScanning] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [analysis, setAnalysis] = useState<any>(null)
    const [checkingComp, setCheckingComp] = useState(false)
    const [aiContext, setAiContext] = useState('')
    const [newQuestion, setNewQuestion] = useState('')
    const [addingQuestion, setAddingQuestion] = useState(false)

    // Cover Letter state
    const [generatingCL, setGeneratingCL] = useState(false)
    const [aiCoverLetter, setAiCoverLetter] = useState(application.ai_cover_letter || '')
    const [mCL, setMCL] = useState(application.manual_cover_letter || application.ai_cover_letter || '')
    const [clInstructions, setClInstructions] = useState('')

    // Analysis state
    const [loadingAnalysis, setLoadingAnalysis] = useState(false)

    // Document state
    const [userDocuments, setUserDocuments] = useState<any[]>([])
    const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
    const [docsLoading, setDocsLoading] = useState(false)

    useEffect(() => {
        if (activeTab === 'questions') {
            loadQuestions()
        } else if (activeTab === 'overview') {
            loadDocuments()
        }

        // Auto-center active tab logic
        const activeIndex = TABS.findIndex(t => t.id === activeTab)
        if (activeIndex !== -1) {
            let targetStart = activeIndex - 1
            const maxStart = TABS.length - 3
            if (targetStart < 0) targetStart = 0
            if (targetStart > maxStart) targetStart = maxStart
            setViewStart(targetStart)
        }
    }, [activeTab])

    const loadDocuments = async () => {
        if (!application.id) return
        setDocsLoading(true)
        try {
            const [allDocs, linkedDocIds] = await Promise.all([
                APIClient.getDocuments(),
                APIClient.getApplicationDocuments(application.id)
            ])
            setUserDocuments(allDocs || [])
            setSelectedDocIds(linkedDocIds || [])
        } catch (e) {
            console.error('Failed to load documents:', e)
        } finally {
            setDocsLoading(false)
        }
    }

    const toggleDocumentSelection = async (docId: string) => {
        if (!application.id) return
        const newSelectedIds = selectedDocIds.includes(docId)
            ? selectedDocIds.filter(id => id !== docId)
            : [...selectedDocIds, docId]

        setSelectedDocIds(newSelectedIds)
        try {
            await APIClient.updateApplicationDocuments(application.id, newSelectedIds)
        } catch (e) {
            console.error('Failed to update documents:', e)
            alert('Failed to save document selection')
            // Revert on failure
            setSelectedDocIds(selectedDocIds)
        }
    }

    const loadQuestions = async () => {
        try {
            const data = await APIClient.getQuestions(application.id!)
            setQuestions(data || [])
        } catch (e) {
            console.error(e)
        }
    }

    const handleSave = async () => {
        if (!application.id) return
        setSaving(true)
        try {
            // Update Application
            const updated = await APIClient.updateApplication(application.id, {
                status,
                notes,
                note_category: noteCategory,
                note_is_pinned: noteIsPinned,
                manual_cover_letter: mCL
            } as any)

            // Update Questions
            if (questions.length > 0) {
                await Promise.all(questions.map(q =>
                    APIClient.updateQuestion(q.id, { ai_answer: q.ai_answer })
                ))
            }

            onUpdate(updated as Application)
        } catch (e: any) {
            console.error('Update failed:', e)
            alert(`Failed to update: ${e.message || JSON.stringify(e)}`)
        } finally {
            setSaving(false)
        }
    }

    const handleQuestionChange = (id: string, newAnswer: string) => {
        setQuestions(prev => prev.map(q =>
            q.id === id ? { ...q, ai_answer: newAnswer } : q
        ))
    }

    useEffect(() => {
        if (activeTab === 'analysis' && application.id) {
            loadAnalysis()
        }
    }, [activeTab, application.id])

    const loadAnalysis = async () => {
        // use the first attached doc or the last analyzed one
        const docId = selectedDocIds.length > 0 ? selectedDocIds[0] : application.last_analyzed_document_id
        if (!docId || !application.id) return

        setLoadingAnalysis(true)
        try {
            const data = await APIClient.getAnalysis(application.id, docId)
            if (data?.analysis_result) {
                setAnalysis(data.analysis_result)
            }
        } catch (e) {
            console.error('Failed to load analysis:', e)
        } finally {
            setLoadingAnalysis(false)
        }
    }

    const handleDelete = async () => {
        if (!application.id) return
        if (confirm('Are you sure you want to delete this application?')) {
            try {
                await APIClient.deleteApplication(application.id)
                onDelete(application.id)
            } catch (e) {
                console.error(e)
                alert('Failed to delete')
            }
        }
    }

    const handleScanQuestions = async () => {
        setScanning(true)
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
            if (!tab?.id) return

            chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_QUESTIONS' }, async (response) => {
                if (chrome.runtime.lastError) {
                    alert("Could not connect to page. Reload the page and try again.")
                    setScanning(false)
                    return
                }

                if (response?.success && response.questions?.length > 0) {
                    await APIClient.saveQuestions(application.id!, response.questions)
                    loadQuestions()
                } else {
                    alert("No questions detected on this page.")
                }
                setScanning(false)
            })
        } catch (e) {
            console.error(e)
            setScanning(false)
        }
    }

    const handleGenerateAnswers = async () => {
        setGenerating(true)
        try {
            await APIClient.generateAnswers(application.id!, aiContext || undefined)
            loadQuestions()
        } catch (e: any) {
            console.error(e)
            alert(`Failed to generate answers: ${e.message || 'Unknown error'}`)
        } finally {
            setGenerating(false)
        }
    }

    const handleAddQuestion = async () => {
        if (!newQuestion.trim() || !application.id) return
        setAddingQuestion(true)
        try {
            await APIClient.createQuestion(application.id, newQuestion.trim())
            setNewQuestion('')
            loadQuestions()
        } catch (e: any) {
            console.error(e)
            alert(`Failed to add question: ${e.message}`)
        } finally {
            setAddingQuestion(false)
        }
    }

    const handleDeleteQuestion = async (id: string) => {
        try {
            await APIClient.deleteQuestion(id)
            loadQuestions()
        } catch (e) {
            console.error(e)
            alert(`Failed to delete question: ${e}`)
        }
    }

    const handleCheckCompatibility = async () => {
        if (!application.id) return

        // Pass the first attached document ID if available
        const docId = selectedDocIds.length > 0 ? selectedDocIds[0] : undefined

        if (!docId) {
            alert("Please attach a resume in the Overview tab first.")
            return
        }

        setCheckingComp(true)
        try {
            const result = await APIClient.checkCompatibility(application.id, docId)
            setAnalysis(result.analysis)
            // also refresh the loaded analysis to ensure persistence
            loadAnalysis()
        } catch (e: any) {
            console.error(e)
            alert(`Analysis failed: ${e.message || 'Unknown error'}`)
        } finally {
            setCheckingComp(false)
        }
    }

    const handleGenerateCL = async () => {
        setGeneratingCL(true)
        try {
            const result = await APIClient.generateCoverLetter(application.id!, clInstructions)
            if (result.coverLetter) {
                setMCL(result.coverLetter)
                setAiCoverLetter(result.coverLetter)
            }
        } catch (e: any) {
            console.error(e)
            alert(`Failed to generate: ${e.message}`)
        } finally {
            setGeneratingCL(false)
        }
    }

    const renderTabButton = (id: Tab, label: string) => {
        const isActive = activeTab === id
        return (
            <button
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                    'flex-1 rounded-md px-1 py-1.5 text-[10.5px] font-medium transition-all',
                    isActive
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                )}
            >
                {label}
            </button>
        )
    }

    return (
        <div className="flex h-full flex-col w-full overflow-hidden bg-background">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/70 bg-card/80 p-3 backdrop-blur-md">
                <button
                    type="button"
                    onClick={onBack}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label="Back to applications"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                    <h2 className="truncate font-display text-[13.5px] font-bold tracking-tight text-foreground">
                        {application.title}
                    </h2>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Building className="h-3 w-3 shrink-0" />
                        <span className="truncate">{application.company || 'Unknown company'}</span>
                        <StatusPill status={status} className="!px-1.5 !text-[9px]" />
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                    <button
                        type="button"
                        onClick={() => {
                            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.applyos.io'
                            window.open(`${baseUrl}/applications/${application.id}`, '_blank')
                        }}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        title="Open in ApplyOS"
                        aria-label="Open in ApplyOS"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded-lg p-1.5 text-primary-strong transition-colors hover:bg-primary/10 disabled:opacity-50 dark:text-primary"
                        title="Save changes"
                        aria-label="Save changes"
                    >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="Delete application"
                        aria-label="Delete application"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Tab switcher — the app's segmented control, windowed to three
                so five tabs fit a 400px popup. */}
            <div className="shrink-0 border-b border-border/50 bg-card/30 px-3 py-2">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setViewStart(Math.max(0, viewStart - 1))}
                        disabled={viewStart === 0}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary disabled:pointer-events-none disabled:opacity-30"
                        aria-label="Previous tabs"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </button>

                    <div className="flex flex-1 gap-0.5 rounded-lg bg-muted/70 p-1">
                        {TABS.slice(viewStart, viewStart + 3).map(tab => renderTabButton(tab.id, tab.label))}
                    </div>

                    <button
                        type="button"
                        onClick={() => setViewStart(Math.min(TABS.length - 3, viewStart + 1))}
                        disabled={viewStart >= TABS.length - 3}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary disabled:pointer-events-none disabled:opacity-30"
                        aria-label="Next tabs"
                    >
                        <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Content Container */}
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-4 p-4">
                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                            <Card className="overflow-hidden">
                                <BlockHead icon={Building} title="Details" sub="Where this application stands" />
                                <div className="grid grid-cols-2 divide-x divide-border/50">
                                    <div className="p-4">
                                        <Label>Status</Label>
                                        <div className="relative group/status">
                                            <select
                                                value={status}
                                                onChange={(e) => setStatus(e.target.value as any)}
                                                className="input-field h-8 appearance-none pr-7 text-[12px] font-medium"
                                                aria-label="Application status"
                                            >
                                                {STATUS_ORDER.map(s => (
                                                    <option key={s} value={s}>{statusMeta(s).label}</option>
                                                ))}
                                            </select>
                                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                <ChevronDown className="h-3 w-3" />
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <Label>Created</Label>
                                        <p className="text-[12px] font-semibold text-foreground">
                                            {new Date(application.created_at || Date.now()).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                {application.url && (
                                    <div className="border-t border-border/50 px-4 py-3">
                                        <Label>Job URL</Label>
                                        <a
                                            href={application.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex max-w-full items-center gap-1.5 text-[12px] font-medium text-primary-strong hover:underline dark:text-primary"
                                        >
                                            <span className="truncate">{application.url}</span>
                                            <ExternalLink className="h-3 w-3 shrink-0" />
                                        </a>
                                    </div>
                                )}
                            </Card>

                            {application.job_description && (
                                <Card className="overflow-hidden">
                                    <BlockHead icon={FileText} title="Job description" sub="As read from the posting" />
                                    <div className="p-4">
                                        <p
                                            className={cn(
                                                'text-[11.5px] leading-relaxed text-muted-foreground',
                                                !jobDescriptionExpanded && 'line-clamp-[4]'
                                            )}
                                        >
                                            {application.job_description}
                                        </p>
                                        {application.job_description.length > 200 && (
                                            <button
                                                type="button"
                                                onClick={() => setJobDescriptionExpanded(!jobDescriptionExpanded)}
                                                className="mt-2 text-[11px] font-semibold text-primary-strong transition-opacity hover:opacity-75 dark:text-primary"
                                            >
                                                {jobDescriptionExpanded ? 'Show less' : 'Show more'}
                                            </button>
                                        )}
                                    </div>
                                </Card>
                            )}

                            <Card className="overflow-hidden">
                                <BlockHead
                                    icon={Paperclip}
                                    title="Documents"
                                    sub="Linked resumes are used for analysis"
                                    action={
                                        selectedDocIds.length > 0 ? (
                                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                                                {selectedDocIds.length} linked
                                            </span>
                                        ) : null
                                    }
                                />
                                {docsLoading ? (
                                    <div className="space-y-2 p-4">
                                        <Skeleton className="h-8 w-full" />
                                        <Skeleton className="h-8 w-full" />
                                    </div>
                                ) : userDocuments.length === 0 ? (
                                    <p className="px-4 py-4 text-[11px] leading-relaxed text-muted-foreground">
                                        No documents in your library yet. Upload a resume in the
                                        ApplyOS app and it will show up here.
                                    </p>
                                ) : (
                                    <ul className="divide-y divide-border/50">
                                        {userDocuments.map(doc => {
                                            const isSelected = selectedDocIds.includes(doc.id)
                                            return (
                                                <li key={doc.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleDocumentSelection(doc.id)}
                                                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
                                                    >
                                                        <span
                                                            className={cn(
                                                                'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                                                                isSelected
                                                                    ? 'border-primary bg-primary text-primary-foreground'
                                                                    : 'border-border bg-card'
                                                            )}
                                                        >
                                                            {isSelected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                                                        </span>
                                                        <FileText
                                                            className={cn(
                                                                'h-3.5 w-3.5 shrink-0',
                                                                isSelected ? 'text-primary-strong dark:text-primary' : 'text-muted-foreground'
                                                            )}
                                                        />
                                                        <span
                                                            className={cn(
                                                                'min-w-0 flex-1 truncate text-[12px]',
                                                                isSelected ? 'font-medium text-foreground' : 'text-muted-foreground'
                                                            )}
                                                        >
                                                            {doc.file_name}
                                                        </span>
                                                    </button>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                )}
                            </Card>
                        </div>
                    )}

                    {/* QUESTIONS TAB */}
                    {activeTab === 'questions' && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                            <Card className="overflow-hidden">
                                <BlockHead
                                    icon={Bot}
                                    title="Application questions"
                                    sub="Scan the form or add them manually"
                                    action={
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={handleScanQuestions}
                                                disabled={scanning}
                                                className="btn-secondary h-7 !px-2.5 !text-[11px]"
                                            >
                                                {scanning ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Target className="h-3 w-3" />}
                                                Scan
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleGenerateAnswers}
                                                disabled={generating || questions.length === 0}
                                                className="btn-primary h-7 !px-2.5 !text-[11px]"
                                            >
                                                <Wand2 className="h-3 w-3" />
                                                Generate
                                            </button>
                                        </div>
                                    }
                                />
                                <div className="p-4">
                                    <Label htmlFor="q-context">Instructions</Label>
                                    <textarea
                                        id="q-context"
                                        value={aiContext}
                                        onChange={e => setAiContext(e.target.value)}
                                        className="input-field h-16 resize-none py-1.5 text-[11px]"
                                        placeholder="E.g. 'Focus on my leadership experience' or 'Keep answers under 100 words'"
                                    />
                                </div>
                            </Card>

                            {questions.length === 0 ? (
                                <Card className="flex flex-col items-center px-5 py-8 text-center">
                                    <div className="icon-chip mb-3 h-10 w-10">
                                        <Bot className="h-5 w-5" />
                                    </div>
                                    <p className="text-[13px] font-semibold text-foreground">No questions yet</p>
                                    <p className="mt-1 max-w-[240px] text-[11px] leading-relaxed text-muted-foreground">
                                        Open the application page and use <strong>Scan</strong> — or add
                                        one below.
                                    </p>
                                </Card>
                            ) : (
                                <div className="space-y-3">
                                    {questions.map((q, i) => (
                                        <Card key={q.id ?? i} className="overflow-hidden">
                                            <div className="flex items-start justify-between gap-2 px-4 py-3">
                                                <p className="min-w-0 flex-1 text-[12px] font-semibold leading-snug text-foreground">
                                                    {q.question_text}
                                                </p>
                                                <div className="flex shrink-0 items-center gap-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => navigator.clipboard.writeText(q.ai_answer || '')}
                                                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                                                        title="Copy answer"
                                                        aria-label="Copy answer"
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteQuestion(q.id)}
                                                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                                        title="Delete question"
                                                        aria-label="Delete question"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="border-t border-border/50 p-3">
                                                <textarea
                                                    value={q.ai_answer || ''}
                                                    onChange={e => handleQuestionChange(q.id, e.target.value)}
                                                    className="h-28 w-full resize-none rounded-lg border border-border/60 bg-muted/30 p-2.5 text-[11px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
                                                    placeholder="Answer will be generated here…"
                                                />
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newQuestion}
                                    onChange={e => setNewQuestion(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddQuestion()}
                                    placeholder="Add a question manually…"
                                    className="input-field h-9 flex-1 text-[12px]"
                                    aria-label="Add question"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddQuestion}
                                    disabled={addingQuestion || !newQuestion.trim()}
                                    className="btn-primary h-9 !px-3"
                                    aria-label="Add question"
                                >
                                    {addingQuestion ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ANALYSIS TAB */}
                    {activeTab === 'analysis' && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                            {loadingAnalysis && !analysis ? (
                                <Card className="flex flex-col items-center justify-center gap-3 py-10">
                                    <Spinner className="h-6 w-6 text-primary" />
                                    <p className="text-[12px] text-muted-foreground">Loading analysis…</p>
                                </Card>
                            ) : !analysis ? (
                                <Card className="flex flex-col items-center px-5 py-8 text-center">
                                    <div className="icon-chip mb-3 h-10 w-10">
                                        <Target className="h-5 w-5" />
                                    </div>
                                    <p className="text-[13px] font-semibold text-foreground">No analysis yet</p>
                                    <p className="mt-1 max-w-[240px] text-[11px] leading-relaxed text-muted-foreground">
                                        Match your resume against this job description to get a score
                                        and the keywords to close.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleCheckCompatibility}
                                        disabled={checkingComp}
                                        className="btn-primary mt-4 h-9 !px-4 !text-[12px]"
                                    >
                                        {checkingComp ? <Spinner className="h-3.5 w-3.5" /> : <Wand2 className="h-3.5 w-3.5" />}
                                        Run analysis
                                    </button>
                                </Card>
                            ) : (
                                <>
                                    <Card className="overflow-hidden">
                                        <BlockHead
                                            icon={Target}
                                            title="Job match"
                                            sub="How well your resume fits"
                                            action={
                                                <button
                                                    type="button"
                                                    onClick={handleCheckCompatibility}
                                                    disabled={checkingComp}
                                                    className="btn-secondary h-7 !px-2.5 !text-[11px]"
                                                >
                                                    {checkingComp ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                                    Re-run
                                                </button>
                                            }
                                        />
                                        <div className="flex flex-col items-center px-4 py-6">
                                            <ScoreRing score={analysis.score} size={96} label="Match score" />
                                        </div>
                                    </Card>

                                    <Card
                                        className={cn(
                                            'overflow-hidden',
                                            (analysis.score ?? 100) < 60 && 'border-destructive/30'
                                        )}
                                    >
                                        <BlockHead
                                            icon={AlertTriangle}
                                            title="Missing keywords"
                                            sub="Terms in the posting your resume doesn't cover"
                                        />
                                        {analysis.missingKeywords?.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5 p-4">
                                                {analysis.missingKeywords.map((kw: string, i: number) => (
                                                    <span
                                                        key={i}
                                                        className={cn(
                                                            'rounded-md border px-2 py-0.5 text-[10.5px] font-medium',
                                                            (analysis.score ?? 100) < 60
                                                                ? 'border-destructive/25 bg-destructive/10 text-destructive'
                                                                : 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                                        )}
                                                    >
                                                        {kw}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="p-4 text-[11.5px] leading-relaxed text-muted-foreground">
                                                None — your resume covers the posting&apos;s keywords.
                                            </p>
                                        )}
                                    </Card>
                                </>
                            )}
                        </div>
                    )}

                    {/* COVER LETTER TAB */}
                    {activeTab === 'cover-letter' && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                            <Card className="overflow-hidden">
                                <BlockHead
                                    icon={Wand2}
                                    title="Cover letter"
                                    sub="Tailored to this job"
                                    action={
                                        <button
                                            type="button"
                                            onClick={handleGenerateCL}
                                            disabled={generatingCL}
                                            className="btn-primary h-7 !px-2.5 !text-[11px]"
                                        >
                                            {generatingCL ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                                            {aiCoverLetter ? 'Regenerate' : 'Generate'}
                                        </button>
                                    }
                                />
                                <div className="p-4">
                                    <Label htmlFor="cl-instructions">Instructions</Label>
                                    <textarea
                                        id="cl-instructions"
                                        value={clInstructions}
                                        onChange={e => setClInstructions(e.target.value)}
                                        className="input-field h-14 resize-none py-1.5 text-[11px]"
                                        placeholder="E.g. 'Emphasise my Python experience' or 'Keep it under 200 words'"
                                    />
                                </div>
                            </Card>

                            <Card className="overflow-hidden">
                                <BlockHead
                                    icon={FileText}
                                    title="Generated letter"
                                    action={
                                        <button
                                            type="button"
                                            onClick={() => navigator.clipboard.writeText(mCL)}
                                            className="btn-ghost"
                                            aria-label="Copy cover letter"
                                        >
                                            <Copy className="h-3 w-3" />
                                            Copy
                                        </button>
                                    }
                                />
                                <div className="p-3">
                                    <textarea
                                        value={mCL}
                                        readOnly
                                        className="h-[380px] w-full resize-none rounded-lg border border-border/60 bg-muted/30 p-3 text-[12px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60"
                                        placeholder="Generate a cover letter…"
                                    />
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* NOTES TAB */}
                    {activeTab === 'notes' && (
                        <div className="animate-in fade-in duration-200 pb-4">
                            <NoteEditor
                                content={notes}
                                onChangeContent={setNotes}
                                category={noteCategory}
                                onChangeCategory={setNoteCategory}
                                isPinned={noteIsPinned}
                                onChangePinned={setNoteIsPinned}
                                onSave={handleSave}
                                saving={saving}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
