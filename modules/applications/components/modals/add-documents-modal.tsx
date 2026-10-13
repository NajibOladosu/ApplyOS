"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { AlertCircle, Check, FileText, Loader2 } from "lucide-react"
import { Button } from "@/shared/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import type { Document } from "@/types/database"

interface AddDocumentsModalProps {
  isOpen: boolean
  documents: Document[]
  linkedDocumentIds: string[]
  isSaving?: boolean
  error?: string | null
  onClose: () => void
  onAdd: (documentIds: string[]) => void
  onClearError?: () => void
}

export function AddDocumentsModal({
  isOpen,
  documents,
  linkedDocumentIds,
  isSaving = false,
  error = null,
  onClose,
  onAdd,
  onClearError,
}: AddDocumentsModalProps) {
  const handleClose = () => {
    if (isSaving) return
    onClearError?.()
    onClose()
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
    >
      {isOpen ? (
        <DocumentPickerContent
          documents={documents}
          linkedDocumentIds={linkedDocumentIds}
          isSaving={isSaving}
          error={error}
          onClose={handleClose}
          onAdd={onAdd}
          onClearError={onClearError}
        />
      ) : null}
    </Dialog>
  )
}

interface DocumentPickerContentProps {
  documents: Document[]
  linkedDocumentIds: string[]
  isSaving: boolean
  error: string | null
  onClose: () => void
  onAdd: (documentIds: string[]) => void
  onClearError?: () => void
}

function DocumentPickerContent({
  documents,
  linkedDocumentIds,
  isSaving,
  error,
  onClose,
  onAdd,
  onClearError,
}: DocumentPickerContentProps) {
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([])
  const availableDocuments = useMemo(
    () => documents.filter((document) => !linkedDocumentIds.includes(document.id)),
    [documents, linkedDocumentIds]
  )

  const toggleSelection = (documentId: string) => {
    onClearError?.()
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId]
    )
  }

  return (
    <DialogContent className="sm:max-h-[min(680px,calc(100vh-2rem))] sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Add documents</DialogTitle>
        <DialogDescription>
          Link existing documents to this application for Job Fit and AI-generated answers.
        </DialogDescription>
      </DialogHeader>

      {documents.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5 text-muted-foreground" />}
          iconClassName="bg-muted"
          title="No documents yet"
          description="Upload a resume or cover letter first, then return here to link it to this application."
          uploadLabel="Upload a document"
          onClose={onClose}
        />
      ) : availableDocuments.length === 0 ? (
        <EmptyState
          icon={<Check className="h-5 w-5 text-primary" />}
          iconClassName="bg-primary/10"
          title="All documents are linked"
          description="Every document in your library is already available to this application."
          uploadLabel="Upload another document"
          onClose={onClose}
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-muted-foreground">
              {availableDocuments.length} available {availableDocuments.length === 1 ? "document" : "documents"}
            </p>
            {selectedDocumentIds.length > 0 ? (
              <span className="text-xs font-semibold text-primary" aria-live="polite">
                {selectedDocumentIds.length} selected
              </span>
            ) : null}
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {availableDocuments.map((document) => {
              const isSelected = selectedDocumentIds.includes(document.id)
              return (
                <button
                  key={document.id}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={isSaving}
                  onClick={() => toggleSelection(document.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60 ${isSelected
                    ? "border-primary/70 bg-primary/10"
                    : "border-border/70 bg-card hover:border-primary/40 hover:bg-muted/40"
                    }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background">
                    <FileText className="h-4 w-4 text-primary" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {document.file_name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {((document.file_size || 0) / 1024).toFixed(0)} KB ·{" "}
                      {document.analysis_status === "success" ? "Analyzed" : "Not analyzed"}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background"
                      }`}
                  >
                    {isSelected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                  </span>
                </button>
              )
            })}
          </div>

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => onAdd(selectedDocumentIds)}
              disabled={selectedDocumentIds.length === 0 || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                `Add ${selectedDocumentIds.length || "selected"}`
              )}
            </Button>
          </DialogFooter>
        </>
      )}
    </DialogContent>
  )
}

interface EmptyStateProps {
  icon: ReactNode
  iconClassName: string
  title: string
  description: string
  uploadLabel: string
  onClose: () => void
}

function EmptyState({
  icon,
  iconClassName,
  title,
  description,
  uploadLabel,
  onClose,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center">
      <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${iconClassName}`}>
        {icon}
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/upload">{uploadLabel}</Link>
        </Button>
      </div>
    </div>
  )
}
