"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Tabs, TabsContent, TabsTrigger } from "@/shared/ui/tabs"
import { ActivityStats } from "@/modules/analytics/components/ActivityStats"
import { FollowUpCard } from "@/modules/applications/components/follow-up-card"
import { MetricsCard } from "@/modules/analytics/components/MetricsCard"
import { TimelineChart } from "@/modules/analytics/components/TimelineChart"
import { ConversionFunnel } from "@/modules/analytics/components/ConversionFunnel"
import { SankeyChart } from "@/modules/analytics/components/SankeyChart"
import { motion } from "framer-motion"
import {
  AlertCircle,
  Award,
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
import type { Application, ApplicationStatus, ApplicationPriority } from "@/types/database"
import type { TimeRange } from "@/modules/analytics/services/analytics.service"

const statusChip: Record<ApplicationStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  submitted: {
    label: "Submitted",
    cls: "bg-primary/10 text-primary-strong dark:text-primary",
  },
  in_review: {
    label: "In Review",
    cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  interview: {
    label: "Interview",
    cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  offer: {
    label: "Offer",
    cls: "bg-primary/15 font-semibold text-primary-strong dark:text-primary",
  },
  rejected: { label: "Rejected", cls: "bg-destructive/10 text-destructive" },
}

const priorityDot: Record<ApplicationPriority, string> = {
  low: "bg-muted-foreground/40",
  medium: "bg-amber-500",
  high: "bg-destructive",
}

const barColor: Record<ApplicationStatus, string> = {
  draft: "bg-muted-foreground/40",
  submitted: "bg-primary/40",
  in_review: "bg-primary/70",
  interview: "bg-primary",
  offer: "bg-primary-strong dark:bg-primary",
  rejected: "bg-destructive/50",
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
  const [activityDates, setActivityDates] = useState<string[]>([])
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

  const statsCards = [
    {
      title: "Total applications",
      value: stats.total.toString(),
      icon: FileText,
    },
    {
      title: "In review",
      value: stats.pending.toString(),
      icon: Clock,
    },
    {
      title: "Deadlines · 7 days",
      value: stats.upcomingDeadlines.toString(),
      icon: CalendarClock,
    },
    {
      title: "Documents",
      value: documentsCount.toString(),
      icon: FolderOpen,
    },
  ]

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
          {/* Header */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                {greeting()}, {firstName}.
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Here&apos;s what&apos;s moving in your pipeline.
              </p>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div className="flex rounded-lg bg-muted/70 p-1">
                {(["overview", "analytics"] as const).map((tab) => (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    className="rounded-md px-4 text-[13px] font-medium capitalize data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    {tab}
                  </TabsTrigger>
                ))}
              </div>
              <div className="flex gap-2">
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
              </div>
            </div>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-2 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              {statsCards.map((stat, index) => {
                const Icon = stat.icon
                return (
                  <motion.div
                    key={stat.title}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="rounded-2xl border border-border/70 bg-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 sm:p-5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">{stat.title}</p>
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-4 w-4 text-primary-strong dark:text-primary" />
                        </span>
                      </div>
                      <p className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground">
                        {stat.value}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Follow-ups due */}
            <FollowUpCard applications={allApplications} />

            {/* Activity: streak, weekly goal, heatmap */}
            <ActivityStats activityDates={activityDates} />

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Status Distribution */}
              <div className="rounded-2xl border border-border/70 bg-card">
                <div className="border-b border-border/60 px-5 py-4">
                  <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">
                    Application status
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Distribution of your current applications
                  </p>
                </div>
                <div className="space-y-4 p-5">
                  {Object.entries(statusDistribution).length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No applications yet.
                    </p>
                  ) : (
                    Object.entries(statusDistribution).map(([status, count]) => {
                      const total = stats.total
                      const percentage = total > 0 ? (count / total) * 100 : 0

                      return (
                        <div key={status} className="space-y-1.5">
                          <div className="flex items-center justify-between text-[13px]">
                            <span className="font-medium capitalize text-foreground">
                              {status.replace("_", " ")}
                            </span>
                            <span className="text-muted-foreground">
                              {count} · {Math.round(percentage)}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${barColor[status as ApplicationStatus] || "bg-primary/60"}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
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
                        const chip = statusChip[app.status]
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
                              className="group flex items-center gap-3 rounded-xl border border-transparent p-2.5 transition-all duration-200 hover:border-border/70 hover:bg-muted/40 sm:p-3"
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary-strong dark:text-primary">
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
                              <span
                                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${chip.cls}`}
                              >
                                {chip.label}
                              </span>
                              <span
                                className={`hidden h-2 w-2 shrink-0 rounded-full sm:block ${priorityDot[app.priority]}`}
                                title={`${app.priority} priority`}
                              />
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
                <div className="flex rounded-lg bg-muted/70 p-1">
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
                </div>
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
