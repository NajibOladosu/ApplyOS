"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card"
import { ScoreRing, scoreTone } from "@/components/data/status-pill"
import { EmptyState } from "@/components/data/empty-state"
import { MiniBar } from "@/components/data/stat"
import { Button } from "@/shared/ui/button"
import { Badge } from "@/shared/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/shared/ui/accordion"
import { ArrowLeft, Mic, Target, Loader2, CheckCircle, XCircle, Lightbulb } from "lucide-react"
import Link from "next/link"
import type { InterviewSession, InterviewQuestion, InterviewAnswer, Application } from "@/types/database"
import { getInterviewSession, getQuestionsForSession, getAnswersForSession } from "@/modules/interviews/services/interview.service"
import { getApplication } from "@/modules/applications/services/application.service"

// Session type labels
const sessionTypeLabels: Record<string, string> = {
  behavioral: 'Behavioral',
  technical: 'Technical',
  company_specific: 'Company-Specific',
  mixed: 'Mixed',
  resume_grill: 'Resume Grill'
}

// Difficulty color classes
const difficultyColors: Record<string, string> = {
  easy: 'bg-primary/10 text-primary-strong dark:text-primary border-primary/30',
  medium: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  hard: 'bg-destructive/10 text-destructive border-destructive/30'
}

// Helper function to get score color
function getScoreColor(score: number | null): string {
  if (score == null) return 'text-muted-foreground'
  if (score >= 8) return 'text-primary-strong dark:text-primary'
  if (score >= 6) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-destructive'
}

// Helper function to get score badge class
function getScoreBadgeClass(score: number): string {
  if (score >= 8) return 'bg-primary/10 border border-primary/30'
  if (score >= 6) return 'bg-yellow-500/10 border border-yellow-500/30'
  return 'bg-destructive/10 border border-destructive/30'
}

// Helper function to aggregate strengths
function aggregateStrengths(answersMap: Map<string, InterviewAnswer>): string[] {
  const strengthCounts = new Map<string, number>()

  answersMap.forEach(answer => {
    if (answer.feedback && Array.isArray(answer.feedback.strengths)) {
      answer.feedback.strengths.forEach(strength => {
        if (strength && typeof strength === 'string') {
          strengthCounts.set(strength, (strengthCounts.get(strength) || 0) + 1)
        }
      })
    }
  })

  return Array.from(strengthCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([strength]) => strength)
}

// Helper function to aggregate weaknesses
function aggregateWeaknesses(answersMap: Map<string, InterviewAnswer>): string[] {
  const weaknessCounts = new Map<string, number>()

  answersMap.forEach(answer => {
    if (answer.feedback && Array.isArray(answer.feedback.weaknesses)) {
      answer.feedback.weaknesses.forEach(weakness => {
        if (weakness && typeof weakness === 'string') {
          weaknessCounts.set(weakness, (weaknessCounts.get(weakness) || 0) + 1)
        }
      })
    }
  })

  return Array.from(weaknessCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([weakness]) => weakness)
}

export default function InterviewReportPage() {
  const params = useParams()
  const sessionId = params?.id as string | undefined

  const [session, setSession] = useState<InterviewSession | null>(null)
  const [questions, setQuestions] = useState<InterviewQuestion[]>([])
  const [answers, setAnswers] = useState<Map<string, InterviewAnswer>>(new Map())
  const [application, setApplication] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return

    const fetchReportData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch all data in parallel
        const [sessionData, questionsData, answersData] = await Promise.all([
          getInterviewSession(sessionId),
          getQuestionsForSession(sessionId),
          getAnswersForSession(sessionId)
        ])

        // Fetch application data
        const appData = await getApplication(sessionData.application_id)

        // Map answers by question_id for O(1) lookup
        const answersMap = new Map(answersData.map(ans => [ans.question_id, ans]))

        setSession(sessionData)
        setApplication(appData)
        setQuestions(questionsData)
        setAnswers(answersMap)
      } catch (err) {
        console.error('Error fetching report data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load interview report')
      } finally {
        setLoading(false)
      }
    }

    void fetchReportData()
  }, [sessionId])

  // Error state - invalid ID
  if (!sessionId) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <p className="text-destructive text-sm">Invalid interview session ID</p>
          <Link href="/interview">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Interviews
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  // Loading state
  // answers that carry a score, used for the dimension averages
  const scoredAnswers = [...answers.values()].filter((a) => typeof a.score === "number")

  // the answers worth revisiting first
  const weakestAnswers = scoredAnswers
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((answer) => ({
      answer,
      question: questions.find((q) => q.id === answer.question_id),
    }))

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  // Error state
  if (error || !session || !application) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <p className="text-destructive text-sm">{error || 'Interview session not found'}</p>
          <Link href="/interview">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Interviews
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const isCompleted = session.status === 'completed'
  const hasAnsweredQuestions = session.answered_questions > 0
  const completionPercentage = session.total_questions > 0
    ? (session.answered_questions / session.total_questions) * 100
    : 0

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2 sm:gap-4">
            <Link href="/interview">
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 mt-1">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>

            <div className="flex-1 min-w-0">
              <h1 className="break-words font-display text-2xl font-bold tracking-tight text-foreground md:text-[28px]">
                {sessionTypeLabels[session.session_type] || session.session_type} Interview Report
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {application.title} • {application.company}
              </p>
            </div>
          </div>

          {/* Go to Interview Button */}
          <div className="flex">
            <Link href={`/applications/${session.application_id}?tab=interview&session=${session.id}`}>
              <Button className="bg-primary text-primary-foreground font-semibold">
                <Mic className="h-4 w-4 mr-2" />
                Go to Interview
              </Button>
            </Link>
          </div>
        </div>

        {/* Session Metadata Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Type</p>
                <Badge variant="outline" className="font-medium">
                  {sessionTypeLabels[session.session_type]}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Difficulty</p>
                <Badge className={difficultyColors[session.difficulty ?? 'medium']}>
                  <span className="capitalize">{session.difficulty}</span>
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Started</p>
                <span className="text-sm">
                  {new Date(session.started_at).toLocaleDateString()}
                </span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Questions</p>
                <span className="text-sm font-medium">
                  {session.answered_questions} / {session.total_questions}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress Card - Show for in-progress interviews */}
        {!isCompleted && (
          <>
            {/* Progress Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Interview Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="relative h-2.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-300"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">
                    {completionPercentage.toFixed(0)}% Complete
                  </p>
                </div>

                {/* Status message */}
                <div className="pt-2">
                  {session.answered_questions === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Interview not started yet. Click &quot;Go to Interview&quot; to begin.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {session.total_questions - session.answered_questions} question{session.total_questions - session.answered_questions !== 1 ? 's' : ''} remaining.
                    </p>
                  )}
                </div>

                {/* Preparation tips (shown if not started) */}
                {session.answered_questions === 0 && (
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-display mb-3 flex items-center gap-2 text-sm font-semibold">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      Preparation Tips
                    </h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>Use the STAR method for behavioral questions (Situation, Task, Action, Result)</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>Prepare specific examples from your experience with quantifiable results</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>Focus on clarity, structure, relevance, and depth in your answers</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>Speak confidently and maintain a professional tone</span>
                      </li>
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

          </>
        )}

        {/* Interview Analysis - Show for any interview with answered questions */}
        {hasAnsweredQuestions && (
          <>
            {/* Overall Summary Card */}
            <Card className="rounded-2xl border-border/70">
              <CardHeader className="px-5 py-4">
                <CardTitle className="font-display text-[15px] font-bold tracking-tight">
                  {isCompleted ? "Interview summary" : "Progress summary"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {isCompleted
                    ? `${session.answered_questions} of ${session.total_questions} questions answered · scored out of 100`
                    : `${session.answered_questions} of ${session.total_questions} questions answered so far`}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6 px-5 pb-5">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
                  <ScoreRing score={session.average_score ?? 0} size={104} tone="score" />

                  <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Questions answered</p>
                      <p className="mt-1 font-display text-xl font-bold leading-none text-foreground tabular-nums">
                        {session.answered_questions}
                        <span className="text-sm font-medium text-muted-foreground">
                          /{session.total_questions}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Time spent</p>
                      <p className="mt-1 font-display text-xl font-bold leading-none text-foreground tabular-nums">
                        {Math.floor((session.total_duration_seconds || 0) / 60)}m
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Company</p>
                      <p className="mt-1 truncate text-sm font-semibold text-foreground">
                        {session.company_name || application?.company || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Session type</p>
                      <p className="mt-1 text-sm font-semibold capitalize text-foreground">
                        {(session.session_type || "mixed").replace("_", " ")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Score breakdown — the raw dimension scores were being
                    collected and then never shown anywhere. */}
                {scoredAnswers.length > 0 && (
                  <div className="space-y-3 border-t border-border/60 pt-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                      Average by dimension
                    </p>
                    {(
                      [
                        { key: "clarity_score", label: "Clarity" },
                        { key: "structure_score", label: "Structure" },
                        { key: "relevance_score", label: "Relevance" },
                        { key: "depth_score", label: "Depth" },
                        { key: "confidence_score", label: "Confidence" },
                      ] as const
                    ).map(({ key, label }) => {
                      const values = scoredAnswers
                        .map((a) => a[key as keyof typeof a])
                        .filter((v): v is number => typeof v === "number")
                      if (!values.length) return null
                      const avg = values.reduce((sum, v) => sum + v, 0) / values.length
                      return (
                        <div key={key} className="flex items-center gap-3">
                          <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
                          <div className="flex-1">
                            <MiniBar ratio={avg / 100} />
                          </div>
                          <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">
                            {Math.round(avg)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Strengths and improvements — an empty list is an absence of
                    data, not a sentence, so it is presented as such. */}
                {answers.size > 0 && (
                  <div className="grid gap-4 border-t border-border/60 pt-5 md:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-foreground">
                        <CheckCircle className="h-4 w-4 text-primary-strong dark:text-primary" />
                        Common strengths
                      </h3>
                      {aggregateStrengths(answers).length > 0 ? (
                        <ul className="space-y-2">
                          {aggregateStrengths(answers)
                            .slice(0, 5)
                            .map((strength, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                                <span>{strength}</span>
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Nothing recorded yet — strengths appear as answers are scored.
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-foreground">
                        <XCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        Areas to work on
                      </h3>
                      {aggregateWeaknesses(answers).length > 0 ? (
                        <ul className="space-y-2">
                          {aggregateWeaknesses(answers)
                            .slice(0, 5)
                            .map((weakness, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                                <span>{weakness}</span>
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No gaps flagged in this session — try a harder difficulty or a different question
                          category to find something to work on.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Weakest answers — the analysis existed but was never surfaced */}
                {weakestAnswers.length > 0 && (
                  <div className="space-y-3 border-t border-border/60 pt-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                      Lowest scoring answers
                    </p>
                    <ul className="space-y-2">
                      {weakestAnswers.map(({ question, answer }) => (
                        <li
                          key={answer.id}
                          className="flex items-center gap-3 rounded-xl border border-border/60 px-3.5 py-2.5"
                        >
                          <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                            {question?.question_text ?? "Question"}
                          </span>
                          <span className={`shrink-0 text-sm font-bold tabular-nums ${scoreTone(answer.score).text}`}>
                            {answer.score}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Question-by-Question Accordion */}
            <Card>
              <CardHeader>
                <CardTitle>Question-by-Question Analysis</CardTitle>
                <CardDescription>
                  {isCompleted
                    ? 'Detailed feedback for each interview question'
                    : 'Detailed feedback for answered questions'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="space-y-2">
                  {questions.map((question, idx) => {
                    const answer = answers.get(question.id)

                    // For in-progress interviews, only show answered questions
                    if (!isCompleted && !answer) return null

                    return (
                      <AccordionItem
                        key={question.id}
                        value={question.id}
                        className="border rounded-lg overflow-hidden"
                      >
                        <AccordionTrigger className="px-4 py-3 hover:bg-muted/40 hover:no-underline">
                          <div className="flex justify-between w-full gap-4 pr-4">
                            <div className="flex-1 text-left">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-sm font-semibold">Question {idx + 1}</span>
                                <Badge variant="outline" className="text-xs">
                                  {question.question_category.replace(/_/g, ' ')}
                                </Badge>
                                <Badge className={difficultyColors[question.difficulty ?? 'medium']} variant="outline">
                                  <span className="capitalize">{question.difficulty}</span>
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {question.question_text}
                              </p>
                            </div>

                            {/* Score badge */}
                            {answer && (
                              <div
                                className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${getScoreBadgeClass(answer.score)}`}
                              >
                                <span className={`text-sm font-bold ${getScoreColor(answer.score)}`}>
                                  {answer.score.toFixed(1)}
                                </span>
                              </div>
                            )}
                          </div>
                        </AccordionTrigger>

                        <AccordionContent className="px-4 pb-4 space-y-4 bg-muted/10">
                          {answer ? (
                            <>
                              {/* User's Answer */}
                              <div>
                                <h4 className="font-display text-xs font-semibold mb-2">Your Answer</h4>
                                <div className="text-sm bg-background/50 p-3 rounded border">
                                  {answer.answer_text}
                                </div>
                              </div>

                              {/* Score Breakdown */}
                              {(answer.clarity_score != null || answer.structure_score != null ||
                                answer.relevance_score != null || answer.depth_score != null ||
                                answer.confidence_score != null) && (
                                  <div>
                                    <h4 className="font-display text-xs font-semibold mb-2">Score Breakdown</h4>
                                    <div className="grid grid-cols-5 gap-2">
                                      {[
                                        { label: 'Clarity', score: answer.clarity_score },
                                        { label: 'Structure', score: answer.structure_score },
                                        { label: 'Relevance', score: answer.relevance_score },
                                        { label: 'Depth', score: answer.depth_score },
                                        { label: 'Confidence', score: answer.confidence_score },
                                      ].map(({ label, score }) => (
                                        score != null && (
                                          <div key={label} className="text-center p-2 bg-background rounded border">
                                            <div className={`text-sm font-bold ${getScoreColor(score)}`}>
                                              {score.toFixed(1)}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                                          </div>
                                        )
                                      ))}
                                    </div>
                                  </div>
                                )}

                              {/* Detailed Feedback */}
                              {answer.feedback ? (
                                <div className="space-y-3">
                                  <h4 className="font-display text-xs font-semibold">Detailed Feedback</h4>

                                  {/* Overall */}
                                  {answer.feedback.overall && (
                                    <div>
                                      <p className="text-xs font-medium mb-1">Overall Assessment</p>
                                      <p className="text-sm text-muted-foreground">{answer.feedback.overall}</p>
                                    </div>
                                  )}

                                  {/* Strengths */}
                                  {answer.feedback.strengths && Array.isArray(answer.feedback.strengths) && answer.feedback.strengths.length > 0 && (
                                    <div>
                                      <p className="font-display text-xs font-medium text-primary-strong dark:text-primary mb-1">
                                        Strengths
                                      </p>
                                      <ul className="space-y-1">
                                        {answer.feedback.strengths.map((strength, i) => (
                                          <li key={i} className="text-sm flex gap-2 items-start">
                                            <span className="text-primary-strong dark:text-primary mt-0.5">✓</span>
                                            <span>{strength}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Weaknesses */}
                                  {answer.feedback.weaknesses && Array.isArray(answer.feedback.weaknesses) && answer.feedback.weaknesses.length > 0 && (
                                    <div>
                                      <p className="font-display text-xs font-medium text-destructive mb-1">
                                        Weaknesses
                                      </p>
                                      <ul className="space-y-1">
                                        {answer.feedback.weaknesses.map((weakness, i) => (
                                          <li key={i} className="text-sm flex gap-2 items-start">
                                            <span className="text-destructive mt-0.5">✗</span>
                                            <span>{weakness}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Suggestions */}
                                  {answer.feedback.suggestions && Array.isArray(answer.feedback.suggestions) && answer.feedback.suggestions.length > 0 && (
                                    <div>
                                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">
                                        Suggestions
                                      </p>
                                      <ul className="space-y-1">
                                        {answer.feedback.suggestions.map((suggestion, i) => (
                                          <li key={i} className="text-sm flex gap-2 items-start">
                                            <span className="text-amber-400 mt-0.5">→</span>
                                            <span>{suggestion}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Tone Analysis */}
                                  {answer.feedback.tone_analysis && (
                                    <div>
                                      <p className="text-xs font-medium mb-1">Communication Style</p>
                                      <p className="text-sm text-muted-foreground italic">
                                        {answer.feedback.tone_analysis}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground italic">
                                  No detailed feedback available for this answer.
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              This question has not been answered yet.
                            </p>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              </CardContent>
            </Card>

            {/* Remaining Questions - Show for in-progress interviews */}
            {!isCompleted && session.answered_questions < session.total_questions && (
              <Card>
                <CardHeader>
                  <CardTitle>Remaining Questions</CardTitle>
                  <CardDescription>
                    {session.total_questions - session.answered_questions} question{session.total_questions - session.answered_questions !== 1 ? 's' : ''} left to answer
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {questions.map((question, idx) => {
                      const answer = answers.get(question.id)

                      // Only show unanswered questions
                      if (answer) return null

                      return (
                        <div
                          key={question.id}
                          className="p-3 border rounded-lg bg-background/50 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <p className="text-sm font-medium">Question {idx + 1}</p>
                            <Badge variant="outline" className="text-xs">
                              {question.question_category.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{question.question_text}</p>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
