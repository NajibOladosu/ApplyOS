"use client"

import { useMemo, useState } from "react"
import type { JSONContent } from "@tiptap/core"
import { diffWords } from "diff"
import { Button } from "@/components/ui/button"
import { Check, X, Loader2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface DiffModalProps {
    open: boolean
    originalDoc: JSONContent | null
    proposedDoc: JSONContent | null
    isLoading: boolean
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
    onCancel,
    onAcceptAll,
    onAcceptPartial,
}: DiffModalProps) {
    const changes = useMemo<NodeChange[]>(() => {
        if (!originalDoc || !proposedDoc) return []
        const original = collectTextNodes(originalDoc)
        const proposed = collectTextNodes(proposedDoc)
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
    }, [originalDoc, proposedDoc])

    const [accepted, setAccepted] = useState<Set<number>>(() => new Set(changes.map((_, i) => i)))

    if (!open) return null

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
                            <p className="text-xs text-muted-foreground">Review proposed rewrites before applying</p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
                        title="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto px-6 py-4 custom-scrollbar">
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
                                {changes.length} change{changes.length === 1 ? '' : 's'} proposed.
                                Click any item to toggle acceptance, or accept all.
                            </p>
                            {changes.map((change, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => toggle(idx)}
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
                        <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button
                            variant="outline"
                            onClick={applyPartial}
                            disabled={isLoading || accepted.size === 0 || accepted.size === changes.length}
                            className="border-primary/40 text-foreground hover:bg-primary/10 hover:text-primary"
                        >
                            Apply selected ({accepted.size})
                        </Button>
                        <Button
                            onClick={acceptAll}
                            disabled={isLoading || changes.length === 0}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            Accept all
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
