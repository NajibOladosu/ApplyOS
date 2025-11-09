"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { X, Loader2, Plus, Trash2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { updateQuestion, deleteQuestion, createQuestion } from "@/lib/services/questions"
import type { Question } from "@/types/database"
import { AlertModal } from "@/components/modals/alert-modal"

interface EditQuestionsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  questions: Question[]
  applicationId: string
}

export function EditQuestionsModal({
  isOpen,
  onClose,
  onSuccess,
  questions,
  applicationId,
}: EditQuestionsModalProps) {
  const [loading, setLoading] = useState(false)
  const [editedQuestions, setEditedQuestions] = useState<Question[]>([])
  const [bulkQuestionsText, setBulkQuestionsText] = useState("")
  const [showBulkAdd, setShowBulkAdd] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Initialize form with questions data
  useEffect(() => {
    if (isOpen) {
      setEditedQuestions(questions)
      setBulkQuestionsText("")
      setShowBulkAdd(false)
    }
  }, [isOpen, questions])

  const handleQuestionChange = (id: string, newText: string) => {
    setEditedQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, question_text: newText } : q))
    )
  }

  const handleDeleteQuestion = (id: string) => {
    setEditedQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  const handleAddBulkQuestions = () => {
    const newQuestions = bulkQuestionsText
      .split("\n")
      .map((text) => text.trim())
      .filter((text) => text.length > 0)

    if (newQuestions.length === 0) {
      setErrorMessage("Please enter at least one question.")
      return
    }

    // Add new questions to the edited list
    const questionsToAdd = newQuestions.map((text) => ({
      id: `temp-${Date.now()}-${Math.random()}`, // Temporary ID
      application_id: applicationId,
      question_text: text,
      ai_answer: null,
      manual_answer: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    setEditedQuestions((prev) => [...prev, ...questionsToAdd])
    setBulkQuestionsText("")
    setShowBulkAdd(false)
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      // Identify which questions are new (temp IDs)
      const newQuestions = editedQuestions.filter((q) =>
        q.id.startsWith("temp-")
      )
      const existingQuestions = editedQuestions.filter(
        (q) => !q.id.startsWith("temp-")
      )

      // Delete questions that were removed
      const deletedQuestionIds = questions
        .filter((q) => !existingQuestions.some((eq) => eq.id === q.id))
        .map((q) => q.id)

      // Delete removed questions
      await Promise.all(deletedQuestionIds.map((id) => deleteQuestion(id)))

      // Update existing questions
      await Promise.all(
        existingQuestions.map((q) =>
          updateQuestion(q.id, { question_text: q.question_text })
        )
      )

      // Create new questions
      await Promise.all(
        newQuestions.map((q) =>
          createQuestion({
            application_id: applicationId,
            question_text: q.question_text,
          })
        )
      )

      onSuccess()
      handleClose()
    } catch (error) {
      console.error("Error updating questions:", error)
      setErrorMessage("Error updating questions. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setEditedQuestions([])
    setBulkQuestionsText("")
    setShowBulkAdd(false)
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
          className="w-full max-w-2xl max-h-[80vh] overflow-y-auto"
        >
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Edit Questions</CardTitle>
                  <CardDescription>
                    Edit, delete, or add new application questions
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  disabled={loading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Questions List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Current Questions</h3>
                  <span className="text-xs text-muted-foreground">
                    {editedQuestions.length} question{editedQuestions.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {editedQuestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No questions yet. Add questions below.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {editedQuestions.map((question, index) => (
                      <div
                        key={question.id}
                        className="flex gap-2 items-start p-2 rounded border border-input hover:border-primary/50 transition-colors"
                      >
                        <span className="text-xs font-medium text-muted-foreground mt-2.5 min-w-fit">
                          Q{index + 1}
                        </span>
                        <div className="flex-1 min-w-0 space-y-1">
                          <Input
                            value={question.question_text}
                            onChange={(e) =>
                              handleQuestionChange(question.id, e.target.value)
                            }
                            placeholder="Enter question text"
                            className="text-sm"
                          />
                        </div>
                        <button
                          onClick={() => handleDeleteQuestion(question.id)}
                          className="p-1.5 hover:bg-destructive/10 rounded transition-colors text-destructive hover:text-destructive"
                          aria-label="Delete question"
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t" />

              {/* Bulk Add Section */}
              {!showBulkAdd && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkAdd(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add More Questions
                </Button>
              )}

              {showBulkAdd && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Add Multiple Questions
                  </label>
                  <Textarea
                    value={bulkQuestionsText}
                    onChange={(e) => setBulkQuestionsText(e.target.value)}
                    placeholder="Enter one question per line&#10;e.g.&#10;What is your experience with React?&#10;Why are you interested in this role?&#10;Tell us about a challenging project."
                    rows={5}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowBulkAdd(false)
                        setBulkQuestionsText("")
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddBulkQuestions}
                      size="sm"
                      disabled={!bulkQuestionsText.trim()}
                      className="flex-1"
                    >
                      Add Questions
                    </Button>
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="border-t pt-4 flex justify-end space-x-2">
                <Button variant="outline" onClick={handleClose} disabled={loading}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="glow-effect"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
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
