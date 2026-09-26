"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { motion } from "framer-motion"
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Eye,
  MoreVertical,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Sparkles,
  FileSpreadsheet,
  FileImage,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Stat } from "@/components/data/stat"
import { EmptyState } from "@/components/data/empty-state"
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

/** Analysis status is the one thing a document card must communicate. */
const ANALYSIS_STATUS = {
  success: {
    label: "Analyzed",
    pill: "border-primary/25 bg-primary/10 text-primary-strong dark:text-primary",
    icon: CheckCircle2,
    spin: "",
  },
  pending: {
    label: "Analyzing",
    pill: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    icon: Clock3,
    spin: "animate-spin",
  },
  failed: {
    label: "Failed",
    pill: "border-destructive/25 bg-destructive/10 text-destructive",
    icon: AlertTriangle,
    spin: "",
  },
  not_analyzed: {
    label: "Not analyzed",
    pill: "border-border/70 bg-muted/60 text-muted-foreground",
    icon: Clock3,
    spin: "",
  },
} as const

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
  const [docFilter, setDocFilter] = useState<"all" | "analyzed" | "attention">("all")
  const [searchQuery, setSearchQuery] = useState("")

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
  const analyzedCount = documents.filter((d) => d.analysis_status === "success").length
  const needsAnalysis = documents.filter((d) => d.analysis_status !== "success" && d.analysis_status !== "failed").length
  const failedCount = documents.filter((d) => d.analysis_status === "failed").length

  const visibleDocuments = documents.filter((doc) => {
    const matchesSearch = doc.file_name.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false
    if (docFilter === "all") return true
    if (docFilter === "analyzed") return doc.analysis_status === "success"
    if (docFilter === "attention")
      return doc.analysis_status === "failed" || doc.analysis_status === "not_analyzed" || doc.analysis_status === "pending"
    return true
  })

  const FILTERS = [
    { key: "all" as const, label: "All", count: documents.length },
    { key: "analyzed" as const, label: "Analyzed", count: analyzedCount },
    { key: "attention" as const, label: "Needs attention", count: needsAnalysis + failedCount },
  ]

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
        <PageHeader
          overline="Library"
          title="Documents"
          description={
            documents.length > 0
              ? `${documents.length} files · ${formatFileSize(totalSize)} · ${analyzedCount} analyzed`
              : "Resumes, transcripts and certificates — the evidence behind every AI draft."
          }
          actions={
            <Link
              href="/upload"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_rgba(24,187,112,0.5)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_-4px_rgba(24,187,112,0.65)]"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload document
            </Link>
          }
        />

        {documents.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <Stat
                label="Analyzed"
                value={analyzedCount}
                icon={<CheckCircle2 className="h-4 w-4" />}
                accent="primary"
                hint={analyzedCount === documents.length ? "Every file is readable by the AI" : `${documents.length - analyzedCount} still to process`}
              />
              <Stat
                label="Needs attention"
                value={needsAnalysis + failedCount}
                icon={<AlertTriangle className="h-4 w-4" />}
                accent={needsAnalysis + failedCount > 0 ? "warning" : "muted"}
                hint={failedCount > 0 ? `${failedCount} failed to parse` : "Nothing stuck"}
              />
              <Stat
                label="Storage used"
                value={formatFileSize(totalSize)}
                icon={<FileSpreadsheet className="h-4 w-4" />}
                hint={`Across ${documents.length} ${documents.length === 1 ? "file" : "files"}`}
              />
              <Stat
                label="Parsed skills"
                value={documents.reduce((sum, d) => {
                  const skills = d.parsed_data?.skills
                  if (!skills) return sum
                  return sum + (skills.technical?.length ?? 0) + (skills.soft?.length ?? 0) + (skills.other?.length ?? 0)
                }, 0)}
                icon={<Sparkles className="h-4 w-4" />}
                hint="Distinct skills across your CVs"
              />
            </div>

            {/* Search + status chips in one card — the same filter language
                as the applications list, so both library pages feel related. */}
            <div className="rounded-2xl border border-border/70 bg-card p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                <input
                  type="search"
                  placeholder="Search by file name…"
                  className="h-9 w-full rounded-lg border border-transparent bg-muted/50 pl-9 pr-3 text-sm text-foreground transition-all placeholder:text-muted-foreground focus-visible:border-primary/40 focus-visible:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-3">
                {FILTERS.map((f) => {
                  const active = docFilter === f.key
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setDocFilter(f.key)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-all duration-150",
                        active
                          ? "bg-foreground text-background shadow-sm"
                          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                      )}
                    >
                      {f.label}
                      <span className={cn("text-[11px] tabular-nums", active ? "opacity-60" : "opacity-50")}>
                        {f.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleDocuments.map((doc, index) => {
                const status = ANALYSIS_STATUS[doc.analysis_status] ?? ANALYSIS_STATUS.not_analyzed
                const StatusIcon = status.icon
                const ext = (doc.file_name.split(".").pop() ?? "").toLowerCase()
                const TypeIcon = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ? FileImage : FileText

                return (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: Math.min(index * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Card className="flex h-full flex-col rounded-2xl border-border/70 transition-all duration-200 hover:border-primary/30">
                      <CardContent className="flex flex-1 flex-col p-5">
                        {/* File identity */}
                        <div className="flex items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/60">
                            <TypeIcon className="h-[18px] w-[18px] text-foreground/70" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/documents/${doc.id}`}
                              className="font-display block truncate text-[14px] font-bold tracking-tight text-foreground transition-colors hover:text-primary-strong dark:hover:text-primary"
                              title={doc.file_name}
                            >
                              {doc.file_name}
                            </Link>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatFileSize(doc.file_size || 0)}
                              {doc.created_at ? <> · {new Date(doc.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</> : null}
                            </p>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem
                                onClick={() => handleAnalyze(doc)}
                                disabled={processingId === doc.id}
                                className="cursor-pointer"
                              >
                                {processingId === doc.id ? (
                                  <>
                                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                    Analyzing…
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                                    {doc.analysis_status === "success" ? "Re-analyze" : "Analyze document"}
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleGenerateReport(doc)}
                                disabled={reportingId === doc.id}
                                className="cursor-pointer"
                              >
                                {reportingId === doc.id ? (
                                  <>
                                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                    Generating…
                                  </>
                                ) : (
                                  <>
                                    <FileText className="mr-2 h-3.5 w-3.5" />
                                    Generate report
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Status — the card previously said nothing about whether
                            the file was readable, which is the one thing that matters. */}
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.pill}`}
                          >
                            <StatusIcon className={`h-3 w-3 ${status.spin ?? ""}`} />
                            {status.label}
                          </span>

                          {doc.report ? (
                            <span className="font-display text-sm font-bold tabular-nums text-foreground">
                              {doc.report.overallScore}
                              <span className="text-xs font-medium text-muted-foreground">/10</span>
                            </span>
                          ) : null}
                        </div>

                        {/* Parsed summary */}
                        {doc.parsed_data ? (
                          <div className="mt-4 space-y-2">
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                ["education", "Education"],
                                ["experience", "Experience"],
                                ["projects", "Project"],
                              ].map(([key, label]) => {
                                const arr = (doc.parsed_data as Record<string, unknown>)?.[key]
                                if (!Array.isArray(arr) || arr.length === 0) return null
                                return (
                                  <span
                                    key={key}
                                    className="rounded-md border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                                  >
                                    {arr.length} {label}
                                    {arr.length > 1 && key !== "education" ? "s" : ""}
                                  </span>
                                )
                              })}
                              {(() => {
                                const skills = doc.parsed_data?.skills
                                const n = (skills?.technical?.length ?? 0) + (skills?.soft?.length ?? 0) + (skills?.other?.length ?? 0)
                                return n > 0 ? (
                                  <span className="rounded-md border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                    {n} skills
                                  </span>
                                ) : null
                              })()}
                            </div>

                            {doc.report?.overallAssessment ? (
                              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                {doc.report.overallAssessment}
                              </p>
                            ) : null}
                          </div>
                        ) : doc.analysis_error ? (
                          <p className="mt-4 line-clamp-2 text-xs leading-relaxed text-destructive/90">
                            {doc.analysis_error}
                          </p>
                        ) : (
                          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                            Not analyzed yet — run the analyzer to unlock AI drafts from this file.
                          </p>
                        )}

                        {/* Actions */}
                        <div className="mt-auto flex items-center gap-2 pt-5">
                          <Link
                            href={`/documents/${doc.id}`}
                            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-card text-[13px] font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary-strong dark:hover:text-primary"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Link>
                          {doc.file_url ? (
                            <a
                              href={doc.file_url}
                              download={doc.file_name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-card text-[13px] font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary-strong dark:hover:text-primary"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </a>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => requestDelete(doc)}
                            disabled={deletingId === doc.id}
                            aria-label={`Delete ${doc.file_name}`}
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
                )
              })}

              {visibleDocuments.length === 0 ? (
                <div className="md:col-span-2 xl:col-span-3">
                  <EmptyState
                    icon={searchQuery ? <Search className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                    title={searchQuery ? "No matching files" : "Nothing here"}
                    description={
                      searchQuery
                        ? `No documents match “${searchQuery}”. Try a different name or clear the filter.`
                        : "Every document in this view is already analyzed."
                    }
                    variant="page"
                  />
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-border/70 bg-card">
            <EmptyState
              variant="page"
              icon={<FileText className="h-5 w-5" />}
              title="No documents yet"
              description="Upload your first resume, transcript or certificate — it powers every AI draft you create."
              action={
                <Link
                  href="/upload"
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_rgba(24,187,112,0.5)] transition-all duration-200 hover:-translate-y-0.5"
                >
                  <Upload className="h-4 w-4" />
                  Upload your first document
                </Link>
              }
            />
          </div>
        )}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

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
