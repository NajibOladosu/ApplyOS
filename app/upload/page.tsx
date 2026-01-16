"use client"

import { useState, useCallback } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { motion } from "framer-motion"
import { Upload, FileText, CheckCircle, X } from "lucide-react"
import { useDropzone } from "react-dropzone"
import Link from "next/link"
import { AlertModal } from "@/components/modals/alert-modal"

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(acceptedFiles)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "image/*": [".png", ".jpg", ".jpeg"],
    },
    multiple: true,
  })

  const handleUpload = async () => {
    if (files.length === 0) return

    try {
      setUploading(true)

      const formData = new FormData()
      files.forEach((file) => {
        formData.append("files", file)
      })

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to upload documents")
      }

      setUploaded(true)
    } catch (error) {
      console.error("Upload failed:", error)
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to upload documents. Please try again."
      )
    } finally {
      setUploading(false)
    }
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  if (uploaded) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-md"
          >
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 glow-effect">
              <CheckCircle className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Upload Successful!</h2>
            <p className="text-muted-foreground mb-6">
              Your documents have been uploaded and are being processed.
            </p>
            <div className="flex items-center justify-center space-x-4">
              <Button asChild>
                <Link href="/documents">View Documents</Link>
              </Button>
              <Button variant="outline" onClick={() => {
                setUploaded(false)
                setFiles([])
              }}>
                Upload More
              </Button>
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Upload Documents</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Upload your resume, transcripts, and other documents for AI analysis
          </p>
        </div>

        {/* Upload Area */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Select Files</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Supported formats: PDF, DOC, DOCX, PNG, JPG (Max 10MB each)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 sm:p-12 text-center cursor-pointer transition-all ${
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <input {...getInputProps()} />
              <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              {isDragActive ? (
                <p className="text-base sm:text-lg font-medium text-primary">Drop files here...</p>
              ) : (
                <>
                  <p className="text-base sm:text-lg font-medium mb-2">
                    Drag & drop files here, or click to select
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    PDF, DOC, DOCX, PNG, JPG up to 10MB
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Selected Files */}
        {files.length > 0 && (
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Selected Files ({files.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="space-y-2">
                {files.map((file, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 sm:p-4 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-base font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(index)}
                      className="text-destructive hover:text-destructive h-8 w-8 sm:h-9 sm:w-9 shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ))}
              </div>

              <Button
                className="w-full mt-4 glow-effect inline-flex items-center justify-center gap-2"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Upload className="h-4 w-4 animate-pulse" />
                    <span className="text-sm sm:text-base">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span className="text-sm sm:text-base">
                      Upload {files.length} File{files.length > 1 ? "s" : ""}
                    </span>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-4xl mb-2">📄</div>
              <h3 className="font-semibold mb-1">Auto Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Our AI automatically extracts education, experience, and skills
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-4xl mb-2">🔒</div>
              <h3 className="font-semibold mb-1">Secure Storage</h3>
              <p className="text-sm text-muted-foreground">
                All documents are encrypted and stored securely
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-4xl mb-2">⚡</div>
              <h3 className="font-semibold mb-1">Fast Processing</h3>
              <p className="text-sm text-muted-foreground">
                Get AI-powered insights in seconds
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Error Modal */}
        <AlertModal
          isOpen={!!errorMessage}
          title="Upload Failed"
          message={errorMessage || ""}
          type="error"
          onClose={() => setErrorMessage(null)}
        />
      </div>
    </DashboardLayout>
  )
}
