"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Textarea } from "@/shared/ui/textarea"
import { Label } from "@/shared/ui/label"
import { useToast } from "@/shared/ui/use-toast"
import { ConfirmModal } from "@/components/modals/confirm-modal"
import { ArrowLeft, Copy, Save, Loader2, Trash2, Pencil, Sparkles } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/data/empty-state"
import {
  STAR_SECTIONS,
  composeStarAnswer,
  starCompleteness,
  type StarAnswer,
  type StarParts,
} from "@/modules/interviews/lib/star"

const STORAGE_KEY = "applyos:starAnswers"

const EMPTY_FORM: { question: string } & StarParts = {
  question: "",
  situation: "",
  task: "",
  action: "",
  result: "",
}

export default function StarBuilderPage() {
  const { toast } = useToast()
  const [answers, setAnswers] = useState<StarAnswer[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // Load saved answers once on mount. localStorage is client-only, so this can't
  // move into a lazy useState initializer without a hydration mismatch.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount guard + localStorage read
      if (raw) setAnswers(JSON.parse(raw) as StarAnswer[])
    } catch {
      // Corrupt or unavailable storage — start empty.
    }
    setHydrated(true)
  }, [])

  // Persist whenever the library changes (after the initial load).
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(answers))
    } catch {
      // Best-effort persistence only.
    }
  }, [answers, hydrated])

  const parts: StarParts = {
    situation: form.situation,
    task: form.task,
    action: form.action,
    result: form.result,
  }


  const setField = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const completeness = starCompleteness(parts)
  const composed = useMemo(() => composeStarAnswer(parts), [parts])
  const hasContent = composed.trim().length > 0 || form.question.trim().length > 0

  const handleSave = () => {
    if (!hasContent) return
    const now = new Date().toISOString()

    if (editingId) {
      setAnswers((prev) =>
        prev.map((a) => (a.id === editingId ? { ...a, ...form, updatedAt: now } : a))
      )
      toast({ title: "Answer updated" })
    } else {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `star-${now}-${Math.round(completeness * 1000)}`
      setAnswers((prev) => [
        { id, ...form, createdAt: now, updatedAt: now },
        ...prev,
      ])
      toast({ title: "Answer saved to your library" })
    }
    resetForm()
  }

  const startEdit = (answer: StarAnswer) => {
    setForm({
      question: answer.question,
      situation: answer.situation,
      task: answer.task,
      action: answer.action,
      result: answer.result,
    })
    setEditingId(answer.id)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleDelete = () => {
    if (!deleteId) return
    setAnswers((prev) => prev.filter((a) => a.id !== deleteId))
    if (editingId === deleteId) resetForm()
    setDeleteId(null)
  }

  const handleCopy = () => copyToClipboard(composed)

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Copied to clipboard" })
    } catch {
      toast({ title: "Couldn't copy", variant: "destructive" })
    }
  }

  const filledCount = STAR_SECTIONS.filter((sec) => form[sec.key].trim().length > 0).length

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <PageHeader
          overline="Interview practice"
          title="STAR answer builder"
          description="Shape an answer as Situation, Task, Action, Result — then reuse it before interviews."
          actions={
            <Link
              href="/interview"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3.5 text-[13px] font-medium text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to practice
            </Link>
          }
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Composer */}
          <section className="rounded-2xl border border-border/70 bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
              <div>
                <h2 className="font-display text-[15px] font-bold tracking-tight text-foreground">
                  {editingId ? "Edit answer" : "New answer"}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {filledCount} of 4 sections written
                </p>
              </div>
              {/* progress is the point of this page — keep it visible */}
              <div className="flex items-center gap-3">
                <div className="flex gap-1" role="img" aria-label={`${filledCount} of 4 sections complete`}>
                  {STAR_SECTIONS.map((sec) => (
                    <span
                      key={sec.key}
                      className={cn(
                        "h-1.5 w-8 rounded-full transition-colors",
                        form[sec.key].trim() ? "bg-primary" : "bg-muted"
                      )}
                    />
                  ))}
                </div>
                <span className="font-display text-sm font-bold tabular-nums text-foreground">
                  {Math.round(completeness * 100)}%
                </span>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <Label htmlFor="star-question" className="text-[13px] font-medium text-foreground">
                  Interview question
                </Label>
                <Input
                  id="star-question"
                  value={form.question}
                  onChange={(e) => setForm({ ...form, question: e.target.value })}
                  placeholder="e.g. Tell me about a time you handled a conflict on your team."
                  className="mt-1.5 h-10"
                />
              </div>

              <div className="space-y-4">
                {STAR_SECTIONS.map((section, index) => {
                  const filled = form[section.key].trim().length > 0
                  return (
                    <div key={section.key} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-display text-[13px] font-bold transition-colors",
                            filled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}
                          aria-hidden
                        >
                          {section.label[0]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <Label htmlFor={`star-${section.key}`} className="text-[13px] font-semibold text-foreground">
                              {section.label}
                              <span className="ml-1.5 font-normal text-muted-foreground/70">
                                step {index + 1}
                              </span>
                            </Label>
                            <span className="text-[11px] tabular-nums text-muted-foreground/70">
                              {form[section.key].trim().length}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{section.hint}</p>
                          <Textarea
                            id={`star-${section.key}`}
                            value={form[section.key]}
                            onChange={(e) => setForm({ ...form, [section.key]: e.target.value })}
                            rows={3}
                            placeholder="Write this part in 2–3 sentences…"
                            className="mt-2 resize-y bg-background text-[13px] leading-relaxed"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={!form.question.trim() || filledCount === 0}
                  className="h-9 rounded-lg bg-primary text-primary-foreground shadow-[0_4px_14px_-4px_rgba(24,187,112,0.5)] hover:bg-primary"
                >
                  <Save className="mr-1.5 h-4 w-4" />
                  {editingId ? "Update answer" : "Save answer"}
                </Button>
                {editingId ? (
                  <Button variant="ghost" className="h-9" onClick={resetForm}>
                    Cancel
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  className="ml-auto h-9"
                  onClick={handleCopy}
                  disabled={!composed}
                >
                  <Copy className="mr-1.5 h-4 w-4" />
                  Copy composed answer
                </Button>
              </div>
            </div>
          </section>

          <div className="space-y-5">
            {/* Live preview — the composed paragraph is the artefact you rehearse */}
            <section className="rounded-2xl border border-border/70 bg-card">
              <div className="flex items-center justify-between gap-2 border-b border-border/60 px-5 py-4">
                <h2 className="font-display text-[15px] font-bold tracking-tight text-foreground">Preview</h2>
                <span className="text-[11px] text-muted-foreground">
                  {composed.split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
              <div className="p-5">
                {composed ? (
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">{composed}</p>
                ) : (
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    Fill in the sections and your answer assembles here, ready to rehearse or paste.
                  </p>
                )}
              </div>
            </section>

            {/* Saved answers */}
            <section className="rounded-2xl border border-border/70 bg-card">
              <div className="flex items-center justify-between gap-2 border-b border-border/60 px-5 py-4">
                <h2 className="font-display text-[15px] font-bold tracking-tight text-foreground">
                  Saved answers
                </h2>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                  {hydrated ? answers.length : 0}
                </span>
              </div>

              {!hydrated ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : answers.length === 0 ? (
                <EmptyState
                  icon={<Sparkles className="h-5 w-5" />}
                  title="No saved answers yet"
                  description="Build one above and it stays in this browser for interview prep."
                />
              ) : (
                <ul className="divide-y divide-border/50">
                  {answers.map((answer) => (
                    <li key={answer.id} className="group px-5 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-foreground">{answer.question}</p>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {composeStarAnswer(answer)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => startEdit(answer)}
                            aria-label={`Edit ${answer.question}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteId(answer.id)}
                            aria-label={`Delete ${answer.question}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1">
                        {STAR_SECTIONS.map((sec) => (
                          <span
                            key={sec.key}
                            className={cn(
                              "h-1 w-6 rounded-full",
                              answer[sec.key].trim() ? "bg-primary/70" : "bg-muted"
                            )}
                            title={`${sec.label}${answer[sec.key].trim() ? "" : " — missing"}`}
                          />
                        ))}
                        <span className="ml-2 text-[11px] text-muted-foreground">
                          {new Date(answer.updatedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteId}
        onConfirm={handleDelete}
        title="Delete this answer?"
        description="It will be removed from this browser. This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onCancel={() => setDeleteId(null)}
      />
    </DashboardLayout>
  )
}
