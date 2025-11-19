"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { X, Loader2, Download, AlertCircle, CheckCircle2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { AlertModal } from "@/components/modals/alert-modal"
import type { ParsedApplication } from "@/lib/csv-utils"

interface ImportApplicationsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (count: number) => void
}

interface ValidationState {
  applications: Array<ParsedApplication & { isDuplicate: boolean }>
  rowCount: number
  errorCount: number
  errors: Array<{ row: number; errors: string[] }>
  duplicateCount: number
}

export function ImportApplicationsModal({ isOpen, onClose, onSuccess }: ImportApplicationsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<"upload" | "preview" | "success">("upload")
  const [loading, setLoading] = useState(false)
  const [validationData, setValidationData] = useState<ValidationState | null>(null)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [importedCount, setImportedCount] = useState(0)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setErrorMessage(null)

    try {
      const text = await file.text()

      // Call validation API
      const response = await fetch("/api/applications/import/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent: text }),
      })

      const data = await response.json()

      if (!response.ok) {
        setErrorMessage(data.error || "Failed to validate CSV")
        return
      }

      setValidationData(data)
      setStep("preview")
    } catch (err) {
      console.error("Error reading file:", err)
      setErrorMessage("Failed to read CSV file")
    } finally {
      setLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch("/api/applications/import/template")
      if (!response.ok) throw new Error("Failed to download template")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "trackly-import-template.csv"
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error("Error downloading template:", err)
      setErrorMessage("Failed to download template")
    }
  }

  const handleImport = async () => {
    if (!validationData) return

    setLoading(true)
    setErrorMessage(null)

    try {
      const applicationsToImport = validationData.applications.filter(
        (app) => !skipDuplicates || !app.isDuplicate
      )

      const response = await fetch("/api/applications/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applications: applicationsToImport,
          skipDuplicates,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setErrorMessage(data.error || "Failed to import applications")
        return
      }

      setImportedCount(data.imported)
      setSuccessMessage(`Successfully imported ${data.imported} application(s)!`)
      setStep("success")
      onSuccess(data.imported)
    } catch (err) {
      console.error("Error importing applications:", err)
      setErrorMessage("Failed to import applications")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStep("upload")
    setValidationData(null)
    setErrorMessage(null)
    setSuccessMessage(null)
    setImportedCount(0)
    setSkipDuplicates(true)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl my-8"
        >
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base sm:text-lg">Import Applications</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    {step === "upload" && "Upload a CSV file from Google Sheets or Excel"}
                    {step === "preview" && "Review and confirm your applications"}
                    {step === "success" && "Import completed successfully"}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="h-8 w-8 sm:h-9 sm:w-9 shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 p-4 sm:p-6 pt-0 max-h-[70vh] overflow-y-auto">
              {/* Upload Step */}
              {step === "upload" && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-input rounded-lg p-8 text-center space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-2">Drag and drop your CSV file here</p>
                      <p className="text-xs text-muted-foreground mb-4">or click to select a file</p>
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading}
                      >
                        Select CSV File
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <p className="text-sm font-medium">Expected CSV format:</p>
                    <p className="text-xs text-muted-foreground">
                      Your CSV should have columns like: Title, URL, Status, Priority, Type, Deadline, Notes
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={handleDownloadTemplate}
                      className="p-0 h-auto"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Sample Template
                    </Button>
                  </div>

                  {errorMessage && (
                    <div className="bg-destructive/10 border border-destructive/30 p-3 rounded-lg flex gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <p className="text-sm text-destructive">{errorMessage}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Preview Step */}
              {step === "preview" && validationData && (
                <div className="space-y-4">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    <div className="bg-muted/50 p-3 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground mb-1">Valid</p>
                      <p className="text-lg sm:text-xl font-bold text-green-600">
                        {validationData.applications.length - validationData.duplicateCount}
                      </p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground mb-1">Duplicates</p>
                      <p className="text-lg sm:text-xl font-bold text-yellow-600">{validationData.duplicateCount}</p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground mb-1">Errors</p>
                      <p className="text-lg sm:text-xl font-bold text-red-600">{validationData.errorCount}</p>
                    </div>
                  </div>

                  {/* Error Details */}
                  {validationData.errors.length > 0 && (
                    <div className="bg-destructive/10 border border-destructive/30 p-3 rounded-lg">
                      <p className="text-sm font-medium text-destructive mb-2">Issues found:</p>
                      <ul className="space-y-1">
                        {validationData.errors.slice(0, 5).map((err, idx) => (
                          <li key={idx} className="text-xs text-destructive">
                            Row {err.row}: {err.errors.join(", ")}
                          </li>
                        ))}
                        {validationData.errors.length > 5 && (
                          <li className="text-xs text-muted-foreground">
                            +{validationData.errors.length - 5} more errors
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Skip Duplicates Option */}
                  {validationData.duplicateCount > 0 && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-lg space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skipDuplicates}
                          onChange={(e) => setSkipDuplicates(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm font-medium">Skip duplicate applications</span>
                      </label>
                      <p className="text-xs text-muted-foreground ml-6">
                        {validationData.duplicateCount} duplicate(s) will be skipped if enabled
                      </p>
                    </div>
                  )}

                  {/* Applications Table */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Applications to import:</p>
                    <div className="border rounded-lg overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <thead className="bg-muted/50 border-b">
                          <tr>
                            <th className="text-left p-2">Title</th>
                            <th className="text-left p-2">Company</th>
                            <th className="text-left p-2">Type</th>
                            <th className="text-center p-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validationData.applications.slice(0, 10).map((app, idx) => (
                            <tr key={idx} className="border-b hover:bg-muted/30">
                              <td className="p-2 truncate">
                                <div className="flex items-center gap-2">
                                  <span>{app.title}</span>
                                  {app.isDuplicate && <Badge variant="outline" className="text-xs">Duplicate</Badge>}
                                </div>
                              </td>
                              <td className="p-2 text-muted-foreground text-xs">{app.company || "-"}</td>
                              <td className="p-2 text-muted-foreground capitalize text-xs">{app.type || "job"}</td>
                              <td className="p-2 text-center">
                                {!app.isDuplicate ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                                ) : skipDuplicates ? (
                                  <AlertCircle className="h-4 w-4 text-yellow-600 mx-auto" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {validationData.applications.length > 10 && (
                      <p className="text-xs text-muted-foreground">
                        +{validationData.applications.length - 10} more applications...
                      </p>
                    )}
                  </div>

                  {errorMessage && (
                    <div className="bg-destructive/10 border border-destructive/30 p-3 rounded-lg flex gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <p className="text-sm text-destructive">{errorMessage}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Success Step */}
              {step === "success" && (
                <div className="space-y-4 text-center">
                  <div className="flex justify-center">
                    <CheckCircle2 className="h-12 w-12 text-green-600" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold mb-1">Import Successful!</p>
                    <p className="text-sm text-muted-foreground">
                      {importedCount} application{importedCount !== 1 ? "s" : ""} imported successfully
                    </p>
                  </div>
                  {successMessage && (
                    <div className="bg-green-500/10 border border-green-500/30 p-3 rounded-lg">
                      <p className="text-sm text-green-600">{successMessage}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-2 pt-2">
                {step === "upload" && (
                  <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                )}

                {step === "preview" && (
                  <>
                    <Button variant="outline" onClick={() => setStep("upload")} className="w-full sm:w-auto">
                      Back
                    </Button>
                    <Button
                      onClick={handleImport}
                      disabled={loading || !validationData || validationData.applications.length === 0}
                      className="glow-effect w-full sm:w-auto"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        validationData && (
                          `Import ${
                            skipDuplicates
                              ? validationData.applications.length - validationData.duplicateCount
                              : validationData.applications.length
                          } Application${
                            skipDuplicates
                              ? validationData.applications.length - validationData.duplicateCount !== 1
                              : validationData.applications.length !== 1
                              ? "s"
                              : ""
                          }`
                        )
                      )}
                    </Button>
                  </>
                )}

                {step === "success" && (
                  <Button onClick={handleClose} className="glow-effect w-full sm:w-auto">
                    Done
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Error Alert Modal */}
      <AlertModal
        isOpen={!!errorMessage && step === "upload"}
        title="Error"
        message={errorMessage || ""}
        type="error"
        onClose={() => setErrorMessage(null)}
      />
    </AnimatePresence>
  )
}
