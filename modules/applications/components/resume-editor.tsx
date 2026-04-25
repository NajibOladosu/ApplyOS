"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
} from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/select"
import { useToast } from "@/shared/ui/use-toast"
import { useDebounceCallback } from "usehooks-ts"
import { type ResumeAnalysisResult } from "./resume-feedback"
import {
    resumeVersionsService,
    type ResumeVersion,
    type SourceFormat,
} from "@/lib/services/resume-versions"
import { buildExtensions } from "./editor/extensions"
import { blocksToTipTap, emptyDoc } from "./editor/blocks-to-tiptap"
import { renderTemplate } from "./editor/templates/registry"
import type { TemplateId, EditorBlock, ResumeDoc } from "./editor/types"
import { EditorToolbar } from "./editor/toolbar"
import { DiffModal } from "./editor/diff-modal"

// Re-export legacy types so existing imports keep working until callers migrate.
export type { EditorBlock, BlockType, BlockStyles } from "./editor/types"

interface ResumeEditorProps {
    documentUrl: string
    analysis: ResumeAnalysisResult | null
    parsedData: any
    extractedText: string | null
    applicationId: string
    documentId: string
    onBack: () => void
    fileName: string
}

const detectSourceFormat = (fileName: string): SourceFormat => {
    const ext = fileName.toLowerCase().split('.').pop()
    if (ext === 'docx' || ext === 'doc') return 'docx'
    if (ext === 'txt') return 'txt'
    if (ext === 'json') return 'json'
    return 'pdf'
}

export function ResumeEditor({
    documentUrl,
    analysis,
    parsedData,
    extractedText,
    applicationId,
    documentId,
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
    const [selectionEmpty, setSelectionEmpty] = useState(true)

    const sourceFormat = useMemo(() => detectSourceFormat(fileName), [fileName])

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

    const debouncedSave = useDebounceCallback(async (doc: JSONContent) => {
        if (!currentVersionId) return
        setIsSaving(true)
        try {
            const version = versions.find(v => v.id === currentVersionId)
            if (!version) return
            const saved = await resumeVersionsService.saveVersion({
                id: version.id,
                document_id: documentId,
                application_id: applicationId,
                version_name: version.version_name,
                content_json: doc,
                template_id: templateId,
                source_format: sourceFormat,
                parent_document_id: documentId,
            })
            setVersions(prev => prev.map(v => v.id === saved.id ? saved : v))
        } catch (err) {
            console.error("Auto-save error:", err)
        } finally {
            setIsSaving(false)
        }
    }, 1500)

    useEffect(() => {
        if (!editor) return
        const handler = () => {
            debouncedSave(editor.getJSON())
        }
        const selectionHandler = () => {
            setSelectionEmpty(editor.state.selection.empty)
        }
        editor.on('update', handler)
        editor.on('selectionUpdate', selectionHandler)
        editor.on('transaction', selectionHandler)
        return () => {
            editor.off('update', handler)
            editor.off('selectionUpdate', selectionHandler)
            editor.off('transaction', selectionHandler)
        }
    }, [editor, debouncedSave])

    useEffect(() => {
        const load = async () => {
            try {
                const fetched = await resumeVersionsService.getVersions(documentId)
                const appScoped = fetched.filter(v => !v.application_id || v.application_id === applicationId)
                setVersions(appScoped)

                let initialDoc: ResumeDoc = emptyDoc()
                let initialTemplate: TemplateId = 'modern'
                let initialVersionId: string | null = null

                if (appScoped.length > 0) {
                    const latest = appScoped[0]
                    initialVersionId = latest.id
                    initialTemplate = latest.template_id ?? 'modern'
                    if (latest.content_json) {
                        initialDoc = latest.content_json as ResumeDoc
                    } else if (latest.blocks && Array.isArray(latest.blocks) && latest.blocks.length > 0) {
                        initialDoc = blocksToTipTap(latest.blocks as EditorBlock[])
                    }
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
                                if (layout?.suggestedTemplate) {
                                    initialTemplate = layout.suggestedTemplate
                                }
                            }
                        } catch (err) {
                            console.warn("Layout detection failed:", err)
                        }
                    }
                }

                if (appScoped.length === 0 && sourceFormat === 'docx') {
                    try {
                        const res = await fetch('/api/editor/import-docx', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ documentId }),
                        })
                        if (res.ok) {
                            const data = await res.json()
                            if (data.contentJson) {
                                initialDoc = data.contentJson as ResumeDoc
                            }
                        } else {
                            console.warn("DOCX import failed:", res.status)
                        }
                    } catch (err) {
                        console.warn("DOCX import error, falling back to text parse:", err)
                    }
                } else if (appScoped.length === 0 && extractedText && extractedText.trim().length > 50) {
                    try {
                        const res = await fetch('/api/editor/parse-text', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ extractedText }),
                        })
                        if (res.ok) {
                            const data = await res.json()
                            if (data.blocks && Array.isArray(data.blocks)) {
                                initialDoc = blocksToTipTap(data.blocks as EditorBlock[])
                            }
                        }
                    } catch (err) {
                        console.warn("AI parse failed, falling back to plain text:", err)
                    }
                }

                if (editor) {
                    editor.commands.setContent(initialDoc)
                }
                setTemplateId(initialTemplate)

                if (!initialVersionId) {
                    const created = await resumeVersionsService.saveVersion({
                        document_id: documentId,
                        application_id: applicationId,
                        version_name: 'Version 1',
                        content_json: editor ? editor.getJSON() : initialDoc,
                        template_id: initialTemplate,
                        source_format: sourceFormat,
                        parent_document_id: documentId,
                    })
                    setVersions([created, ...appScoped])
                    setCurrentVersionId(created.id)
                } else {
                    setCurrentVersionId(initialVersionId)
                }
            } catch (err) {
                console.error("Editor load failed:", err)
                toast({ title: "Failed to load resume", variant: "destructive" })
            } finally {
                setIsLoading(false)
            }
        }
        if (editor) {
            load()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor, documentId, applicationId])

    const handleNewVersion = async () => {
        if (!editor) return
        setIsSaving(true)
        try {
            const newName = `Version ${versions.length + 1}`
            const created = await resumeVersionsService.saveVersion({
                document_id: documentId,
                application_id: applicationId,
                version_name: newName,
                content_json: editor.getJSON(),
                template_id: templateId,
                source_format: sourceFormat,
                parent_document_id: documentId,
            })
            setVersions([created, ...versions])
            setCurrentVersionId(created.id)
            toast({ title: "Saved as new version" })
        } catch (err: any) {
            console.error("Capture failed:", err)
            toast({
                title: "Failed to save version",
                description: err?.message ?? "Unknown error",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const handleSwitchVersion = (id: string) => {
        if (!editor) return
        const v = versions.find(x => x.id === id)
        if (!v) return
        const doc = (v.content_json as ResumeDoc | null) ??
            (v.blocks ? blocksToTipTap(v.blocks as EditorBlock[]) : emptyDoc())
        editor.commands.setContent(doc)
        setCurrentVersionId(id)
        if (v.template_id) setTemplateId(v.template_id)
    }

    const handleTemplateChange = useCallback(async (id: TemplateId) => {
        setTemplateId(id)
        if (currentVersionId && editor) {
            try {
                const v = versions.find(x => x.id === currentVersionId)
                if (!v) return
                const saved = await resumeVersionsService.saveVersion({
                    id: v.id,
                    document_id: documentId,
                    application_id: applicationId,
                    version_name: v.version_name,
                    content_json: editor.getJSON(),
                    template_id: id,
                    source_format: sourceFormat,
                    parent_document_id: documentId,
                })
                setVersions(prev => prev.map(x => x.id === saved.id ? saved : x))
            } catch (err) {
                console.error("Template switch save failed:", err)
            }
        }
    }, [currentVersionId, editor, versions, documentId, applicationId, sourceFormat])

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
        } catch (err) {
            toast({ title: "AI rewrite failed", variant: "destructive" })
        } finally {
            setIsRewriting(false)
        }
    }

    const handleApplyRecommendations = async () => {
        if (!editor || !analysis?.recommendations?.length) {
            toast({ title: "No recommendations to apply", variant: "destructive" })
            return
        }
        const original = editor.getJSON()
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
                    contentJson: original,
                    recommendations: analysis.recommendations,
                }),
            })
            if (!res.ok) {
                const errText = await res.text()
                throw new Error(errText || "Bulk apply failed")
            }
            const data = await res.json()
            if (data.contentJson) {
                setDiffProposed(data.contentJson as ResumeDoc)
            } else {
                throw new Error("AI returned no content")
            }
        } catch (err: any) {
            setDiffOpen(false)
            toast({
                title: "Failed to apply recommendations",
                description: err.message,
                variant: "destructive",
            })
        } finally {
            setDiffLoading(false)
        }
    }

    const acceptDiff = async (mergedDoc: ResumeDoc) => {
        if (!editor) return
        editor.commands.setContent(mergedDoc as any)
        setDiffOpen(false)
        setDiffProposed(null)
        setDiffOriginal(null)
        toast({
            title: "Recommendations applied",
            description: "Saved as a new version.",
        })
        try {
            const newName = `Version ${versions.length + 1}`
            const created = await resumeVersionsService.saveVersion({
                document_id: documentId,
                application_id: applicationId,
                version_name: newName,
                content_json: mergedDoc,
                template_id: templateId,
                source_format: sourceFormat,
                parent_document_id: documentId,
            })
            setVersions([created, ...versions])
            setCurrentVersionId(created.id)
        } catch (err) {
            console.error("Failed to capture version after diff accept:", err)
        }
    }

    const handleExport = async () => {
        if (!editor) return
        setIsExporting(true)
        try {
            const endpoint = sourceFormat === 'docx'
                ? '/api/editor/export-docx'
                : '/api/editor/export-pdf'

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contentJson: editor.getJSON(),
                    templateId,
                    fileName,
                }),
            })

            if (!res.ok) {
                throw new Error(`Export failed: ${res.status}`)
            }

            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            const baseName = fileName.replace(/\.(pdf|docx?|txt|json)$/i, "")
            const ext = sourceFormat === 'docx' ? 'docx' : 'pdf'
            a.href = url
            a.download = `${baseName}_edited.${ext}`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            toast({ title: `Exported as ${ext.toUpperCase()}` })
        } catch (err: any) {
            console.error("Export error:", err)
            toast({
                title: "Export failed",
                description: err.message,
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
        <div className="flex flex-col h-[calc(100vh-140px)] bg-background rounded-lg border border-border overflow-hidden">
            <div className="border-b border-border bg-card z-20 sticky top-0">
                <div className="flex items-center flex-wrap gap-3 px-4 py-2.5 min-h-14">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onBack}
                        className="font-medium text-muted-foreground hover:text-primary hover:bg-muted"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back
                    </Button>
                    <div className="h-6 w-px bg-border" />
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Select
                            value={currentVersionId ?? undefined}
                            onValueChange={handleSwitchVersion}
                        >
                            <SelectTrigger className="w-[180px] h-8 font-medium bg-muted/40 border-border text-foreground hover:border-primary">
                                <SelectValue placeholder="Select version" />
                            </SelectTrigger>
                            <SelectContent>
                                {versions.length === 0 ? (
                                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No saved versions yet</div>
                                ) : versions.map(v => (
                                    <SelectItem key={v.id} value={v.id}>{v.version_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleNewVersion}
                            disabled={isSaving}
                            className="h-8 px-3 border-dashed font-medium bg-muted/40 border-primary/30 text-foreground hover:bg-muted hover:border-primary"
                        >
                            {isSaving ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Save className="h-3 w-3 mr-2" />}
                            Capture
                        </Button>
                    </div>

                    <div className="ml-auto flex items-center gap-2 flex-wrap">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleAIRewriteSelection}
                            disabled={isRewriting || selectionEmpty}
                            className="h-8 font-medium bg-muted/40 border-primary/40 text-foreground hover:bg-primary/10 hover:border-primary hover:text-primary disabled:opacity-50"
                            title={selectionEmpty ? "Select text in the editor to rewrite" : "Rewrite selected text with AI"}
                        >
                            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Ask AI
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleApplyRecommendations}
                            disabled={!analysis?.recommendations?.length || isRewriting}
                            className="h-8 font-medium bg-muted/40 border-primary/40 text-foreground hover:bg-primary/10 hover:border-primary hover:text-primary disabled:opacity-50"
                            title={analysis?.recommendations?.length ? "Rewrite resume to address analysis recommendations" : "Run analysis first to enable bulk apply"}
                        >
                            <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Apply Recommendations
                        </Button>
                        <Button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="glow-effect font-semibold h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {isExporting ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Download className="h-4 w-4 mr-2" />
                            )}
                            Download {sourceFormat === 'docx' ? 'DOCX' : 'PDF'}
                        </Button>
                    </div>
                </div>

                <div className="border-t border-border bg-card">
                    <EditorToolbar
                        editor={editor}
                        templateId={templateId}
                        onTemplateChange={handleTemplateChange}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar bg-background bg-[radial-gradient(circle_at_50%_0%,rgba(0,255,136,0.04),transparent_60%)]">
                {isRewriting && (
                    <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
                        <div className="bg-card p-5 rounded-2xl shadow-2xl flex items-center gap-4 border border-primary/30 animate-in zoom-in duration-300">
                            <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                            <span className="font-bold text-foreground text-lg">AI is polishing…</span>
                        </div>
                    </div>
                )}

                <div className="min-w-min py-12 px-6 flex flex-col items-center gap-8">
                    <div className="flex-shrink-0">
                        {renderTemplate(templateId, { editor })}
                    </div>
                </div>
            </div>

            <DiffModal
                open={diffOpen}
                originalDoc={diffOriginal}
                proposedDoc={diffProposed}
                isLoading={diffLoading}
                onCancel={() => {
                    setDiffOpen(false)
                    setDiffProposed(null)
                    setDiffOriginal(null)
                }}
                onAcceptAll={() => {
                    if (diffProposed) acceptDiff(diffProposed)
                }}
                onAcceptPartial={(merged) => acceptDiff(merged)}
            />

            <div className="h-8 border-t border-border bg-card px-4 flex items-center justify-between text-[11px] text-muted-foreground uppercase tracking-widest font-medium">
                <div className="flex items-center gap-4">
                    <span>Document: {fileName}</span>
                    <span>Source: {sourceFormat.toUpperCase()}</span>
                    <span>Version: {currentVersionId ? versions.find(v => v.id === currentVersionId)?.version_name : 'Unsaved'}</span>
                </div>
                <div className="flex items-center gap-2">
                    {isSaving ? (
                        <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Saving…</span>
                        </>
                    ) : (
                        <span className="text-primary">✓ Saved</span>
                    )}
                </div>
            </div>
        </div>
    )
}
