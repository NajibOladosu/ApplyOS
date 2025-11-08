"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Eye,
  MoreVertical,
} from "lucide-react"
import Link from "next/link"

const documents = [
  {
    id: "1",
    file_name: "Resume_2024.pdf",
    file_type: "application/pdf",
    file_size: 245000,
    created_at: "2024-11-01",
    parsed_data: { education: 2, experience: 5, skills: 12 },
  },
  {
    id: "2",
    file_name: "Cover_Letter_Google.pdf",
    file_type: "application/pdf",
    file_size: 128000,
    created_at: "2024-11-01",
    parsed_data: null,
  },
  {
    id: "3",
    file_name: "Transcript_University.pdf",
    file_type: "application/pdf",
    file_size: 512000,
    created_at: "2024-10-28",
    parsed_data: { education: 1, courses: 24 },
  },
  {
    id: "4",
    file_name: "Portfolio_Projects.pdf",
    file_type: "application/pdf",
    file_size: 1024000,
    created_at: "2024-10-25",
    parsed_data: { projects: 8 },
  },
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

export default function DocumentsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Documents</h1>
            <p className="text-muted-foreground">
              Manage your resumes, transcripts, and certificates
            </p>
          </div>
          <Button className="glow-effect" asChild>
            <Link href="/upload">
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Link>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{documents.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Size
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatFileSize(documents.reduce((acc, doc) => acc + doc.file_size, 0))}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Analyzed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {documents.filter((d) => d.parsed_data).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">2</p>
            </CardContent>
          </Card>
        </div>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc, index) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card className="hover:border-primary/40 transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-4">
                    <h3 className="font-semibold truncate">{doc.file_name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatFileSize(doc.file_size)} • {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </CardHeader>

                <CardContent>
                  {doc.parsed_data && (
                    <div className="mb-4">
                      <p className="text-xs text-muted-foreground mb-2">AI Analysis</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(doc.parsed_data).map(([key, value]) => (
                          <Badge key={key} variant="outline" className="text-xs">
                            {value} {key}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Eye className="mr-2 h-3 w-3" />
                      View
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Download className="mr-2 h-3 w-3" />
                      Download
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
