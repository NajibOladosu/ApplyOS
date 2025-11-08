"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  ExternalLink,
  Calendar,
  Sparkles,
  Edit,
  RotateCw,
  FileText,
  CheckCircle,
  Loader2,
} from "lucide-react"
import Link from "next/link"
import type { Application, Question } from "@/types/database"
import { getApplication } from "@/lib/services/applications"
import {
  getQuestionsByApplicationId,
  updateQuestion,
} from "@/lib/services/questions"
import { generateAnswer } from "@/lib/ai"

export default function ApplicationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string | undefined

  const [application, setApplication] = useState<Application | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState<string | "all" | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const [app, qs] = await Promise.all([
          getApplication(id),
          getQuestionsByApplicationId(id),
        ])
        setApplication(app)
        setQuestions(qs)
      } catch (err: unknown) {
        console.error("Error loading application detail:", err)
        setError("Unable to load this application. It may not exist or you may not have access.")
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [id])

  const handleRegenerate = async (questionId?: string) => {
    if (!application) return

    try {
      // Optionally load some parsed_data from documents or profile later as context.
      // For now, keep context minimal but real (no mocks).
      const context = {
        resume: undefined,
        experience: undefined,
        education: undefined,
      }

      if (!questionId) {
        setRegenerating("all")
        const updated: Question[] = []
        for (const q of questions) {
          const answer = await generateAnswer(q.question_text, context)
          const saved = await updateQuestion(q.id, { ai_answer: answer })
          updated.push(saved)
        }
        setQuestions(updated)
      } else {
        setRegenerating(questionId)
        const target = questions.find((q) => q.id === questionId)
        if (!target) return
        const answer = await generateAnswer(target.question_text, context)
        const saved = await updateQuestion(target.id, { ai_answer: answer })
        setQuestions((prev) => prev.map((q) => (q.id === saved.id ? saved : q)))
      }
    } catch (err) {
      console.error("Error regenerating answer:", err)
    } finally {
      setRegenerating(null)
    }
  }

  const handleSaveManual = async (questionId: string, value: string) => {
    setSaving(questionId)
    try {
      const saved = await updateQuestion(questionId, { manual_answer: value })
      setQuestions((prev) => prev.map((q) => (q.id === saved.id ? saved : q)))
    } catch (err) {
      console.error("Error saving answer:", err)
    } finally {
      setSaving(null)
    }
  }

  if (!id) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Invalid application id.</p>
        </div>
      </DashboardLayout>
    )
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  if (error || !application) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <p className="text-destructive text-sm">
            {error || "Application not found."}
          </p>
          <Button variant="outline" onClick={() => router.push("/applications")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Applications
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const statusLabel: Record<Application["status"], string> = {
    draft: "Draft",
    submitted: "Submitted",
    in_review: "In Review",
    interview: "Interview",
    offer: "Offer",
    rejected: "Rejected",
  }

  const statusVariant: Record<Application["status"], "outline" | "info" | "warning" | "success" | "default" | "destructive"> = {
    draft: "outline",
    submitted: "info",
    in_review: "warning",
    interview: "success",
    offer: "default",
    rejected: "destructive",
  }

  const priorityColor: Record<Application["priority"], string> = {
    low: "bg-green-500",
    medium: "bg-yellow-500",
    high: "bg-red-500",
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/applications">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{application.title}</h1>
            <p className="text-muted-foreground mt-1">
              Application Details & AI-Generated Responses
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push(`/applications`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Manage
          </Button>
        </div>

        {/* Application Info */}
        <Card>
          <CardHeader>
            <CardTitle>Application Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <Badge variant={statusVariant[application.status]}>
                  {statusLabel[application.status]}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Priority</p>
                <div className="flex items-center space-x-2">
                  <div className={`h-2 w-2 rounded-full ${priorityColor[application.priority]}`} />
                  <span className="text-sm font-medium capitalize">
                    {application.priority}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Deadline</p>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {application.deadline
                      ? new Date(application.deadline).toLocaleDateString()
                      : "No deadline"}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Type</p>
                <Badge variant="outline" className="capitalize">
                  {application.type}
                </Badge>
              </div>
            </div>

            {application.url && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Application URL</p>
                <a
                  href={application.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center space-x-1"
                >
                  <span>{application.url}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {application.notes && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{application.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Simple Status Summary (timeline can be implemented via status_history later) */}
        <Card>
          <CardHeader>
            <CardTitle>Application Progress</CardTitle>
            <CardDescription>
              Status changes are tracked in status history (Supabase). This view shows the current snapshot.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm">
                  Current status:{" "}
                  <span className="font-medium">
                    {statusLabel[application.status]}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Detailed timeline visualization can be added by querying status_history.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Questions and Answers */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Application Questions</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRegenerate()}
              disabled={regenerating !== null || questions.length === 0}
            >
              {regenerating === "all" ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Regenerate All
                </>
              )}
            </Button>
          </div>

          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No questions found for this application yet. You can add questions when creating or
              editing the application.
            </p>
          ) : (
            questions.map((question, index) => (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg">
                          Question {index + 1}
                        </CardTitle>
                        <CardDescription className="text-base font-medium text-foreground">
                          {question.question_text}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRegenerate(question.id)}
                        disabled={regenerating === question.id || regenerating === "all"}
                      >
                        {regenerating === question.id ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Regenerating
                          </>
                        ) : (
                          <>
                            <RotateCw className="mr-2 h-3 w-3" />
                            Regenerate
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <p className="text-sm font-medium">AI-Generated Answer</p>
                      </div>
                      <Textarea
                        value={question.ai_answer || ""}
                        rows={5}
                        className="resize-none"
                        readOnly
                        placeholder="No AI-generated answer yet."
                      />
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Your edited answer (saved privately for this application)
                      </p>
                      <Textarea
                        defaultValue={question.manual_answer || ""}
                        rows={4}
                        onBlur={(e) =>
                          e.target.value !== (question.manual_answer || "")
                            ? handleSaveManual(question.id, e.target.value)
                            : undefined
                        }
                        disabled={saving === question.id}
                      />
                      {saving === question.id && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Saving...
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        {/* Related Documents (placeholder referencing real data model, not hardcoded files) */}
        <Card>
          <CardHeader>
            <CardTitle>Related Documents</CardTitle>
            <CardDescription>
              Documents from your library that you may use for this application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-primary" />
                <span>
                  You can associate documents with applications by using consistent naming
                  or extending the schema (e.g. a join table). This section intentionally
                  avoids mocked static entries.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
