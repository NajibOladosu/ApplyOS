"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Briefcase,
  Loader2
} from "lucide-react"
import { getApplications, getApplicationStats } from "@/lib/services/applications"
import { getDocuments } from "@/lib/services/documents"
import type { Application } from "@/types/database"

const statusConfig = {
  draft: { label: "Draft", variant: "outline" as const },
  submitted: { label: "Submitted", variant: "info" as const },
  in_review: { label: "In Review", variant: "warning" as const },
  interview: { label: "Interview", variant: "success" as const },
  offer: { label: "Offer", variant: "default" as const },
  rejected: { label: "Rejected", variant: "destructive" as const },
}

const priorityConfig = {
  low: { color: "bg-green-500" },
  medium: { color: "bg-yellow-500" },
  high: { color: "bg-red-500" },
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, pending: 0, upcomingDeadlines: 0 })
  const [documentsCount, setDocumentsCount] = useState(0)
  const [recentApplications, setRecentApplications] = useState<Application[]>([])
  const [statusDistribution, setStatusDistribution] = useState<Record<string, number>>({})

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [applicationsData, statsData, documentsData] = await Promise.all([
        getApplications(),
        getApplicationStats(),
        getDocuments()
      ])

      setStats(statsData)
      setDocumentsCount(documentsData.length)
      setRecentApplications(applicationsData.slice(0, 4))

      // Calculate status distribution
      const distribution: Record<string, number> = {}
      applicationsData.forEach(app => {
        distribution[app.status] = (distribution[app.status] || 0) + 1
      })
      setStatusDistribution(distribution)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
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

  const statsCards = [
    {
      title: "Total Applications",
      value: stats.total.toString(),
      icon: FileText,
      color: "text-blue-500",
    },
    {
      title: "Pending Decisions",
      value: stats.pending.toString(),
      icon: Clock,
      color: "text-yellow-500",
    },
    {
      title: "Upcoming Deadlines",
      value: stats.upcomingDeadlines.toString(),
      icon: AlertCircle,
      color: "text-red-500",
    },
    {
      title: "Documents Uploaded",
      value: documentsCount.toString(),
      icon: CheckCircle,
      color: "text-primary",
    },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back! Here's an overview of your applications.
            </p>
          </div>
          <Button
            className="glow-effect"
            asChild
          >
            <Link href="/applications">
              Add Application
            </Link>
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsCards.map((stat, index) => {
            const Icon = stat.icon
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="hover:border-primary/40 transition-all">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {stat.title}
                    </CardTitle>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Application Status</CardTitle>
            <CardDescription>
              Distribution of your current applications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(statusDistribution).map(([status, count]) => {
              const total = stats.total
              const percentage = total > 0 ? (count / total) * 100 : 0

              return (
                <div key={status} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="h-3 w-3 rounded-full bg-primary" />
                      <span className="text-sm capitalize">{status.replace('_', ' ')}</span>
                    </div>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Recent Applications */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Applications</CardTitle>
            <CardDescription>
              Your most recent application activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentApplications.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No applications yet. Create your first application to get started!
                </p>
              ) : (
                recentApplications.map((app, index) => (
                  <motion.div
                    key={app.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <Link href={`/applications/${app.id}`}>
                      <div className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/40 transition-all cursor-pointer">
                        <div className="flex items-center space-x-4">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Briefcase className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-medium">{app.title}</h4>
                            <div className="flex items-center space-x-2 mt-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {app.deadline
                                  ? `Deadline: ${new Date(app.deadline).toLocaleDateString()}`
                                  : 'No deadline set'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <Badge variant={statusConfig[app.status].variant}>
                            {statusConfig[app.status].label}
                          </Badge>
                          <div
                            className={`h-2 w-2 rounded-full ${priorityConfig[app.priority].color}`}
                          />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
