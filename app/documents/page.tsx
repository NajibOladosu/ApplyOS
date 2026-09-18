"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { Badge } from "@/shared/ui/badge"
import { motion } from "framer-motion"
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Eye,
  MoreVertical,
  Loader2,
} from "lucide-react"
import Link from "next/link"
import type { Document } from "@/types/database"
import { getDocuments, deleteDocument } from "@/modules/documents/services/document.service"
import { cn } from "@/shared/lib/utils"
import { useToast } from "@/shared/ui/use-toast"
import { ConfirmDialog } from "@/shared/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu"

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

export default function DocumentsPage() {
  const { toast } = useToast()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [reportingId, setReportingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; fileUrl: string; fileName: string } | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const docs = await getDocuments()
        setDocuments(docs)
      } catch (err) {
        console.error("Error loading documents:", err)
        setError("Unable to load your documents. Please try again.")
        toast({
          variant: "destructive",
          title: "Failed to load documents",
          description: "Please refresh the page or try again later.",
        })
      } finally {
        setLoading(false)
      }
    }

    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const requestDelete = (doc: Document) => {
    setDeleteTarget({
      id: doc.id,
      fileUrl: doc.file_url,
      fileName: doc.file_name,
    })
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    try {
      await deleteDocument(deleteTarget.id, deleteTarget.fileUrl)
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id))
      toast({
        title: "Document deleted",
        description: `"${deleteTarget.fileName}" has been removed.`,
      })
    } catch (err) {
      console.error("Error deleting document:", err)
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "Failed to delete document. Please try again.",
      })
    } finally {
      setDeletingId(null)
      setDeleteTarget(null)
    }
  }

  // Analyze document via backend pipeline:
  // - POST /api/documents/reprocess with { id, force }
  // - Backend enforces auth/RLS, fetches file, calls parseDocument, and persists parsed_data & status.
  const handleAnalyze = async (doc: Document) => {
    if (processingId) return

    setProcessingId(doc.id)
    try {
      const res = await fetch("/api/documents/reprocess", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: doc.id, force: true }),
      })

      const payload = await res.json().catch(() => ({}))

      if (!res.ok) {
        console.error("Analyze error:", payload)
        toast({
          title: "Analyze failed",
          description:
            payload?.error ||
            "Unable to analyze this document. Please try again or contact support.",
          variant: "destructive",
        })
        return
      }

      setDocuments((prev) =>
        prev.map((d) =>
          d.id === doc.id
            ? {
              ...d,
              parsed_data: payload.parsed_data ?? d.parsed_data,
              // analysis_status / parsed_at are surfaced via refetch on detail page; here we optimistically mark analyzed.
            }
            : d
        )
      )

      toast({
        title: "Document analyzed",
        description:
          "The document has been analyzed and its structured data has been updated.",
      })
    } catch (error) {
      console.error("Error during analyze handler:", error)
      toast({
        title: "Analyze failed",
        description:
          "An unexpected error occurred while trying to analyze this document.",
        variant: "destructive",
      })
    } finally {
      setProcessingId(null)
    }
  }

  // Generate report via backend:
  // - POST /api/documents/[id]/report
  // - Backend uses generateDocumentReport(), persists report & report_generated_at.
  const handleGenerateReport = async (doc: Document) => {
    if (reportingId) return

    setReportingId(doc.id)
    try {
      const res = await fetch(`/api/documents/${doc.id}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force: true }),
      })

      const payload = await res.json().catch(() => ({}))

      if (!res.ok) {
        console.error("Report error:", payload)
        toast({
          title: "Report generation failed",
          description:
            payload?.error ||
            "Unable to generate a report for this document.",
          variant: "destructive",
        })
        return
      }

      setDocuments((prev) =>
        prev.map((d) =>
          d.id === doc.id
            ? {
              ...d,
              parsed_data: { ...(d.parsed_data ?? {}) } as typeof d.parsed_data,
              ...(payload.report !== undefined && {
                report: payload.report,
                report_generated_at: payload.report_generated_at,
              }),
            }
            : d
        )
      )

      toast({
        title: "Report generated",
        description:
          "Comprehensive report has been generated and saved for this document.",
      })
    } catch (error) {
      console.error("Error generating report:", error)
      toast({
        title: "Report generation failed",
        description:
          "Unable to generate a report at this time. Please try again later.",
        variant: "destructive",
      })
    } finally {
      setReportingId(null)
    }
  }

  const totalSize = documents.reduce((acc, doc) => acc + (doc.file_size || 0), 0)
  const analyzedCount = documents.filter((d) => d.parsed_data).length

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Documents
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your resumes, transcripts, and certificates — the context behind every AI draft.
            </p>
          </div>
          <Link
            href="/upload"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_rgba(24,187,112,0.5)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_-4px_rgba(24,187,112,0.65)]"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload document
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {[
            { label: "Total documents", value: String(documents.length) },
            { label: "Total size", value: formatFileSize(totalSize) },
            { label: "Analyzed", value: String(analyzedCount) },
            {
              label: "This month",
              value: String(
                documents.filter((d) => {
                  if (!d.created_at) return false
                  const created = new Date(d.created_at)
                  const now = new Date()
                  return (
                    created.getFullYear() === now.getFullYear() &&
                    created.getMonth() === now.getMonth()
                  )
                }).length
              ),
            },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                <p className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">
                  {stat.value}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.length === 0 ? (
            <Card className="rounded-2xl border-border/70">
              <CardContent className="p-12 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
                  <FileText className="h-6 w-6 text-primary-strong dark:text-primary" />
                </div>
                <p className="font-display text-base font-bold tracking-tight text-foreground">
                  No documents yet
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  Upload your first resume, transcript, or certificate — it powers every AI draft
                  you create.
                </p>
                <Link
                  href="/upload"
                  className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_rgba(24,187,112,0.5)] transition-all duration-200 hover:-translate-y-0.5"
                >
                  <Upload className="h-4 w-4" />
                  Upload your first document
                </Link>
              </CardContent>
            </Card>
          ) : (
            documents.map((doc, index) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Card className="rounded-2xl border-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30">
                  <CardHeader className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 shrink-0">
                        <FileText className="h-[18px] w-[18px] text-primary-strong dark:text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display truncate text-[15px] font-semibold text-foreground">{doc.file_name}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatFileSize(doc.file_size || 0)}
                          {doc.created_at && (
                            <> · {new Date(doc.created_at).toLocaleDateString()}</>
                          )}
                        </p>
                      </div>
                      {/* 3-dot menu for non-destructive AI actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-primary h-8 w-8 sm:h-9 sm:w-9"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 sm:w-52">
                          {/* Re-process flow (see handler for detailed behavior notes) */}
                          <DropdownMenuItem
                            onClick={() => handleAnalyze(doc)}
                            disabled={processingId === doc.id}
                            className="cursor-pointer text-xs sm:text-sm"
                          >
                            {processingId === doc.id ? (
                              <>
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <Upload className="mr-2 h-3 w-3" />
                                Analyze document
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleGenerateReport(doc)}
                            disabled={reportingId === doc.id}
                            className="cursor-pointer text-xs sm:text-sm"
                          >
                            {reportingId === doc.id ? (
                              <>
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                Generating report...
                              </>
                            ) : (
                              <>
                                <FileText className="mr-2 h-3 w-3" />
                                Generate report
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                    {/* AI Analysis summary */}
                    {doc.parsed_data && (
                      <div className="mb-4">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          {/* Education */}
                          {Array.isArray(doc.parsed_data.education) && doc.parsed_data.education.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {doc.parsed_data.education.length} {doc.parsed_data.education.length === 1 ? 'Education' : 'Educations'}
                            </Badge>
                          )}

                          {/* Experience */}
                          {Array.isArray(doc.parsed_data.experience) && doc.parsed_data.experience.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {doc.parsed_data.experience.length} {doc.parsed_data.experience.length === 1 ? 'Experience' : 'Experiences'}
                            </Badge>
                          )}

                          {/* Projects */}
                          {Array.isArray(doc.parsed_data.projects) && doc.parsed_data.projects.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {doc.parsed_data.projects.length} {doc.parsed_data.projects.length === 1 ? 'Project' : 'Projects'}
                            </Badge>
                          )}

                          {/* Skills */}
                          {doc.parsed_data.skills && (
                            (doc.parsed_data.skills.technical?.length || 0) +
                            (doc.parsed_data.skills.soft?.length || 0) +
                            (doc.parsed_data.skills.other?.length || 0) > 0
                          ) && (
                              <Badge variant="secondary" className="text-xs">
                                {(
                                  (doc.parsed_data.skills.technical?.length || 0) +
                                  (doc.parsed_data.skills.soft?.length || 0) +
                                  (doc.parsed_data.skills.other?.length || 0)
                                )} Skills
                              </Badge>
                            )}
                        </div>

                        {/* Inline report display if available */}
                        {doc.report && (
                          <div className="rounded-md bg-muted/60 p-2.5 mb-2.5">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-xs font-medium text-muted-foreground">
                                {doc.report.documentType}
                              </p>
                              <span className="text-xs font-bold text-primary">
                                {doc.report.overallScore}/10
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                              {doc.report.overallAssessment}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 min-w-[100px]"
                        asChild
                      >
                        <Link href={`/documents/${doc.id}`} className="flex items-center justify-center gap-1.5">
                          <Eye className="h-3 w-3" />
                          <span className="text-xs sm:text-sm">View</span>
                        </Link>
                      </Button>
                      {doc.file_url ? (
                        <a
                          href={doc.file_url}
                          download={doc.file_name}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-w-[100px]"
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full flex items-center justify-center gap-1.5"
                          >
                            <Download className="h-4 w-4 flex-shrink-0" />
                            <span className="text-xs sm:text-sm">Download</span>
                          </Button>
                        </a>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5"
                          disabled
                        >
                          <Download className="h-4 w-4 flex-shrink-0" />
                          <span className="text-xs sm:text-sm">Download</span>
                        </Button>
                      )}
                      {/* Explicit, visible destructive delete button with confirm dialog */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "text-destructive hover:bg-destructive hover:text-white h-9 w-9",
                          deletingId === doc.id && "opacity-50 cursor-not-allowed"
                        )}
                        onClick={() => requestDelete(doc)}
                        disabled={deletingId === doc.id}
                      >
                        {deletingId === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        {error && (
          <p className="text-xs text-destructive">
            {error}
          </p>
        )}

        <ConfirmDialog
          open={!!deleteTarget}
          title="Delete document"
          description={
            deleteTarget
              ? `This will permanently delete "${deleteTarget.fileName}" and its associated data. This action cannot be undone.`
              : "This will permanently delete the document and its associated data. This action cannot be undone."
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="destructive"
          onCancel={() => {
            if (!deletingId) setDeleteTarget(null)
          }}
          onConfirm={handleConfirmDelete}
        />
      </div>
    </DashboardLayout>
  )
}
