"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { X, Sparkles, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { createApplication } from "@/lib/services/applications"
import { createQuestion } from "@/lib/services/questions"
import { AlertModal } from "@/components/modals/alert-modal"

interface AddApplicationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddApplicationModal({ isOpen, onClose, onSuccess }: AddApplicationModalProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Form data
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [type, setType] = useState("job")
  const [priority, setPriority] = useState("medium")
  const [deadline, setDeadline] = useState("")
  const [notes, setNotes] = useState("")
  const [extractedQuestions, setExtractedQuestions] = useState<string[]>([])

  const handleExtractQuestions = async () => {
    if (!url) return

    setExtracting(true)
    try {
      const response = await fetch('/api/questions/extract-from-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      const data = await response.json()

      if (response.ok && data.questions) {
        setExtractedQuestions(data.questions)
        setStep(2)
      } else {
        console.error('Error extracting questions:', data.error)
        setErrorMessage(data.error || 'Error extracting questions. Continuing without AI extraction.')
        // Still proceed to step 2 even if extraction fails
        setStep(2)
      }
    } catch (error) {
      console.error('Error extracting questions:', error)
      setErrorMessage('Error extracting questions. Continuing without AI extraction.')
      setStep(2)
    } finally {
      setExtracting(false)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      // Create application
      const application = await createApplication({
        title,
        url,
        type,
        priority: priority as any,
        deadline: deadline || undefined,
        notes: notes || undefined,
      })

      // Create questions if any were extracted
      if (extractedQuestions.length > 0) {
        await Promise.all(
          extractedQuestions.map(q =>
            createQuestion({
              application_id: application.id,
              question_text: q,
            })
          )
        )
      }

      onSuccess()
      handleClose()
    } catch (error) {
      console.error('Error creating application:', error)
      setErrorMessage('Error creating application')
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
    setNotes("")
    setExtractedQuestions([])
    setStep(1)
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
                  <CardTitle className="text-base sm:text-lg">Add New Application</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Step {step} of 2: {step === 1 ? "Application Details" : "Review & Confirm"}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6 pt-0 max-h-[70vh] overflow-y-auto">
              {step === 1 && (
                <>
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
                    {url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExtractQuestions}
                        disabled={extracting}
                      >
                        {extracting ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Extracting Questions...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-3 w-3" />
                            Extract Questions with AI
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs sm:text-sm font-medium">Type</label>
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
                      <label className="text-xs sm:text-sm font-medium">Priority</label>
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
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-2 pt-2">
                    <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">
                      Cancel
                    </Button>
                    <Button
                      onClick={() => setStep(2)}
                      disabled={!title || ((type === 'job' || type === 'scholarship' || type === 'internship') && !notes)}
                      className="w-full sm:w-auto"
                    >
                      Continue
                    </Button>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Title</p>
                      <p className="font-medium">{title}</p>
                    </div>
                    {url && (
                      <div>
                        <p className="text-sm text-muted-foreground">URL</p>
                        <p className="text-sm truncate">{url}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Badge variant="outline" className="capitalize">{type}</Badge>
                      <Badge variant="outline" className="capitalize">{priority}</Badge>
                      {deadline && <Badge variant="outline">{new Date(deadline).toLocaleDateString()}</Badge>}
                    </div>
                  </div>

                  {extractedQuestions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium flex items-center space-x-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span>AI Extracted {extractedQuestions.length} Questions</span>
                      </p>
                      <ul className="space-y-1">
                        {extractedQuestions.map((q, i) => (
                          <li key={i} className="text-sm text-muted-foreground pl-4">
                            • {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-2 pt-2">
                    <Button variant="outline" onClick={() => setStep(1)} className="w-full sm:w-auto">
                      Back
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading} className="glow-effect w-full sm:w-auto">
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Application'
                      )}
                    </Button>
                  </div>
                </>
              )}
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
