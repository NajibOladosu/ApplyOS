"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import type { Application, Document, DocumentAnalysis } from "@/types/database"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { Badge } from "@/shared/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/select"
import {
    Loader2,
    Sparkles,
    AlertTriangle,
    CheckCircle,
    FileText,
    Target,
    XCircle,
    Lightbulb,
    ScanSearch,
    Edit,
    History,
    Wand2,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/shared/lib/utils"
import type { ResumeAnalysisResult } from "./resume-feedback"
import {
    resumeVersionsService,
    type ResumeVersion,
} from "@/lib/services/resume-versions"

const ResumeEditor = dynamic(
    () => import("./resume-editor").then((mod) => mod.ResumeEditor),
    { ssr: false },
)

interface JobFitTabProps {
    application: Application
    documents: Document[]
    analyses?: DocumentAnalysis[]
}

function formatVersionDate(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function requiresVersionMigration(error: unknown) {
    if (!error || typeof error !== "object") return false
    const candidate = error as { code?: string; message?: string }
    return candidate.code === "42703"
        || candidate.message?.includes("is_original") === true
        || candidate.message?.includes("version_number") === true
        || candidate.message?.includes("resume_version_id") === true
}

export function JobFitTab({ application, documents, analyses = [] }: JobFitTabProps) {
    const initialDocumentId = documents.some((doc) => doc.id === application.last_analyzed_document_id)
        ? application.last_analyzed_document_id
        : documents[0]?.id ?? null

    const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(initialDocumentId)
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
        application.last_analyzed_resume_version_id || null,
    )
    const [versionsByDocument, setVersionsByDocument] = useState<Record<string, ResumeVersion[]>>({})
    const [versionsLoading, setVersionsLoading] = useState(true)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [analysis, setAnalysis] = useState<ResumeAnalysisResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [viewMode, setViewMode] = useState<"job-fit" | "editor">("job-fit")
    const [applyOnEditorOpen, setApplyOnEditorOpen] = useState(false)
    const [analysisCache, setAnalysisCache] = useState<Record<string, ResumeAnalysisResult>>({})

    const selectedDocument = useMemo(
        () => documents.find((doc) => doc.id === selectedDocumentId),
        [documents, selectedDocumentId],
    )
    const selectedVersions = selectedDocumentId
        ? versionsByDocument[selectedDocumentId] ?? []
        : []
    const selectedVersion = selectedVersions.find((version) => version.id === selectedVersionId) ?? null

    useEffect(() => {
        const initialCache: Record<string, ResumeAnalysisResult> = {}
        analyses.forEach((item) => {
            if (item.resume_version_id && item.analysis_result && item.analysis_status === "success") {
                initialCache[item.resume_version_id] = item.analysis_result
            }
        })
        setAnalysisCache((previous) => ({ ...previous, ...initialCache }))
    }, [analyses])

    useEffect(() => {
        let cancelled = false

        const loadVersions = async () => {
            setVersionsLoading(true)
            try {
                const entries = await Promise.all(
                    documents.map(async (document) => {
                        let versions = await resumeVersionsService.getVersions(document.id)
                        if (versions.length === 0) {
                            const original = await resumeVersionsService.ensureOriginalVersion(document)
                            versions = [original]
                        }
                        versions.sort((a, b) => {
                            if (a.is_original !== b.is_original) return a.is_original ? -1 : 1
                            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                        })
                        return [document.id, versions] as const
                    }),
                )

                if (!cancelled) setVersionsByDocument(Object.fromEntries(entries))
            } catch (loadError) {
                console.error("Failed to load resume versions:", loadError)
                if (!cancelled) {
                    setError(
                        requiresVersionMigration(loadError)
                            ? "Job Fit needs the latest database migration before resume versions can be used."
                            : "Resume versions could not be loaded. Please refresh and try again.",
                    )
                }
            } finally {
                if (!cancelled) setVersionsLoading(false)
            }
        }

        void loadVersions()
        return () => { cancelled = true }
    }, [documents])

    useEffect(() => {
        if (documents.length === 0) {
            setSelectedDocumentId(null)
            setSelectedVersionId(null)
            return
        }
        if (!documents.some((doc) => doc.id === selectedDocumentId)) {
            setSelectedDocumentId(documents[0].id)
        }
    }, [documents, selectedDocumentId])

    useEffect(() => {
        if (versionsLoading || !selectedDocumentId) return
        const versions = versionsByDocument[selectedDocumentId] ?? []
        if (versions.length === 0) {
            setSelectedVersionId(null)
            return
        }
        if (!versions.some((version) => version.id === selectedVersionId)) {
            const preferred = versions.find(
                (version) => version.id === application.last_analyzed_resume_version_id,
            )
            setSelectedVersionId((preferred ?? versions[versions.length - 1]).id)
        }
    }, [
        application.last_analyzed_resume_version_id,
        selectedDocumentId,
        selectedVersionId,
        versionsByDocument,
        versionsLoading,
    ])

    useEffect(() => {
        setAnalysis(selectedVersionId ? analysisCache[selectedVersionId] ?? null : null)
        setError(null)
    }, [selectedVersionId, analysisCache])

    const selectDocument = (documentId: string) => {
        setSelectedDocumentId(documentId)
        const versions = versionsByDocument[documentId] ?? []
        setSelectedVersionId(versions.at(-1)?.id ?? null)
    }

    const handleAnalyze = async () => {
        if (!selectedDocumentId || !selectedVersionId) return
        if (!application.job_description?.trim()) {
            setError("Add a job description to this application before running Job Fit.")
            return
        }

        setIsAnalyzing(true)
        setError(null)

        try {
            const response = await fetch('/api/applications/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    applicationId: application.id,
                    documentId: selectedDocumentId,
                    resumeVersionId: selectedVersionId,
                }),
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(data.error || 'Failed to analyze resume')

            setAnalysis(data.analysis)
            setAnalysisCache((previous) => ({
                ...previous,
                [selectedVersionId]: data.analysis,
            }))
        } catch (analyzeError) {
            console.error('Job Fit error:', analyzeError)
            setError(
                analyzeError instanceof Error
                    ? analyzeError.message
                    : 'An unexpected error occurred during Job Fit analysis.',
            )
        } finally {
            setIsAnalyzing(false)
        }
    }

    const openEditor = (applyRecommendations: boolean) => {
        if (!selectedDocument || !selectedVersion) return
        setApplyOnEditorOpen(applyRecommendations)
        setViewMode("editor")
    }

    const handleVersionSaved = (version: ResumeVersion) => {
        setVersionsByDocument((previous) => ({
            ...previous,
            [version.document_id]: [
                ...(previous[version.document_id] ?? []).filter((item) => item.id !== version.id),
                version,
            ],
        }))
        setSelectedVersionId(version.id)
    }

    const getScoreBg = (score: number) => {
        if (score >= 80) return "bg-primary"
        if (score >= 60) return "bg-orange-500"
        return "bg-red-500"
    }

    const getScoreCardTextColor = (score: number) => score >= 60 ? "text-black" : "text-white"

    const renderMarkdown = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g)
        return parts.map((part, index) => part.startsWith('**') && part.endsWith('**')
            ? <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>
            : <span key={index}>{part}</span>,
        )
    }

    if (viewMode === "editor" && selectedDocument && selectedVersion) {
        return (
            <ResumeEditor
                documentUrl={selectedDocument.file_url}
                analysis={analysis}
                parsedData={selectedDocument.parsed_data}
                extractedText={selectedDocument.extracted_text}
                applicationId={application.id}
                documentId={selectedDocument.id}
                initialVersionId={selectedVersion.id}
                autoApplyRecommendations={applyOnEditorOpen}
                onVersionSaved={handleVersionSaved}
                onBack={() => {
                    setApplyOnEditorOpen(false)
                    setViewMode("job-fit")
                }}
                fileName={selectedDocument.file_name}
            />
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="font-display flex items-center gap-2 text-2xl font-bold tracking-tight">
                    <ScanSearch className="h-6 w-6 text-foreground dark:text-primary" />
                    Job Fit
                </h2>
                <p className="mt-1 text-muted-foreground">
                    Compare a specific resume version with this job description, then turn the findings into a stronger revision.
                </p>
            </div>

            <Card className="border-primary/20 bg-muted/10">
                <CardHeader className="pb-4">
                    <CardTitle className="text-base">Choose what to analyze</CardTitle>
                    <CardDescription>
                        Each saved edit is a separate version, so your previous resumes and results stay intact.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Resume</label>
                        {documents.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {documents.map((document) => (
                                    <button
                                        type="button"
                                        key={document.id}
                                        onClick={() => selectDocument(document.id)}
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:bg-muted",
                                            selectedDocumentId === document.id
                                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                                : "border-input",
                                        )}
                                    >
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
                                            <FileText className="h-4 w-4 text-primary" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">{document.file_name}</span>
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {((document.file_size || 0) / 1024).toFixed(0)} KB · {Math.max(1, (versionsByDocument[document.id] ?? []).length)} version{Math.max(1, (versionsByDocument[document.id] ?? []).length) === 1 ? "" : "s"}
                                            </span>
                                        </span>
                                        {selectedDocumentId === document.id ? (
                                            <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                                        ) : null}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-muted-foreground">
                                <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                                <p className="font-medium">No resumes attached to this application</p>
                                <p className="mt-1 text-sm">Attach a document from the application sidebar first.</p>
                            </div>
                        )}
                    </div>

                    {selectedDocument ? (
                        <div className="grid gap-4 border-t border-border/60 pt-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium">
                                    <History className="h-4 w-4 text-muted-foreground" />
                                    Resume version
                                </label>
                                <Select
                                    value={selectedVersionId ?? undefined}
                                    onValueChange={setSelectedVersionId}
                                    disabled={versionsLoading || selectedVersions.length === 0}
                                >
                                    <SelectTrigger className="w-full lg:max-w-md">
                                        <SelectValue placeholder={versionsLoading ? "Loading versions…" : "Choose a version"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {selectedVersions.map((version, index) => (
                                            <SelectItem key={version.id} value={version.id}>
                                                {version.version_name} · v{version.version_number ?? index + 1}{version.is_original ? " · Original" : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedVersion ? (
                                    <p className="text-xs text-muted-foreground">
                                        Saved {formatVersionDate(selectedVersion.created_at)}
                                        {selectedVersion.application_id === application.id ? " for this application" : ""}
                                    </p>
                                ) : null}
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                    variant="outline"
                                    onClick={() => openEditor(false)}
                                    disabled={!selectedVersion}
                                >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Resume
                                </Button>
                                <Button
                                    onClick={handleAnalyze}
                                    disabled={!selectedVersion || isAnalyzing || !application.job_description?.trim()}
                                    className="glow-effect min-w-36"
                                >
                                    {isAnalyzing ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing…</>
                                    ) : (
                                        <><Sparkles className="mr-2 h-4 w-4" />{analysis ? "Re-analyze" : "Analyze Fit"}</>
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : null}

                    {!application.job_description?.trim() ? (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            Add a job description to this application before running Job Fit.
                        </div>
                    ) : null}
                    {error ? (
                        <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            {error}
                        </div>
                    ) : null}
                </CardContent>
            </Card>

            <AnimatePresence mode="wait">
                {analysis && (
                    <motion.div
                        key={selectedVersionId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: isAnalyzing ? 0.55 : 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.35 }}
                        className="space-y-6"
                    >
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                            <Card className={cn("relative flex min-h-[280px] flex-col items-center justify-center overflow-hidden md:col-span-1", getScoreBg(analysis.score))}>
                                <CardContent className="flex flex-col items-center justify-center py-6">
                                    <p className={cn("mb-1 text-sm font-medium", getScoreCardTextColor(analysis.score))}>Match Score</p>
                                    <p className={cn("mb-4 text-xs opacity-70", getScoreCardTextColor(analysis.score))}>Compatibility with Job Description</p>
                                    <div className="relative flex h-32 w-32 items-center justify-center">
                                        <svg className="h-full w-full -rotate-90 text-white/30" viewBox="0 0 100 100">
                                            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" />
                                        </svg>
                                        <motion.svg
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: analysis.score / 100 }}
                                            transition={{ duration: 1.25, ease: "easeOut" }}
                                            className="absolute inset-0 h-full w-full -rotate-90 text-white"
                                            viewBox="0 0 100 100"
                                        >
                                            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="251.2" strokeLinecap="round" />
                                        </motion.svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className={cn("text-4xl font-bold", getScoreCardTextColor(analysis.score))}>{analysis.score}</span>
                                            <span className={cn("text-xs font-medium uppercase tracking-wider opacity-70", getScoreCardTextColor(analysis.score))}>/ 100</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className={cn("md:col-span-2", analysis.score < 60 ? "border-red-500/50" : analysis.score < 80 ? "border-orange-500/50" : "border-border")}>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5" />
                                        Critical ATS Missing Keywords
                                    </CardTitle>
                                    <CardDescription>Important language in the posting that is absent or under-emphasized in this version.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {analysis.missingKeywords.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {analysis.missingKeywords.map((keyword, index) => (
                                                <Badge key={index} variant="outline" className="border-red-500/40 bg-red-500/5 px-3 py-1 text-sm font-medium text-red-600 dark:text-red-400">
                                                    {keyword}
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-4 text-green-600 dark:text-green-400">
                                            <CheckCircle className="h-5 w-5" />
                                            <span className="font-medium">No critical keywords are missing.</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                        <Target className="h-5 w-5" />Strengths
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-3">
                                        {analysis.strengths.map((strength, index) => (
                                            <li key={index} className="flex items-start gap-2">
                                                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                                                <span className="text-sm">{renderMarkdown(strength)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                        <XCircle className="h-5 w-5" />Weaknesses & Gaps
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-3">
                                        {analysis.weaknesses.map((weakness, index) => (
                                            <li key={index} className="flex items-start gap-2">
                                                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                                                <span className="text-sm">{renderMarkdown(weakness)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="border-primary/20 bg-primary/5">
                            <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Lightbulb className="h-5 w-5 text-primary" />
                                        Actionable Recommendations
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        Apply these with AI, review every change, then name and save a new version.
                                    </CardDescription>
                                </div>
                                <Button
                                    onClick={() => openEditor(true)}
                                    disabled={!selectedVersion || analysis.recommendations.length === 0}
                                    className="shrink-0"
                                >
                                    <Wand2 className="mr-2 h-4 w-4" />
                                    Apply Recommendations
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {analysis.recommendations.map((recommendation, index) => (
                                        <div key={index} className="flex gap-4 rounded-lg border bg-background p-4 shadow-sm">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                                                <span className="text-sm font-bold text-primary">{index + 1}</span>
                                            </div>
                                            <p className="pt-1 text-sm">{renderMarkdown(recommendation)}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
