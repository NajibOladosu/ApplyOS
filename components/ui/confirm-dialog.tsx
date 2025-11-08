"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
  loading?: boolean
  onConfirm: () => Promise<void> | void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [submitting, setSubmitting] = React.useState(false)

  const handleConfirm = async () => {
    if (submitting) return
    const result = onConfirm()
    if (result instanceof Promise) {
      try {
        setSubmitting(true)
        await result
      } finally {
        setSubmitting(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !submitting && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={variant === "destructive" ? "text-destructive" : ""}>
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription>
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting || loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={submitting || loading}
          >
            {submitting || loading ? "Please wait..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}