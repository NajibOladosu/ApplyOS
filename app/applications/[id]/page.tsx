"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
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
  RotateCw,
  Loader2,
  ChevronDown,
  Plus,
  X,
} from "lucide-react"
import Link from "next/link"
import type { Application, Question, Document } from "@/types/database"
import { getApplication, updateApplication, getApplicationDocuments, updateApplicationDocuments } from "@/lib/services/applications"
import {
  getQuestionsByApplicationId,
  updateQuestion,
} from "@/lib/services/questions"
import {
  getDocuments,
  getAnalyzedDocuments,
  buildContextFromDocument,
} from "@/lib/services/documents"
import { generateAnswer } from "@/lib/ai"
import { EditApplicationModal } from "@/components/modals/edit-application-modal"

export default function ApplicationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string | undefined

  const [application, setApplication] = useState<Application | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([])
  const [pendingDocumentIds, setPendingDocumentIds] = useState<string[]>([])
  const [initialSelectedDocumentIds, setInitialSelectedDocumentIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState<string | "all" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingStatus, setPendingStatus] = useState<Application["status"] | null>(null)
  const [initialStatus, setInitialStatus] = useState<Application["status"] | null>(null)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [showDocumentModal, setShowDocumentModal] = useState(false)
  const [isSavingChanges, setIsSavingChanges] = useState(false)
  const [jobDescriptionExpanded, setJobDescriptionExpanded] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    if (!id) return

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const [app, qs, docs, relatedDocIds] = await Promise.all([
          getApplication(id),
          getQuestionsByApplicationId(id),
          getDocuments(),
          getApplicationDocuments(id),
        ])
        setApplication(app)
        setQuestions(qs)
        setDocuments(docs)
        setPendingStatus(app.status)
        setInitialStatus(app.status)
        setPendingDocumentIds([])
        setInitialSelectedDocumentIds(relatedDocIds)
        setSelectedDocumentIds(relatedDocIds)
      } catch (err: unknown) {
        console.error("Error loading application detail:", err)
        setError("Unable to load this application. It may not exist or you may not have access.")
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [id])

  const handleRegenerate = async (questionId?: string) => {
    if (!application) return

    try {
      // Build context from selected documents
      let context: {
        resume?: string
        experience?: string
        education?: string
      } = {
        resume: undefined,
        experience: undefined,
        education: undefined,
      }

      // Use selected documents for context
      if (selectedDocumentIds.length > 0) {
        const selectedDocs = documents.filter((d) =>
          selectedDocumentIds.includes(d.id)
        )
        // Merge context from all selected documents
        for (const doc of selectedDocs) {
          if (doc.analysis_status === "success" && doc.parsed_data) {
            const docContext = buildContextFromDocument(doc)
            // Merge contexts (later documents add to earlier ones)
            if (docContext.resume) context.resume = docContext.resume
            if (docContext.experience) context.experience = docContext.experience
            if (docContext.education) context.education = docContext.education
          }
        }
      } else {
        // Fallback: use the most recent analyzed document
        const analyzedDocs = await getAnalyzedDocuments()
        if (analyzedDocs.length > 0) {
          context = buildContextFromDocument(analyzedDocs[0])
        }
      }

      if (!questionId) {
        // Regenerate all questions
        setRegenerating("all")
        const updated: Question[] = []
        for (const q of questions) {
          const answer = await generateAnswer(q.question_text, context)
          const saved = await updateQuestion(q.id, { ai_answer: answer })
          updated.push(saved)
        }
        setQuestions(updated)
      } else {
        // Regenerate single question
        setRegenerating(questionId)
        const target = questions.find((q) => q.id === questionId)
        if (!target) return
        const answer = await generateAnswer(target.question_text, context)
        const saved = await updateQuestion(target.id, { ai_answer: answer })
        setQuestions((prev) => prev.map((q) => (q.id === saved.id ? saved : q)))
      }
    } catch (err) {
      console.error("Error regenerating answer:", err)
    } finally {
      setRegenerating(null)
    }
  }

  const handleStatusChange = (newStatus: Application["status"]) => {
    setPendingStatus(newStatus)
  }

  const toggleDocumentSelection = (docId: string) => {
    setPendingDocumentIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    )
  }

  const addSelectedDocuments = () => {
    const newSelectedIds = [
      ...new Set([...selectedDocumentIds, ...pendingDocumentIds]),
    ]
    setSelectedDocumentIds(newSelectedIds)
    // Don't update initial state here - only when saving
    setPendingDocumentIds([])
    setShowDocumentModal(false)
  }

  const removeDocument = (docId: string) => {
    setSelectedDocumentIds((prev) => prev.filter((id) => id !== docId))
  }

  const hasChanges = () => {
    const statusChanged = pendingStatus !== initialStatus
    const documentsChanged = selectedDocumentIds.length !== initialSelectedDocumentIds.length ||
      !selectedDocumentIds.every(id => initialSelectedDocumentIds.includes(id))
    return statusChanged || documentsChanged
  }

  const saveChanges = async () => {
    if (!application) return

    setIsSavingChanges(true)
    try {
      if (pendingStatus && pendingStatus !== application.status) {
        await updateApplication(application.id, { status: pendingStatus })
        setApplication((prev) => prev ? { ...prev, status: pendingStatus } : null)
      }

      // Save document relationships if they changed
      if (selectedDocumentIds.length !== initialSelectedDocumentIds.length ||
          !selectedDocumentIds.every(id => initialSelectedDocumentIds.includes(id))) {
        await updateApplicationDocuments(application.id, selectedDocumentIds)
      }

      // Update initial states to reflect saved changes
      setInitialStatus(pendingStatus || application.status)
      setInitialSelectedDocumentIds(selectedDocumentIds)
      setPendingDocumentIds([])
    } catch (err) {
      console.error("Error saving changes:", err)
    } finally {
      setIsSavingChanges(false)
    }
  }

  const handleSaveManual = async (questionId: string, value: string) => {
    setSaving(questionId)
    try {
      const saved = await updateQuestion(questionId, { manual_answer: value })
      setQuestions((prev) => prev.map((q) => (q.id === saved.id ? saved : q)))
    } catch (err) {
      console.error("Error saving answer:", err)
    } finally {
      setSaving(null)
    }
  }

  if (!id) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Invalid application id.</p>
        </div>
      </DashboardLayout>
    )
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

  if (error || !application) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <p className="text-destructive text-sm">
            {error || "Application not found."}
          </p>
          <Button variant="outline" onClick={() => router.push("/applications")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Applications
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const statusLabel: Record<Application["status"], string> = {
    draft: "Draft",
    submitted: "Submitted",
    in_review: "In Review",
    interview: "Interview",
    offer: "Offer",
    rejected: "Rejected",
  }

  const statusVariant: Record<Application["status"], "outline" | "info" | "warning" | "success" | "default" | "destructive"> = {
    draft: "outline",
    submitted: "info",
    in_review: "warning",
    interview: "success",
    offer: "default",
    rejected: "destructive",
  }

  const priorityColor: Record<Application["priority"], string> = {
    low: "bg-green-500",
    medium: "bg-yellow-500",
    high: "bg-red-500",
  }

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
            <h1 className="text-3xl font-bold">{application.title}</h1>
            {application.url ? (
              <a
                href={application.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center space-x-1 mt-1"
              >
                <span>{application.url}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <div className="h-5 mt-1" />
            )}
          </div>
          {hasChanges() && (
            <Button
              onClick={saveChanges}
              disabled={isSavingChanges}
              className="glow-effect"
            >
              {isSavingChanges ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowEditModal(true)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Manage
          </Button>
        </div>

        {/* Application Info */}
        <Card>
          <CardHeader>
            <CardTitle>Application Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Status</p>
                <div className="relative inline-block w-full">
                  <button
                    onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-input hover:bg-muted transition-colors text-sm font-medium"
                  >
                    <Badge variant={statusVariant[pendingStatus || application.status]}>
                      {statusLabel[pendingStatus || application.status]}
                    </Badge>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>
                  {statusDropdownOpen && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-input rounded-md shadow-md">
                      {(Object.keys(statusLabel) as Array<keyof typeof statusLabel>).map((status) => (
                        <button
                          key={status}
                          onClick={() => {
                            handleStatusChange(status)
                            setStatusDropdownOpen(false)
                          }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-muted ${
                            pendingStatus === status ? "bg-muted font-medium" : ""
                          }`}
                        >
                          {statusLabel[status]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Priority</p>
                <div className="flex items-center space-x-2">
                  <div className={`h-2 w-2 rounded-full ${priorityColor[application.priority]}`} />
                  <span className="text-sm font-medium capitalize">
                    {application.priority}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Deadline</p>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {application.deadline
                      ? new Date(application.deadline).toLocaleDateString()
                      : "No deadline"}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Type</p>
                <Badge variant="outline" className="capitalize">
                  {application.type}
                </Badge>
              </div>
            </div>


            {application.notes && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">
                  {application.type === 'scholarship' ? 'Scholarship Details' : 'Job Description'}
                </p>
                <motion.div
                  animate={{ height: "auto" }}
                  transition={{ duration: 0.3 }}
                >
                  <div
                    className={`text-sm whitespace-pre-wrap text-muted-foreground bg-muted/30 p-3 rounded border border-input transition-all ${
                      jobDescriptionExpanded ? "" : "line-clamp-3"
                    }`}
                  >
                    {application.notes}
                  </div>
                </motion.div>
                {application.notes.split("\n").length > 3 && (
                  <button
                    onClick={() => setJobDescriptionExpanded(!jobDescriptionExpanded)}
                    className="mt-2 text-xs text-primary hover:underline transition-colors"
                  >
                    {jobDescriptionExpanded ? "Show Less" : "Show More"}
                  </button>
                )}
              </div>
            )}

            {/* Related Documents */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Related Documents</p>
              <p className="text-xs text-muted-foreground mb-4">
                Select documents to use as context for generating AI answers to application questions.
              </p>

              {/* Add Document Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPendingDocumentIds([])
                  setShowDocumentModal(true)
                }}
                className="mb-4"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Document
              </Button>

              {/* Selected Documents List */}
              {selectedDocumentIds.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No documents selected yet. Click "Add Document" to select documents.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedDocumentIds.map((docId) => {
                    const doc = documents.find((d) => d.id === docId)
                    if (!doc) return null
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-2 rounded bg-muted/50 border border-input"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.analysis_status === "success"
                              ? "✓ Analyzed"
                              : doc.analysis_status === "pending"
                              ? "⏳ Analyzing..."
                              : "✗ Not analyzed"}
                          </p>
                        </div>
                        <button
                          onClick={() => removeDocument(doc.id)}
                          className="ml-2 p-1 hover:bg-muted rounded transition-colors"
                          aria-label="Remove document"
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Document Selection Modal */}
              {showDocumentModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
                  <Card className="w-full max-w-md mx-4">
                    <CardHeader>
                      <CardTitle>Select Documents</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {documents.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No documents available. Upload documents in the Documents section first.
                        </p>
                      ) : (
                        <>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {documents.map((doc) => (
                              <button
                                key={doc.id}
                                onClick={() => toggleDocumentSelection(doc.id)}
                                className={`w-full text-left p-3 rounded border transition-all ${
                                  pendingDocumentIds.includes(doc.id)
                                    ? "border-primary bg-primary/10"
                                    : "border-input hover:border-primary/50 hover:bg-muted/50"
                                }`}
                              >
                                <p className="text-sm font-medium truncate">{doc.file_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {doc.analysis_status === "success"
                                    ? "✓ Analyzed"
                                    : doc.analysis_status === "pending"
                                    ? "⏳ Analyzing..."
                                    : "✗ Not analyzed"}
                                </p>
                              </button>
                            ))}
                          </div>
                          <div className="flex space-x-2 pt-4 border-t">
                            <Button
                              variant="outline"
                              onClick={() => setShowDocumentModal(false)}
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={addSelectedDocuments}
                              disabled={pendingDocumentIds.length === 0}
                              className="flex-1"
                            >
                              Add Selected
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </CardContent>
        </Card>


        {/* Questions and Answers */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Application Questions</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRegenerate()}
              disabled={regenerating !== null || questions.length === 0}
            >
              {regenerating === "all" ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Regenerate All
                </>
              )}
            </Button>
          </div>

          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No questions found for this application yet. You can add questions when creating or
              editing the application.
            </p>
          ) : (
            questions.map((question, index) => (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg">
                          Question {index + 1}
                        </CardTitle>
                        <CardDescription className="text-base font-medium text-foreground">
                          {question.question_text}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRegenerate(question.id)}
                        disabled={regenerating === question.id || regenerating === "all"}
                      >
                        {regenerating === question.id ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Regenerating
                          </>
                        ) : (
                          <>
                            <RotateCw className="mr-2 h-3 w-3" />
                            Regenerate
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <p className="text-sm font-medium">AI-Generated Answer</p>
                      </div>
                      <Textarea
                        value={question.ai_answer || ""}
                        rows={5}
                        className="resize-none"
                        readOnly
                        placeholder="No AI-generated answer yet."
                      />
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Your edited answer (saved privately for this application)
                      </p>
                      <Textarea
                        defaultValue={question.manual_answer || ""}
                        rows={4}
                        onBlur={(e) =>
                          e.target.value !== (question.manual_answer || "")
                            ? handleSaveManual(question.id, e.target.value)
                            : undefined
                        }
                        disabled={saving === question.id}
                      />
                      {saving === question.id && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Saving...
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>

      </div>

      {/* Edit Application Modal */}
      <EditApplicationModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={() => {
          setShowEditModal(false)
          // Reload application data
          const load = async () => {
            try {
              const app = await getApplication(id!)
              setApplication(app)
            } catch (err) {
              console.error("Error reloading application:", err)
            }
          }
          void load()
        }}
        application={application}
      />
    </DashboardLayout>
  )
}
