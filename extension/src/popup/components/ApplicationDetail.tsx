import React, { useState, useEffect, useRef } from 'react'
import { APIClient, type Application } from '../../lib/api/api-client'
import { ArrowLeft, Building, Trash2, Save, CheckCircle2, Bot, Wand2, Target, Copy, RefreshCw, FileText, StickyNote, Loader2, ChevronDown } from 'lucide-react'

interface ApplicationDetailProps {
    application: Application
    onBack: () => void
    onUpdate: (app: Application) => void
    onDelete: (id: string) => void
}

type Tab = 'overview' | 'questions' | 'analysis' | 'cover-letter' | 'documents' | 'notes'

export function ApplicationDetail({ application, onBack, onUpdate, onDelete }: ApplicationDetailProps) {
    const [activeTab, setActiveTab] = useState<Tab>('overview')
    const [notes, setNotes] = useState(application.notes || '')
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
    const [mCL, setMCL] = useState(application.manual_cover_letter || '')

    // Document state
    const [userDocuments, setUserDocuments] = useState<any[]>([])
    const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
    const [docsLoading, setDocsLoading] = useState(false)

    useEffect(() => {
        if (activeTab === 'questions') {
            loadQuestions()
        } else if (activeTab === 'documents') {
            loadDocuments()
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
            const updated = await APIClient.updateApplication(application.id, {
                status,
                notes,
                manual_cover_letter: mCL
            } as any)
            onUpdate(updated as Application)
        } catch (e: any) {
            console.error('Update failed:', e)
            alert(`Failed to update: ${e.message || JSON.stringify(e)}`)
        } finally {
            setSaving(false)
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
        setCheckingComp(true)
        try {
            const result = await APIClient.checkCompatibility(application.job_description || '')
            setCompatibility(result)
        } catch (e) {
            console.error(e)
            alert("Analysis failed. Ensure you have an uploaded resume.")
        } finally {
            setCheckingComp(false)
        }
    }

    const handleGenerateCL = async () => {
        setGeneratingCL(true)
        try {
            const result = await APIClient.generateCoverLetter(application.id!)
            if (result.coverLetter) {
                setAiCoverLetter(result.coverLetter)
                // Also update local application state if needed, but the next getApplication will handle it.
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
                <div className="flex p-1 bg-secondary rounded-lg gap-1 border border-border overflow-x-auto no-scrollbar">
                    {renderTabButton('overview', 'Overview')}
                    {renderTabButton('questions', 'Questions')}
                    {renderTabButton('analysis', 'Analysis')}
                    {renderTabButton('cover-letter', 'Cover Letter')}
                    {renderTabButton('documents', 'Documents')}
                    {renderTabButton('notes', 'Notes')}
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
                                <label className="text-[10px] uppercase font-bold text-muted-foreground">AI Context / Instructions (Optional)</label>
                                <textarea
                                    value={aiContext}
                                    onChange={e => setAiContext(e.target.value)}
                                    className="w-full h-20 p-2 text-xs bg-card border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                                    placeholder="E.g., 'Focus on my leadership experience' or 'Keep answers concise under 100 words'"
                                />
                            </div>

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

                            {questions.length === 0 ? (
                                <div className="text-center py-10 bg-secondary/20 rounded-lg border border-dashed border-border">
                                    <p className="text-xs text-muted-foreground mb-2">No questions saved yet.</p>
                                    <p className="text-[10px] text-muted-foreground/60">Navigate to the application page and click "Scan".</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {questions.map((q, i) => (
                                        <div key={i} className="bg-card border border-border/50 rounded-lg p-3 space-y-2 relative group-card">
                                            <div className="flex justify-between items-start gap-2">
                                                <p className="text-xs font-medium pr-6">{q.question_text}</p>
                                                <button
                                                    onClick={() => handleDeleteQuestion(q.id)}
                                                    className="p-1 text-muted-foreground hover:text-red-400 opacity-0 group-card:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                            {q.ai_answer ? (
                                                <div className="bg-secondary/30 p-2 rounded text-xs text-muted-foreground relative group">
                                                    {q.ai_answer}
                                                    <button
                                                        onClick={() => navigator.clipboard.writeText(q.ai_answer)}
                                                        className="absolute top-2 right-2 p-1 rounded hover:bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Copy className="w-3 h-3 text-primary" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="text-[10px] italic text-muted-foreground/50">
                                                    Answer not generated yet...
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ANALYSIS TAB */}
                    {activeTab === 'analysis' && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            {!compatibility ? (
                                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                                    <div className="p-4 bg-secondary/30 rounded-full">
                                        <Target className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                    <div className="text-center space-y-1">
                                        <p className="text-sm font-semibold">Job Analysis</p>
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
                                    {/* Score */}
                                    <div className="text-center p-6 bg-card border border-border rounded-xl relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                                        <div className="text-4xl font-black text-primary mb-1">{compatibility.score}%</div>
                                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Match Score</div>
                                    </div>

                                    {/* Summary */}
                                    <div className="bg-secondary/20 p-3 rounded-lg border border-border/50">
                                        <p className="text-xs text-muted-foreground italic leading-relaxed">
                                            "{compatibility.summary}"
                                        </p>
                                    </div>

                                    {/* Tips */}
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold uppercase text-muted-foreground">Improvement Tips</h4>
                                        <ul className="space-y-2">
                                            {compatibility.tips?.map((tip: string, i: number) => (
                                                <li key={i} className="text-xs flex gap-2 items-start bg-card p-2 rounded border border-border/50">
                                                    <span className="text-primary font-bold">•</span>
                                                    <span className="text-muted-foreground">{tip}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Keywords */}
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold uppercase text-muted-foreground">Missing Keywords</h4>
                                        <div className="flex flex-wrap gap-1.5">
                                            {compatibility.missingKeywords?.map((kw: string, i: number) => (
                                                <span key={i} className="text-[10px] px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md">
                                                    {kw}
                                                </span>
                                            ))}
                                        </div>
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
                                <button
                                    onClick={handleGenerateCL}
                                    disabled={generatingCL}
                                    className="text-[10px] bg-primary hover:bg-primary/90 text-background px-4 py-1.5 rounded-full flex items-center gap-1 font-semibold transition-colors disabled:opacity-50"
                                >
                                    {generatingCL ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                    {aiCoverLetter ? 'Regenerate' : 'Generate'}
                                </button>
                            </div>

                            {aiCoverLetter && (
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase font-bold text-muted-foreground flex justify-between">
                                        AI Version
                                        <button
                                            onClick={() => {
                                                setMCL(aiCoverLetter)
                                                // We'll also need to update the application record eventually or just on manual save
                                            }}
                                            className="text-primary hover:underline lowercase font-normal"
                                        >
                                            Copy to manual
                                        </button>
                                    </label>
                                    <div className="bg-secondary/30 p-3 rounded-lg text-xs text-muted-foreground relative group max-h-48 overflow-y-auto border border-border/50 leading-relaxed">
                                        {aiCoverLetter}
                                        <button
                                            onClick={() => navigator.clipboard.writeText(aiCoverLetter)}
                                            className="absolute top-2 right-2 p-1 rounded bg-background/50 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Copy className="w-3 h-3 text-primary" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground">Your Version</label>
                                <textarea
                                    value={mCL}
                                    onChange={e => setMCL(e.target.value)}
                                    className="w-full h-64 p-3 text-sm bg-card border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none leading-relaxed"
                                    placeholder="Edit your cover letter here..."
                                />
                            </div>
                        </div>
                    )}

                    {/* DOCUMENTS TAB */}
                    {activeTab === 'documents' && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <FileText className="w-4 h-4 text-primary" />
                                Application Documents
                            </h3>

                            {docsLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                    <p className="text-xs text-muted-foreground">Loading documents...</p>
                                </div>
                            ) : userDocuments.length === 0 ? (
                                <div className="text-center py-10 bg-secondary/20 rounded-lg border border-dashed border-border">
                                    <p className="text-xs text-muted-foreground mb-2">No documents found.</p>
                                    <p className="text-[10px] text-muted-foreground/60">Upload resumes or cover letters in the main app.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-3">Attach to this application</p>
                                    <div className="space-y-2">
                                        {userDocuments.map(doc => {
                                            const isSelected = selectedDocIds.includes(doc.id)
                                            return (
                                                <button
                                                    key={doc.id}
                                                    onClick={() => toggleDocumentSelection(doc.id)}
                                                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left group ${isSelected
                                                        ? 'border-primary bg-primary/5'
                                                        : 'border-border bg-card hover:border-primary/30'
                                                        }`}
                                                >
                                                    <div className={`p-2 rounded-md transition-colors ${isSelected ? 'bg-primary text-black' : 'bg-secondary text-muted-foreground group-hover:text-foreground'
                                                        }`}>
                                                        <FileText className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-xs font-medium truncate ${isSelected ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
                                                            {doc.file_name}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground/60">
                                                            {new Date(doc.created_at).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary' : 'border-border'
                                                        }`}>
                                                        {isSelected && <CheckCircle2 className="w-3 h-3 text-black" />}
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* NOTES TAB */}
                    {activeTab === 'notes' && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <StickyNote className="w-4 h-4 text-primary" />
                                Application Notes
                            </h3>
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground">Private Notes</label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    className="w-full h-[350px] p-3 text-sm bg-card border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none leading-relaxed"
                                    placeholder="Add private notes about this application, interview dates, contact info, etc."
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
