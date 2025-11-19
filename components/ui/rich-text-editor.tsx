"use client"

import { useEffect, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import Link from "@tiptap/extension-link"
import Strike from "@tiptap/extension-strike"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Heading2,
  Quote,
  Code,
  RotateCcw,
  Link as LinkIcon,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react"
import { Button } from "./button"
import { cn } from "@/lib/utils"

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
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Strike,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    immediatelyRender: false,
  })

  // Update editor content when value prop changes
  useEffect(() => {
    if (editor && value && editor.getHTML() !== value) {
      editor.commands.setContent(value)
    }
  }, [value, editor])

  const handleAddLink = () => {
    if (!linkUrl.trim()) {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run()
      setShowLinkInput(false)
      setLinkUrl("")
      return
    }

    let url = linkUrl.trim()
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url
    }

    editor
      ?.chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run()

    setShowLinkInput(false)
    setLinkUrl("")
  }

  if (!editor) {
    return null
  }

  return (
    <div className={cn("border border-input rounded-lg overflow-hidden flex flex-col focus-within:ring-2 focus-within:ring-primary focus-within:shadow-lg shadow-md transition-all", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 border-b border-input bg-muted/50 p-3 backdrop-blur-sm">
        {/* Text Formatting Group */}
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className={cn(
              "transition-colors",
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
              "transition-colors",
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
              "transition-colors",
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
              "transition-colors",
              editor.isActive("strike") ? "bg-primary/30 text-primary" : "hover:bg-primary/10"
            )}
            title="Strikethrough"
          >
            <Strikethrough className="h-4 w-4" />
          </Button>
        </div>

        <div className="w-px bg-border mx-1" />

        {/* Heading Group */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(
            "transition-colors",
            editor.isActive("heading", { level: 2 }) ? "bg-primary/30 text-primary" : "hover:bg-primary/10"
          )}
          title="Heading"
        >
          <Heading2 className="h-4 w-4" />
        </Button>

        <div className="w-px bg-border mx-1" />

        {/* List Group */}
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(
              "transition-colors",
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
              "transition-colors",
              editor.isActive("orderedList") ? "bg-primary/30 text-primary" : "hover:bg-primary/10"
            )}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
        </div>

        <div className="w-px bg-border mx-1" />

        {/* Alignment Group */}
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            className={cn(
              "transition-colors",
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
              "transition-colors",
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
              "transition-colors",
              editor.isActive({ textAlign: "right" }) ? "bg-primary/30 text-primary" : "hover:bg-primary/10"
            )}
            title="Align Right"
          >
            <AlignRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="w-px bg-border mx-1" />

        {/* Block Group */}
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={cn(
              "transition-colors",
              editor.isActive("blockquote") ? "bg-primary/30 text-primary" : "hover:bg-primary/10"
            )}
            title="Quote"
          >
            <Quote className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={cn(
              "transition-colors",
              editor.isActive("codeBlock") ? "bg-primary/30 text-primary" : "hover:bg-primary/10"
            )}
            title="Code Block"
          >
            <Code className="h-4 w-4" />
          </Button>
        </div>

        <div className="w-px bg-border mx-1" />

        {/* Link Group */}
        <div className="flex gap-1 items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLinkInput(!showLinkInput)}
            className={cn(
              "transition-colors",
              editor.isActive("link") ? "bg-primary/30 text-primary" : "hover:bg-primary/10"
            )}
            title="Add Link"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>

          {showLinkInput && (
            <input
              type="text"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddLink()
                } else if (e.key === "Escape") {
                  setShowLinkInput(false)
                  setLinkUrl("")
                }
              }}
              className="h-9 px-2 text-sm bg-muted border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary w-48"
              autoFocus
            />
          )}
        </div>

        <div className="w-px bg-border mx-1" />

        {/* History Group */}
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run()}
            className="hover:bg-primary/10 transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run()}
            className="hover:bg-primary/10 transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="w-px bg-border mx-1" />

        {/* Utility Group */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().clearNodes().run()}
          className="hover:bg-destructive/10 transition-colors"
          title="Clear Formatting"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor Content */}
      <div className="flex-1 prose prose-sm dark:prose-invert max-w-none p-4 overflow-y-auto min-h-0">
        <EditorContent
          editor={editor}
          className="w-full h-full focus:outline-none"
        />
      </div>
    </div>
  )
}
