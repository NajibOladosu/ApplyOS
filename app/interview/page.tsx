"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { motion } from "framer-motion"
import {
  Mic,
  TrendingUp,
  Target,
  Award,
  Clock,
  BarChart3,
  Loader2,
} from "lucide-react"
import Link from "next/link"
import type { InterviewSession, Application } from "@/types/database"
import { createClient } from "@/lib/supabase/client"

interface SessionWithApplication extends InterviewSession {
  application: Application | null
}

export default function InterviewPage() {
  const [sessions, setSessions] = useState<SessionWithApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

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
          application:applications(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      setSessions(sessionsData || [])
    } catch (err) {
      console.error('Error loading interview sessions:', err)
    } finally {
      setLoading(false)
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
  const totalQuestionsAnswered = sessions.reduce((sum, s) => sum + s.answered_questions, 0)
  const averageScore = sessions.length > 0
    ? sessions.reduce((sum, s) => sum + (s.average_score || 0), 0) / sessions.length
    : 0
  const totalTimeSpent = sessions.reduce((sum, s) => sum + (s.total_duration_seconds || 0), 0)

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
    easy: "bg-green-500/10 text-green-700 dark:text-green-400",
    medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    hard: "bg-red-500/10 text-red-700 dark:text-red-400"
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Mic className="h-8 w-8" />
            Interview Practice
          </h1>
          <p className="text-muted-foreground mt-2">
            Track your interview preparation progress across all applications
          </p>
        </div>

        {sessions.length === 0 ? (
          // Empty State
          <Card className="border-2">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Mic className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold mb-2">No Interview Sessions Yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-6">
                  Start practicing your interview skills by creating an interview session from any application.
                </p>
                <Link href="/applications">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                    Go to Applications
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardDescription>Total Sessions</CardDescription>
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalSessions}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {completedSessions} completed
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardDescription>Questions Answered</CardDescription>
                      <Target className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalQuestionsAnswered}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Across all sessions
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardDescription>Average Score</CardDescription>
                      <Award className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${
                      averageScore >= 8 ? 'text-green-600 dark:text-green-400' :
                      averageScore >= 6 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      {averageScore.toFixed(1)}/10
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Overall performance
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardDescription>Time Spent</CardDescription>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {Math.floor(totalTimeSpent / 60)}m
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Total practice time
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardDescription>Improvement</CardDescription>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      +{((completedSessions / Math.max(totalSessions, 1)) * 100).toFixed(0)}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Completion rate
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-2 w-full sm:w-auto">
                <TabsTrigger value="overview">All Sessions</TabsTrigger>
                <TabsTrigger value="by-type">By Type</TabsTrigger>
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
                        <Link href={`/applications/${session.application_id}?tab=interview&session=${session.id}`}>
                          <Card className="cursor-pointer hover:border-primary transition-all">
                            <CardHeader>
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                                    {sessionTypeLabels[session.session_type] || session.session_type}
                                    {session.company_name && (
                                      <Badge variant="outline" className="text-xs">
                                        {session.company_name}
                                      </Badge>
                                    )}
                                  </CardTitle>
                                  <CardDescription className="mt-1">
                                    {session.application?.title || 'Unknown Application'} •{' '}
                                    {new Date(session.created_at).toLocaleDateString()}
                                  </CardDescription>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`capitalize shrink-0 ${session.difficulty ? difficultyColors[session.difficulty] : ''}`}
                                >
                                  {session.difficulty || 'medium'}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {/* Progress Bar */}
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Progress</span>
                                  <span className="font-medium">
                                    {session.answered_questions} / {session.total_questions} questions
                                  </span>
                                </div>
                                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary transition-all"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>

                              {/* Stats */}
                              <div className="flex justify-between items-center pt-2">
                                {session.answered_questions > 0 ? (
                                  <>
                                    <div className="text-sm">
                                      <span className="text-muted-foreground">Avg Score: </span>
                                      <span className={`font-semibold ${
                                        avgScore >= 8 ? 'text-green-600 dark:text-green-400' :
                                        avgScore >= 6 ? 'text-yellow-600 dark:text-yellow-400' :
                                        'text-red-600 dark:text-red-400'
                                      }`}>
                                        {avgScore.toFixed(1)}/10
                                      </span>
                                    </div>
                                    {session.status === 'completed' && (
                                      <Badge variant="success" className="bg-green-600 text-white">
                                        Completed
                                      </Badge>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-sm text-muted-foreground">No answers yet</span>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>
              </TabsContent>

              {/* By Type Tab */}
              <TabsContent value="by-type" className="space-y-6 mt-6">
                {Object.entries(sessionsByType).map(([type, typeSessions]) => (
                  <div key={type} className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      {sessionTypeLabels[type] || type}
                      <Badge variant="outline">{typeSessions.length} session{typeSessions.length !== 1 ? 's' : ''}</Badge>
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                      {typeSessions.map((session) => {
                        const progress = session.total_questions > 0
                          ? (session.answered_questions / session.total_questions) * 100
                          : 0
                        const avgScore = session.average_score || 0

                        return (
                          <Link key={session.id} href={`/applications/${session.application_id}?tab=interview&session=${session.id}`}>
                            <Card className="cursor-pointer hover:border-primary transition-all">
                              <CardContent className="pt-4">
                                <div className="flex items-center justify-between gap-4 mb-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{session.application?.title || 'Unknown Application'}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(session.created_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                  {session.answered_questions > 0 && (
                                    <div className={`text-lg font-bold ${
                                      avgScore >= 8 ? 'text-green-600 dark:text-green-400' :
                                      avgScore >= 6 ? 'text-yellow-600 dark:text-yellow-400' :
                                      'text-red-600 dark:text-red-400'
                                    }`}>
                                      {avgScore.toFixed(1)}/10
                                    </div>
                                  )}
                                </div>
                                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary transition-all"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
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
    </DashboardLayout>
  )
}
