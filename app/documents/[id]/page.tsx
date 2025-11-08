"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, ExternalLink, RefreshCw, FileText } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

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
  summary: string | null
  summary_generated_at: string | null
  parsed_data: ParsedDocument | null
  parsed_at: string | null
  analysis_status: "not_analyzed" | "pending" | "success" | "failed"
  analysis_error: string | null
  application_id: string | null
}

function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "Unknown size"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string | null): string {
  if (!value) return "Unknown"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "Unknown"
  return d.toLocaleString()
}

export default function DocumentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()

  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const documentId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : ""

  useEffect(() => {
    if (!documentId) return

    const fetchDocument = async () => {
      setLoading(true)
      setError(null)
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
          summary: payload.summary ?? null,
          summary_generated_at: payload.summary_generated_at ?? null,
          parsed_data: payload.parsed_data ?? null,
          parsed_at: payload.parsed_at ?? null,
          analysis_status: payload.analysis_status ?? "not_analyzed",
          analysis_error: payload.analysis_error ?? null,
          application_id: payload.application_id ?? null,
        }

        setDoc(mapped)
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
      setDoc((prev) =>
        prev
          ? {
              ...prev,
              ...payload,
              summary: payload.summary ?? prev.summary,
              summary_generated_at: payload.summary_generated_at ?? prev.summary_generated_at,
              parsed_data: payload.parsed_data ?? prev.parsed_data,
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
              summary: payload.summary ?? null,
              summary_generated_at: payload.summary_generated_at ?? null,
              parsed_data: payload.parsed_data ?? null,
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

  const handleGenerateSummary = async () => {
    if (!doc || loadingSummary) return
    setLoadingSummary(true)
    try {
      const res = await fetch(`/api/documents/${doc.id}/summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force: true }),
      })
      const payload = await res.json().catch(() => ({}))

      if (!res.ok) {
        console.error("Summary error:", payload)
        toast({
          variant: "destructive",
          title: "Summary failed",
          description:
            payload?.error ||
            "Unable to generate a summary for this document.",
        })
      } else {
        toast({
          title: "Summary generated",
          description: "Summary has been generated and saved.",
        })
        setDoc((prev) =>
          prev
            ? {
                ...prev,
                summary: payload.summary ?? prev.summary,
                summary_generated_at:
                  payload.summary_generated_at ?? prev.summary_generated_at,
              }
            : prev
        )
      }
    } catch (err) {
      console.error("Summary exception:", err)
      toast({
        variant: "destructive",
        title: "Summary failed",
        description:
          "An unexpected error occurred while generating summary.",
      })
    } finally {
      setLoadingSummary(false)
    }
  }

  const renderAnalysisStatusBadge = () => {
    if (!doc) return null
    const status = doc.analysis_status
    const base = "px-2 py-0.5 text-xs rounded-full border"

    if (status === "success") {
      return (
        <span className={cn(base, "border-emerald-500/40 text-emerald-400")}>
          Analyzed
        </span>
      )
    }
    if (status === "pending") {
      return (
        <span className={cn(base, "border-primary/40 text-primary flex items-center gap-1")}>
          <Loader2 className="h-3 w-3 animate-spin" />
          Analyzing...
        </span>
      )
    }
    if (status === "failed") {
      return (
        <span className={cn(base, "border-red-500/40 text-red-400")}>
          Analysis failed
        </span>
      )
    }
    return (
      <span className={cn(base, "border-muted-foreground/30 text-muted-foreground")}>
        Not analyzed
      </span>
    )
  }

  const renderSummarySection = () => {
    if (!doc) return null

    return (
      <Card className="bg-background/60 border-primary/10">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-lg">Summary</CardTitle>
          <div className="flex items-center gap-2">
            {doc.summary && (
              <Badge variant="outline" className="text-xs">
                Updated {formatDate(doc.summary_generated_at)}
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={handleGenerateSummary}
              disabled={loadingSummary}
            >
              {loadingSummary ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-3 w-3" />
                  Generate summary
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {doc.summary ? (
            <div className="text-sm text-muted-foreground whitespace-pre-line max-h-64 overflow-y-auto">
              {doc.summary}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">
                No summary has been generated for this document yet.
              </p>
              <Button
                size="sm"
                className="mt-1"
                onClick={handleGenerateSummary}
                disabled={loadingSummary}
              >
                {loadingSummary ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  "Generate summary"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderAnalysisSection = () => {
    if (!doc) return null

    const parsed = doc.parsed_data as ParsedDocument | null

    return (
      <Card className="bg-background/60 border-primary/10">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-lg">AI Analysis</CardTitle>
          <div className="flex items-center gap-2">
            {renderAnalysisStatusBadge()}
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={handleAnalyze}
              disabled={loadingAnalysis}
            >
              {loadingAnalysis ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3" />
                  Analyze document
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {doc.analysis_status === "failed" && (
            <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3 text-xs text-red-300">
              <p className="font-semibold mb-1">Last analysis attempt failed.</p>
              {doc.analysis_error && (
                <p className="line-clamp-3">
                  {doc.analysis_error}
                </p>
              )}
            </div>
          )}

          {doc.analysis_status !== "success" || !parsed ? (
            <div className="text-sm">
              <p className="mb-2">
                This document has not been successfully analyzed yet.
              </p>
              <Button
                size="sm"
                onClick={handleAnalyze}
                disabled={loadingAnalysis}
              >
                {loadingAnalysis ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                    Analyzing...
                  </>
                ) : (
                  "Analyze document"
                )}
              </Button>
            </div>
          ) : (
            <>
              {parsed.education?.length > 0 && (
                <section>
                  <h3 className="font-semibold text-foreground mb-1">
                    Education
                  </h3>
                  <div className="space-y-1">
                    {parsed.education.map((e, idx) => (
                      <div key={idx} className="border-l border-primary/30 pl-3">
                        <div className="font-medium text-foreground">
                          {e.degree || e.field || "Education entry"}
                        </div>
                        <div className="text-xs">
                          {e.institution}
                          {e.start_date || e.end_date
                            ? ` • ${[e.start_date, e.end_date]
                                .filter(Boolean)
                                .join(" - ")}`
                            : ""}
                        </div>
                        {e.description && (
                          <div className="text-xs mt-0.5">
                            {e.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {parsed.experience?.length > 0 && (
                <section>
                  <h3 className="font-semibold text-foreground mb-1">
                    Experience
                  </h3>
                  <div className="space-y-1">
                    {parsed.experience.map((e, idx) => (
                      <div key={idx} className="border-l border-primary/30 pl-3">
                        <div className="font-medium text-foreground">
                          {e.role || "Experience"}
                        </div>
                        <div className="text-xs">
                          {e.company}
                          {e.start_date || e.end_date
                            ? ` • ${[e.start_date, e.end_date]
                                .filter(Boolean)
                                .join(" - ")}`
                            : ""}
                        </div>
                        {e.description && (
                          <div className="text-xs mt-0.5">
                            {e.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {(parsed.skills?.technical?.length ||
                parsed.skills?.soft?.length ||
                parsed.skills?.other?.length) && (
                <section>
                  <h3 className="font-semibold text-foreground mb-1">
                    Skills
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {parsed.skills.technical.map((s, i) => (
                      <Badge
                        key={`t-${i}`}
                        variant="outline"
                        className="border-primary/40 text-primary text-[10px]"
                      >
                        {s}
                      </Badge>
                    ))}
                    {parsed.skills.soft.map((s, i) => (
                      <Badge
                        key={`s-${i}`}
                        variant="outline"
                        className="border-sky-400/40 text-sky-300 text-[10px]"
                      >
                        {s}
                      </Badge>
                    ))}
                    {parsed.skills.other.map((s, i) => (
                      <Badge
                        key={`o-${i}`}
                        variant="outline"
                        className="border-purple-400/40 text-purple-300 text-[10px]"
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              {parsed.achievements?.length > 0 && (
                <section>
                  <h3 className="font-semibold text-foreground mb-1">
                    Achievements
                  </h3>
                  <ul className="list-disc list-inside space-y-0.5">
                    {parsed.achievements.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </section>
              )}

              {parsed.certifications?.length > 0 && (
                <section>
                  <h3 className="font-semibold text-foreground mb-1">
                    Certifications
                  </h3>
                  <ul className="list-disc list-inside space-y-0.5">
                    {parsed.certifications.map((c, i) => (
                      <li key={i}>
                        <span className="font-medium">
                          {c.name}
                        </span>{" "}
                        {c.issuer && `• ${c.issuer}`}{" "}
                        {c.date && `(${c.date})`}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {parsed.keywords?.length > 0 && (
                <section>
                  <h3 className="font-semibold text-foreground mb-1">
                    Keywords
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {parsed.keywords.map((k, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-[10px]"
                      >
                        {k}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              {parsed.raw_highlights?.length > 0 && (
                <section>
                  <h3 className="font-semibold text-foreground mb-1">
                    Highlights
                  </h3>
                  <ul className="list-disc list-inside space-y-0.5">
                    {parsed.raw_highlights.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </CardContent>
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
          <Card className="h-32 bg-background/60 border-primary/5 animate-pulse" />
          <Card className="h-64 bg-background/60 border-primary/5 animate-pulse" />
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={() => router.push("/documents")}
              className="mt-1 text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                {doc.file_name}
              </h1>
              <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                <span>{formatFileSize(doc.file_size)}</span>
                <span>• Uploaded {formatDate(doc.created_at)}</span>
                {doc.file_type && <span>• {doc.file_type}</span>}
                {doc.application_id && (
                  <span>
                    • Linked to{" "}
                    <Link
                      href={`/applications/${doc.application_id}`}
                      className="text-primary hover:underline"
                    >
                      application
                    </Link>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {renderAnalysisStatusBadge()}
            {doc.summary && (
              <Badge
                variant="outline"
                className="border-primary/40 text-primary text-xs"
              >
                Summary available
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={handleOpenOriginal}
            >
              <ExternalLink className="h-3 w-3" />
              View original
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {renderSummarySection()}
          {renderAnalysisSection()}
        </div>
      </div>
    </DashboardLayout>
  )
}