import React from 'react'
import { Pin, Save, Loader2, StickyNote } from 'lucide-react'

import { cn } from '../../lib/cn'

/**
 * Application notes.
 *
 * This replaced a TipTap rich-text editor. TipTap accounted for ~2MB of the
 * 2.79MB popup bundle, in a 400px-wide window, to produce notes the ApplyOS web
 * app stores as plain TEXT — so every heading, alignment and underline was
 * discarded on save. A textarea is both smaller and more honest about what is
 * actually persisted.
 *
 * The prop names are unchanged so the caller did not need to move.
 */
interface NoteEditorProps {
    content: string
    onChangeContent: (content: string) => void
    category: string
    onChangeCategory: (category: string) => void
    isPinned: boolean
    onChangePinned: (pinned: boolean) => void
    onSave: () => void
    saving: boolean
}

const CATEGORIES = [
    { id: '', label: 'None' },
    { id: 'general', label: 'General' },
    { id: 'interview', label: 'Interview' },
    { id: 'follow_up', label: 'Follow-up' },
    { id: 'research', label: 'Research' },
]

export function NoteEditor({
    content,
    onChangeContent,
    category,
    onChangeCategory,
    isPinned,
    onChangePinned,
    onSave,
    saving,
}: NoteEditorProps) {
    const characters = content.length

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                    <StickyNote className="h-3.5 w-3.5 text-primary" />
                    Application notes
                </h3>
                <button
                    type="button"
                    onClick={() => onChangePinned(!isPinned)}
                    className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors',
                        isPinned
                            ? 'border-primary/30 bg-primary/10 text-primary-strong dark:text-primary'
                            : 'border-border/70 bg-card text-muted-foreground hover:text-foreground'
                    )}
                    aria-pressed={isPinned}
                >
                    <Pin className={cn('h-2.5 w-2.5', isPinned && 'fill-current')} />
                    {isPinned ? 'Pinned' : 'Pin'}
                </button>
            </div>

            <textarea
                value={content}
                onChange={(event) => onChangeContent(event.target.value)}
                placeholder="Recruiter names, follow-up dates, what they asked about…"
                className="input-field h-40 resize-none py-2 text-[11px] leading-relaxed"
            />

            <div className="flex items-center justify-between gap-2">
                <select
                    value={category}
                    onChange={(event) => onChangeCategory(event.target.value)}
                    className="input-field h-8 w-auto min-w-[120px] py-0 text-[11px]"
                    aria-label="Note category"
                >
                    {CATEGORIES.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.label}
                        </option>
                    ))}
                </select>

                <span className="text-[10px] tabular-nums text-muted-foreground">
                    {characters.toLocaleString()} characters
                </span>

                <button
                    type="button"
                    onClick={onSave}
                    disabled={saving}
                    className="btn-secondary h-8 px-3 text-[11px]"
                >
                    {saving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                        <>
                            <Save className="h-3 w-3" />
                            Save
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}
