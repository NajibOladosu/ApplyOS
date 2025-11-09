"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { X, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { updateApplication } from "@/lib/services/applications"
import type { Application } from "@/types/database"
import { AlertModal } from "@/components/modals/alert-modal"

interface EditApplicationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  application: Application | null
}

export function EditApplicationModal({
  isOpen,
  onClose,
  onSuccess,
  application,
}: EditApplicationModalProps) {
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Form data
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [type, setType] = useState("job")
  const [priority, setPriority] = useState("medium")
  const [deadline, setDeadline] = useState("")
  const [jobDescription, setJobDescription] = useState("")

  // Initialize form with application data
  useEffect(() => {
    if (application && isOpen) {
      setTitle(application.title || "")
      setUrl(application.url || "")
      setType(application.type || "job")
      setPriority(application.priority || "medium")
      setDeadline(application.deadline ? application.deadline.split("T")[0] : "")
      setJobDescription(application.notes || "")
    }
  }, [application, isOpen])

  const handleSubmit = async () => {
    if (!application) return

    setLoading(true)
    try {
      await updateApplication(application.id, {
        title,
        url: url || null,
        type: type as any,
        priority: priority as any,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        notes: jobDescription || null,
      })

      onSuccess()
      handleClose()
    } catch (error) {
      console.error("Error updating application:", error)
      setErrorMessage("Error updating application")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setTitle("")
    setUrl("")
    setType("job")
    setPriority("medium")
    setDeadline("")
    setJobDescription("")
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl"
        >
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Edit Application</CardTitle>
                  <CardDescription>
                    Update the details of this application
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={handleClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Application Title *</label>
                <Input
                  placeholder="e.g., Software Engineer - Google"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Application URL</label>
                <Input
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="job">Job</option>
                    <option value="scholarship">Scholarship</option>
                    <option value="internship">Internship</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Deadline</label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {type === 'scholarship' ? 'Scholarship Details' : type === 'job' || type === 'internship' ? 'Job Description' : 'Notes'}
                  {(type === 'job' || type === 'scholarship' || type === 'internship') && <span className="text-destructive">*</span>}
                </label>
                <Textarea
                  placeholder={type === 'scholarship' ? 'Add scholarship details...' : type === 'job' || type === 'internship' ? 'Paste the job description...' : 'Add any notes about this application...'}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={5}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading || !title || ((type === 'job' || type === 'scholarship' || type === 'internship') && !jobDescription)}
                  className="glow-effect"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Error Modal */}
      <AlertModal
        isOpen={!!errorMessage}
        title="Error"
        message={errorMessage || ""}
        type="error"
        onClose={() => setErrorMessage(null)}
      />
    </AnimatePresence>
  )
}
