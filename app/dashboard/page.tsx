"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Calendar,
  Briefcase
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const stats = [
  {
    title: "Total Applications",
    value: "24",
    change: "+12%",
    icon: FileText,
    color: "text-blue-500",
  },
  {
    title: "Pending Decisions",
    value: "8",
    change: "+5%",
    icon: Clock,
    color: "text-yellow-500",
  },
  {
    title: "Upcoming Deadlines",
    value: "5",
    change: "-2%",
    icon: AlertCircle,
    color: "text-red-500",
  },
  {
    title: "Documents Uploaded",
    value: "12",
    change: "+8%",
    icon: CheckCircle,
    color: "text-primary",
  },
]

const chartData = [
  { month: "Jan", applications: 4 },
  { month: "Feb", applications: 7 },
  { month: "Mar", applications: 5 },
  { month: "Apr", applications: 8 },
  { month: "May", applications: 12 },
  { month: "Jun", applications: 6 },
]

const recentApplications = [
  {
    title: "Software Engineer - Google",
    status: "in_review",
    deadline: "2024-12-15",
    priority: "high",
  },
  {
    title: "Product Designer - Meta",
    status: "interview",
    deadline: "2024-12-10",
    priority: "high",
  },
  {
    title: "Frontend Developer - Stripe",
    status: "submitted",
    deadline: "2024-12-20",
    priority: "medium",
  },
  {
    title: "Research Scholar - MIT",
    status: "draft",
    deadline: "2024-12-25",
    priority: "medium",
  },
]

const statusConfig = {
  draft: { label: "Draft", variant: "outline" as const },
  submitted: { label: "Submitted", variant: "info" as const },
  in_review: { label: "In Review", variant: "warning" as const },
  interview: { label: "Interview", variant: "success" as const },
  offer: { label: "Offer", variant: "default" as const },
  rejected: { label: "Rejected", variant: "destructive" as const },
}

const priorityConfig = {
  low: { color: "text-green-500" },
  medium: { color: "text-yellow-500" },
  high: { color: "text-red-500" },
}

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's an overview of your applications.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => {
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
                    <p className="text-xs text-muted-foreground">
                      <span className="text-primary">{stat.change}</span> from last month
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* Charts and Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Applications Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Application Trends</CardTitle>
              <CardDescription>
                Your application activity over the last 6 months
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" />
                  <XAxis dataKey="month" stroke="#B5B5B5" />
                  <YAxis stroke="#B5B5B5" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#101010",
                      border: "1px solid #1A1A1A",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="applications" fill="#00FF88" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Application Status</CardTitle>
              <CardDescription>
                Distribution of your current applications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="h-3 w-3 rounded-full bg-primary" />
                    <span className="text-sm">In Review</span>
                  </div>
                  <span className="text-sm font-medium">8</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="h-full w-[33%] bg-primary" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <span className="text-sm">Interview</span>
                  </div>
                  <span className="text-sm font-medium">5</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="h-full w-[20%] bg-yellow-500" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <span className="text-sm">Submitted</span>
                  </div>
                  <span className="text-sm font-medium">6</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="h-full w-[25%] bg-blue-500" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="h-3 w-3 rounded-full bg-muted" />
                    <span className="text-sm">Draft</span>
                  </div>
                  <span className="text-sm font-medium">5</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="h-full w-[22%] bg-muted" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
              {recentApplications.map((app, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/40 transition-all cursor-pointer"
                >
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">{app.title}</h4>
                      <div className="flex items-center space-x-2 mt-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Deadline: {new Date(app.deadline).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Badge variant={statusConfig[app.status as keyof typeof statusConfig].variant}>
                      {statusConfig[app.status as keyof typeof statusConfig].label}
                    </Badge>
                    <div className={`h-2 w-2 rounded-full ${priorityConfig[app.priority as keyof typeof priorityConfig].color.replace('text-', 'bg-')}`} />
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
