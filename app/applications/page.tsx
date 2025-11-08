"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"
import {
  Plus,
  Search,
  Filter,
  Calendar,
  Briefcase,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  ExternalLink,
} from "lucide-react"
import Link from "next/link"

const applications = [
  {
    id: "1",
    title: "Software Engineer - Google",
    url: "https://careers.google.com/jobs/123",
    status: "in_review",
    priority: "high",
    type: "job",
    deadline: "2024-12-15",
    created_at: "2024-11-01",
  },
  {
    id: "2",
    title: "Product Designer - Meta",
    url: "https://www.metacareers.com/jobs/456",
    status: "interview",
    priority: "high",
    type: "job",
    deadline: "2024-12-10",
    created_at: "2024-11-05",
  },
  {
    id: "3",
    title: "Frontend Developer - Stripe",
    url: "https://stripe.com/jobs/789",
    status: "submitted",
    priority: "medium",
    type: "job",
    deadline: "2024-12-20",
    created_at: "2024-11-08",
  },
  {
    id: "4",
    title: "Research Scholar - MIT",
    url: "https://mit.edu/scholarships/phd",
    status: "draft",
    priority: "high",
    type: "scholarship",
    deadline: "2024-12-25",
    created_at: "2024-11-10",
  },
  {
    id: "5",
    title: "Data Scientist - Amazon",
    url: "https://amazon.jobs/en/jobs/abc123",
    status: "submitted",
    priority: "medium",
    type: "job",
    deadline: "2024-12-18",
    created_at: "2024-11-12",
  },
  {
    id: "6",
    title: "UX Researcher - Apple",
    url: "https://jobs.apple.com/en-us/details/xyz789",
    status: "rejected",
    priority: "low",
    type: "job",
    deadline: "2024-11-30",
    created_at: "2024-10-15",
  },
]

const statusConfig = {
  draft: { label: "Draft", variant: "outline" as const, color: "bg-muted" },
  submitted: { label: "Submitted", variant: "info" as const, color: "bg-blue-500" },
  in_review: { label: "In Review", variant: "warning" as const, color: "bg-yellow-500" },
  interview: { label: "Interview", variant: "success" as const, color: "bg-green-500" },
  offer: { label: "Offer", variant: "default" as const, color: "bg-primary" },
  rejected: { label: "Rejected", variant: "destructive" as const, color: "bg-destructive" },
}

const priorityConfig = {
  low: { color: "bg-green-500" },
  medium: { color: "bg-yellow-500" },
  high: { color: "bg-red-500" },
}

export default function ApplicationsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")

  const filteredApplications = applications.filter((app) => {
    const matchesSearch = app.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = selectedStatus === "all" || app.status === selectedStatus
    return matchesSearch && matchesStatus
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Applications</h1>
            <p className="text-muted-foreground">
              Manage and track all your job and scholarship applications
            </p>
          </div>
          <Button className="glow-effect">
            <Plus className="mr-2 h-4 w-4" />
            Add Application
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search applications..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant={selectedStatus === "all" ? "default" : "outline"}
                  onClick={() => setSelectedStatus("all")}
                >
                  All
                </Button>
                <Button
                  variant={selectedStatus === "draft" ? "default" : "outline"}
                  onClick={() => setSelectedStatus("draft")}
                >
                  Draft
                </Button>
                <Button
                  variant={selectedStatus === "submitted" ? "default" : "outline"}
                  onClick={() => setSelectedStatus("submitted")}
                >
                  Submitted
                </Button>
                <Button
                  variant={selectedStatus === "in_review" ? "default" : "outline"}
                  onClick={() => setSelectedStatus("in_review")}
                >
                  In Review
                </Button>
                <Button
                  variant={selectedStatus === "interview" ? "default" : "outline"}
                  onClick={() => setSelectedStatus("interview")}
                >
                  Interview
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Applications Grid */}
        <div className="grid grid-cols-1 gap-4">
          {filteredApplications.map((app, index) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card className="hover:border-primary/40 transition-all">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Briefcase className="h-6 w-6 text-primary" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold truncate">{app.title}</h3>
                          <div className={`h-2 w-2 rounded-full ${priorityConfig[app.priority as keyof typeof priorityConfig].color}`} />
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4" />
                            <span>Deadline: {new Date(app.deadline).toLocaleDateString()}</span>
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {app.type}
                          </Badge>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Badge variant={statusConfig[app.status as keyof typeof statusConfig].variant}>
                            {statusConfig[app.status as keyof typeof statusConfig].label}
                          </Badge>
                          <a
                            href={app.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center space-x-1"
                          >
                            <span>View posting</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/applications/${app.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {filteredApplications.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Briefcase className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No applications found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search or filters
              </p>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Application
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
