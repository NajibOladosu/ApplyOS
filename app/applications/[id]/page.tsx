"use client"

import { use } from "react"
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
  Save,
  RotateCw,
  FileText,
  CheckCircle,
} from "lucide-react"
import Link from "next/link"

const mockApplication = {
  id: "1",
  title: "Software Engineer - Google",
  url: "https://careers.google.com/jobs/123",
  status: "in_review",
  priority: "high",
  type: "job",
  deadline: "2024-12-15",
  notes: "This is my dream job! Make sure to highlight my experience with distributed systems.",
  created_at: "2024-11-01",
}

const mockQuestions = [
  {
    id: "q1",
    question_text: "Why do you want to work at Google?",
    ai_answer:
      "I am deeply passionate about working at Google because of its commitment to innovation and solving complex problems at scale. Throughout my career, I have been fascinated by distributed systems and large-scale infrastructure, areas where Google is the industry leader. The opportunity to work with cutting-edge technologies and collaborate with some of the brightest minds in the industry would be invaluable for my professional growth.",
    manual_answer: null,
  },
  {
    id: "q2",
    question_text: "What are your key technical skills and experiences?",
    ai_answer:
      "I bring 5+ years of experience in software engineering with a strong focus on backend development and distributed systems. My technical skills include proficiency in Python, Go, and Java, along with expertise in cloud platforms like AWS and GCP. I have successfully led the development of microservices architectures handling millions of requests daily, and I'm well-versed in tools like Kubernetes, Docker, and Terraform.",
    manual_answer: null,
  },
  {
    id: "q3",
    question_text: "Describe a challenging project you've worked on.",
    ai_answer:
      "One of my most challenging projects involved redesigning a monolithic application into a microservices architecture for a fintech company. The system processed over 10 million transactions daily, and we needed zero downtime during the migration. I led a team of 4 engineers, implementing a gradual migration strategy using the strangler fig pattern. We successfully completed the migration in 6 months, resulting in a 40% improvement in system performance and 99.99% uptime.",
    manual_answer: null,
  },
]

const statusHistory = [
  { status: "Draft", date: "2024-11-01", current: false },
  { status: "Submitted", date: "2024-11-05", current: false },
  { status: "In Review", date: "2024-11-10", current: true },
  { status: "Interview", date: null, current: false },
  { status: "Offer", date: null, current: false },
]

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

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
            <h1 className="text-3xl font-bold">{mockApplication.title}</h1>
            <p className="text-muted-foreground mt-1">
              Application Details & AI-Generated Responses
            </p>
          </div>
          <Button variant="outline">
            <Edit className="mr-2 h-4 w-4" />
            Edit
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
                <Badge variant="warning">In Review</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Priority</p>
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-sm font-medium">High</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Deadline</p>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {new Date(mockApplication.deadline).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Type</p>
                <Badge variant="outline" className="capitalize">
                  {mockApplication.type}
                </Badge>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Application URL</p>
              <a
                href={mockApplication.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center space-x-1"
              >
                <span>{mockApplication.url}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Notes</p>
              <p className="text-sm">{mockApplication.notes}</p>
            </div>
          </CardContent>
        </Card>

        {/* Status Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Application Timeline</CardTitle>
            <CardDescription>Track your application progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
              <div className="space-y-6">
                {statusHistory.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="relative flex items-center space-x-4"
                  >
                    <div
                      className={`h-8 w-8 rounded-full border-2 flex items-center justify-center z-10 ${
                        item.current
                          ? "bg-primary border-primary"
                          : item.date
                          ? "bg-background border-primary"
                          : "bg-background border-border"
                      }`}
                    >
                      {item.current || item.date ? (
                        <CheckCircle className="h-4 w-4 text-primary-foreground" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-muted" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${item.current ? "text-primary" : ""}`}>
                        {item.status}
                      </p>
                      {item.date && (
                        <p className="text-sm text-muted-foreground">
                          {new Date(item.date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Questions and Answers */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Application Questions</h2>
            <Button variant="outline" size="sm">
              <Sparkles className="mr-2 h-4 w-4" />
              Regenerate All
            </Button>
          </div>

          {mockQuestions.map((question, index) => (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">Question {index + 1}</CardTitle>
                    <Button variant="ghost" size="sm">
                      <RotateCw className="mr-2 h-3 w-3" />
                      Regenerate
                    </Button>
                  </div>
                  <CardDescription className="text-base font-medium text-foreground">
                    {question.question_text}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium">AI-Generated Answer</p>
                    </div>
                    <Textarea
                      value={question.ai_answer}
                      rows={6}
                      className="resize-none"
                      readOnly
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button size="sm">
                      <Edit className="mr-2 h-3 w-3" />
                      Edit Answer
                    </Button>
                    <Button size="sm" variant="outline">
                      <Save className="mr-2 h-3 w-3" />
                      Save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Related Documents */}
        <Card>
          <CardHeader>
            <CardTitle>Related Documents</CardTitle>
            <CardDescription>
              Documents used for this application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/40 transition-all">
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Resume_2024.pdf</p>
                    <p className="text-xs text-muted-foreground">Uploaded on Nov 1, 2024</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  View
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/40 transition-all">
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Cover_Letter_Google.pdf</p>
                    <p className="text-xs text-muted-foreground">Uploaded on Nov 1, 2024</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  View
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
