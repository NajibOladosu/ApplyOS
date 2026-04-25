"use client"

import type { Editor } from "@tiptap/react"
import { Button } from "@/shared/ui/button"
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
    Sparkles,
    Wand2,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/select"
import { TEMPLATES, type TemplateId } from "./types"

interface ToolbarProps {
    editor: Editor | null
    templateId: TemplateId
    onTemplateChange: (id: TemplateId) => void
    onAIRewriteSelection: () => void
    onApplyRecommendations: () => void
    canApplyRecommendations: boolean
    isRewriting: boolean
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
            "h-8 w-8 flex items-center justify-center rounded-sm transition-colors",
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

const promptForLink = (editor: Editor) => {
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL', previous ?? 'https://')
    if (url === null) return
    if (url === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run()
        return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

export function EditorToolbar({
    editor,
    templateId,
    onTemplateChange,
    onAIRewriteSelection,
    onApplyRecommendations,
    canApplyRecommendations,
    isRewriting,
}: ToolbarProps) {
    if (!editor) {
        return <div className="flex items-center gap-2 px-2 h-10" />
    }

    const isHeading = (level: 1 | 2 | 3) => editor.isActive('heading', { level })

    return (
        <div className="flex items-center flex-wrap gap-2 px-3 py-2">
            <Select value={templateId} onValueChange={(v) => onTemplateChange(v as TemplateId)}>
                <SelectTrigger className="w-[160px] h-8 bg-muted/40 border-border text-foreground hover:border-primary">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {Object.values(TEMPLATES).map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
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
                    onClick={() => promptForLink(editor)}
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

            <Divider />

            <Button
                size="sm"
                onClick={onAIRewriteSelection}
                disabled={isRewriting || editor.state.selection.empty}
                className="font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 h-8"
            >
                <Sparkles className="h-3 w-3 mr-1" /> Ask AI
            </Button>

            <Button
                size="sm"
                variant="outline"
                onClick={onApplyRecommendations}
                disabled={!canApplyRecommendations || isRewriting}
                className="font-medium bg-muted/40 border-primary/40 text-foreground hover:bg-primary/10 hover:border-primary hover:text-primary disabled:opacity-50 h-8"
                title={canApplyRecommendations ? "Rewrite resume to address analysis recommendations" : "Run analysis first to enable bulk apply"}
            >
                <Wand2 className="h-3 w-3 mr-1" /> Apply Recommendations
            </Button>
        </div>
    )
}
