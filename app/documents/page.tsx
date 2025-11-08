"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
  Loader2,
} from "lucide-react"
import Link from "next/link"
import type { Document } from "@/types/database"
import { getDocuments, deleteDocument } from "@/lib/services/documents"

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

export default function DocumentsPage() {
  const router = useRouter()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const docs = await getDocuments()
        setDocuments(docs)
      } catch (err) {
        console.error("Error loading documents:", err)
        setError("Unable to load your documents. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return
    setDeletingId(doc.id)
    try {
      await deleteDocument(doc.id, doc.file_url)
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
    } catch (err) {
      console.error("Error deleting document:", err)
      alert("Failed to delete document. Please try again.")
    } finally {
      setDeletingId(null)
    }
  }

  const totalSize = documents.reduce((acc, doc) => acc + (doc.file_size || 0), 0)
  const analyzedCount = documents.filter((d) => d.parsed_data).length

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

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
          <Button
            className="glow-effect inline-flex items-center justify-center gap-2"
            asChild
          >
            <Link href="/upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <span>Upload Document</span>
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
                {formatFileSize(totalSize)}
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
                {analyzedCount}
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
              <p className="text-2xl font-bold">
                {
                  documents.filter((d) => {
                    if (!d.created_at) return false
                    const created = new Date(d.created_at)
                    const now = new Date()
                    return (
                      created.getFullYear() === now.getFullYear() &&
                      created.getMonth() === now.getMonth()
                    )
                  }).length
                }
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center space-y-3">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <p className="font-semibold">No documents uploaded yet</p>
                <p className="text-sm text-muted-foreground">
                  Start by uploading your first resume, transcript, or certificate.
                </p>
                <Button
                  className="mt-2 inline-flex items-center justify-center gap-2"
                  asChild
                >
                  <Link href="/upload" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    <span>Upload Document</span>
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            documents.map((doc, index) => (
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
                        {formatFileSize(doc.file_size || 0)}
                        {doc.created_at && (
                          <> • {new Date(doc.created_at).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {doc.parsed_data && (
                      <div className="mb-4">
                        <p className="text-xs text-muted-foreground mb-2">
                          AI Analysis
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(doc.parsed_data).map(([key, value]) => (
                            <Badge key={key} variant="outline" className="text-xs">
                              {Array.isArray(value)
                                ? `${value.length} ${key}`
                                : `${value} ${key}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          if (doc.file_url) {
                            window.open(doc.file_url, "_blank", "noopener,noreferrer")
                          }
                        }}
                      >
                        <Eye className="mr-2 h-3 w-3" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          if (doc.file_url) {
                            window.open(doc.file_url, "_blank", "noopener,noreferrer")
                          }
                        }}
                      >
                        <Download className="mr-2 h-3 w-3" />
                        Download
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(doc)}
                        disabled={deletingId === doc.id}
                      >
                        {deletingId === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        {error && (
          <p className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </DashboardLayout>
  )
}
