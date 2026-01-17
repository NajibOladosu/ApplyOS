"use client"

import { useState, useEffect } from "react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card"
import { RichTextEditor } from "@/shared/ui/rich-text-editor"
import { ToggleSwitch } from "@/shared/ui/toggle-switch"
import { X, Loader2, Pin } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface NoteModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (note: {
    content: string
    category?: string
    is_pinned: boolean
  }) => Promise<void>
  initialNote?: {
    content: string
    category: string | null
    is_pinned: boolean
  }
  isLoading?: boolean
}

export function NoteModal({
  isOpen,
  onClose,
  onSave,
  initialNote,
  isLoading = false,
}: NoteModalProps) {
  const [content, setContent] = useState("")
  const [category, setCategory] = useState("")
  const [isPinned, setIsPinned] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (initialNote) {
      setContent(initialNote.content)
      setCategory(initialNote.category || "")
      setIsPinned(initialNote.is_pinned)
    } else {
      setContent("")
      setCategory("")
      setIsPinned(false)
    }
  }, [initialNote, isOpen])

  const handleSave = async () => {
    if (!content.trim()) return

    setIsSaving(true)
    try {
      await onSave({
        content,
        category: category || undefined,
        is_pinned: isPinned,
      })
      handleClose()
    } catch (error) {
      console.error("Error saving note:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setContent("")
    setCategory("")
    setIsPinned(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl my-8"
        >
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base sm:text-lg">
                    {initialNote ? "Edit Note" : "New Note"}
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Create or edit a note for this application
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="h-8 w-8 sm:h-9 sm:w-9 shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-4 p-4 sm:p-6 pt-0 max-h-[calc(100vh-220px)]">
              {/* Category Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Category (Optional)</label>
                <Input
                  placeholder="e.g., Interview Prep, Follow-up, Research"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="text-sm"
                />
              </div>

              {/* Rich Text Editor */}
              <div className="space-y-2 flex flex-col flex-1 min-h-0">
                <label className="text-sm font-medium">Note Content *</label>
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Write your note here..."
                  className="flex-1"
                />
              </div>

              {/* Pin Toggle Switch */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-input/50">
                <div className="flex items-center gap-2">
                  <Pin className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Pin this note to the top</span>
                </div>
                <ToggleSwitch
                  checked={isPinned}
                  onChange={setIsPinned}
                  className="m-0"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-2 pt-4 border-t">
                <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving || isLoading || !content.trim()}
                  className="glow-effect w-full sm:w-auto"
                >
                  {isSaving || isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    initialNote ? "Update Note" : "Create Note"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
