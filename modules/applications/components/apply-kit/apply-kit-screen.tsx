"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Check,
  ClipboardPaste,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { Badge } from "@/shared/ui/badge"
import { useToast } from "@/shared/ui/use-toast"
import { getAnalyzedDocuments } from "@/modules/documents/services/document.service"
import type { Document } from "@/types/database"
import {
  runApplyKit,
  createApplyKitClient,
  type StepStatus,
  type ResumeAnalysisResult,
  type ApplyKitInput,
} from "@/modules/applications/services/apply-kit"

type Mode = "url" | "text"

function StepCard({
  title,
  status,
  children,
}: {
  title: string
  status: StepStatus | "idle"
  children: React.ReactNode
}) {
  if (status === "idle") return null

  return (
    <div className="rounded-2xl border border-border/70 bg-card">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
        <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">
          {title}
        </h3>
        {status === "loading" && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            Working…
          </span>
        )}
        {status === "done" && (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary-strong dark:text-primary">
            Done
          </span>
        )}
        {status === "error" && (
          <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-semibold text-destructive">
            Failed
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export function ApplyKitScreen() {
  const { toast } = useToast()
  const client = useMemo(() => createApplyKitClient(), [])
  const [mode, setMode] = useState<Mode>("text")
  const [url, setUrl] = useState("")
  const [text, setText] = useState("")
  const [docs, setDocs] = useState<Document[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [documentId, setDocumentId] = useState<string>("")
  const [running, setRunning] = useState(false)

  const [wantAnalysis, setWantAnalysis] = useState(true)
  const [wantCoverLetter, setWantCoverLetter] = useState(true)

  const [applicationId, setApplicationId] = useState<string | null>(null)
  const [jobTitle, setJobTitle] = useState<string | null>(null)
  const [jobCompany, setJobCompany] = useState<string | null>(null)

  const [jobStatus, setJobStatus] = useState<StepStatus | "idle">("idle")
  const [analysisStatus, setAnalysisStatus] = useState<StepStatus | "idle">("idle")
  const [coverStatus, setCoverStatus] = useState<StepStatus | "idle">("idle")
  const [analysis, setAnalysis] = useState<ResumeAnalysisResult | null>(null)
  const [coverLetter, setCoverLetter] = useState<string | null>(null)

  useEffect(() => {
    getAnalyzedDocuments()
      .then((d) => {
        setDocs(d)
        if (d.length > 0) setDocumentId(d[0].id)
      })
      .catch(() => setDocs([]))
      .finally(() => setDocsLoading(false))
  }, [])

  function resetResults() {
    setApplicationId(null)
    setJobTitle(null)
    setJobCompany(null)
    setJobStatus("idle")
    setAnalysisStatus("idle")
    setCoverStatus("idle")
    setAnalysis(null)
    setCoverLetter(null)
  }

  async function handleGenerate() {
    if (mode === "url" && !url.trim()) return toast({ title: "Enter a job URL", variant: "destructive" })
    if (mode === "text" && !text.trim()) return toast({ title: "Paste a job description", variant: "destructive" })
    if (!documentId) return toast({ title: "Pick a resume first", variant: "destructive" })

    resetResults()
    setRunning(true)
    const input: ApplyKitInput = mode === "url" ? { url: url.trim() } : { text: text.trim() }

    let jobErrored = false
    try {
      const result = await runApplyKit(
        input,
        documentId,
        { analysis: wantAnalysis, coverLetter: wantCoverLetter },
        client,
        (e) => {
          if (e.step === "job") {
            setJobStatus(e.status)
            if (e.status === "error") {
              jobErrored = true
              toast({ title: "Couldn't read the job", description: e.error, variant: "destructive" })
            }
          }
          if (e.step === "analysis") setAnalysisStatus(e.status)
          if (e.step === "coverLetter") setCoverStatus(e.status)
        }
      )
      setApplicationId(result.applicationId)
      setJobTitle(result.job.title)
      setJobCompany(result.job.company)
      setAnalysis(result.analysis)
      setCoverLetter(result.coverLetter)
    } catch (e) {
      if (!jobErrored) {
        toast({ title: "Something went wrong", description: e instanceof Error ? e.message : undefined, variant: "destructive" })
      }
    } finally {
      setRunning(false)
    }
  }

  async function retryAnalysis() {
    if (!applicationId) return
    setAnalysisStatus("loading")
    try {
      const r = await client.analyzeResume(applicationId, documentId)
      setAnalysis(r)
      setAnalysisStatus("done")
    } catch (e) {
      setAnalysisStatus("error")
      toast({ title: "Analysis retry failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" })
    }
  }

  async function retryCover() {
    if (!applicationId) return
    setCoverStatus("loading")
    try {
      const cl = await client.generateCoverLetter(applicationId)
      setCoverLetter(cl)
      setCoverStatus("done")
    } catch (e) {
      setCoverStatus("error")
      toast({ title: "Cover letter retry failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" })
    }
  }

  const optionCard = (checked: boolean) =>
    cn(
      "flex flex-1 cursor-pointer items-center justify-between gap-3 rounded-xl border p-3.5 transition-all duration-150",
      checked
        ? "border-primary/50 bg-primary/[0.06]"
        : "border-border/70 hover:border-primary/30"
    )

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
            <Wand2 className="h-5 w-5 text-primary-strong dark:text-primary" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Apply Kit
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Paste a posting, pick your resume, and let the AI build the application.
            </p>
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
        <div className="mb-5 flex rounded-lg bg-muted/70 p-1">
          <button
            type="button"
            aria-pressed={mode === "text"}
            onClick={() => setMode("text")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-all",
              mode === "text"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            Paste JD
          </button>
          <button
            type="button"
            aria-pressed={mode === "url"}
            onClick={() => setMode("url")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-all",
              mode === "url"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Link2 className="h-3.5 w-3.5" />
            Job URL
          </button>
        </div>

        <div className="space-y-5">
          {mode === "url" ? (
            <input
              id="job-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://company.com/careers/role"
              className="h-11 w-full rounded-xl border border-border/80 bg-background px-4 text-sm text-foreground transition-all placeholder:text-muted-foreground focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          ) : (
            <textarea
              id="job-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the full job description here…"
              rows={9}
              className="w-full resize-y rounded-xl border border-border/80 bg-background p-4 text-sm leading-relaxed text-foreground transition-all placeholder:text-muted-foreground focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          )}

          <div>
            <label htmlFor="resume-select" className="mb-1.5 block text-[13px] font-medium text-foreground">
              Resume
            </label>
            {docsLoading ? (
              <p className="text-sm text-muted-foreground">Loading resumes…</p>
            ) : docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No analyzed resume found.{" "}
                <Link href="/upload" className="font-semibold text-primary-strong underline underline-offset-2 dark:text-primary">
                  Upload one
                </Link>{" "}
                first.
              </p>
            ) : (
              <div className="relative">
                <FileText className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                <select
                  id="resume-select"
                  value={documentId}
                  onChange={(e) => setDocumentId(e.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-border/80 bg-background pl-10 pr-4 text-sm font-medium text-foreground focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  {docs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.file_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-[13px] font-medium text-foreground">Also generate</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="want-analysis" className={optionCard(wantAnalysis)}>
                <span className="text-sm font-medium text-foreground">Resume analysis</span>
                <input
                  id="want-analysis"
                  type="checkbox"
                  checked={wantAnalysis}
                  onChange={(e) => setWantAnalysis(e.target.checked)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
                    wantAnalysis
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background"
                  )}
                >
                  {wantAnalysis && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
              </label>
              <label htmlFor="want-cover-letter" className={optionCard(wantCoverLetter)}>
                <span className="text-sm font-medium text-foreground">Cover letter</span>
                <input
                  id="want-cover-letter"
                  type="checkbox"
                  checked={wantCoverLetter}
                  onChange={(e) => setWantCoverLetter(e.target.checked)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
                    wantCoverLetter
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background"
                  )}
                >
                  {wantCoverLetter && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
              </label>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground/80">
              The application is always created and saved. Selected items are generated and saved
              to it, just like running each feature individually.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={running || docsLoading || docs.length === 0}
            className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground shadow-[0_6px_20px_-8px_rgba(24,187,112,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-8px_rgba(24,187,112,0.75)] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Apply Kit
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      <StepCard title="Application" status={jobStatus}>
        {jobStatus === "done" && (
          <div className="space-y-2">
            <p className="text-[15px] font-semibold text-foreground">
              {jobTitle}
              {jobCompany ? <span className="font-normal text-muted-foreground"> — {jobCompany}</span> : null}
            </p>
            {applicationId && (
              <Link
                href={`/applications/${applicationId}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary-strong transition-opacity hover:opacity-75 dark:text-primary"
              >
                Open application
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
        {jobStatus === "error" && (
          <p className="text-sm text-destructive">Could not read the job posting.</p>
        )}
      </StepCard>

      <StepCard title="Resume analysis" status={analysisStatus}>
        {analysisStatus === "done" && analysis && (
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold tracking-tight text-foreground">
                {analysis.score}
              </span>
              <span className="text-sm text-muted-foreground">/ 100 match score</span>
            </div>
            {analysis.missingKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {analysis.missingKeywords.map((k) => (
                  <Badge key={k} variant="outline" className="rounded-full font-normal">
                    {k}
                  </Badge>
                ))}
              </div>
            )}
            {applicationId && (
              <Link
                href={`/applications/${applicationId}?tab=analysis`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary-strong transition-opacity hover:opacity-75 dark:text-primary"
              >
                View full analysis
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
        {analysisStatus === "error" && (
          <button
            type="button"
            onClick={retryAnalysis}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:border-primary/40"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry analysis
          </button>
        )}
      </StepCard>

      <StepCard title="Cover letter" status={coverStatus}>
        {coverStatus === "done" &&
          (coverLetter ? (
            <div className="space-y-3">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {coverLetter}
              </p>
              {applicationId && (
                <Link
                  href={`/applications/${applicationId}?tab=cover-letter`}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-primary-strong transition-opacity hover:opacity-75 dark:text-primary"
                >
                  Edit in application
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No cover letter was generated.</p>
          ))}
        {coverStatus === "error" && (
          <button
            type="button"
            onClick={retryCover}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:border-primary/40"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry cover letter
          </button>
        )}
      </StepCard>
    </div>
  )
}
