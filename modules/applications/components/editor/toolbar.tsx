"use client"

import { useState } from "react"
import type { Editor } from "@tiptap/react"
import {
    Bold,
    Italic,
    Underline,
    Strikethrough,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    List,
    ListOrdered,
    Heading1,
    Heading2,
    Heading3,
    Undo2,
    Redo2,
    Link as LinkIcon,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/select"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/dialog"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { Button } from "@/shared/ui/button"
import { TEMPLATES, FONT_FAMILY_OPTIONS, FONT_SIZE_OPTIONS, type DocSettings, type TemplateId } from "./types"
import { PageSetupDialog } from "./page-setup-dialog"

interface ToolbarProps {
    editor: Editor | null
    templateId: TemplateId
    onTemplateChange: (id: TemplateId) => void
    docSettings: DocSettings
    onDocSettingsChange: (next: Partial<DocSettings>) => void
}

const ToolbarButton = ({
    onClick,
    isActive,
    disabled,
    children,
    title,
}: {
    onClick: () => void
    isActive?: boolean
    disabled?: boolean
    children: React.ReactNode
    title?: string
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={cn(
            "h-9 w-9 flex items-center justify-center rounded-sm transition-colors",
            "text-muted-foreground hover:text-primary hover:bg-primary/10",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
            isActive && "bg-primary/15 text-primary",
        )}
    >
        {children}
    </button>
)

const Group = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center bg-muted/40 rounded-md p-0.5 border border-border">
        {children}
    </div>
)

const Divider = () => <div className="h-5 w-px bg-border mx-1" />

function LinkDialog({
    editor,
    open,
    onOpenChange,
}: {
    editor: Editor
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const existing = (editor.getAttributes('link').href as string | undefined) ?? ''
    const [url, setUrl] = useState(existing || 'https://')

    const apply = () => {
        const trimmed = url.trim()
        if (!trimmed) {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
        } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run()
        }
        onOpenChange(false)
    }

    const remove = () => {
        editor.chain().focus().extendMarkRange('link').unsetLink().run()
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={(next) => {
            onOpenChange(next)
            if (next) setUrl(existing || 'https://')
        }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{existing ? 'Edit link' : 'Insert link'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 pt-2">
                    <Label htmlFor="link-url">URL</Label>
                    <Input
                        id="link-url"
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault()
                                apply()
                            }
                        }}
                    />
                </div>
                <DialogFooter className="gap-2 sm:gap-2">
                    {existing && (
                        <Button variant="outline" onClick={remove} className="mr-auto">
                            Remove link
                        </Button>
                    )}
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={apply}>{existing ? 'Update' : 'Insert'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export function EditorToolbar({
    editor,
    templateId,
    onTemplateChange,
    docSettings,
    onDocSettingsChange,
}: ToolbarProps) {
    const [linkDialogOpen, setLinkDialogOpen] = useState(false)

    if (!editor) {
        return <div className="flex items-center gap-2 px-2 h-10" />
    }

    const isHeading = (level: 1 | 2 | 3) => editor.isActive('heading', { level })

    const activeFontFamily = (editor.getAttributes('textStyle').fontFamily as string | undefined) ?? ''
    const activeFontSize = (editor.getAttributes('textStyle').fontSize as string | undefined) ?? ''

    const setFontFamily = (value: string) => {
        if (value === '__unset__') {
            editor.chain().focus().unsetFontFamily().run()
        } else {
            editor.chain().focus().setFontFamily(value).run()
        }
    }

    const setFontSize = (value: string) => {
        if (value === '__unset__') {
            editor.chain().focus().unsetFontSize().run()
        } else {
            editor.chain().focus().setFontSize(value).run()
        }
    }

    return (
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 px-2 sm:px-3 py-2.5 sm:py-3 overflow-x-auto">
            <PageSetupDialog settings={docSettings} onChange={onDocSettingsChange} />

            <Divider />

            <Select value={templateId} onValueChange={(v) => onTemplateChange(v as TemplateId)}>
                <SelectTrigger className="w-[120px] sm:w-[150px] h-9 font-medium bg-muted/40 border-border text-foreground hover:border-primary">
                    <SelectValue placeholder="Template" />
                </SelectTrigger>
                <SelectContent>
                    {Object.values(TEMPLATES).map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Divider />

            <Select value={activeFontFamily || ''} onValueChange={setFontFamily}>
                <SelectTrigger className="w-[140px] sm:w-[160px] h-9 font-medium bg-muted/40 border-border text-foreground hover:border-primary">
                    <SelectValue placeholder="Font" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="__unset__">Default</SelectItem>
                    {FONT_FAMILY_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} style={{ fontFamily: opt.value }}>
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={activeFontSize || ''} onValueChange={setFontSize}>
                <SelectTrigger className="w-[80px] h-9 font-medium bg-muted/40 border-border text-foreground hover:border-primary">
                    <SelectValue placeholder="Size" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="__unset__">Default</SelectItem>
                    {FONT_SIZE_OPTIONS.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Divider />

            <Group>
                <ToolbarButton
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    title="Undo (⌘Z)"
                >
                    <Undo2 className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    title="Redo (⇧⌘Z)"
                >
                    <Redo2 className="h-4 w-4" />
                </ToolbarButton>
            </Group>

            <Group>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    isActive={isHeading(1)}
                    title="Heading 1"
                >
                    <Heading1 className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    isActive={isHeading(2)}
                    title="Heading 2"
                >
                    <Heading2 className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    isActive={isHeading(3)}
                    title="Heading 3"
                >
                    <Heading3 className="h-4 w-4" />
                </ToolbarButton>
            </Group>

            <Group>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive('bold')}
                    title="Bold (⌘B)"
                >
                    <Bold className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive('italic')}
                    title="Italic (⌘I)"
                >
                    <Italic className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    isActive={editor.isActive('underline')}
                    title="Underline (⌘U)"
                >
                    <Underline className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    isActive={editor.isActive('strike')}
                    title="Strikethrough"
                >
                    <Strikethrough className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => setLinkDialogOpen(true)}
                    isActive={editor.isActive('link')}
                    title="Link"
                >
                    <LinkIcon className="h-4 w-4" />
                </ToolbarButton>
            </Group>

            <Group>
                <ToolbarButton
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    isActive={editor.isActive({ textAlign: 'left' })}
                    title="Align left"
                >
                    <AlignLeft className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    isActive={editor.isActive({ textAlign: 'center' })}
                    title="Align center"
                >
                    <AlignCenter className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    isActive={editor.isActive({ textAlign: 'right' })}
                    title="Align right"
                >
                    <AlignRight className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                    isActive={editor.isActive({ textAlign: 'justify' })}
                    title="Justify"
                >
                    <AlignJustify className="h-4 w-4" />
                </ToolbarButton>
            </Group>

            <Group>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    isActive={editor.isActive('bulletList')}
                    title="Bulleted list"
                >
                    <List className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    isActive={editor.isActive('orderedList')}
                    title="Numbered list"
                >
                    <ListOrdered className="h-4 w-4" />
                </ToolbarButton>
            </Group>

            <LinkDialog
                editor={editor}
                open={linkDialogOpen}
                onOpenChange={setLinkDialogOpen}
            />
        </div>
    )
}
