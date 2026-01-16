"use client"

import { useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import Strike from "@tiptap/extension-strike"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Heading2,
  RotateCcw,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react"
import { Button } from "./button"
import { cn } from "@/shared/lib/utils"

interface RichTextEditorProps {
  value: string
  onChange: (content: string) => void
  placeholder?: string
  className?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
        codeBlock: false,
        blockquote: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Strike,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[250px]",
      },
    },
    immediatelyRender: false,
  })

  // Update editor content when value prop changes
  useEffect(() => {
    if (editor && value && editor.getHTML() !== value) {
      editor.commands.setContent(value)
    }
  }, [value, editor])

  if (!editor) {
    return null
  }

  return (
    <div className={cn("border border-input rounded-lg overflow-hidden flex flex-col focus-within:ring-2 focus-within:ring-primary focus-within:shadow-lg shadow-md transition-all", className)}>
      {/* Toolbar - Single Line */}
      <div className="flex gap-1 border-b border-input bg-muted/50 p-2 backdrop-blur-sm overflow-x-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={cn(
            "transition-colors shrink-0",
            editor.isActive("bold") ? "bg-primary/30 text-primary" : "hover:bg-primary/10"
          )}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={cn(
            "transition-colors shrink-0",
            editor.isActive("italic") ? "bg-primary/30 text-primary" : "hover:bg-primary/10"
          )}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={!editor.can().chain().focus().toggleUnderline().run()}
          className={cn(
            "transition-colors shrink-0",
            editor.isActive("underline") ? "bg-primary/30 text-primary" : "hover:bg-primary/10"
          )}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          className={cn(
            "transition-colors shrink-0",
            editor.isActive("strike") ? "bg-primary/30 text-primary" : "hover:bg-primary/10"
          )}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(
            "transition-colors shrink-0",
            editor.isActive("heading", { level: 2 }) ? "bg-primary/30 text-primary" : "hover:bg-primary/10"
          )}
          title="Heading"
        >
          <Heading2 className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            "transition-colors shrink-0",
            editor.isActive("bulletList") ? "bg-primary/30 text-primary" : "hover:bg-primary/10"
          )}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            "transition-colors shrink-0",
            editor.isActive("orderedList") ? "bg-primary/30 text-primary" : "hover:bg-primary/10"
          )}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={cn(
            "transition-colors shrink-0",
            editor.isActive({ textAlign: "left" }) ? "bg-primary/30 text-primary" : "hover:bg-primary/10"
          )}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={cn(
            "transition-colors shrink-0",
            editor.isActive({ textAlign: "center" }) ? "bg-primary/30 text-primary" : "hover:bg-primary/10"
          )}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={cn(
            "transition-colors shrink-0",
            editor.isActive({ textAlign: "right" }) ? "bg-primary/30 text-primary" : "hover:bg-primary/10"
          )}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          className="hover:bg-primary/10 transition-colors shrink-0"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          className="hover:bg-primary/10 transition-colors shrink-0"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().clearNodes().run()}
          className="hover:bg-destructive/10 transition-colors shrink-0"
          title="Clear Formatting"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor Content - Fully Clickable Area */}
      <div
        className="flex-1 prose prose-sm dark:prose-invert max-w-none p-4 overflow-y-auto min-h-0 cursor-text"
        onClick={() => editor?.chain().focus("end").run()}
      >
        <EditorContent
          editor={editor}
          className="w-full focus:outline-none"
        />
      </div>
    </div>
  )
}
