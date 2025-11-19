"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Copy,
  StickyNote,
  ArrowUpDown,
} from "lucide-react"
import Link from "next/link"
import type { Application, Question, Document, ApplicationNote } from "@/types/database"
import { getApplication, updateApplication, getApplicationDocuments, updateApplicationDocuments } from "@/lib/services/applications"
import { getQuestionsByApplicationId, updateQuestion, deleteQuestion, createQuestion } from "@/lib/services/questions"
import { getDocuments } from "@/lib/services/documents"
import { getNotesByApplicationId, createNote, updateNote, deleteNote, togglePinNote } from "@/lib/services/notes"
import { EditApplicationModal } from "@/components/modals/edit-application-modal"
import { EditQuestionsModal } from "@/components/modals/edit-questions-modal"
import { ConfirmModal } from "@/components/modals/confirm-modal"
import { AlertModal } from "@/components/modals/alert-modal"
import { NoteModal } from "@/components/modals/note-modal"
import { NotesCardView } from "@/components/notes/notes-card-view"
import { NotesTimelineView } from "@/components/notes/notes-timeline-view"

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
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingStatus, setPendingStatus] = useState<Application["status"] | null>(null)
  const [initialStatus, setInitialStatus] = useState<Application["status"] | null>(null)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [showDocumentModal, setShowDocumentModal] = useState(false)
  const [isSavingChanges, setIsSavingChanges] = useState(false)
  const [jobDescriptionExpanded, setJobDescriptionExpanded] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showEditQuestionsModal, setShowEditQuestionsModal] = useState(false)
  const [showExtractConfirmModal, setShowExtractConfirmModal] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [generatingCoverLetter, setGeneratingCoverLetter] = useState(false)
  const [savingCoverLetter, setSavingCoverLetter] = useState(false)
  const [notes, setNotes] = useState<ApplicationNote[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [notesViewType, setNotesViewType] = useState<"card" | "timeline">("card")
  const [notesSortOrder, setNotesSortOrder] = useState<"newest" | "oldest">("newest")
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [editingNote, setEditingNote] = useState<ApplicationNote | null>(null)
  const textareaRefs = new Map<string, HTMLTextAreaElement | null>()
  const coverLetterTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!id) return

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const [app, qs, docs, relatedDocIds, appNotes] = await Promise.all([
          getApplication(id),
          getQuestionsByApplicationId(id),
          getDocuments(),
          getApplicationDocuments(id),
          getNotesByApplicationId(id),
        ])
        setApplication(app)
        setQuestions(qs)
        setDocuments(docs)
        setNotes(appNotes)
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

  // Load notes view preference and sort order from localStorage
  useEffect(() => {
    if (!id) return
    const savedViewType = localStorage.getItem(`notes-view-${id}`) as "card" | "timeline" | null
    const savedSortOrder = localStorage.getItem(`notes-sort-${id}`) as "newest" | "oldest" | null
    if (savedViewType) setNotesViewType(savedViewType)
    if (savedSortOrder) setNotesSortOrder(savedSortOrder)
  }, [id])

  const handleRegenerate = async (questionId?: string) => {
    if (!application) return

    try {
      if (!questionId) {
        setRegenerating("all")
      } else {
        setRegenerating(questionId)
      }

      const response = await fetch("/api/questions/regenerate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          applicationId: application.id,
          ...(questionId && { questionId }), // Only include questionId if provided (for single question)
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("Error regenerating answer:", errorData.error)
        setError(errorData.error || "Failed to regenerate answers")
        return
      }

      const data = await response.json()
      if (data.questions && data.questions.length > 0) {
        if (questionId) {
          // Update single question
          setQuestions((prev) =>
            prev.map((q) => {
              const updated = data.questions.find(
                (uq: Question) => uq.id === q.id
              )
              return updated || q
            })
          )
        } else {
          // Update all questions
          setQuestions(data.questions)
        }
      }
    } catch (err) {
      console.error("Error regenerating answer:", err)
      setError("Failed to regenerate answers. Please try again.")
    } finally {
      setRegenerating(null)
    }
  }

  const handleExtractQuestions = () => {
    if (!application || !application.url) {
      setError("No application URL found. Please add a URL to the application first.")
      return
    }

    setShowExtractConfirmModal(true)
  }

  const handleConfirmExtractQuestions = async () => {
    if (!application) return

    setExtracting(true)
    setError(null)
    setShowExtractConfirmModal(false)

    try {
      // Call the extract-from-url API
      const response = await fetch('/api/questions/extract-from-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: application.url }),
      })

      const data = await response.json()

      if (!response.ok || !data.questions || data.questions.length === 0) {
        setError(data.error || 'No questions could be extracted from the URL.')
        return
      }

      // Delete all existing questions
      await Promise.all(questions.map(q => deleteQuestion(q.id)))

      // Create new questions
      const newQuestions = await Promise.all(
        data.questions.map((questionText: string) =>
          createQuestion({
            application_id: application.id,
            question_text: questionText,
          })
        )
      )

      setQuestions(newQuestions)

      // Show success message
      setSuccessMessage(`Successfully extracted ${newQuestions.length} question(s)!`)
    } catch (err) {
      console.error('Error extracting questions:', err)
      setError('Failed to extract questions. Please try again.')
    } finally {
      setExtracting(false)
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
        const previousStatus = application.status
        await updateApplication(application.id, { status: pendingStatus })
        setApplication((prev) => prev ? { ...prev, status: pendingStatus } : null)

        // Send status update email notification
        try {
          await fetch('/api/notifications/send-status-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              applicationId: application.id,
              applicationTitle: application.title,
              previousStatus,
              newStatus: pendingStatus,
            }),
          })
        } catch (emailErr) {
          console.error('Failed to send status update email:', emailErr)
          // Don't fail the save if email fails
        }
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

  const handleCopyAIAnswer = async (questionId: string, aiAnswer: string) => {
    // Save the AI answer as manual answer
    await handleSaveManual(questionId, aiAnswer)

    // Update the textarea visual
    const textarea = textareaRefs.get(questionId)
    if (textarea) {
      textarea.value = aiAnswer
    }
  }

  const handleGenerateCoverLetter = async () => {
    if (!application) return

    setGeneratingCoverLetter(true)
    setError(null)

    try {
      const response = await fetch("/api/cover-letter/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          applicationId: application.id,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("Error generating cover letter:", errorData.error)
        setError(errorData.error || "Failed to generate cover letter")
        return
      }

      const data = await response.json()
      if (data.coverLetter) {
        setApplication((prev) => prev ? { ...prev, ai_cover_letter: data.coverLetter } : null)
      }
    } catch (err) {
      console.error("Error generating cover letter:", err)
      setError("Failed to generate cover letter. Please try again.")
    } finally {
      setGeneratingCoverLetter(false)
    }
  }

  const handleSaveManualCoverLetter = async (value: string) => {
    if (!application) return

    setSavingCoverLetter(true)
    try {
      await updateApplication(application.id, { manual_cover_letter: value })
      setApplication((prev) => prev ? { ...prev, manual_cover_letter: value } : null)
    } catch (err) {
      console.error("Error saving cover letter:", err)
    } finally {
      setSavingCoverLetter(false)
    }
  }

  const handleCopyAICoverLetter = async (aiCoverLetter: string) => {
    // Save the AI cover letter as manual cover letter
    await handleSaveManualCoverLetter(aiCoverLetter)

    // Update the textarea visual
    const textarea = coverLetterTextareaRef.current
    if (textarea) {
      textarea.value = aiCoverLetter
    }
  }

  const handleSaveNote = async (noteData: {
    content: string
    category?: string
    is_pinned: boolean
  }) => {
    if (!application) return

    try {
      if (editingNote) {
        const updated = await updateNote(editingNote.id, noteData)
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
      } else {
        const newNote = await createNote(application.id, noteData)
        setNotes((prev) => [newNote, ...prev])
      }
      setEditingNote(null)
      setShowNoteModal(false)
    } catch (err) {
      console.error("Error saving note:", err)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteNote(noteId)
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
    } catch (err) {
      console.error("Error deleting note:", err)
    }
  }

  const handleTogglePinNote = async (noteId: string, isPinned: boolean) => {
    try {
      const updated = await togglePinNote(noteId, isPinned)
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
    } catch (err) {
      console.error("Error toggling pin:", err)
    }
  }

  const handleEditNote = (note: ApplicationNote) => {
    setEditingNote(note)
    setShowNoteModal(true)
  }

  const handleNewNote = () => {
    setEditingNote(null)
    setShowNoteModal(true)
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
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex items-start gap-2 sm:gap-4">
            <Link href="/applications">
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 mt-1">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold break-words">{application.title}</h1>
              {application.url ? (
                <a
                  href={application.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1 mt-1 break-all"
                >
                  <span className="truncate">{application.url}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ) : (
                <div className="h-5 mt-1" />
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasChanges() && (
              <Button
                onClick={saveChanges}
                disabled={isSavingChanges}
                className="glow-effect flex-1 sm:flex-none"
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
              className="flex-1 sm:flex-none"
            >
              <Edit className="mr-2 h-4 w-4" />
              Manage
            </Button>
          </div>
        </div>

        {/* Application Info */}
        <Card>
          <CardHeader>
            <CardTitle>Application Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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


            {application.job_description && (
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
                    {application.job_description}
                  </div>
                </motion.div>
                {application.job_description.split("\n").length > 3 && (
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-xl sm:text-2xl font-bold">Application Questions</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExtractQuestions}
                disabled={extracting || regenerating !== null || !application.url}
                title={!application.url ? "Add a URL to the application first" : "Extract questions from the application URL"}
              >
                {extracting ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Extract Questions
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditQuestionsModal(true)}
                disabled={regenerating !== null || extracting}
                title="Edit, delete, or add new questions"
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit Questions
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRegenerate()}
                disabled={regenerating !== null || questions.length === 0}
              >
                {regenerating === "all" ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate All
                  </>
                )}
              </Button>
            </div>
          </div>

          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No questions found for this application yet. {application.url ? "Click 'Extract Questions' above to automatically extract questions from the application URL, or" : "You can"} add questions when creating or editing the application.
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
                  <CardHeader className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base sm:text-lg">
                          Question {index + 1}
                        </CardTitle>
                        <CardDescription className="text-sm sm:text-base font-medium text-foreground break-words">
                          {question.question_text}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRegenerate(question.id)}
                        disabled={regenerating === question.id || regenerating === "all"}
                        className="shrink-0 text-xs sm:text-sm self-end sm:self-start"
                      >
                        {regenerating === question.id ? (
                          <>
                            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                            {question.ai_answer ? "Regenerating" : "Generating"}
                          </>
                        ) : (
                          <>
                            <RotateCw className="mr-1.5 h-3 w-3" />
                            {question.ai_answer ? "Regenerate" : "Generate"}
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

                    {question.ai_answer && (
                      <div className="flex justify-center">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleCopyAIAnswer(question.id, question.ai_answer || "")}
                          disabled={saving === question.id}
                          className="glow-effect hover:bg-primary group"
                          title="Copy AI answer to your edited answer"
                        >
                          <Copy className="h-4 w-4 text-primary group-hover:text-background" />
                        </Button>
                      </div>
                    )}

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Your edited answer (saved privately for this application)
                      </p>
                      <Textarea
                        ref={(el) => {
                          if (el) textareaRefs.set(question.id, el)
                        }}
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

        {/* Cover Letter Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-xl sm:text-2xl font-bold">Cover Letter</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateCoverLetter}
              disabled={generatingCoverLetter}
            >
              {generatingCoverLetter ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Cover Letter
                </>
              )}
            </Button>
          </div>

          {application?.ai_cover_letter && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">Generated Cover Letter</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
                    {/* AI-Generated Cover Letter */}
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center space-x-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <p className="text-sm font-medium">AI-Generated Cover Letter</p>
                      </div>
                      <Textarea
                        value={application.ai_cover_letter || ""}
                        className="resize-none flex-1 min-h-[400px]"
                        readOnly
                        placeholder="No AI-generated cover letter yet."
                      />
                    </div>

                    {/* Copy Button */}
                    <div className="flex items-center justify-center lg:flex-col gap-2 lg:gap-0">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopyAICoverLetter(application.ai_cover_letter || "")}
                        disabled={savingCoverLetter}
                        className="glow-effect hover:bg-primary group"
                        title="Copy AI cover letter to your edited cover letter"
                      >
                        <Copy className="h-4 w-4 text-primary group-hover:text-background" />
                      </Button>
                    </div>

                    {/* Your Edited Cover Letter */}
                    <div className="flex-1 flex flex-col">
                      <p className="text-xs text-muted-foreground mb-2">
                        Your edited cover letter (saved privately for this application)
                      </p>
                      <Textarea
                        ref={coverLetterTextareaRef}
                        defaultValue={application.manual_cover_letter || ""}
                        className="resize-none flex-1 min-h-[400px]"
                        onBlur={(e) =>
                          e.target.value !== (application.manual_cover_letter || "")
                            ? handleSaveManualCoverLetter(e.target.value)
                            : undefined
                        }
                        disabled={savingCoverLetter}
                      />
                      {savingCoverLetter && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Saving...
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Notes Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <StickyNote className="h-6 w-6" />
              Notes
            </h2>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1 border border-input rounded-lg p-1">
                <Button
                  variant={notesViewType === "card" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setNotesViewType("card")
                    localStorage.setItem(`notes-view-${id}`, "card")
                  }}
                  className="text-xs"
                >
                  Card View
                </Button>
                <Button
                  variant={notesViewType === "timeline" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setNotesViewType("timeline")
                    localStorage.setItem(`notes-view-${id}`, "timeline")
                  }}
                  className="text-xs"
                >
                  Timeline
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  const newOrder = notesSortOrder === "newest" ? "oldest" : "newest"
                  setNotesSortOrder(newOrder)
                  localStorage.setItem(`notes-sort-${id}`, newOrder)
                }}
                title={`Currently: ${notesSortOrder === "newest" ? "Newest First" : "Oldest First"}`}
              >
                <ArrowUpDown className="h-4 w-4 mr-2" />
                {notesSortOrder === "newest" ? "Newest" : "Oldest"}
              </Button>
              <Button
                onClick={handleNewNote}
                className="glow-effect flex-1 sm:flex-none"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Note
              </Button>
            </div>
          </div>

          {notesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (() => {
            // Sort notes based on notesSortOrder
            const sortedNotes = [...notes].sort((a, b) => {
              // Keep pinned notes first
              if (a.is_pinned !== b.is_pinned) {
                return a.is_pinned ? -1 : 1
              }
              // Then sort by date
              const dateA = new Date(a.created_at).getTime()
              const dateB = new Date(b.created_at).getTime()
              return notesSortOrder === "newest" ? dateB - dateA : dateA - dateB
            })

            return notesViewType === "card" ? (
              <NotesCardView
                notes={sortedNotes}
                onEdit={handleEditNote}
                onDelete={handleDeleteNote}
                onTogglePin={handleTogglePinNote}
              />
            ) : (
              <NotesTimelineView
                notes={sortedNotes}
                onEdit={handleEditNote}
                onDelete={handleDeleteNote}
                onTogglePin={handleTogglePinNote}
              />
            )
          })()}
        </div>

      </div>

      {/* Note Modal */}
      <NoteModal
        isOpen={showNoteModal}
        onClose={() => {
          setShowNoteModal(false)
          setEditingNote(null)
        }}
        onSave={handleSaveNote}
        initialNote={
          editingNote
            ? {
                content: editingNote.content,
                category: editingNote.category,
                is_pinned: editingNote.is_pinned,
              }
            : undefined
        }
      />

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

      {/* Edit Questions Modal */}
      <EditQuestionsModal
        isOpen={showEditQuestionsModal}
        onClose={() => setShowEditQuestionsModal(false)}
        onSuccess={() => {
          // Reload questions data
          const load = async () => {
            try {
              const qs = await getQuestionsByApplicationId(id!)
              setQuestions(qs)
            } catch (err) {
              console.error("Error reloading questions:", err)
            }
          }
          void load()
        }}
        questions={questions}
        applicationId={application?.id || ""}
      />

      {/* Extract Questions Confirmation Modal */}
      <ConfirmModal
        isOpen={showExtractConfirmModal}
        title="Extract Questions?"
        description="This will replace all existing questions with newly extracted ones from the URL. Continue?"
        confirmText="Extract"
        cancelText="Cancel"
        onConfirm={handleConfirmExtractQuestions}
        onCancel={() => setShowExtractConfirmModal(false)}
        isLoading={extracting}
      />

      {/* Success Message Modal */}
      <AlertModal
        isOpen={!!successMessage}
        title="Success"
        message={successMessage || ""}
        type="success"
        onClose={() => setSuccessMessage(null)}
      />
    </DashboardLayout>
  )
}
