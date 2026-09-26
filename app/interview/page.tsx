"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent } from "@/shared/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import { motion } from "framer-motion"
import { PageHeader } from "@/components/layout/page-header"
import { Stat } from "@/components/data/stat"
import { ScoreRing } from "@/components/data/status-pill"
import { EmptyState } from "@/components/data/empty-state"
import {
  Mic,
  TrendingUp,
  Award,
  Clock,
  Loader2,
  RefreshCcw,
  Sparkles,
  HelpCircle,
  Timer,
  ArrowRight,
  CheckCircle2,
} from "lucide-react"
import Link from "next/link"
import type { InterviewSession, Application } from "@/types/database"
import { createClient } from "@/shared/db/supabase/client"
import { Button } from "@/shared/ui/button"
import { useToast } from "@/shared/ui/use-toast"
import { ConfirmDialog } from "@/shared/ui/confirm-dialog"

interface SessionWithApplication extends InterviewSession {
  application: Application | null
}

export default function InterviewPage() {
  const { toast } = useToast()
  const [sessions, setSessions] = useState<SessionWithApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")
  const [retrySessionId, setRetrySessionId] = useState<string | null>(null)

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      // Fetch all interview sessions with their applications
      const { data: sessionsData, error } = await supabase
        .from('interview_sessions')
        .select(`
          *,
          application:applications(*),
          db_total_questions,
          db_answered_questions,
          db_average_score
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const mappedSessions = (sessionsData || []).map((session: SessionWithApplication & {
        db_total_questions?: number | null
        db_answered_questions?: number | null
        db_average_score?: number | null
      }) => ({
        ...session,
        total_questions: session.db_total_questions ?? session.total_questions,
        answered_questions: session.db_answered_questions ?? session.answered_questions,
        average_score: session.db_average_score ?? session.average_score,
      }))

      setSessions(mappedSessions)
    } catch (err) {
      console.error('Error loading interview sessions:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRetryClick = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setRetrySessionId(sessionId)
  }

  const handleConfirmRetry = async () => {
    if (!retrySessionId) return

    try {
      const response = await fetch('/api/interview/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: retrySessionId }),
      })

      if (!response.ok) throw new Error('Failed to reset session')

      toast({
        title: "Session Reset",
        description: "The interview session has been reset. You can now start over.",
      })

      loadSessions()
    } catch (err) {
      console.error('Error resetting session:', err)
      toast({
        title: "Error",
        description: "Failed to reset session. Please try again.",
        variant: "destructive",
      })
    } finally {
      setRetrySessionId(null)
    }
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

  // Calculate statistics
  const totalSessions = sessions.length
  const completedSessions = sessions.filter(s => s.status === 'completed').length
  const answeredTotal = sessions.reduce((sum, s) => sum + (s.answered_questions ?? 0), 0)
  const questionsTotal = sessions.reduce((sum, s) => sum + (s.total_questions ?? 0), 0)
  const timeSpentMinutes = Math.round(
    sessions.reduce((sum, s) => sum + (s.total_duration_seconds ?? 0), 0) / 60
  )
  const avgScoreOverall =
    completedSessions > 0
      ? sessions.filter((s) => s.status === "completed" && s.average_score).reduce((sum, s) => sum + (s.average_score ?? 0), 0) /
        sessions.filter((s) => s.status === "completed" && s.average_score).length || 0
      : 0
  // Group sessions by type
  const sessionsByType = sessions.reduce((acc, session) => {
    const type = session.session_type
    if (!acc[type]) acc[type] = []
    acc[type].push(session)
    return acc
  }, {} as Record<string, SessionWithApplication[]>)

  const sessionTypeLabels: Record<string, string> = {
    behavioral: "Behavioral",
    technical: "Technical",
    mixed: "Mixed",
    resume_grill: "Resume Grill",
    company_specific: "Company-Specific"
  }

  const difficultyColors = {
    easy: "bg-primary/10 text-primary-strong dark:text-primary",
    medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    hard: "bg-destructive/10 text-destructive"
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          overline="Practice"
          title="Interview"
          description={
            sessions.length > 0
              ? `${totalSessions} sessions · ${answeredTotal} questions answered · ${avgScoreOverall.toFixed(1)}/10 average score`
              : "Practise out loud — the AI scores clarity, structure, depth and confidence."
          }
          actions={
            <Link
              href="/interview/star"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3.5 text-[13px] font-medium text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40"
            >
              <Sparkles className="h-3.5 w-3.5" />
              STAR Answer Builder
            </Link>
          }
        />

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <Stat
                label="Average score"
                value={`${avgScoreOverall.toFixed(1)}/10`}
                icon={<Award className="h-4 w-4" />}
                accent={avgScoreOverall >= 7.5 ? "primary" : avgScoreOverall >= 6 ? "warning" : "danger"}
                hint={`Across ${completedSessions} completed ${completedSessions === 1 ? "session" : "sessions"}`}
              />
              <Stat
                label="Questions answered"
                value={answeredTotal}
                icon={<HelpCircle className="h-4 w-4" />}
                accent="primary"
                hint={questionsTotal > 0 ? `${Math.round((answeredTotal / questionsTotal) * 100)}% of ${questionsTotal} generated` : "No questions yet"}
              />
              <Stat
                label="Time practising"
                value={timeSpentMinutes >= 60 ? `${Math.floor(timeSpentMinutes / 60)}h ${timeSpentMinutes % 60}m` : `${timeSpentMinutes}m`}
                icon={<Timer className="h-4 w-4" />}
                hint="Total across every session"
              />
              <Stat
                label="Completion rate"
                value={`${Math.round((completedSessions / Math.max(totalSessions, 1)) * 100)}%`}
                icon={<TrendingUp className="h-4 w-4" />}
                accent={completedSessions === totalSessions && totalSessions > 0 ? "primary" : "muted"}
                hint={`${completedSessions} of ${totalSessions} finished`}
              />
            </div>

            {sessions.length === 0 ? (
              <div className="rounded-2xl border border-border/70 bg-card">
                <EmptyState
                  variant="page"
                  icon={<Mic className="h-5 w-5" />}
                  title="No interview sessions yet"
                  description="Sessions start from an application — open one and practise the questions the AI generates for the role."
                  action={
                    <Link
                      href="/applications"
                      className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_rgba(24,187,112,0.5)] transition-all duration-200 hover:-translate-y-0.5"
                    >
                      <ArrowRight className="h-4 w-4" />
                      Go to applications
                    </Link>
                  }
                />
              </div>
            ) : (
              <>
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="flex w-fit rounded-lg border-0 bg-muted/70 p-1">
                <TabsTrigger
                  value="overview"
                  className="rounded-md px-4 text-[13px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  All Sessions
                </TabsTrigger>
                <TabsTrigger
                  value="by-type"
                  className="rounded-md px-4 text-[13px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  By Type
                </TabsTrigger>
              </TabsList>

              {/* All Sessions Tab */}
              <TabsContent value="overview" className="space-y-4 mt-6">
                <div className="grid grid-cols-1 gap-4">
                  {sessions.map((session) => {
                    const progress = session.total_questions > 0
                      ? (session.answered_questions / session.total_questions) * 100
                      : 0
                    const avgScore = session.average_score || 0

                    return (
                      <motion.div
                        key={session.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                                              >
                        <Link href={`/interview/${session.id}/report`} className="block">
                          <Card className="group relative overflow-hidden rounded-2xl border-border/70 bg-card transition-colors duration-200 hover:border-primary/40">
                            <CardContent className="p-5">
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                {/* Identity */}
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">
                                      {sessionTypeLabels[session.session_type] || session.session_type}
                                    </h3>
                                    {session.company_name ? (
                                      <span className="rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                                        {session.company_name}
                                      </span>
                                    ) : null}
                                    {session.difficulty ? (
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${difficultyColors[session.difficulty]}`}
                                      >
                                        {session.difficulty}
                                      </span>
                                    ) : null}
                                    {session.status === "completed" ? (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary-strong dark:text-primary">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Completed
                                      </span>
                                    ) : session.status === "in_progress" ? (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                                        <Clock className="h-3 w-3" />
                                        In progress
                                      </span>
                                    ) : null}
                                  </div>

                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {session.application?.title || "Unknown application"} ·{" "}
                                    {new Date(session.created_at).toLocaleDateString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })}
                                    {session.total_duration_seconds
                                      ? ` · ${Math.round(session.total_duration_seconds / 60)} min`
                                      : ""}
                                  </p>

                                  {/* One thin meter instead of two heavy bars */}
                                  <div className="mt-3 flex items-center gap-3">
                                    <div className="h-1.5 max-w-[220px] flex-1 overflow-hidden rounded-full bg-muted">
                                      <div
                                        className="h-full rounded-full bg-primary transition-[width] duration-500"
                                        style={{ width: `${progress}%` }}
                                      />
                                    </div>
                                    <span className="text-[11px] tabular-nums text-muted-foreground">
                                      {session.answered_questions}/{session.total_questions} answered
                                    </span>
                                  </div>
                                </div>

                                {/* Score */}
                                <div className="flex items-center gap-4 sm:shrink-0">
                                  {session.answered_questions > 0 ? (
                                    <ScoreRing score={avgScore} size={52} />
                                  ) : (
                                    <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-dashed border-border text-[11px] text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                  <ArrowRight className="h-4 w-4 text-muted-foreground/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>
              </TabsContent>

              {/* By Type Tab — same card language as the All Sessions list:
                  one bordered card per session, no gradient chrome. */}
              <TabsContent value="by-type" className="space-y-6 mt-6">
                {Object.entries(sessionsByType).map(([type, typeSessions]) => (
                  <div key={type} className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">
                        {sessionTypeLabels[type] || type}
                      </h3>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                        {typeSessions.length} session{typeSessions.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {typeSessions.map((session, index) => {
                        const progress = session.total_questions > 0
                          ? (session.answered_questions / session.total_questions) * 100
                          : 0
                        const avgScore = session.average_score || 0

                        return (
                          <motion.div
                            key={session.id}
                            initial={index < 8 ? { opacity: 0, y: 10 } : false}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, delay: index * 0.03, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <Link href={`/interview/${session.id}/report`}>
                              <Card className="group rounded-2xl border-border/70 bg-card transition-colors duration-200 hover:border-primary/40">
                                <CardContent className="p-4 sm:p-5">
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="truncate text-[14px] font-semibold text-foreground">
                                          {session.application?.title || 'Unknown application'}
                                        </p>
                                        {session.status === "completed" || progress === 100 ? (
                                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary-strong dark:text-primary">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Completed
                                          </span>
                                        ) : null}
                                      </div>
                                      <p className="mt-0.5 text-xs text-muted-foreground">
                                        {new Date(session.created_at).toLocaleDateString(undefined, {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                        })}
                                        {session.total_duration_seconds
                                          ? ` · ${Math.round(session.total_duration_seconds / 60)} min`
                                          : ""}
                                      </p>
                                      <div className="mt-2.5 flex items-center gap-3">
                                        <div className="h-1.5 max-w-[200px] flex-1 overflow-hidden rounded-full bg-muted">
                                          <div
                                            className="h-full rounded-full bg-primary transition-[width] duration-500"
                                            style={{ width: `${progress}%` }}
                                          />
                                        </div>
                                        <span className="text-[11px] tabular-nums text-muted-foreground">
                                          {session.answered_questions}/{session.total_questions} answered
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-3">
                                      {session.answered_questions > 0 ? (
                                        <ScoreRing score={avgScore} size={48} />
                                      ) : (
                                        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-border text-[11px] text-muted-foreground">
                                          —
                                        </span>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                        onClick={(e) => handleRetryClick(e, session.id)}
                                        aria-label={`Retry ${session.application?.title || 'this interview'}`}
                                        title="Retry session"
                                      >
                                        <RefreshCcw className="h-3.5 w-3.5" />
                                      </Button>
                                      <ArrowRight className="h-4 w-4 text-muted-foreground/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </Link>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
              </>
            )}
      </div>

      <ConfirmDialog
        open={!!retrySessionId}
        title="Retry Interview?"
        description="This will delete all your current answers and score for this session. You will be able to start over from the beginning."
        confirmLabel="Yes, Retry"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleConfirmRetry}
        onCancel={() => setRetrySessionId(null)}
      />
    </DashboardLayout>
  )
}
