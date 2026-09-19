"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import { FollowUpCard } from "@/modules/applications/components/follow-up-card"
import { MetricsCard } from "@/modules/analytics/components/MetricsCard"
import { TimelineChart } from "@/modules/analytics/components/TimelineChart"
import { ConversionFunnel } from "@/modules/analytics/components/ConversionFunnel"
import { SankeyChart } from "@/modules/analytics/components/SankeyChart"
import { motion } from "framer-motion"
import {
  AlertCircle,
  ArrowRight,
  Award,
  BarChart3,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  FolderOpen,
  Loader2,
  Plus,
  Target,
  Upload,
} from "lucide-react"
import { getApplications, getApplicationStats } from "@/modules/applications/services/application.service"
import { getDocuments } from "@/modules/documents/services/document.service"
import { useAuth } from "@/contexts/AuthContext"
import { PageHeader } from "@/components/layout/page-header"
import { Stat, Sparkline, MiniBar } from "@/components/data/stat"
import { StatusPill, STATUS_META, PRIORITY_META, ScoreRing } from "@/components/data/status-pill"
import { ActivityHeatmap } from "@/components/data/activity-heatmap"
import { EmptyState } from "@/components/data/empty-state"
import type { Application, ApplicationStatus, ApplicationPriority } from "@/types/database"
import type { TimeRange } from "@/modules/analytics/services/analytics.service"

/** Funnel order used by the pipeline band — the story of an application. */
const PIPELINE_STAGES: ApplicationStatus[] = ["draft", "submitted", "in_review", "interview", "offer"]

const OUTCOME_GROUPS = {
  active: ["draft", "submitted", "in_review", "interview"] as ApplicationStatus[],
  closed: ["offer", "rejected"] as ApplicationStatus[],
}

function deadlineInfo(deadline: string | null) {
  if (!deadline) return null
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
  if (days < 0) return { label: "Deadline passed", cls: "text-muted-foreground/60" }
  if (days === 0) return { label: "Due today", cls: "font-medium text-destructive" }
  if (days <= 3) return { label: `Due in ${days}d`, cls: "font-medium text-amber-600 dark:text-amber-400" }
  return { label: `Due in ${days}d`, cls: "text-muted-foreground" }
}

function initialsFor(app: Application) {
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

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

interface AnalyticsData {
  metrics: {
    total: number
    successRate: number
    averageTimeToOutcome: number | null
    interviewConversionRate: number
  }
  timeline: Array<{ date: string; count: number }>
  funnel: Array<{ stage: string; count: number; percentage: number }>
  byType: Array<{ type: string; count: number; percentage: number }>
  byPriority: Array<{ priority: string; count: number; percentage: number }>
  statusFlow: {
    nodes: Array<{ name: string; value?: number }>
    links: Array<{ source: number; target: number; value: number }>
  }
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState("overview")
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, pending: 0, upcomingDeadlines: 0 })
  const [documentsCount, setDocumentsCount] = useState(0)
  const [recentApplications, setRecentApplications] = useState<Application[]>([])
  const [allApplications, setAllApplications] = useState<Application[]>([])
  const [, setActivityDates] = useState<string[]>([])
  const [weeklyGoal] = useState(5)
  const [statusDistribution, setStatusDistribution] = useState<Record<string, number>>({})

  // Analytics state
  const [timeRange, setTimeRange] = useState<TimeRange>("all")
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (activeTab === "analytics" && !analyticsData) {
      fetchAnalytics()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === "analytics") {
      fetchAnalytics()
    }
  }, [timeRange])

  const fetchData = async () => {
    try {
      const [applicationsResult, statsResult, documentsResult] = await Promise.allSettled([
        getApplications(),
        getApplicationStats(),
        getDocuments(),
      ])

      const applicationsData = applicationsResult.status === "fulfilled" ? applicationsResult.value : []
      const statsData = statsResult.status === "fulfilled" ? statsResult.value : null
      const documentsData = documentsResult.status === "fulfilled" ? documentsResult.value : []

      if (applicationsResult.status === "rejected")
        console.error("Error fetching applications:", applicationsResult.reason)
      if (statsResult.status === "rejected")
        console.error("Error fetching stats:", statsResult.reason)

      if (statsData) setStats(statsData)
      setDocumentsCount(documentsData.length)
      setRecentApplications(applicationsData.slice(0, 4))
      setAllApplications(applicationsData)
      setActivityDates(applicationsData.map((app) => app.created_at))

      const distribution: Record<string, number> = {}
      applicationsData.forEach((app) => {
        distribution[app.status] = (distribution[app.status] || 0) + 1
      })
      setStatusDistribution(distribution)
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true)
      setAnalyticsError(null)

      const metricsRes = await fetch(`/api/analytics/metrics?timeRange=${timeRange}`)

      if (!metricsRes.ok) {
        throw new Error("Failed to fetch analytics data")
      }

      const metricsData = await metricsRes.json()

      setAnalyticsData(metricsData.data)
    } catch (err) {
      console.error("Error fetching analytics:", err)
      setAnalyticsError("Failed to load analytics data. Please try again.")
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const firstName = (user?.user_metadata?.name || user?.email || "there").split(" ")[0]

  // ---- derived view models -------------------------------------------
  const statusCount = (status: ApplicationStatus) => statusDistribution[status] ?? 0

  const interviewRate =
    stats.total > 0
      ? Math.round(((statusCount("interview") + statusCount("offer")) / stats.total) * 100)
      : 0

  // last 8 weeks of application volume, for the trend sparkline
  const weeklyVolume = (() => {
    const buckets = new Array(8).fill(0)
    const now = Date.now()
    for (const app of allApplications) {
      const weeksAgo = Math.floor((now - new Date(app.created_at).getTime()) / (7 * 86_400_000))
      if (weeksAgo >= 0 && weeksAgo < 8) buckets[7 - weeksAgo] += 1
    }
    return buckets
  })()

  // heatmap data: applications created per day
  const activityByDay = (() => {
    const map = new Map<string, number>()
    for (const app of allApplications) {
      const key = app.created_at.slice(0, 10)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  })()

  // the single most useful next action, surfaced instead of buried in a list
  const nextDeadline = [...allApplications]
    .filter((a) => a.deadline && new Date(a.deadline).getTime() > Date.now())
    .sort((a, b) => new Date(a.deadline as string).getTime() - new Date(b.deadline as string).getTime())[0]

  const activeCount = OUTCOME_GROUPS.active.reduce((sum, s) => sum + statusCount(s), 0)
  const closedCount = OUTCOME_GROUPS.closed.reduce((sum, s) => sum + statusCount(s), 0)

  const rankedStatuses = (Object.keys(STATUS_META) as ApplicationStatus[])
    .map((status) => ({ status, count: statusCount(status) }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="space-y-6">
          <PageHeader
            overline={`${greeting()}`}
            title={`${firstName}, here's your pipeline.`}
            description={
              stats.total > 0
                ? `${activeCount} active · ${closedCount} closed · ${interviewRate}% reached interview or offer`
                : "Add your first application and this becomes your job-search command centre."
            }
            actions={
              <>
                <TabsList className="flex rounded-lg border-0 bg-muted/70 p-1">
                  {(["overview", "analytics"] as const).map((tab) => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      className="rounded-md px-4 text-[13px] font-medium capitalize data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                    >
                      {tab}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <Link
                  href="/upload"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3.5 text-[13px] font-medium text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload
                </Link>
                <Link
                  href="/applications"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_rgba(24,187,112,0.5)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_-4px_rgba(24,187,112,0.65)]"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                  New application
                </Link>
              </>
            }
          />

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-2 space-y-6">
            {/* Pipeline band — the stages of this search, ranked by volume */}
            <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
                <div>
                  <h2 className="font-display text-[15px] font-bold tracking-tight text-foreground">
                    Pipeline
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Where every application currently sits
                  </p>
                </div>
                {nextDeadline ? (
                  <Link
                    href={`/applications/${nextDeadline.id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/15 dark:text-amber-400"
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    Next deadline: {nextDeadline.company || nextDeadline.title} ·{" "}
                    {new Date(nextDeadline.deadline as string).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </Link>
                ) : null}
              </div>

              {stats.total === 0 ? (
                <EmptyState
                  icon={<FileText className="h-5 w-5" />}
                  title="No applications yet"
                  description="Track your first role and the pipeline fills in automatically."
                  action={
                    <Link
                      href="/applications"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                      New application
                    </Link>
                  }
                />
              ) : (
                <div className="grid grid-cols-2 divide-border/60 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
                  {PIPELINE_STAGES.map((stage) => {
                    const count = statusCount(stage)
                    const share = stats.total > 0 ? count / stats.total : 0
                    const meta = STATUS_META[stage]
                    return (
                      <Link
                        key={stage}
                        href={`/applications?status=${stage}`}
                        className="group relative border-b border-border/60 px-5 py-4 transition-colors last:border-b-0 hover:bg-muted/40 lg:border-b-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
                          <span className="text-xs font-medium text-muted-foreground">{meta.label}</span>
                        </div>
                        <p className="mt-2 font-display text-[26px] font-bold leading-none tracking-[-0.02em] text-foreground tabular-nums">
                          {count}
                        </p>
                        <div className="mt-3">
                          <MiniBar
                            ratio={share}
                            tone={stage === "offer" ? "primary" : stage === "rejected" ? "danger" : "primary"}
                          />
                        </div>
                        <p className="mt-1.5 text-[11px] text-muted-foreground/80">
                          {Math.round(share * 100)}% of {stats.total}
                        </p>
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Focused stats — each answers a different question */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
              <Stat
                label="Applications this week"
                value={weeklyVolume[weeklyVolume.length - 1] ?? 0}
                icon={<FileText className="h-4 w-4" />}
                accent="primary"
                visual={<Sparkline values={weeklyVolume} />}
                hint="Last 8 weeks of activity"
              />
              <Stat
                label="Awaiting a reply"
                value={stats.pending}
                icon={<Clock className="h-4 w-4" />}
                accent="warning"
                hint={
                  stats.pending > 0
                    ? "Applications sitting in review"
                    : "Nothing waiting on the other side"
                }
              />
              <Stat
                label="Deadlines in 7 days"
                value={stats.upcomingDeadlines}
                icon={<CalendarClock className="h-4 w-4" />}
                accent={stats.upcomingDeadlines > 0 ? "danger" : "muted"}
                hint={stats.upcomingDeadlines > 0 ? "Time-sensitive — sort by deadline" : "Clear week ahead"}
              />
              <Stat
                label="Reached interview"
                value={`${interviewRate}%`}
                icon={<Target className="h-4 w-4" />}
                accent="primary"
                hint={`Conversions from ${stats.total} applications`}
              />
            </div>

            {/* Activity: streak, weekly goal, heatmap */}
            <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
              <section className="rounded-2xl border border-border/70 bg-card p-5">
                <ActivityHeatmap
                  data={activityByDay}
                  weeks={26}
                  subtitle="Applications you started, by day"
                />
              </section>

              <section className="rounded-2xl border border-border/70 bg-card p-5">
                <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">
                  This week&apos;s target
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  A steady pace beats a burst before deadlines
                </p>

                <div className="mt-5 flex items-center gap-5">
                  <ScoreRing
                    score={Math.min(((weeklyVolume[weeklyVolume.length - 1] ?? 0) / weeklyGoal) * 100, 100)}
                    size={76}
                    tone="progress"
                  />
                  <div>
                    <p className="font-display text-2xl font-bold leading-none text-foreground tabular-nums">
                      {weeklyVolume[weeklyVolume.length - 1]}
                      <span className="text-sm font-medium text-muted-foreground"> / {weeklyGoal}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {weeklyVolume[weeklyVolume.length - 1] >= weeklyGoal
                        ? "Target met — nice work."
                        : `${weeklyGoal - (weeklyVolume[weeklyVolume.length - 1] ?? 0)} to go this week`}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Documents on file</p>
                    <p className="mt-0.5 font-display text-lg font-bold leading-none text-foreground tabular-nums">
                      {documentsCount}
                    </p>
                  </div>
                  <Link
                    href="/documents"
                    className="text-[13px] font-semibold text-primary-strong transition-opacity hover:opacity-75 dark:text-primary"
                  >
                    Manage →
                  </Link>
                </div>
              </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Status Distribution */}
              <div className="rounded-2xl border border-border/70 bg-card">
                <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                  <div>
                    <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">
                      Outcomes
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Ranked by volume, split by whether it is still live
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                      {activeCount} active
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40" aria-hidden />
                      {closedCount} closed
                    </span>
                  </div>
                </div>

                {rankedStatuses.length === 0 ? (
                  <EmptyState
                    icon={<BarChart3 className="h-5 w-5" />}
                    title="Nothing to chart yet"
                    description="Once you log applications their outcomes appear here."
                  />
                ) : (
                  <ul className="divide-y divide-border/50">
                    {rankedStatuses.map(({ status, count }) => {
                      const meta = STATUS_META[status]
                      const share = stats.total > 0 ? count / stats.total : 0
                      const tone =
                        status === "rejected" ? "danger" : status === "draft" ? "muted" : "primary"
                      return (
                        <li key={status} className="flex items-center gap-4 px-5 py-3.5">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${meta.pill}`}
                          >
                            <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-[13.5px] font-semibold text-foreground">{meta.label}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {count} · {Math.round(share * 100)}%
                              </span>
                            </div>
                            <div className="mt-2">
                              <MiniBar ratio={share} tone={tone as "primary" | "muted" | "danger"} />
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {/* Recent Applications */}
              <div className="rounded-2xl border border-border/70 bg-card">
                <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                  <div>
                    <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">
                      Recent applications
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Your most recent activity
                    </p>
                  </div>
                  <Link
                    href="/applications"
                    className="text-[13px] font-semibold text-primary-strong transition-opacity hover:opacity-75 dark:text-primary"
                  >
                    View all →
                  </Link>
                </div>
                <div className="p-3">
                  {recentApplications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
                        <CheckCircle2 className="h-6 w-6 text-primary-strong dark:text-primary" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          No applications yet
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Create your first one — the AI does the heavy lifting.
                        </p>
                      </div>
                      <Link
                        href="/apply"
                        className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-all hover:-translate-y-0.5"
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        Start your first application
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {recentApplications.map((app, index) => {
                        const deadline = deadlineInfo(app.deadline)
                        return (
                          <motion.div
                            key={app.id}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <Link
                              href={`/applications/${app.id}`}
                              className="group flex items-center gap-3 rounded-xl border border-transparent px-2.5 py-3 transition-all duration-200 hover:border-border/70 hover:bg-muted/40 sm:px-3"
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/60 text-[11px] font-bold text-foreground/80">
                                {initialsFor(app)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13.5px] font-semibold text-foreground">
                                  {app.title}
                                </span>
                                <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                                  {app.company && <span className="truncate">{app.company}</span>}
                                  {deadline && (
                                    <span className={`flex shrink-0 items-center gap-1 ${deadline.cls}`}>
                                      <CalendarClock className="h-3 w-3" />
                                      {deadline.label}
                                    </span>
                                  )}
                                </span>
                              </span>
                              {app.priority !== "low" ? (
                                <span
                                  className={`hidden h-1.5 w-1.5 shrink-0 rounded-full sm:block ${PRIORITY_META[app.priority].dot}`}
                                  title={`${PRIORITY_META[app.priority].label} priority`}
                                />
                              ) : null}
                              <StatusPill status={app.status} size="sm" className="shrink-0" />
                              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
                            </Link>
                          </motion.div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-2 space-y-6">
            {/* Time Range Selector */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
                  Analytics
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Insights into your application journey
                </p>
              </div>

              <Tabs
                value={timeRange}
                onValueChange={(value) => setTimeRange(value as TimeRange)}
              >
                <TabsList className="flex w-fit rounded-lg border-0 bg-muted/70 p-1">
                  <TabsTrigger
                    value="7d"
                    className="rounded-md px-3 text-[13px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    7d
                  </TabsTrigger>
                  <TabsTrigger
                    value="30d"
                    className="rounded-md px-3 text-[13px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    30d
                  </TabsTrigger>
                  <TabsTrigger
                    value="90d"
                    className="rounded-md px-3 text-[13px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    90d
                  </TabsTrigger>
                  <TabsTrigger
                    value="all"
                    className="rounded-md px-3 text-[13px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    All
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Error State */}
            {analyticsError && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{analyticsError}</span>
              </div>
            )}

            {/* Loading State */}
            {analyticsLoading ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-border/70 bg-card p-5"
                    >
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                      <div className="mt-4 h-8 w-16 animate-pulse rounded bg-muted" />
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-border/70 bg-card p-5">
                  <div className="h-[400px] animate-pulse rounded-xl bg-muted" />
                </div>
              </div>
            ) : (
              analyticsData && (
                <>
                  {/* KPI Cards */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <MetricsCard
                      title="Total Applications"
                      value={analyticsData.metrics.total}
                      icon={Briefcase}
                      subtitle={`${timeRange === "all" ? "All time" : `Last ${timeRange}`}`}
                    />
                    <MetricsCard
                      title="Success Rate"
                      value={`${analyticsData.metrics.successRate}%`}
                      icon={Award}
                      subtitle="Offers received"
                    />
                    <MetricsCard
                      title="Avg Time to Outcome"
                      value={
                        analyticsData.metrics.averageTimeToOutcome
                          ? `${analyticsData.metrics.averageTimeToOutcome} days`
                          : "N/A"
                      }
                      icon={Clock}
                      subtitle="From submission to decision"
                    />
                    <MetricsCard
                      title="Interview Rate"
                      value={`${analyticsData.metrics.interviewConversionRate}%`}
                      icon={Target}
                      subtitle="Submissions to interviews"
                    />
                  </div>

                  {/* Sankey Diagram */}
                  <SankeyChart data={analyticsData.statusFlow} title="Application Status Flow" />

                  {/* Timeline and Funnel */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="min-h-[400px]">
                      <TimelineChart
                        data={analyticsData.timeline}
                        title="Applications Over Time"
                      />
                    </div>
                    <div className="min-h-[400px]">
                      <ConversionFunnel
                        data={analyticsData.funnel}
                        title="Application Conversion Funnel"
                      />
                    </div>
                  </div>

                  {/* Type and Priority Breakdown */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-border/70 bg-card">
                      <div className="border-b border-border/60 px-5 py-4">
                        <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">
                          Applications by type
                        </h3>
                      </div>
                      <div className="space-y-4 p-5">
                        {analyticsData.byType.length > 0 ? (
                          analyticsData.byType.map((item) => (
                            <div key={item.type}>
                              <div className="mb-1.5 flex items-center justify-between text-[13px]">
                                <span className="font-medium capitalize text-foreground">
                                  {item.type}
                                </span>
                                <span className="text-muted-foreground">
                                  {item.count} ({item.percentage}%)
                                </span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary transition-all duration-500"
                                  style={{ width: `${item.percentage}%` }}
                                />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-8 text-center text-sm text-muted-foreground">
                            No type data available
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-card">
                      <div className="border-b border-border/60 px-5 py-4">
                        <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">
                          Applications by priority
                        </h3>
                      </div>
                      <div className="space-y-4 p-5">
                        {analyticsData.byPriority.length > 0 ? (
                          analyticsData.byPriority.map((item) => {
                            const priorityColor =
                              item.priority === "High"
                                ? "bg-destructive"
                                : item.priority === "Medium"
                                  ? "bg-amber-500"
                                  : "bg-primary/60"

                            return (
                              <div key={item.priority}>
                                <div className="mb-1.5 flex items-center justify-between text-[13px]">
                                  <span className="font-medium capitalize text-foreground">
                                    {item.priority}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {item.count} ({item.percentage}%)
                                  </span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${priorityColor}`}
                                    style={{ width: `${item.percentage}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })
                        ) : (
                          <div className="py-8 text-center text-sm text-muted-foreground">
                            No priority data available
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )
            )}
          </TabsContent>
        </div>
      </Tabs>
    </DashboardLayout>
  )
}
