"use client"

import { useEffect, useMemo, useState } from "react"
import type { JSONContent } from "@tiptap/core"
import { diffWords } from "diff"
import { Button } from "@/shared/ui/button"
import { AlertTriangle, Check, Download, Loader2, ShieldCheck, Sparkles, X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { ResumeTailoringReport } from "@/lib/resume-tailoring/types"

interface DiffModalProps {
    open: boolean
    originalDoc: JSONContent | null
    proposedDoc: JSONContent | null
    isLoading: boolean
    report?: ResumeTailoringReport | null
    onCancel: () => void
    onAcceptAll: () => void
    onAcceptPartial: (mergedDoc: JSONContent) => void
}

interface NodeChange {
    path: number[]
    originalText: string
    proposedText: string
    accepted: boolean
}

export const escapeMarkdownTableCell = (value: string): string =>
    value.replace(/[\\|]/g, (character) => `\\${character}`)

const collectTextNodes = (
    node: JSONContent,
    path: number[] = [],
    out: { path: number[]; text: string }[] = [],
): { path: number[]; text: string }[] => {
    if (!node) return out
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'listItem') {
        const text = (node.content ?? [])
            .filter(c => c.type === 'text')
            .map(c => c.text ?? '')
            .join('')
        if (text.length > 0) out.push({ path, text })
    }
    if (node.content) {
        node.content.forEach((child, idx) => collectTextNodes(child, [...path, idx], out))
    }
    return out
}

const replaceTextAtPath = (
    doc: JSONContent,
    path: number[],
    newText: string,
): JSONContent => {
    const cloned = JSON.parse(JSON.stringify(doc)) as JSONContent
    let cursor: JSONContent = cloned
    for (let i = 0; i < path.length; i++) {
        if (!cursor.content) return cloned
        cursor = cursor.content[path[i]]
        if (!cursor) return cloned
    }
    if (cursor.content && cursor.content.length > 0) {
        const firstText = cursor.content.find(c => c.type === 'text')
        const marks = firstText?.marks ?? []
        cursor.content = [{ type: 'text', text: newText, ...(marks.length ? { marks } : {}) }]
    } else {
        cursor.content = [{ type: 'text', text: newText }]
    }
    return cloned
}

export function DiffModal({
    open,
    originalDoc,
    proposedDoc,
    isLoading,
    report = null,
    onCancel,
    onAcceptAll,
    onAcceptPartial,
}: DiffModalProps) {
    const structureRepaired = report?.safety.structureRepaired === true
    const changes = useMemo<NodeChange[]>(() => {
        if (!originalDoc || !proposedDoc) return []
        const original = collectTextNodes(originalDoc)
        const proposed = collectTextNodes(proposedDoc)
        if (structureRepaired) {
            return [{
                path: [],
                originalText: original.map((item) => item.text).join("\n"),
                proposedText: proposed.map((item) => item.text).join("\n"),
                accepted: true,
            }]
        }
        const result: NodeChange[] = []
        const len = Math.min(original.length, proposed.length)
        for (let i = 0; i < len; i++) {
            if (original[i].text !== proposed[i].text) {
                result.push({
                    path: proposed[i].path,
                    originalText: original[i].text,
                    proposedText: proposed[i].text,
                    accepted: true,
                })
            }
        }
        return result
    }, [originalDoc, proposedDoc, structureRepaired])

    const [accepted, setAccepted] = useState<Set<number>>(new Set())

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset accepted selection when change set updates
        setAccepted(new Set(changes.map((_, i) => i)))
    }, [changes])

    if (!open) return null

    const hasStructuralChanges = report?.safety.sourceStructurePreserved === false

    const downloadReport = () => {
        if (!report) return
        const requirementRows = report.requirements.map((item) =>
            `| ${escapeMarkdownTableCell(item.requirement)} | ${item.priority} | ${item.status} | ${escapeMarkdownTableCell(item.evidence.join("; ")) || "—"} |`,
        )
        const markdown = [
            "# Resume tailoring report",
            "",
            `- Mode: ${report.mode === "truthful" ? "Truthful" : "Interview preparation"}`,
            `- Evidence coverage: ${report.score}%`,
            `- Accepted edits: ${report.acceptedEdits.length}`,
            `- Rejected unsafe edits: ${report.rejectedEdits.length}`,
            `- Unsupported claims blocked: ${report.safety.unsupportedClaimsBlocked}`,
            `- Imported structure reconstructed: ${report.safety.structureRepaired ? "Yes" : "No"}`,
            "",
            "## Requirement evidence",
            "",
            "| Requirement | Priority | Status | Evidence |",
            "|---|---|---|---|",
            ...requirementRows,
            ...(report.familiaritySkills.length > 0 ? [
                "",
                "## Clearly labelled familiarity",
                "",
                ...report.familiaritySkills.map((skill) => `- ${skill}`),
            ] : []),
            ...(report.rejectedEdits.length > 0 ? [
                "",
                "## Safety rejections",
                "",
                ...report.rejectedEdits.map((edit) => `- Block ${edit.blockIndex}: ${edit.rejectionReason}`),
            ] : []),
            "",
        ].join("\n")
        const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }))
        const anchor = document.createElement("a")
        anchor.href = url
        anchor.download = "resume-tailoring-report.md"
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        URL.revokeObjectURL(url)
    }

    const toggle = (idx: number) => {
        setAccepted(prev => {
            const next = new Set(prev)
            if (next.has(idx)) next.delete(idx)
            else next.add(idx)
            return next
        })
    }

    const acceptAll = () => onAcceptAll()

    const applyPartial = () => {
        if (!proposedDoc || !originalDoc) return
        let merged: JSONContent = JSON.parse(JSON.stringify(proposedDoc))
        changes.forEach((change, idx) => {
            if (!accepted.has(idx)) {
                merged = replaceTextAtPath(merged, change.path, change.originalText)
            }
        })
        onAcceptPartial(merged)
    }

    return (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center">
                            <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground text-base">Apply Recommendations</h3>
                            <p className="text-xs text-muted-foreground">
                                {structureRepaired
                                    ? "Review the reconstructed resume and safe rewrites"
                                    : "Review proposed rewrites before applying"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {report ? (
                            <Button variant="ghost" size="sm" onClick={downloadReport}>
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                                Report
                            </Button>
                        ) : null}
                        <button
                            onClick={onCancel}
                            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title="Close"
                            aria-label="Close recommendation review"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto px-6 py-4 custom-scrollbar">
                    {!isLoading && report ? (
                        <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Evidence coverage</p>
                                    <p className="mt-1 text-2xl font-bold text-foreground">{report.score}%</p>
                                </div>
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Safe edits</p>
                                    <p className="mt-1 text-2xl font-bold text-foreground">{report.acceptedEdits.length}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Blocked proposals</p>
                                    <p className="mt-1 text-2xl font-bold text-foreground">{report.rejectedEdits.length}</p>
                                </div>
                            </div>
                            <div className="mt-3 flex items-start gap-2 border-t border-primary/15 pt-3 text-xs text-muted-foreground">
                                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                <span>
                                    Metrics and factual claims were checked against this exact resume version.
                                    {report.mode === "interview-prep" && report.familiaritySkills.length > 0
                                        ? ` ${report.familiaritySkills.length} unsupported skill${report.familiaritySkills.length === 1 ? " is" : "s are"} isolated in a clearly labelled Familiarity section.`
                                        : " Unsupported requirements were kept out of the generated resume."}
                                </span>
                            </div>
                            {structureRepaired ? (
                                <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/25 bg-background/70 px-3 py-2 text-xs text-foreground">
                                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                                    <span>
                                        The imported PDF had lost its spacing and hierarchy. ApplyOS safely rebuilt the name/contact header, sections, entry headings, and bullet lists before tailoring. Protected facts were verified, and this reconstruction must be accepted as one complete document.
                                    </span>
                                </div>
                            ) : null}
                            {report.rejectedEdits.length > 0 ? (
                                <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    Unsafe or layout-breaking proposals were automatically excluded. Download the report for details.
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-muted-foreground text-sm">AI is rewriting your resume…</p>
                        </div>
                    ) : changes.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                            <p className="font-medium">No changes proposed.</p>
                            <p className="text-sm mt-1">The current resume already addresses the recommendations.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-xs text-muted-foreground">
                                {structureRepaired
                                    ? "Full-document reconstruction shown below. Review it as one protected change."
                                    : `${changes.length} change${changes.length === 1 ? "" : "s"} proposed. Click any item to toggle acceptance, or accept all.`}
                            </p>
                            {changes.map((change, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => toggle(idx)}
                                    disabled={structureRepaired}
                                    className={cn(
                                        "w-full text-left rounded-lg border transition-all overflow-hidden",
                                        accepted.has(idx)
                                            ? "border-primary/40 bg-primary/5"
                                            : "border-border bg-muted/20 opacity-60",
                                    )}
                                >
                                    <div className="flex items-start gap-3 p-3">
                                        <div className={cn(
                                            "mt-0.5 h-5 w-5 rounded flex items-center justify-center flex-shrink-0 transition-colors",
                                            accepted.has(idx)
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted border border-border"
                                        )}>
                                            {accepted.has(idx) && <Check className="h-3.5 w-3.5" />}
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-2 text-sm">
                                            <DiffLine original={change.originalText} proposed={change.proposedText} />
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
                    <div className="text-xs text-muted-foreground">
                        {!isLoading && `${accepted.size} of ${changes.length} selected`}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={onCancel}>
                            Cancel
                        </Button>
                        <Button
                            variant="outline"
                            onClick={applyPartial}
                            disabled={isLoading || hasStructuralChanges || accepted.size === 0 || accepted.size === changes.length}
                            className="border-primary/40 text-foreground hover:bg-primary/10 hover:text-primary"
                            title={structureRepaired
                                ? "Reconstructed headings and lists must be accepted as one complete document"
                                : hasStructuralChanges
                                    ? "Interview-prep familiarity changes must be accepted as a complete, clearly labelled section"
                                    : undefined}
                        >
                            Apply selected ({accepted.size})
                        </Button>
                        <Button
                            onClick={acceptAll}
                            disabled={isLoading || (!report && changes.length === 0)}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {changes.length === 0 ? "Apply ATS layout" : "Accept all"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

const DiffLine = ({ original, proposed }: { original: string; proposed: string }) => {
    const parts = diffWords(original, proposed)
    return (
        <div className="leading-relaxed">
            {parts.map((part, i) => {
                if (part.added) {
                    return (
                        <span key={i} className="bg-primary/20 text-primary px-0.5 rounded">
                            {part.value}
                        </span>
                    )
                }
                if (part.removed) {
                    return (
                        <span key={i} className="bg-destructive/15 text-destructive line-through px-0.5 rounded">
                            {part.value}
                        </span>
                    )
                }
                return <span key={i} className="text-foreground/80">{part.value}</span>
            })}
        </div>
    )
}
