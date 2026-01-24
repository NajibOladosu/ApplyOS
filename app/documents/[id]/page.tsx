"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { Loader2, ArrowLeft, ExternalLink, RefreshCw, FileText, ChevronDown } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/shared/ui/use-toast"
import { cn } from "@/shared/lib/utils"
import type { DocumentReport } from "@/types/database"

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
  report: DocumentReport | null
  report_generated_at: string | null
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
  const [loadingReport, setLoadingReport] = useState(false)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

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
          report: payload.report ?? null,
          report_generated_at: payload.report_generated_at ?? null,
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

  const renderAnalysisStatusBadge = () => {
    if (!doc) return null
    const status = doc.analysis_status
    const base = "px-2 py-0.5 text-xs rounded-full border"

    if (status === "success") {
      return (
        <span className={cn(base, "border-primary/40 text-primary")}>
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

  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName)
    } else {
      newExpanded.add(categoryName)
    }
    setExpandedCategories(newExpanded)
  }

  const renderReportSection = () => {
    if (!doc) return null

    const report = doc.report as DocumentReport | null

    return (
      <Card className="bg-background/60 border-primary/10">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base sm:text-lg">Document Report</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {report && (
                <Badge variant="outline" className="text-xs">
                  Updated {formatDate(doc.report_generated_at)}
                </Badge>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs sm:text-sm"
                onClick={handleGenerateReport}
                disabled={loadingReport}
              >
                {loadingReport ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-3 w-3" />
                    Generate report
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {report ? (
            <>
              {/* Header */}
              <div className="space-y-2 pb-4 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    {report.documentType || "Document"}
                  </h3>
                  <div className="text-sm font-bold text-primary">
                    {report.overallScore}/10
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {report.overallAssessment}
                </p>
                {/* Overall score bar */}
                <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${(report.overallScore / 10) * 100}%` }}
                  />
                </div>
              </div>

              {/* Categories */}
              {report.categories && report.categories.length > 0 ? (
                <div className="space-y-2">
                  {report.categories.map((category, idx) => {
                    const isExpanded = expandedCategories.has(category.name)
                    const scorePercentage = (category.score / 10) * 100
                    const scoreColor =
                      category.score >= 8
                        ? "text-primary"
                        : category.score >= 6
                          ? "text-muted-foreground"
                          : "text-destructive"

                    return (
                      <div key={idx} className="border border-border/50 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleCategory(category.name)}
                          className="w-full p-3 flex items-center justify-between hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="flex-1 text-left">
                              <div className="text-sm font-medium text-foreground">
                                {category.name}
                              </div>
                              <div className="w-24 bg-muted/30 rounded-full h-1.5 mt-1.5 overflow-hidden">
                                <div
                                  className="h-full bg-primary transition-all duration-300"
                                  style={{ width: `${scorePercentage}%` }}
                                />
                              </div>
                            </div>
                            <div className={cn("text-sm font-bold min-w-12 text-right", scoreColor)}>
                              {category.score}/10
                            </div>
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform ml-2",
                              isExpanded && "rotate-180"
                            )}
                          />
                        </button>

                        {isExpanded && (
                          <div className="px-3 pb-3 space-y-3 border-t border-border/50 bg-muted/20">
                            {category.strengths && category.strengths.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-primary mb-1.5">
                                  Strengths
                                </h4>
                                <ul className="space-y-1">
                                  {category.strengths.map((strength, i) => (
                                    <li key={i} className="text-xs text-muted-foreground flex gap-2">
                                      <span className="text-primary mt-0.5">✓</span>
                                      <span>{strength}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {category.improvements && category.improvements.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-muted-foreground mb-1.5">
                                  Areas for Improvement
                                </h4>
                                <ul className="space-y-1">
                                  {category.improvements.map((improvement, i) => (
                                    <li key={i} className="text-xs text-muted-foreground flex gap-2">
                                      <span className="text-muted-foreground mt-0.5">→</span>
                                      <span>{improvement}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {(!category.improvements || category.improvements.length === 0) &&
                              (!category.strengths || category.strengths.length === 0) && (
                                <p className="text-xs text-muted-foreground">
                                  No details available for this category.
                                </p>
                              )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No detailed feedback available.
                </p>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              <p className="mb-3">
                No report has been generated for this document yet.
              </p>
              <Button
                size="sm"
                onClick={handleGenerateReport}
                disabled={loadingReport}
              >
                {loadingReport ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  "Generate report"
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
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base sm:text-lg">AI Analysis</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {renderAnalysisStatusBadge()}
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs sm:text-sm"
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

              {parsed.projects?.length > 0 && (
                <section>
                  <h3 className="font-semibold text-foreground mb-1">
                    Projects
                  </h3>
                  <div className="space-y-1">
                    {parsed.projects.map((p, idx) => (
                      <div key={idx} className="border-l border-primary/30 pl-3">
                        <div className="font-medium text-foreground">
                          {p.name || "Project"}
                        </div>
                        <div className="text-xs">
                          {p.start_date || p.end_date
                            ? `${[p.start_date, p.end_date]
                              .filter(Boolean)
                              .join(" - ")}`
                            : ""}
                        </div>
                        {p.description && (
                          <div className="text-xs mt-0.5">
                            {p.description}
                          </div>
                        )}
                        {p.technologies && p.technologies.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.technologies.map((tech, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="bg-zinc-800/80 text-amber-300 border-0 px-3 py-1 text-[10px] backdrop-blur-sm"
                              >
                                {tech}
                              </Badge>
                            ))}
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
                          variant="secondary"
                          className="bg-zinc-800/80 text-primary border-0 px-3 py-1 text-[10px] backdrop-blur-sm"
                        >
                          {s}
                        </Badge>
                      ))}
                      {parsed.skills.soft.map((s, i) => (
                        <Badge
                          key={`s-${i}`}
                          variant="secondary"
                          className="bg-zinc-800/80 text-sky-300 border-0 px-3 py-1 text-[10px] backdrop-blur-sm"
                        >
                          {s}
                        </Badge>
                      ))}
                      {parsed.skills.other.map((s, i) => (
                        <Badge
                          key={`o-${i}`}
                          variant="secondary"
                          className="bg-zinc-800/80 text-purple-300 border-0 px-3 py-1 text-[10px] backdrop-blur-sm"
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
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2 sm:gap-3">
            <button
              onClick={() => router.push("/documents")}
              className="mt-1 text-muted-foreground hover:text-primary transition-colors shrink-0"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold break-words">
                {doc.file_name}
              </h1>
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2 text-xs text-muted-foreground">
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
            {doc.report && (
              <Badge
                variant="outline"
                className="border-primary/40 text-primary text-xs"
              >
                Report available
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={handleOpenOriginal}
            >
              <ExternalLink className="h-3 w-3" />
              <span className="text-xs sm:text-sm">View original</span>
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {renderReportSection()}
          {renderAnalysisSection()}
        </div>
      </div>
    </DashboardLayout>
  )
}