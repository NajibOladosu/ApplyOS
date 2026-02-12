import React, { useState, useEffect, useRef } from 'react'
import { APIClient, type Application } from '../../lib/api/api-client'
import { ArrowLeft, Building, Trash2, Save, CheckCircle2, Bot, Wand2, Target, Copy, RefreshCw, FileText, StickyNote, Loader2, ChevronDown, ExternalLink, Briefcase, MapPin, Calendar, Globe, CheckCircle, XCircle, AlertTriangle, Info, Plus, Minus, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react'
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
    { id: 'analysis', label: 'Analysis' },
    { id: 'cover-letter', label: 'Cover Letter' },
    { id: 'notes', label: 'Notes' }
]

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
    const [compatibility, setCompatibility] = useState<any>(null)
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
    const [analysis, setAnalysis] = useState<any>(null)
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
        } catch (e: any) {
            console.error(e)
            alert(`Failed to delete question: ${e.message}`)
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

    const getScoreColor = (score: number) => {
        if (score >= 80) return "text-green-600"
        if (score >= 60) return "text-orange-600"
        return "text-red-600"
    }

    const getScoreBg = (score: number) => {
        if (score >= 80) return "bg-primary"
        if (score >= 60) return "bg-orange-500"
        return "bg-red-500"
    }

    const getScoreCardTextColor = (score: number) => {
        if (score >= 80) return "text-green-600"
        if (score >= 60) return "text-orange-600"
        return "text-red-600"
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

    const statuses = ['draft', 'submitted', 'in_review', 'interview', 'offer', 'rejected']

    const renderTabButton = (id: Tab, label: string) => {
        const isActive = activeTab === id
        return (
            <button
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center py-2 px-1 rounded-md text-[10px] font-medium transition-all ${isActive
                    ? 'bg-primary text-black shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/20'
                    }`}
            >
                {label}
            </button>
        )
    }

    return (
        <div className="flex flex-col h-full bg-background animate-in slide-in-from-right-4 duration-200 w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 p-3 border-b border-border bg-card/50 sticky top-0 z-10 backdrop-blur-md">
                <button
                    onClick={onBack}
                    className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-sm truncate">{application.title}</h2>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Building className="w-3 h-3" />
                        <span className="truncate">{application.company || 'Unknown Company'}</span>
                    </div>
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={() => {
                            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
                            window.open(`${baseUrl}/applications/${application.id}`, '_blank')
                        }}
                        className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Open in ApplyOS"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
                        title="Save Changes"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={handleDelete}
                        className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Delete Application"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Pill Tabs */}
            <div className="p-3 bg-card/30">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setViewStart(Math.max(0, viewStart - 1))}
                        disabled={viewStart === 0}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none hover:bg-secondary transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="flex-1 flex p-1 bg-secondary rounded-lg gap-1 border border-border overflow-hidden">
                        {TABS.slice(viewStart, viewStart + 3).map(tab => renderTabButton(tab.id, tab.label))}
                    </div>

                    <button
                        onClick={() => setViewStart(Math.min(TABS.length - 3, viewStart + 1))}
                        disabled={viewStart >= TABS.length - 3}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none hover:bg-secondary transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-y-auto min-h-0">
                <div className="p-4 space-y-6">
                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            {/* Application Information Grid */}
                            <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1.5">Status</p>
                                    <div className="relative group/status">
                                        <select
                                            value={status}
                                            onChange={(e) => setStatus(e.target.value as any)}
                                            className="w-full text-xs font-medium bg-card border border-border rounded-md px-2 py-1.5 outline-none appearance-none cursor-pointer focus:border-primary transition-colors"
                                        >
                                            {statuses.map(s => (
                                                <option key={s} value={s}>{s.replace('_', ' ')}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                            <ChevronDown className="w-3 h-3" />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1.5">Created</p>
                                    <div className="h-[29px] flex items-center">
                                        <p className="text-xs font-semibold">{new Date(application.created_at || Date.now()).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                {application.url && (
                                    <div className="col-span-2">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1.5">Job URL</p>
                                        <a href={application.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary truncate block hover:underline font-medium">
                                            {application.url}
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Job Description */}
                            {application.job_description && (
                                <div className="space-y-2 border-t border-border pt-4">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Job Description</p>
                                    <div className="relative">
                                        <div
                                            className={`text-xs text-muted-foreground bg-card/40 p-3 rounded-lg border border-border leading-relaxed transition-all ${jobDescriptionExpanded ? "" : "line-clamp-[4]"
                                                }`}
                                        >
                                            {application.job_description}
                                        </div>
                                        {application.job_description.length > 200 && (
                                            <button
                                                onClick={() => setJobDescriptionExpanded(!jobDescriptionExpanded)}
                                                className="mt-1 text-[10px] text-primary hover:underline font-medium"
                                            >
                                                {jobDescriptionExpanded ? "Show Less" : "Show More"}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Attached Documents */}
                            <div className="space-y-2 border-t border-border pt-4">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Attached Documents</p>
                                {docsLoading ? (
                                    <div className="flex items-center gap-2 py-2">
                                        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                                        <span className="text-[10px] text-muted-foreground">Loading...</span>
                                    </div>
                                ) : userDocuments.length === 0 ? (
                                    <p className="text-[10px] text-muted-foreground/60 py-2">No documents uploaded yet. Upload in the main app.</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {userDocuments.map(doc => {
                                            const isSelected = selectedDocIds.includes(doc.id)
                                            return (
                                                <button
                                                    key={doc.id}
                                                    onClick={() => toggleDocumentSelection(doc.id)}
                                                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all text-left ${isSelected
                                                        ? 'border-primary bg-primary/5'
                                                        : 'border-border bg-card hover:border-primary/30'
                                                        }`}
                                                >
                                                    <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                                    <span className={`text-xs truncate flex-1 ${isSelected ? 'font-medium' : 'text-muted-foreground'}`}>
                                                        {doc.file_name}
                                                    </span>
                                                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-primary border-primary' : 'border-border'
                                                        }`}>
                                                        {isSelected && <CheckCircle2 className="w-2.5 h-2.5 text-black" />}
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* QUESTIONS TAB */}
                    {activeTab === 'questions' && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-bold flex items-center gap-2">
                                    <Bot className="w-4 h-4 text-primary" />
                                    Application Questions
                                </h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleScanQuestions}
                                        disabled={scanning}
                                        className="text-[10px] bg-secondary hover:bg-secondary/80 text-foreground px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors"
                                    >
                                        {scanning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Target className="w-3 h-3" />}
                                        Scan Page
                                    </button>
                                    <button
                                        onClick={handleGenerateAnswers}
                                        disabled={generating || questions.length === 0}
                                        className="text-[10px] bg-primary hover:bg-primary/90 text-background px-3 py-1.5 rounded-full flex items-center gap-1 font-semibold transition-colors disabled:opacity-50"
                                    >
                                        {generating ? <Wand2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                        Generate
                                    </button>
                                </div>
                            </div>

                            {/* Context Input */}
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground">Instructions</label>
                                <textarea
                                    value={aiContext}
                                    onChange={e => setAiContext(e.target.value)}
                                    className="w-full h-20 p-2 text-xs bg-card border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                                    placeholder="E.g., 'Focus on my leadership experience' or 'Keep answers concise under 100 words'"
                                />
                            </div>



                            {questions.length === 0 ? (
                                <div className="text-center py-10 bg-secondary/20 rounded-lg border border-dashed border-border">
                                    <p className="text-xs text-muted-foreground mb-2">No questions saved yet.</p>
                                    <p className="text-[10px] text-muted-foreground/60">Navigate to the application page and click "Scan".</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {questions.map((q, i) => (
                                        <div key={i} className="bg-card border border-border/50 rounded-lg p-3 space-y-2 relative group-card">
                                            <div className="flex justify-between items-start gap-2 mb-2">
                                                <p className="text-xs font-bold text-foreground">{q.question_text}</p>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => navigator.clipboard.writeText(q.ai_answer || '')}
                                                        className="p-1 text-muted-foreground hover:text-primary transition-colors"
                                                        title="Copy Answer"
                                                    >
                                                        <Copy className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteQuestion(q.id)}
                                                        className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
                                                        title="Delete Question"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>

                                            <textarea
                                                value={q.ai_answer || ''}
                                                readOnly
                                                className="w-full h-32 p-3 text-xs bg-card border border-border rounded-lg outline-none resize-none leading-relaxed"
                                                placeholder="Answer will be generated here..."
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Manual Question Entry */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newQuestion}
                                    onChange={e => setNewQuestion(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddQuestion()}
                                    placeholder="Add manual question (e.g. why us?)"
                                    className="flex-1 text-xs bg-card border border-border rounded-lg px-3 py-2 focus:border-primary outline-none"
                                />
                                <button
                                    onClick={handleAddQuestion}
                                    disabled={addingQuestion || !newQuestion.trim()}
                                    className="p-2 bg-primary text-black rounded-lg disabled:opacity-50"
                                >
                                    {addingQuestion ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ANALYSIS TAB */}
                    {activeTab === 'analysis' && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-bold flex items-center gap-2">
                                    <Target className="w-4 h-4 text-primary" />
                                    Job Analysis
                                </h3>
                                {(analysis || !loadingAnalysis) && (
                                    <button
                                        onClick={handleCheckCompatibility}
                                        disabled={checkingComp}
                                        className="text-[10px] bg-secondary hover:bg-secondary/80 text-foreground px-3 py-1 rounded-full flex items-center gap-1 font-medium transition-colors disabled:opacity-50"
                                    >
                                        {checkingComp ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                        Re-Analyze
                                    </button>
                                )}
                            </div>

                            {loadingAnalysis && !analysis ? (
                                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                                    <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                                    <p className="text-xs text-muted-foreground">Loading analysis...</p>
                                </div>
                            ) : !analysis ? (
                                <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
                                    <div className="p-4 bg-secondary/30 rounded-full">
                                        <Target className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                    <div className="text-center space-y-1">
                                        <p className="text-sm font-semibold">No Analysis Found</p>
                                        <p className="text-xs text-muted-foreground max-w-[200px]">
                                            Analyze your resume against this job description to get a match score and tips.
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleCheckCompatibility}
                                        disabled={checkingComp}
                                        className="bg-primary hover:bg-primary/90 text-background px-6 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2"
                                    >
                                        {checkingComp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                        Run Analysis
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Score Card */}
                                    <div className={`text-center p-6 border rounded-xl relative overflow-hidden ${getScoreBg(analysis.score)} bg-opacity-10 border-opacity-20`}>
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

                                        <div className="relative flex items-center justify-center h-24 w-24 mx-auto mb-2">
                                            <svg className="h-full w-full -rotate-90 text-muted-foreground/20" viewBox="0 0 100 100">
                                                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" />
                                            </svg>
                                            <svg className="h-full w-full -rotate-90 absolute inset-0" viewBox="0 0 100 100">
                                                <circle
                                                    cx="50" cy="50" r="40"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="8"
                                                    strokeDasharray="251.2"
                                                    strokeDashoffset={251.2 - (251.2 * analysis.score) / 100}
                                                    strokeLinecap="round"
                                                    className={`transition-all duration-1000 ease-out ${getScoreColor(analysis.score)}`}
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className={`text-2xl font-bold ${getScoreCardTextColor(analysis.score)}`}>
                                                    {analysis.score}
                                                </span>
                                                <span className={`text-[10px] font-medium uppercase tracking-wider opacity-70 ${getScoreCardTextColor(analysis.score)}`}>/ 100</span>
                                            </div>
                                        </div>
                                        <div className={`text-xs font-medium uppercase tracking-wider ${getScoreCardTextColor(analysis.score)}`}>Match Score</div>
                                    </div>

                                    {/* Missing Keywords */}
                                    <div className={`rounded-lg border p-4 ${analysis.score < 60 ? "border-red-500/30 bg-red-500/5" : "border-border bg-card"}`}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <AlertTriangle className={`h-4 w-4 ${analysis.score < 60 ? "text-red-500" : "text-orange-500"}`} />
                                            <h4 className={`text-xs font-bold uppercase ${analysis.score < 60 ? "text-red-500" : "text-foreground"}`}>Missing Keywords</h4>
                                        </div>
                                        {analysis.missingKeywords?.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5">
                                                {analysis.missingKeywords.map((kw: string, i: number) => (
                                                    <span key={i} className={`text-[10px] px-2 py-1 rounded-md border ${analysis.score < 60
                                                        ? "bg-red-500/10 text-red-500 border-red-500/20"
                                                        : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                                                        }`}>
                                                        {kw}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-muted-foreground italic">None! Great job coverage.</div>
                                        )}
                                    </div>


                                </div>
                            )}
                        </div>
                    )}

                    {/* COVER LETTER TAB */}
                    {activeTab === 'cover-letter' && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-bold flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-primary" />
                                    Cover Letter
                                </h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleGenerateCL}
                                        disabled={generatingCL}
                                        className="text-[10px] bg-primary hover:bg-primary/90 text-background px-4 py-1.5 rounded-full flex items-center gap-1 font-semibold transition-colors disabled:opacity-50"
                                    >
                                        {generatingCL ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                        {aiCoverLetter ? 'Regenerate' : 'Generate'}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1 mb-3">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground">Instructions</label>
                                <textarea
                                    value={clInstructions}
                                    onChange={e => setClInstructions(e.target.value)}
                                    className="w-full h-16 p-2 text-xs bg-card border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                                    placeholder="E.g. 'Emphasize my Python experience' or 'Keep it under 200 words'"
                                />
                            </div>

                            <div className="bg-card border border-border rounded-lg p-3 space-y-2 relative group-card">
                                <div className="flex justify-between items-start gap-2 mb-2">
                                    <p className="text-xs font-bold text-foreground">Generated Cover Letter</p>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => navigator.clipboard.writeText(mCL)}
                                            className="p-1 text-muted-foreground hover:text-primary transition-colors"
                                            title="Copy Cover Letter"
                                        >
                                            <Copy className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                                <textarea
                                    value={mCL}
                                    readOnly
                                    className="w-full h-[400px] p-4 text-sm bg-card border border-border rounded-lg outline-none resize-none leading-relaxed"
                                    placeholder="Generate a cover letter..."
                                />
                            </div>
                        </div>
                    )}

                    {/* NOTES TAB */}
                    {/* NOTES TAB */}
                    {activeTab === 'notes' && (
                        <div className="h-full animate-in fade-in duration-200 pb-4">
                            <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                                <StickyNote className="w-4 h-4 text-primary" />
                                Application Notes
                            </h3>
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
