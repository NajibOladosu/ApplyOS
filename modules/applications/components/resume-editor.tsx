"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useEditor } from "@tiptap/react"
import type { JSONContent } from "@tiptap/react"
import { Button } from "@/shared/ui/button"
import {
    ArrowLeft,
    Download,
    Save,
    History,
    Loader2,
    Sparkles,
    Wand2,
    Trash2,
    ChevronDown,
    FileText,
    FileType2,
    BookOpenCheck,
    ShieldCheck,
} from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/select"
import { useToast } from "@/shared/ui/use-toast"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/dialog"
import { type ResumeAnalysisResult } from "./resume-feedback"
import type { ParsedDocument } from "@/shared/infrastructure/ai"
import {
    resumeVersionsService,
    sourceFormatFromFileName,
    type ResumeVersion,
} from "@/lib/services/resume-versions"
import { buildExtensions } from "./editor/extensions"
import { blocksToTipTap, emptyDoc } from "./editor/blocks-to-tiptap"
import { renderTemplate } from "./editor/templates/registry"
import type { TemplateId, EditorBlock, ResumeDoc, DocSettings } from "./editor/types"
import { DEFAULT_DOC_SETTINGS } from "./editor/types"
import { EditorToolbar } from "./editor/toolbar"
import { DiffModal } from "./editor/diff-modal"
import type { ResumeTailoringReport, TailoringMode } from "@/lib/resume-tailoring/types"

// Re-export legacy types so existing imports keep working until callers migrate.
export type { EditorBlock, BlockType, BlockStyles } from "./editor/types"

const plainTextToTipTap = (text: string | null): ResumeDoc => {
    if (!text?.trim()) return emptyDoc()
    return {
        type: 'doc',
        content: text
            .split(/\n+/)
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => ({
                type: 'paragraph',
                content: [{ type: 'text', text: line }],
            })),
    }
}

interface ResumeEditorProps {
    documentUrl: string
    analysis: ResumeAnalysisResult | null
    parsedData: ParsedDocument | null
    extractedText: string | null
    applicationId: string
    documentId: string
    initialVersionId?: string | null
    autoApplyRecommendations?: boolean
    onVersionSaved?: (version: ResumeVersion) => void
    onBack: () => void
    fileName: string
}

export function ResumeEditor({
    analysis,
    extractedText,
    applicationId,
    documentId,
    initialVersionId = null,
    autoApplyRecommendations = false,
    onVersionSaved,
    onBack,
    fileName,
}: ResumeEditorProps) {
    const { toast } = useToast()
    const [versions, setVersions] = useState<ResumeVersion[]>([])
    const [currentVersionId, setCurrentVersionId] = useState<string | null>(null)
    const [templateId, setTemplateId] = useState<TemplateId>('modern')
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const [isRewriting, setIsRewriting] = useState(false)
    const [diffOpen, setDiffOpen] = useState(false)
    const [diffOriginal, setDiffOriginal] = useState<ResumeDoc | null>(null)
    const [diffProposed, setDiffProposed] = useState<ResumeDoc | null>(null)
    const [diffLoading, setDiffLoading] = useState(false)
    const [tailoringDialogOpen, setTailoringDialogOpen] = useState(false)
    const [tailoringReport, setTailoringReport] = useState<ResumeTailoringReport | null>(null)
    const [suggestedDocSettings, setSuggestedDocSettings] = useState<Partial<DocSettings> | null>(null)
    const [selectionEmpty, setSelectionEmpty] = useState(true)
    const [docSettings, setDocSettings] = useState<DocSettings>(DEFAULT_DOC_SETTINGS)
    const [isDirty, setIsDirty] = useState(false)
    const [saveDialogOpen, setSaveDialogOpen] = useState(false)
    const [versionName, setVersionName] = useState("")
    const suppressDirtyRef = useRef(false)
    const autoApplyStartedRef = useRef(false)

    const sourceFormat = useMemo(() => sourceFormatFromFileName(fileName), [fileName])
    const nextVersionNumber = useMemo(
        () => versions.reduce(
            (highest, version, index) => Math.max(highest, version.version_number ?? index + 1),
            0,
        ) + 1,
        [versions],
    )

    const settingsStorageKey = useMemo(
        () => `resume-doc-settings:${documentId}:${applicationId}`,
        [documentId, applicationId],
    )

    useEffect(() => {
        if (typeof window === 'undefined') return
        try {
            const raw = window.localStorage.getItem(settingsStorageKey)
            if (raw) {
                const parsed = JSON.parse(raw) as Partial<DocSettings>
                setDocSettings({
                    marginTopMm: parsed.marginTopMm ?? DEFAULT_DOC_SETTINGS.marginTopMm,
                    marginRightMm: parsed.marginRightMm ?? DEFAULT_DOC_SETTINGS.marginRightMm,
                    marginBottomMm: parsed.marginBottomMm ?? DEFAULT_DOC_SETTINGS.marginBottomMm,
                    marginLeftMm: parsed.marginLeftMm ?? DEFAULT_DOC_SETTINGS.marginLeftMm,
                })
            }
        } catch {
            // ignore corrupt storage
        }
    }, [settingsStorageKey])

    const updateDocSettings = useCallback((next: Partial<DocSettings>) => {
        setDocSettings(prev => {
            const merged = { ...prev, ...next }
            if (typeof window !== 'undefined') {
                try {
                    window.localStorage.setItem(settingsStorageKey, JSON.stringify(merged))
                } catch {
                    // ignore quota errors
                }
            }
            return merged
        })
    }, [settingsStorageKey])

    const editor = useEditor({
        extensions: buildExtensions(),
        content: emptyDoc(),
        immediatelyRender: false,
        editorProps: {
            attributes: {
                spellcheck: 'true',
                class: 'focus:outline-none',
            },
        },
    })

    useEffect(() => {
        if (!editor) return
        const updateHandler = () => {
            if (!suppressDirtyRef.current) setIsDirty(true)
        }
        const selectionHandler = () => {
            setSelectionEmpty(editor.state.selection.empty)
        }
        editor.on('update', updateHandler)
        editor.on('selectionUpdate', selectionHandler)
        editor.on('transaction', selectionHandler)
        return () => {
            editor.off('update', updateHandler)
            editor.off('selectionUpdate', selectionHandler)
            editor.off('transaction', selectionHandler)
        }
    }, [editor])

    useEffect(() => {
        const load = async () => {
            try {
                let fetched = await resumeVersionsService.getVersions(documentId)
                if (fetched.length === 0) {
                    const original = await resumeVersionsService.ensureOriginalVersion({
                        id: documentId,
                        file_name: fileName,
                    })
                    fetched = [original]
                }
                fetched.sort((a, b) => {
                    if (a.is_original !== b.is_original) return a.is_original ? -1 : 1
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                })
                setVersions(fetched)

                const target = fetched.find((version) => version.id === initialVersionId)
                    ?? fetched[fetched.length - 1]
                let initialDoc: ResumeDoc = emptyDoc()
                let initialTemplate: TemplateId = target?.template_id ?? 'modern'

                const docFromVersion = (version: ResumeVersion): ResumeDoc | null => {
                    if (version.content_json) return version.content_json as ResumeDoc
                    if (version.blocks && version.blocks.length > 0) {
                        return blocksToTipTap(version.blocks as EditorBlock[])
                    }
                    return null
                }

                const storedDoc = target ? docFromVersion(target) : null
                if (storedDoc) {
                    initialDoc = storedDoc
                } else {
                    if (sourceFormat === 'pdf') {
                        try {
                            const layoutRes = await fetch('/api/editor/detect-layout', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ documentId }),
                            })
                            if (layoutRes.ok) {
                                const { layout } = await layoutRes.json()
                                if (layout?.suggestedTemplate) initialTemplate = layout.suggestedTemplate
                            }
                        } catch (err) {
                            console.warn("Layout detection failed:", err)
                        }
                    }

                    if (sourceFormat === 'docx') {
                        try {
                            const res = await fetch('/api/editor/import-docx', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ documentId }),
                            })
                            if (res.ok) {
                                const data = await res.json()
                                if (data.contentJson) initialDoc = data.contentJson as ResumeDoc
                            }
                        } catch (err) {
                            console.warn("DOCX import error, falling back to extracted text:", err)
                        }
                    }

                    const stillEmpty = !initialDoc.content || initialDoc.content.length === 0
                        || (initialDoc.content.length === 1 && !initialDoc.content[0].content)
                    if (stillEmpty && extractedText && extractedText.trim().length > 50) {
                        try {
                            const res = await fetch('/api/editor/parse-text', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ extractedText }),
                            })
                            if (res.ok) {
                                const data = await res.json()
                                if (Array.isArray(data.blocks) && data.blocks.length > 0) {
                                    initialDoc = blocksToTipTap(data.blocks as EditorBlock[])
                                }
                            }
                        } catch (err) {
                            console.warn("AI parse failed:", err)
                        }
                    }

                    const contentStillEmpty = !initialDoc.content || initialDoc.content.length === 0
                        || (initialDoc.content.length === 1 && !initialDoc.content[0].content)
                    if (contentStillEmpty) initialDoc = plainTextToTipTap(extractedText)
                }

                if (target?.is_original && !target.content_json) {
                    // Hydrate version 1 in memory for instant switching. The database
                    // continues to point at the immutable uploaded source.
                    setVersions(fetched.map((version) =>
                        version.id === target.id ? { ...version, content_json: initialDoc } : version,
                    ))
                }

                suppressDirtyRef.current = true
                editor?.commands.setContent(initialDoc)
                setTemplateId(initialTemplate)
                setCurrentVersionId(target?.id ?? null)
                setIsDirty(false)
                queueMicrotask(() => { suppressDirtyRef.current = false })
            } catch (err) {
                console.error("Editor load failed:", err)
                toast({ title: "Failed to load resume", variant: "destructive" })
            } finally {
                setIsLoading(false)
            }
        }
        if (editor) void load()
        // The editor instance and selected version define a fresh editor session.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor, documentId, initialVersionId])

    const openSaveDialog = () => {
        setVersionName(`Version ${nextVersionNumber}`)
        setSaveDialogOpen(true)
    }

    const handleNewVersion = async () => {
        if (!editor || !versionName.trim()) return
        setIsSaving(true)
        try {
            const created = await resumeVersionsService.createVersion({
                document_id: documentId,
                application_id: applicationId,
                version_name: versionName.trim(),
                content_json: editor.getJSON(),
                template_id: templateId,
                source_format: sourceFormat,
                is_original: false,
                parent_document_id: documentId,
            })
            setVersions((previous) => [...previous, created])
            setCurrentVersionId(created.id)
            setIsDirty(false)
            setSaveDialogOpen(false)
            onVersionSaved?.(created)
            toast({
                title: "Version saved",
                description: `Saved as “${created.version_name}”.`,
            })
        } catch (err) {
            console.error("Capture failed:", err)
            toast({
                title: "Failed to save version",
                description: err instanceof Error ? err.message : "Unknown error",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteVersion = async (id: string) => {
        const v = versions.find(x => x.id === id)
        if (!v || v.is_original) return
        const confirmed = window.confirm(`Delete "${v.version_name}"? This cannot be undone.`)
        if (!confirmed) return
        try {
            await resumeVersionsService.deleteVersion(id)
            const remaining = versions.filter(x => x.id !== id)
            setVersions(remaining)
            if (currentVersionId === id) {
                if (remaining.length > 0 && editor) {
                    const next = remaining[remaining.length - 1]
                    const doc = (next.content_json as ResumeDoc | null) ??
                        (next.blocks ? blocksToTipTap(next.blocks as EditorBlock[]) : emptyDoc())
                    suppressDirtyRef.current = true
                    editor.commands.setContent(doc)
                    setCurrentVersionId(next.id)
                    setIsDirty(false)
                    queueMicrotask(() => { suppressDirtyRef.current = false })
                    if (next.template_id) setTemplateId(next.template_id)
                } else {
                    setCurrentVersionId(null)
                    if (editor) editor.commands.setContent(emptyDoc())
                }
            }
            toast({ title: "Version deleted" })
        } catch (err) {
            console.error("Delete version failed:", err)
            toast({
                title: "Failed to delete version",
                description: err instanceof Error ? err.message : "Unknown error",
                variant: "destructive",
            })
        }
    }

    const handleBack = () => {
        if (isDirty && !window.confirm("Leave the editor without saving this new version?")) return
        onBack()
    }

    const handleSwitchVersion = (id: string) => {
        if (!editor || id === currentVersionId) return
        if (isDirty && !window.confirm("Discard unsaved changes and switch versions?")) return
        const version = versions.find((item) => item.id === id)
        if (!version) return
        const doc = (version.content_json as ResumeDoc | null)
            ?? (version.blocks ? blocksToTipTap(version.blocks as EditorBlock[]) : null)
            ?? (version.is_original ? plainTextToTipTap(extractedText) : emptyDoc())
        suppressDirtyRef.current = true
        editor.commands.setContent(doc)
        setCurrentVersionId(id)
        setIsDirty(false)
        queueMicrotask(() => { suppressDirtyRef.current = false })
        if (version.template_id) setTemplateId(version.template_id)
    }

    const handleTemplateChange = useCallback((id: TemplateId) => {
        setTemplateId(id)
        setIsDirty(true)
    }, [])

    const handleAIRewriteSelection = async () => {
        if (!editor) return
        const { from, to, empty } = editor.state.selection
        if (empty) {
            toast({ title: "Select some text first", variant: "destructive" })
            return
        }
        const selectedText = editor.state.doc.textBetween(from, to, '\n')
        if (!selectedText.trim()) return

        setIsRewriting(true)
        try {
            const res = await fetch('/api/editor/ai-rewrite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: selectedText,
                    type: 'paragraph',
                    analysisFeedback: analysis?.recommendations?.join("\n") || "",
                }),
            })
            const data = await res.json()
            if (data.rewritten) {
                editor.chain().focus().insertContentAt({ from, to }, data.rewritten).run()
                toast({ title: "Rewritten" })
            }
        } catch {
            toast({ title: "AI rewrite failed", variant: "destructive" })
        } finally {
            setIsRewriting(false)
        }
    }

    const handleApplyRecommendations = () => {
        if (!editor || !analysis?.recommendations?.length) {
            toast({ title: "No recommendations to apply", variant: "destructive" })
            return
        }
        setTailoringDialogOpen(true)
    }

    const generateTailoredResume = async (mode: TailoringMode) => {
        if (!editor || !analysis?.recommendations?.length) return

        const original = editor.getJSON()
        setTailoringDialogOpen(false)
        setTailoringReport(null)
        setSuggestedDocSettings(null)
        setDiffOriginal(original)
        setDiffProposed(null)
        setDiffOpen(true)
        setDiffLoading(true)

        try {
            const res = await fetch('/api/editor/apply-recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    applicationId,
                    documentId,
                    resumeVersionId: currentVersionId,
                    contentJson: original,
                    recommendations: analysis.recommendations,
                    mode,
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || "Tailored resume generation failed")
            if (!data.contentJson || !data.report) throw new Error("AI returned no validated resume")

            setDiffProposed(data.contentJson as ResumeDoc)
            setTailoringReport(data.report as ResumeTailoringReport)
            setSuggestedDocSettings(data.suggestedDocSettings ?? null)
        } catch (err) {
            setDiffOpen(false)
            toast({
                title: "Failed to generate tailored resume",
                description: err instanceof Error ? err.message : String(err),
                variant: "destructive",
            })
        } finally {
            setDiffLoading(false)
        }
    }

    const acceptDiff = (mergedDoc: ResumeDoc) => {
        if (!editor) return
        editor.commands.setContent(mergedDoc as unknown as JSONContent)
        if (tailoringReport) {
            setTemplateId('ats')
            updateDocSettings(suggestedDocSettings ?? {
                marginTopMm: 12,
                marginRightMm: 14,
                marginBottomMm: 12,
                marginLeftMm: 14,
            })
        }
        setIsDirty(true)
        setDiffOpen(false)
        setDiffProposed(null)
        setDiffOriginal(null)
        toast({
            title: "Tailored resume ready",
            description: "Applied the validated edits and ATS one-page layout. Review it, then save a named version.",
        })
    }

    useEffect(() => {
        if (
            autoApplyRecommendations
            && !isLoading
            && editor
            && analysis?.recommendations?.length
            && !autoApplyStartedRef.current
        ) {
            autoApplyStartedRef.current = true
            void handleApplyRecommendations()
        }
        // Run once after the selected version has loaded into the editor.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoApplyRecommendations, isLoading, editor, analysis])

    const handleExport = async (format: 'pdf' | 'docx') => {
        if (!editor) return
        setIsExporting(true)
        try {
            const endpoint = format === 'docx'
                ? '/api/editor/export-docx'
                : '/api/editor/export-pdf'

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contentJson: editor.getJSON(),
                    templateId,
                    fileName,
                    docSettings,
                    fitToOnePage: format === 'pdf' && templateId === 'ats',
                }),
            })

            if (!res.ok) {
                let errMsg = `Export failed: ${res.status}`
                try {
                    const errBody = await res.json()
                    if (errBody?.error) errMsg = errBody.error
                } catch {
                    // ignore non-JSON body
                }
                throw new Error(errMsg)
            }

            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            const baseName = fileName.replace(/\.(pdf|docx?|txt|json)$/i, "")
            a.href = url
            a.download = `${baseName}_edited.${format}`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            const pageCount = Number(res.headers.get('X-Resume-Page-Count') || 0)
            const verified = res.headers.get('X-Resume-Layout-Verified') === 'true'
            toast({
                title: `Exported as ${format.toUpperCase()}`,
                description: format === 'pdf' && pageCount > 0
                    ? verified
                        ? `Layout verified at ${pageCount} page${pageCount === 1 ? '' : 's'}.`
                        : `Exported at ${pageCount} pages. Consider shortening lower-priority content.`
                    : undefined,
            })
        } catch (err) {
            console.error("Export error:", err)
            toast({
                title: "Export failed",
                description: err instanceof Error ? err.message : String(err),
                variant: "destructive",
            })
        } finally {
            setIsExporting(false)
        }
    }

    if (isLoading || !editor) {
        return (
            <div className="flex h-[calc(100vh-200px)] items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground animate-pulse font-medium">Loading editor…</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] bg-white dark:bg-background rounded-lg border border-border overflow-hidden">
            <div className="border-b border-border bg-white dark:bg-card z-20 sticky top-0">
                <div className="flex items-center flex-wrap gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-4 min-h-16 sm:min-h-[68px]">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleBack}
                        className="font-medium text-muted-foreground hover:text-primary hover:bg-muted px-2 sm:px-3"
                    >
                        <ArrowLeft className="h-4 w-4 lg:mr-2" /> <span className="hidden lg:inline">Back</span>
                    </Button>
                    <div className="hidden sm:block h-6 w-px bg-border" />
                    <div className="flex items-center gap-2">
                        <History className="hidden sm:block h-4 w-4 text-muted-foreground shrink-0" />
                        <Select
                            value={currentVersionId ?? undefined}
                            onValueChange={handleSwitchVersion}
                        >
                            <SelectTrigger className="w-[120px] sm:w-[180px] h-9 font-medium bg-muted/40 border-border text-foreground hover:border-primary">
                                <SelectValue placeholder="Select version" />
                            </SelectTrigger>
                            <SelectContent>
                                {versions.length === 0 ? (
                                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No saved versions yet</div>
                                ) : versions.map(v => (
                                    <div key={v.id} className="flex items-center pr-1 group">
                                        <SelectItem value={v.id} className="flex-1">
                                            {v.version_name}{v.is_original ? " · Original" : ""}
                                        </SelectItem>
                                        {!v.is_original ? (
                                            <button
                                                type="button"
                                                onPointerDown={(e) => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    handleDeleteVersion(v.id)
                                                }}
                                                className="opacity-60 hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                                title={`Delete ${v.version_name}`}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        ) : null}
                                    </div>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={openSaveDialog}
                            disabled={isSaving}
                            className="h-9 px-2 sm:px-3 border-dashed font-medium bg-muted/40 border-primary/30 text-foreground hover:bg-muted hover:border-primary"
                        >
                            {isSaving ? <Loader2 className="h-3 w-3 lg:mr-2 animate-spin" /> : <Save className="h-3 w-3 lg:mr-2" />}
                            <span className="hidden lg:inline">Save Version</span>
                        </Button>
                    </div>

                    <div className="ml-auto flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleAIRewriteSelection}
                            disabled={isRewriting || selectionEmpty}
                            className="h-9 px-2 sm:px-3 font-medium bg-muted/40 border-primary/40 text-foreground hover:bg-primary/10 hover:border-primary hover:text-primary disabled:opacity-50"
                            title={selectionEmpty ? "Select text in the editor to rewrite" : "Rewrite selected text with AI"}
                        >
                            <Sparkles className="h-3.5 w-3.5 lg:mr-1.5" /> <span className="hidden lg:inline">Ask AI</span>
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleApplyRecommendations}
                            disabled={!analysis?.recommendations?.length || isRewriting}
                            className="h-9 px-2 sm:px-3 font-medium bg-muted/40 border-primary/40 text-foreground hover:bg-primary/10 hover:border-primary hover:text-primary disabled:opacity-50"
                            title={analysis?.recommendations?.length ? "Rewrite resume to address analysis recommendations" : "Run analysis first to enable bulk apply"}
                        >
                            <Wand2 className="h-3.5 w-3.5 xl:mr-1.5" />
                            <span className="hidden xl:inline">Apply Recommendations</span>
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    disabled={isExporting}
                                    className="glow-effect font-semibold h-9 px-3 sm:px-4 bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                    {isExporting ? (
                                        <Loader2 className="h-4 w-4 animate-spin lg:mr-2" />
                                    ) : (
                                        <Download className="h-4 w-4 lg:mr-2" />
                                    )}
                                    <span className="hidden lg:inline">Download</span>
                                    <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-80" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => handleExport('pdf')} className="cursor-pointer">
                                    <FileText className="h-4 w-4 mr-2" /> Download as PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport('docx')} className="cursor-pointer">
                                    <FileType2 className="h-4 w-4 mr-2" /> Download as DOCX
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div className="border-t border-border bg-white dark:bg-card">
                    <EditorToolbar
                        editor={editor}
                        templateId={templateId}
                        onTemplateChange={handleTemplateChange}
                        docSettings={docSettings}
                        onDocSettingsChange={updateDocSettings}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar bg-white dark:bg-background dark:bg-[radial-gradient(circle_at_50%_0%,rgba(0,255,136,0.04),transparent_60%)]">
                {isRewriting && (
                    <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
                        <div className="bg-card p-5 rounded-2xl shadow-2xl flex items-center gap-4 border border-primary/30 animate-in zoom-in duration-300">
                            <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                            <span className="font-bold text-foreground text-lg">AI is polishing…</span>
                        </div>
                    </div>
                )}

                <div className="min-w-min py-6 sm:py-12 px-3 sm:px-6 flex flex-col items-center gap-8">
                    <div className="flex-shrink-0">
                        {renderTemplate(templateId, { editor, docSettings })}
                    </div>
                </div>
            </div>

            <DiffModal
                open={diffOpen}
                originalDoc={diffOriginal}
                proposedDoc={diffProposed}
                isLoading={diffLoading}
                report={tailoringReport}
                onCancel={() => {
                    setDiffOpen(false)
                    setDiffProposed(null)
                    setDiffOriginal(null)
                    setTailoringReport(null)
                    setSuggestedDocSettings(null)
                }}
                onAcceptAll={() => {
                    if (diffProposed) acceptDiff(diffProposed)
                }}
                onAcceptPartial={(merged) => acceptDiff(merged)}
            />

            <div className="h-8 border-t border-border bg-white dark:bg-card px-3 sm:px-4 flex items-center justify-between text-[10px] sm:text-[11px] text-muted-foreground uppercase tracking-widest font-medium gap-2">
                <div className="flex items-center gap-2 sm:gap-4 min-w-0 overflow-hidden">
                    <span className="truncate max-w-[120px] sm:max-w-none">{fileName}</span>
                    <span className="hidden md:inline">Source: {sourceFormat.toUpperCase()}</span>
                    <span className="hidden lg:inline truncate">Version: {currentVersionId ? versions.find(v => v.id === currentVersionId)?.version_name : 'Unsaved'}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {isSaving ? (
                        <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Saving…</span>
                        </>
                    ) : isDirty ? (
                        <span className="text-amber-600 dark:text-amber-400">Unsaved changes</span>
                    ) : (
                        <span className="text-primary">✓ Version saved</span>
                    )}
                </div>
            </div>

            <Dialog open={tailoringDialogOpen} onOpenChange={setTailoringDialogOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Generate a tailored resume</DialogTitle>
                        <DialogDescription>
                            ApplyOS will propose small, evidence-backed edits, validate every claim, and switch the accepted result to the ATS one-page layout.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-2 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => void generateTailoredResume("truthful")}
                            className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-left transition-colors hover:border-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                        >
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                                <ShieldCheck className="h-4 w-4" />
                            </span>
                            <span className="mt-3 block text-sm font-semibold text-foreground">Truthful mode</span>
                            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                                Uses only claims and skills supported by this resume version. Best for submitting applications.
                            </span>
                            <span className="mt-3 inline-flex rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                Recommended
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => void generateTailoredResume("interview-prep")}
                            className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-amber-500/50 hover:bg-amber-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                        >
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                <BookOpenCheck className="h-4 w-4" />
                            </span>
                            <span className="mt-3 block text-sm font-semibold text-foreground">Interview prep</span>
                            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                                Keeps normal claims evidence-backed and isolates adjacent skills in a clearly labelled Familiarity section.
                            </span>
                        </button>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTailoringDialogOpen(false)}>
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={saveDialogOpen} onOpenChange={(open) => !isSaving && setSaveDialogOpen(open)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save a new resume version</DialogTitle>
                        <DialogDescription>
                            Give this revision a memorable name. Your current version will remain unchanged.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="resume-version-name">Version name</Label>
                        <Input
                            id="resume-version-name"
                            value={versionName}
                            onChange={(event) => setVersionName(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && versionName.trim() && !isSaving) {
                                    event.preventDefault()
                                    void handleNewVersion()
                                }
                            }}
                            maxLength={80}
                            autoFocus
                            placeholder="e.g. Backend role — tailored"
                        />
                        <p className="text-xs text-muted-foreground">
                            This will become version {nextVersionNumber} in your document history.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => void handleNewVersion()} disabled={!versionName.trim() || isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Version
                        </Button>
                        <Button variant="outline" onClick={() => setSaveDialogOpen(false)} disabled={isSaving}>
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
