import React, { useState, useEffect } from 'react'
import { APIClient, type Application } from '../../lib/api/api-client'
import { ArrowLeft, Building, Trash2, Save, CheckCircle2, Bot, Wand2, Target, Copy, RefreshCw } from 'lucide-react'

interface ApplicationDetailProps {
    application: Application
    onBack: () => void
    onUpdate: (app: Application) => void
    onDelete: (id: string) => void
}

type Tab = 'details' | 'questions' | 'compatibility'

export function ApplicationDetail({ application, onBack, onUpdate, onDelete }: ApplicationDetailProps) {
    const [activeTab, setActiveTab] = useState<Tab>('details')
    const [notes, setNotes] = useState(application.notes || '')
    const [status, setStatus] = useState<Application['status']>(application.status)
    const [saving, setSaving] = useState(false)

    // AI State
    const [questions, setQuestions] = useState<any[]>([])
    const [scanning, setScanning] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [compatibility, setCompatibility] = useState<any>(null)
    const [checkingComp, setCheckingComp] = useState(false)
    const [aiContext, setAiContext] = useState('')

    useEffect(() => {
        if (activeTab === 'questions') {
            loadQuestions()
        }
    }, [activeTab])

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
                notes
            })
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
        } catch (e) {
            console.error(e)
            alert("Failed to generate answers")
        } finally {
            setGenerating(false)
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

    const statuses = ['draft', 'submitted', 'in_review', 'interview', 'offer', 'rejected']

    return (
        <div className="flex flex-col h-full bg-background animate-in slide-in-from-right-4 duration-200">
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
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border bg-card/30">
                <button
                    onClick={() => setActiveTab('details')}
                    className={`flex-1 py-3 text-xs font-semibold text-center border-b-2 transition-colors ${activeTab === 'details' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    Details
                </button>
                <button
                    onClick={() => setActiveTab('questions')}
                    className={`flex-1 py-3 text-xs font-semibold text-center border-b-2 transition-colors ${activeTab === 'questions' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    AI Answers
                </button>
                <button
                    onClick={() => setActiveTab('compatibility')}
                    className={`flex-1 py-3 text-xs font-semibold text-center border-b-2 transition-colors ${activeTab === 'compatibility' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    Match %
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* DETAILS TAB */}
                {activeTab === 'details' && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        {/* Status */}
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground">Status</label>
                            <div className="grid grid-cols-3 gap-2">
                                {statuses.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setStatus(s as any)}
                                        className={`text-[10px] py-1.5 px-2 rounded border capitalize transition-all ${status === s
                                            ? 'border-primary bg-primary/10 text-primary font-semibold shadow-[0_0_10px_rgba(0,255,136,0.1)]'
                                            : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
                                            }`}
                                    >
                                        {s.replace('_', ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground">Notes</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="w-full h-40 p-3 text-sm bg-card border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none leading-relaxed"
                                placeholder="Add private notes about this application..."
                            />
                        </div>

                        {/* Save/Delete Actions */}
                        <div className="pt-4 flex gap-3">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 bg-primary text-background py-2 rounded-lg font-bold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                            >
                                {saving ? <CheckCircle2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save Changes
                            </button>
                            <button
                                onClick={handleDelete}
                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors border border-transparent hover:border-red-400/20"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
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
                            <label className="text-[10px] uppercase font-bold text-muted-foreground">AI Context / Instructions (Optional)</label>
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
                                    <div key={i} className="bg-card border border-border/50 rounded-lg p-3 space-y-2">
                                        <p className="text-xs font-medium">{q.question_text}</p>
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

                {/* COMPATIBILITY TAB */}
                {activeTab === 'compatibility' && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        {!compatibility ? (
                            <div className="flex flex-col items-center justify-center py-8 space-y-4">
                                <div className="p-4 bg-secondary/30 rounded-full">
                                    <Target className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <div className="text-center space-y-1">
                                    <p className="text-sm font-semibold">Check Compatibility</p>
                                    <p className="text-xs text-muted-foreground max-w-[200px]">
                                        Analyze your resume against this job description to get a match score.
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
            </div>
        </div>
    )
}
