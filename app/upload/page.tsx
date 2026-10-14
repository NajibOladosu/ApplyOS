"use client"

import { useState, useCallback } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent } from "@/shared/ui/card"
import { PageHeader } from "@/components/layout/page-header"
import Link from "next/link"
import { Button } from "@/shared/ui/button"
import { motion } from "framer-motion"
import { Upload, FileText, CheckCircle, X, Loader2, Wand2 } from "lucide-react"
import { useDropzone } from "react-dropzone"
import { AlertModal } from "@/components/modals/alert-modal"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"

interface UploadedDocument {
  id: string
  file_name: string
  profile_ready: boolean
}

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [profilePromptOpen, setProfilePromptOpen] = useState(false)
  const [profileDocuments, setProfileDocuments] = useState<UploadedDocument[]>([])
  const [applyingDetails, setApplyingDetails] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileResult, setProfileResult] = useState<string | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(acceptedFiles)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
      "text/markdown": [".md"],
      "application/json": [".json"],
    },
    multiple: true,
  })

  const handleUpload = async () => {
    if (files.length === 0) return

    try {
      setUploading(true)

      const formData = new FormData()
      files.forEach((file) => {
        formData.append("files", file)
      })

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to upload documents")
      }

      const result = await res.json()
      const ready = (Array.isArray(result.documents) ? result.documents : [])
        .filter((document: UploadedDocument) => document.profile_ready)
      setProfileDocuments(ready)
      setProfilePromptOpen(ready.length > 0)
      setProfileError(null)
      setProfileResult(null)
      setUploaded(true)
    } catch (error) {
      console.error("Upload failed:", error)
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to upload documents. Please try again."
      )
    } finally {
      setUploading(false)
    }
  }

  const handleUseDocumentDetails = async () => {
    setApplyingDetails(true)
    setProfileError(null)
    try {
      const response = await fetch("/api/profile/autofill-from-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: profileDocuments.map((document) => document.id) }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || "Could not update application details")
      setProfileResult(
        result.filledCount > 0
          ? `${result.filledCount} blank detail${result.filledCount === 1 ? " was" : "s were"} added to your profile.`
          : "Your profile already has the details found in these documents."
      )
      setProfilePromptOpen(false)
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Could not update application details")
    } finally {
      setApplyingDetails(false)
    }
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  if (uploaded) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-md text-center"
          >
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-primary/25 bg-primary/10">
              <CheckCircle className="h-9 w-9 text-primary-strong dark:text-primary" />
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Upload successful
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Your documents are in your library. Any extracted details are ready to use.
            </p>
            {profileResult ? <p role="status" className="mt-4 text-sm text-primary-strong dark:text-primary">{profileResult}</p> : null}
            <div className="mt-7 flex items-center justify-center gap-3">
              <Link
                href="/documents"
                className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_rgba(24,187,112,0.5)] transition-all duration-200 hover:-translate-y-0.5"
              >
                View documents
              </Link>
              <button
                type="button"
                onClick={() => {
                  setUploaded(false)
                  setFiles([])
                  setProfileDocuments([])
                  setProfileResult(null)
                }}
                className="inline-flex h-10 items-center rounded-lg border border-border/80 bg-card px-5 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
              >
                Upload more
              </button>
            </div>
          </motion.div>
        </div>
        <Dialog open={profilePromptOpen} onOpenChange={(open) => {
          if (!open && !applyingDetails) setProfilePromptOpen(false)
        }}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary-strong dark:text-primary">
                <Wand2 className="h-5 w-5" />
              </span>
              <DialogTitle className="font-display text-[clamp(1.25rem,1vw+1rem,1.6rem)] tracking-[-0.04em]">
                Add these details to your profile?
              </DialogTitle>
              <DialogDescription>
                We found application details in {profileDocuments.length === 1 ? "this document" : "these documents"}. Only blank fields will be filled. You can also do this later from Profile.
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-2 rounded-xl border border-border/70 bg-muted/30 p-3 text-sm text-foreground">
              {profileDocuments.map((document) => (
                <li key={document.id} className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-primary-strong dark:text-primary" />
                  <span className="truncate">{document.file_name}</span>
                </li>
              ))}
            </ul>
            {profileError ? <p role="alert" className="text-sm text-destructive">{profileError}</p> : null}
            <DialogFooter>
              <Button onClick={handleUseDocumentDetails} disabled={applyingDetails}>
                {applyingDetails ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {applyingDetails ? "Adding details…" : "Yes, fill blank details"}
              </Button>
              <Button variant="outline" onClick={() => setProfilePromptOpen(false)} disabled={applyingDetails}>
                No, not now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          overline="Library"
          title="Upload documents"
          description="Drop in a résumé, transcript or certificate — ApplyOS parses it and the AI drafts from it."
          actions={
            <Link
              href="/documents"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3.5 text-[13px] font-medium text-foreground shadow-sm transition-colors hover:border-primary/40"
            >
              View library
            </Link>
          }
        />

        {/* Upload Area — sized to the task instead of filling the viewport */}
        <Card className="rounded-2xl border-border/70">
          <CardContent className="p-4 sm:p-5">
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200 sm:p-8 ${isDragActive
                ? "border-primary bg-primary/[0.06]"
                : "border-border bg-muted/30 hover:border-primary/40 hover:bg-primary/[0.03]"
                }`}
            >
              <input {...getInputProps()} />
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 sm:mb-4">
                <Upload className="h-6 w-6 text-primary-strong dark:text-primary" />
              </div>
              {isDragActive ? (
                <p className="text-base font-semibold text-primary-strong dark:text-primary">
                  Drop files here…
                </p>
              ) : (
                <>
                  <p className="text-[15px] font-semibold text-foreground">
                    Drag &amp; drop files here, or{" "}
                    <span className="text-primary-strong dark:text-primary">browse</span>
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">
                    PDF, DOCX, TXT, MD, JSON · up to 25MB each
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Selected Files */}
        {files.length > 0 && (
          <Card className="rounded-2xl border-border/70">
            <div className="border-b border-border/60 px-4 py-3.5 sm:px-6">
              <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">
                Selected files
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {files.length}
                </span>
              </h3>
            </div>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-2">
                {files.map((file, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-center justify-between rounded-xl border border-border/70 p-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-4 w-4 text-primary-strong dark:text-primary" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {file.size > 1024 * 1024
                            ? (file.size / (1024 * 1024)).toFixed(1) + " MB"
                            : (file.size / 1024).toFixed(0) + " KB"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(index)}
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground shadow-[0_6px_20px_-8px_rgba(24,187,112,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-8px_rgba(24,187,112,0.75)] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
              >
                {uploading ? (
                  <>
                    <Upload className="h-4 w-4 animate-pulse" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload {files.length} file{files.length > 1 ? "s" : ""}
                  </>
                )}
              </button>
            </CardContent>
          </Card>
        )}

        {/* What happens next — a single list rather than three cards that all
            restate the same promise in different words. */}
        <section className="rounded-2xl border border-border/70 bg-card p-5">
          <h2 className="font-display text-[15px] font-bold tracking-tight text-foreground">
            What happens to your file
          </h2>
          <ol className="mt-4 space-y-3">
            {[
              {
                title: "Parsed into structure",
                text: "Education, experience, projects and skills are extracted automatically — you can correct anything afterwards.",
              },
              {
                title: "Scored and reported",
                text: "You get an overall score with per-category feedback, so you know what to tighten before applying.",
              },
              {
                title: "Available to every draft",
                text: "Cover letters, application answers and interview prep all read from the parsed version.",
              },
            ].map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-display text-[11px] font-bold text-primary-strong dark:text-primary">
                  {i + 1}
                </span>
                <div>
                  <p className="text-[13.5px] font-semibold text-foreground">{step.title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            Files stay in your own workspace and are only ever read by your own drafts.
          </p>
        </section>

        {/* Error Modal */}
        <AlertModal
          isOpen={!!errorMessage}
          title="Upload Failed"
          message={errorMessage || ""}
          type="error"
          onClose={() => setErrorMessage(null)}
        />
      </div>
    </DashboardLayout>
  )
}
