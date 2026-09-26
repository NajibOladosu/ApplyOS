"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import {
  Loader2,
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  FileText,
  ChevronDown,
  Check,
  CheckCircle2,
  AlertCircle,
  Circle,
  ArrowRight,
  Sparkles,
  Trophy,
  GitBranch,
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/shared/ui/use-toast"
import { cn } from "@/shared/lib/utils"
import { MiniBar } from "@/components/data/stat"
import { ScoreRing, StatusPill } from "@/components/data/status-pill"
import { EmptyState } from "@/components/data/empty-state"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu"
import { getDocuments } from "@/modules/documents/services/document.service"
import type { ApplicationStatus, Document, DocumentReport } from "@/types/database"

type ParsedEducation = {
  institution: string
  degree: string
  field: string
  start_date: string
  end_date: string
  description: string
}

type ParsedExperience = {
  company: string
  role: string
  start_date: string
  end_date: string
  description: string
}

type ParsedProject = {
  name: string
  description: string
  technologies?: string[]
  start_date?: string
  end_date?: string
}

type ParsedSkills = {
  technical: string[]
  soft: string[]
  other: string[]
}

type ParsedCertification = {
  name: string
  issuer: string
  date: string
}

type ParsedDocument = {
  education: ParsedEducation[]
  experience: ParsedExperience[]
  projects: ParsedProject[]
  skills: ParsedSkills
  achievements: string[]
  certifications: ParsedCertification[]
  keywords: string[]
  raw_highlights: string[]
}

type DocumentDetail = {
  id: string
  file_name: string
  file_url: string | null
  file_type: string | null
  file_size: number | null
  created_at: string | null
  updated_at: string | null
  version: number | null
  report: DocumentReport | null
  report_generated_at: string | null
  parsed_data: ParsedDocument | null
  parsed_at: string | null
  analysis_status: "not_analyzed" | "pending" | "success" | "failed"
  analysis_error: string | null
  application_id: string | null
}

type LinkedApplication = {
  id: string
  title: string
  company: string | null
  status: ApplicationStatus
  type: string
  priority: string
  deadline: string | null
  created_at: string | null
}

/** How many linked applications fit before the list collapses behind "show more". */
const LINKED_VISIBLE = 3

function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "Unknown size"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Short, unambiguous date — the long toLocaleString is for the header line only. */
function formatDay(value: string | null): string {
  if (!value) return "Unknown"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "Unknown"
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

function formatRelativeDay(value: string | null): string {
  if (!value) return ""
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ""
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return "Updated today"
  if (days === 1) return "Updated yesterday"
  if (days < 30) return `Updated ${days} days ago`
  return `Updated ${new Date(value).toLocaleDateString()}`
}

/**
 * Groups uploads of "the same file" into a version family: identical base name
 * ignoring the extension and browser copy suffixes ("resume.pdf",
 * "resume (2).pdf", "resume 3.pdf" all resolve to "resume").
 */
function familyKey(fileName: string): string {
  const noExt = fileName.replace(/\.[a-z0-9]{1,6}$/i, "").trim().toLowerCase()
  return noExt
    .replace(/\s*\(\d{1,3}\)$/, "")
    .replace(/\s\d{1,3}$/, "")
    .trim()
}

function initialsFor(app: { title: string; company: string | null }) {
  const source = app.company || app.title
  return (
    source
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "AP"
  )
}

/** Card header used by both columns: overline + title, optional right-hand slot. */
function CardHead({
  overline,
  title,
  action,
}: {
  overline: string
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border/50 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
          {overline}
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{title}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

function ParsedSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 py-4">
      <h3 className="font-display mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Chip({
  children,
  variant = "default",
}: {
  children: React.ReactNode
  variant?: "default" | "primary" | "muted"
}) {
  const tones = {
    default: "border-border/70 bg-muted/50 text-foreground/90",
    primary: "border-primary/25 bg-primary/10 text-primary-strong dark:text-primary",
    muted: "border-border/60 bg-transparent text-muted-foreground",
  } as const
  return (
    <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-medium", tones[variant])}>
      {children}
    </span>
  )
}

/** The file's own facts — kept out of the header so the title stays the loudest thing. */
function FileFacts({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/70">
      <CardHead overline="File" title="Document details" />
      <dl className="divide-y divide-border/50">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 px-5 py-3">
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="truncate text-[13px] font-medium text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

export default function DocumentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()

  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingReport, setLoadingReport] = useState(false)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Version family: every upload of this same file, so the header can switch
  // between v1…vN instead of only showing the one currently open.
  const [allDocs, setAllDocs] = useState<Document[]>([])
  // Applications that use this document (junction + legacy single link).
  const [linkedApps, setLinkedApps] = useState<LinkedApplication[]>([])
  const [linkedLoading, setLinkedLoading] = useState(false)
  const [showAllLinked, setShowAllLinked] = useState(false)

  const documentId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : ""

  useEffect(() => {
    getDocuments()
      .then(setAllDocs)
      .catch(() => setAllDocs([]))
  }, [])

  const fetchLinked = async (id: string) => {
    setLinkedLoading(true)
    setShowAllLinked(false)
    try {
      const res = await fetch(`/api/documents/${id}/applications`)
      if (!res.ok) return
      const payload = await res.json().catch(() => ({}))
      setLinkedApps(Array.isArray(payload.applications) ? payload.applications : [])
    } catch (err) {
      console.error("Error loading linked applications:", err)
    } finally {
      setLinkedLoading(false)
    }
  }

  useEffect(() => {
    if (!documentId) return

    const fetchDocument = async () => {
      setLoading(true)
      setError(null)
      setLinkedApps([])
      try {
        const res = await fetch(`/api/documents/${documentId}`)
        const payload = await res.json().catch(() => ({}))

        if (!res.ok) {
          setError(payload?.error || "Failed to load document")
          if (res.status === 404) {
            toast({
              variant: "destructive",
              title: "Document not found",
              description: "This document does not exist or you do not have access.",
            })
          } else {
            toast({
              variant: "destructive",
              title: "Failed to load document",
              description: payload?.error || "Please try again.",
            })
          }
          return
        }

        const mapped: DocumentDetail = {
          id: payload.id,
          file_name: payload.file_name,
          file_url: payload.file_url ?? null,
          file_type: payload.file_type ?? null,
          file_size: typeof payload.file_size === "number" ? payload.file_size : null,
          created_at: payload.created_at ?? null,
          updated_at: payload.updated_at ?? null,
          version: typeof payload.version === "number" ? payload.version : null,
          report: payload.report ?? null,
          report_generated_at: payload.report_generated_at ?? null,
          parsed_data: payload.parsed_data ?? null,
          parsed_at: payload.parsed_at ?? null,
          analysis_status: payload.analysis_status ?? "not_analyzed",
          analysis_error: payload.analysis_error ?? null,
          application_id: payload.application_id ?? null,
        }

        setDoc(mapped)
        void fetchLinked(documentId)
      } catch (err) {
        console.error("Error loading document detail:", err)
        setError("Unable to load document. Please try again.")
        toast({
          variant: "destructive",
          title: "Error",
          description: "Unable to load document. Please refresh and try again.",
        })
      } finally {
        setLoading(false)
      }
    }

    void fetchDocument()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId])

  const refetch = async () => {
    if (!documentId) return
    try {
      const res = await fetch(`/api/documents/${documentId}`)
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) return

      // Ensure parsed_data is properly extracted (it might be nested in response)
      const parsedData = payload.parsed_data || null

      setDoc((prev) =>
        prev
          ? {
            ...prev,
            file_name: payload.file_name ?? prev.file_name,
            file_url: payload.file_url ?? prev.file_url,
            file_type: payload.file_type ?? prev.file_type,
            file_size: payload.file_size ?? prev.file_size,
            report: payload.report ?? prev.report,
            report_generated_at: payload.report_generated_at ?? prev.report_generated_at,
            parsed_data: parsedData ?? prev.parsed_data,
            parsed_at: payload.parsed_at ?? prev.parsed_at,
            analysis_status: payload.analysis_status ?? prev.analysis_status,
            analysis_error: payload.analysis_error ?? prev.analysis_error,
          }
          : {
            id: payload.id,
            file_name: payload.file_name,
            file_url: payload.file_url ?? null,
            file_type: payload.file_type ?? null,
            file_size: typeof payload.file_size === "number" ? payload.file_size : null,
            created_at: payload.created_at ?? null,
            updated_at: payload.updated_at ?? null,
            version: typeof payload.version === "number" ? payload.version : null,
            report: payload.report ?? null,
            report_generated_at: payload.report_generated_at ?? null,
            parsed_data: parsedData ?? null,
            parsed_at: payload.parsed_at ?? null,
            analysis_status: payload.analysis_status ?? "not_analyzed",
            analysis_error: payload.analysis_error ?? null,
            application_id: payload.application_id ?? null,
          }
      )
    } catch (err) {
      console.error("Error refreshing document detail:", err)
    }
  }

  const handleOpenOriginal = () => {
    if (doc?.file_url) {
      window.open(doc.file_url, "_blank", "noopener,noreferrer")
    } else {
      toast({
        variant: "destructive",
        title: "No file URL",
        description: "Original file URL is not available for this document.",
      })
    }
  }

  const handleAnalyze = async () => {
    if (!doc || loadingAnalysis) return
    setLoadingAnalysis(true)
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
          variant: "destructive",
          title: "Analyze failed",
          description:
            payload?.error ||
            "Unable to analyze this document. Please try again.",
        })
      } else {
        toast({
          title: "Document analyzed",
          description:
            "AI analysis has been updated for this document.",
        })

        // UPDATE STATE DIRECTLY FROM RESPONSE (don't wait for refetch)
        const parsedData = payload.parsed_data || null
        setDoc((prev) =>
          prev
            ? {
              ...prev,
              parsed_data: parsedData,
              parsed_at: payload.parsed_at ?? prev.parsed_at,
              analysis_status: payload.analysis_status ?? prev.analysis_status,
              analysis_error: payload.analysis_error ?? prev.analysis_error,
            }
            : prev
        )

        // THEN refetch after a brief delay to ensure DB is updated
        await new Promise(resolve => setTimeout(resolve, 500))
        await refetch()
      }
    } catch (err) {
      console.error("Analyze exception:", err)
      toast({
        variant: "destructive",
        title: "Analyze failed",
        description:
          "An unexpected error occurred while analyzing this document.",
      })
    } finally {
      setLoadingAnalysis(false)
    }
  }

  const handleGenerateReport = async () => {
    if (!doc || loadingReport) return
    setLoadingReport(true)
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
          variant: "destructive",
          title: "Report generation failed",
          description:
            payload?.error ||
            "Unable to generate a report for this document.",
        })
      } else {
        toast({
          title: "Report generated",
          description: "Comprehensive report has been generated and saved.",
        })
        setDoc((prev) =>
          prev
            ? {
              ...prev,
              report: payload.report ?? prev.report,
              report_generated_at:
                payload.report_generated_at ?? prev.report_generated_at,
            }
            : prev
        )
        // Reset expanded categories when new report is generated
        setExpandedCategories(new Set())
      }
    } catch (err) {
      console.error("Report exception:", err)
      toast({
        variant: "destructive",
        title: "Report generation failed",
        description:
          "An unexpected error occurred while generating report.",
      })
    } finally {
      setLoadingReport(false)
    }
  }

  const statusChip = () => {
    if (!doc) return null
    const base =
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
    if (doc.analysis_status === "success") {
      return (
        <span className={cn(base, "border-primary/25 bg-primary/10 text-primary-strong dark:text-primary")}>
          <CheckCircle2 className="h-3 w-3" />
          Parsed
        </span>
      )
    }
    if (doc.analysis_status === "pending") {
      return (
        <span className={cn(base, "border-border/70 bg-muted/60 text-muted-foreground")}>
          <Loader2 className="h-3 w-3 animate-spin" />
          Parsing
        </span>
      )
    }
    if (doc.analysis_status === "failed") {
      return (
        <span className={cn(base, "border-destructive/25 bg-destructive/10 text-destructive")}>
          <AlertCircle className="h-3 w-3" />
          Parse failed
        </span>
      )
    }
    return (
      <span className={cn(base, "border-border/70 bg-muted/60 text-muted-foreground")}>
        <Circle className="h-3 w-3" />
        Not parsed
      </span>
    )
  }

  const toggleCategory = (categoryName: string) => {
    const next = new Set(expandedCategories)
    if (next.has(categoryName)) next.delete(categoryName)
    else next.add(categoryName)
    setExpandedCategories(next)
  }

  /** This file's version family, oldest first, so v1 is the first upload. */
  const versions = useMemo(() => {
    if (!doc) return []
    const key = familyKey(doc.file_name)
    return allDocs
      .filter((d) => familyKey(d.file_name) === key)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }, [allDocs, doc])

  const versionIndex = doc ? versions.findIndex((v) => v.id === doc.id) : -1
  const isLatest = versionIndex === versions.length - 1

  const handleSwitchVersion = (id: string) => {
    if (!doc || id === doc.id) return
    router.replace(`/documents/${id}`)
  }

  /* ---------- Report column ---------- */
  const renderReport = () => {
    if (!doc) return null
    const report = doc.report as DocumentReport | null

    if (!report) {
      const parsedOk = doc.analysis_status === "success"
      return (
          <Card className="overflow-hidden rounded-2xl border-border/70">
            <CardHead overline="Report" title="No report yet" />
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title={parsedOk ? "Nothing has been scored" : "Waiting on a parse"}
              description={
                parsedOk
                  ? "Generate a report to get a score, category feedback and the changes worth making first."
                  : "A report reads the parsed content, so this file has to be parsed before it can be scored."
              }
              action={
                parsedOk ? (
                  <Button size="sm" className="rounded-lg" onClick={handleGenerateReport} disabled={loadingReport}>
                    {loadingReport ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                    Generate report
                  </Button>
                ) : undefined
              }
            />
          </Card>
      )
    }

    const overall = Math.round(report.overallScore * 10)
    const categories = report.categories ?? []

    return (
      <Card className="overflow-hidden rounded-2xl border-border/70">
        <CardHead
          overline="Report"
          title={report.documentType || "Document report"}
          action={
            <div className="flex items-center gap-2">
              {doc.report_generated_at ? (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {formatRelativeDay(doc.report_generated_at)}
                </span>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-lg"
                onClick={handleGenerateReport}
                disabled={loadingReport}
              >
                {loadingReport ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Regenerate
              </Button>
            </div>
          }
        />

        <div className="flex items-center gap-4 border-b border-border/50 px-5 py-4">
          <ScoreRing score={overall} size={68} tone="progress" />
          <div className="min-w-0">
            <p className="font-display text-[26px] font-bold leading-none tracking-[-0.02em] text-foreground">
              {report.overallScore.toFixed(1)}
              <span className="text-base font-medium text-muted-foreground/70">/10</span>
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              {report.overallAssessment || "No summary was returned with this report."}
            </p>
          </div>
        </div>

        {categories.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            This report has no category breakdown — regenerate it to get one.
          </p>
        ) : (
          <ul className="divide-y divide-border/50">
            {categories.map((category) => {
              const open = expandedCategories.has(category.name)
              const hasDetail =
                (category.strengths?.length ?? 0) > 0 || (category.improvements?.length ?? 0) > 0
              return (
                <li key={category.name}>
                  <button
                    type="button"
                    onClick={() => hasDetail && toggleCategory(category.name)}
                    aria-expanded={open}
                    className={cn(
                      "flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors",
                      hasDetail ? "hover:bg-muted/40" : "cursor-default"
                    )}
                  >
                    <span className="w-32 shrink-0 text-sm font-medium text-foreground">
                      {category.name}
                    </span>
                    <span className="min-w-0 flex-1">
                      <MiniBar
                        ratio={category.score / 10}
                        tone={category.score >= 8 ? "primary" : category.score >= 6 ? "warning" : "danger"}
                      />
                    </span>
                    <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                      {category.score}
                      <span className="font-normal text-muted-foreground/70">/10</span>
                    </span>
                    {hasDetail ? (
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          open && "rotate-180"
                        )}
                      />
                    ) : (
                      <span className="h-4 w-4 shrink-0" />
                    )}
                  </button>

                  {open ? (
                    <div className="space-y-3 bg-muted/20 px-5 pb-4 pt-1">
                      {category.strengths?.length ? (
                        <div>
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                            Working
                          </p>
                          <ul className="space-y-1.5">
                            {category.strengths.map((item, i) => (
                              <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-foreground/90">
                                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {category.improvements?.length ? (
                        <div>
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                            Worth changing
                          </p>
                          <ul className="space-y-1.5">
                            {category.improvements.map((item, i) => (
                              <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-foreground/90">
                                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    )
  }

  /* ---------- Parsed content column ---------- */
  const renderParsed = () => {
    if (!doc) return null
    const parsed = doc.parsed_data as ParsedDocument | null

    if (doc.analysis_status !== "success" || !parsed) {
      return (
        <Card className="overflow-hidden rounded-2xl border-border/70">
          <CardHead
            overline="Parsed content"
            title="What ApplyOS read"
            action={statusChip()}
          />
          {doc.analysis_status === "failed" && doc.analysis_error ? (
            <div className="mx-5 mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                Last attempt failed
              </p>
              <p className="mt-1 text-xs leading-relaxed text-destructive/90">{doc.analysis_error}</p>
            </div>
          ) : null}
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title={
              doc.analysis_status === "pending" ? "Still reading this file" : "Not parsed yet"
            }
            description={
              doc.analysis_status === "pending"
                ? "Parsing usually takes a few seconds. This card fills in as soon as it finishes."
                : "Parse the file to extract your roles, skills and dates — that is what drafts and matching read from."
            }
            action={
              doc.analysis_status === "pending" ? undefined : (
                <Button size="sm" className="rounded-lg" onClick={handleAnalyze} disabled={loadingAnalysis}>
                  {loadingAnalysis ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                  Parse document
                </Button>
              )
            }
          />
        </Card>
      )
    }

    const hasAnything =
      (parsed.experience?.length ?? 0) +
        (parsed.education?.length ?? 0) +
        (parsed.projects?.length ?? 0) +
        (parsed.skills?.technical?.length ?? 0) +
        (parsed.achievements?.length ?? 0) +
        (parsed.certifications?.length ?? 0) >
      0

    return (
      <Card className="overflow-hidden rounded-2xl border-border/70">
        <CardHead
          overline="Parsed content"
          title="What ApplyOS read"
          action={statusChip()}
        />

        {!hasAnything ? (
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="Nothing extractable found"
            description="This file parsed without errors but contained no roles, skills or dates. If it is a scan, upload the text-based original instead."
          />
        ) : (
          <div className="divide-y divide-border/50">
            {parsed.experience?.length ? (
              <ParsedSection title="Experience">
                <ol className="space-y-3.5">
                  {parsed.experience.map((e, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{e.role || "Role"}</p>
                        <p className="text-xs text-muted-foreground">
                          {[e.company, [e.start_date, e.end_date].filter(Boolean).join(" – ")]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {e.description ? (
                          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                            {e.description}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </ParsedSection>
            ) : null}

            {parsed.education?.length ? (
              <ParsedSection title="Education">
                <ul className="space-y-3">
                  {parsed.education.map((e, i) => (
                    <li key={i}>
                      <p className="text-sm font-medium text-foreground">
                        {e.degree || e.field || "Qualification"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[e.institution, [e.start_date, e.end_date].filter(Boolean).join(" – ")]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {e.description ? (
                        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                          {e.description}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </ParsedSection>
            ) : null}

            {parsed.projects?.length ? (
              <ParsedSection title="Projects">
                <ul className="space-y-3">
                  {parsed.projects.map((p, i) => (
                    <li key={i}>
                      <p className="text-sm font-medium text-foreground">{p.name || "Project"}</p>
                      {p.description ? (
                        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                          {p.description}
                        </p>
                      ) : null}
                      {p.technologies?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {p.technologies.map((tech, j) => (
                            <Chip key={j}>{tech}</Chip>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </ParsedSection>
            ) : null}

            {parsed.skills &&
            (parsed.skills.technical?.length || parsed.skills.soft?.length || parsed.skills.other?.length) ? (
              <ParsedSection title="Skills">
                <div className="space-y-3">
                  {(
                    [
                      ["Technical", parsed.skills.technical, "primary"],
                      ["Ways of working", parsed.skills.soft, "default"],
                      ["Tools", parsed.skills.other, "muted"],
                    ] as const
                  ).map(([label, list, variant]) =>
                    list?.length ? (
                      <div key={label}>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                          {label}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {list.map((skill, i) => (
                            <Chip key={i} variant={variant}>
                              {skill}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              </ParsedSection>
            ) : null}

            {parsed.achievements?.length ? (
              <ParsedSection title="Achievements">
                <ul className="space-y-1.5">
                  {parsed.achievements.map((a, i) => (
                    <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-foreground/90">
                      <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      {a}
                    </li>
                  ))}
                </ul>
              </ParsedSection>
            ) : null}

            {parsed.certifications?.length ? (
              <ParsedSection title="Certifications">
                <ul className="space-y-2">
                  {parsed.certifications.map((c, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-foreground">{c.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {[c.issuer, c.date].filter(Boolean).join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </ParsedSection>
            ) : null}
          </div>
        )}
      </Card>
    )
  }

  /* ---------- Linked applications column card ---------- */
  const renderLinked = () => {
    if (!doc) return null
    const visible = showAllLinked ? linkedApps : linkedApps.slice(0, LINKED_VISIBLE)

    return (
      <Card className="overflow-hidden rounded-2xl border-border/70">
        <CardHead
          overline="Linked"
          title="Applications using this file"
          action={
            linkedApps.length > 0 ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                {linkedApps.length}
              </span>
            ) : null
          }
        />
        {linkedLoading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Loading applications…
          </div>
        ) : linkedApps.length === 0 ? (
          <div className="px-5 py-6">
            <p className="text-sm font-medium text-muted-foreground">Not linked</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground/80">
              Attach this document from an application&apos;s details page and it will
              show up here with its status.
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border/50">
              {visible.map((app) => (
                <li key={app.id}>
                  <Link
                    href={`/applications/${app.id}`}
                    className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/60 font-display text-[11px] font-bold text-foreground/80">
                      {initialsFor(app)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-foreground">
                        {app.title}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{app.company || app.type}</span>
                        {app.created_at ? (
                          <>
                            <span aria-hidden className="text-muted-foreground/40">·</span>
                            <span className="shrink-0">{formatDay(app.created_at)}</span>
                          </>
                        ) : null}
                      </span>
                    </span>
                    <StatusPill status={app.status} size="sm" className="shrink-0" />
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
            {linkedApps.length > LINKED_VISIBLE ? (
              <div className="border-t border-border/50 p-3">
                <button
                  type="button"
                  onClick={() => setShowAllLinked((v) => !v)}
                  className="mx-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold text-primary-strong transition-colors hover:bg-primary/10 dark:text-primary"
                >
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      showAllLinked && "rotate-180"
                    )}
                  />
                  {showAllLinked
                    ? "Show less"
                    : `Show ${linkedApps.length - LINKED_VISIBLE} more`}
                </button>
              </div>
            ) : null}
          </>
        )}
      </Card>
    )
  }

  if (!documentId) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <p className="text-sm text-muted-foreground">
            Invalid document id.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push("/documents")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to documents
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col gap-4 min-h-[60vh]">
          <div className="flex items-center gap-3 mt-2">
            <div className="h-10 w-10 rounded-lg bg-primary/10 animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-40 bg-primary/10 rounded animate-pulse" />
              <div className="h-3 w-24 bg-muted/20 rounded animate-pulse" />
            </div>
          </div>
          <Card className="h-32 rounded-2xl border-border/70 animate-pulse" />
          <Card className="h-64 rounded-2xl border-border/70 animate-pulse" />
        </div>
      </DashboardLayout>
    )
  }

  if (error || !doc) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
          <p className="text-sm text-destructive">
            {error || "Unable to load this document."}
          </p>
          <Button
            variant="outline"
            onClick={() => router.push("/documents")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to documents
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* Header */}
        <div className="space-y-4 border-b border-border/60 pb-5">
          <Link
            href="/documents"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Library
          </Link>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 className="break-words font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-foreground">
                {doc.file_name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-muted-foreground">
                {statusChip()}
                <span>{formatFileSize(doc.file_size)}</span>
                <span aria-hidden className="text-muted-foreground/40">·</span>
                <span>Uploaded {formatDay(doc.created_at)}</span>
                {versions.length > 1 ? (
                  <>
                    <span aria-hidden className="text-muted-foreground/40">·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <GitBranch className="h-3 w-3" />
                      Version {versionIndex + 1} of {versions.length}
                      {isLatest ? (
                        <span className="rounded-full border border-primary/25 bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-primary-strong dark:text-primary">
                          Latest
                        </span>
                      ) : null}
                    </span>
                  </>
                ) : null}
                {!linkedLoading ? (
                  linkedApps.length > 0 ? (
                    <>
                      <span aria-hidden className="text-muted-foreground/40">·</span>
                      <span>
                        {linkedApps.length} linked{" "}
                        {linkedApps.length === 1 ? "application" : "applications"}
                      </span>
                    </>
                  ) : null
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {versions.length > 1 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-[13px] font-medium text-foreground shadow-sm transition-colors hover:border-primary/40"
                    >
                      <GitBranch className="h-3.5 w-3.5" />
                      {isLatest ? "Latest version" : `v${versionIndex + 1}`}
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                      Versions of this file
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {[...versions].reverse().map((v, i) => {
                      const versionNo = versions.length - i
                      const isCurrent = v.id === doc.id
                      const isNewest = versionNo === versions.length
                      return (
                        <DropdownMenuItem
                          key={v.id}
                          onClick={() => handleSwitchVersion(v.id)}
                          className="cursor-pointer gap-3 py-2.5"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                              v{versionNo}
                              {isNewest && !isCurrent ? (
                                <span className="rounded-full border border-primary/25 bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-primary-strong dark:text-primary">
                                  Latest
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                              {formatDay(v.created_at)} · {formatFileSize(v.file_size)}
                            </span>
                          </span>
                          {isCurrent ? (
                            <Check className="h-4 w-4 shrink-0 text-primary" />
                          ) : null}
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              <Button variant="outline" size="sm" className="h-9 rounded-lg" onClick={handleOpenOriginal}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                View original
              </Button>
              {doc.analysis_status === "success" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg"
                  onClick={handleAnalyze}
                  disabled={loadingAnalysis}
                >
                  {loadingAnalysis ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Re-parse
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
          <div className="space-y-5">
            {renderReport()}
            {renderLinked()}
            <FileFacts
              rows={[
                { label: "File type", value: doc.file_type ?? "Unknown" },
                { label: "Size", value: formatFileSize(doc.file_size) },
                {
                  label: "Version",
                  value:
                    versions.length > 1
                      ? `v${versionIndex + 1} of ${versions.length}${isLatest ? " (latest)" : ""}`
                      : "v1",
                },
                { label: "Uploaded", value: formatDay(doc.created_at) },
                { label: "Last parsed", value: doc.parsed_at ? formatDay(doc.parsed_at) : "Never" },
              ]}
            />
          </div>
          {renderParsed()}
        </div>
      </div>
    </DashboardLayout>
  )
}
