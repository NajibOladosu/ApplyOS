"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X, Mic, Loader2, Sparkles, FileText, Building2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { AlertModal } from "@/components/modals/alert-modal"
import type { Document } from "@/types/database"

interface NewInterviewModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (sessionId: string) => void
  applicationId: string
  documents?: Document[]
  companyName?: string
}

type SessionType = 'behavioral' | 'technical' | 'mixed' | 'resume_grill' | 'company_specific'
type Difficulty = 'easy' | 'medium' | 'hard'

const COMPANY_TEMPLATES = [
  { value: 'google', label: 'Google', icon: '🔍' },
  { value: 'meta', label: 'Meta (Facebook)', icon: '📘' },
  { value: 'amazon', label: 'Amazon', icon: '📦' },
  { value: 'netflix', label: 'Netflix', icon: '🎬' },
]

export function NewInterviewModal({
  isOpen,
  onClose,
  onSuccess,
  applicationId,
  documents = [],
  companyName,
}: NewInterviewModalProps) {
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Form state
  const [sessionType, setSessionType] = useState<SessionType>('behavioral')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [questionCount, setQuestionCount] = useState('5')
  const [selectedCompany, setSelectedCompany] = useState('')
  const [selectedDocumentId, setSelectedDocumentId] = useState('')
  const [customizeForJob, setCustomizeForJob] = useState(false)

  // Reset selected company when company name changes
  useEffect(() => {
    if (companyName) {
      const matchingTemplate = COMPANY_TEMPLATES.find(
        t => t.label.toLowerCase() === companyName.toLowerCase()
      )
      if (matchingTemplate) {
        setSelectedCompany(matchingTemplate.value)
      }
    }
  }, [companyName])

  // Reset document selection when documents change
  useEffect(() => {
    if (documents.length > 0 && !selectedDocumentId) {
      setSelectedDocumentId(documents[0].id)
    }
  }, [documents, selectedDocumentId])

  const handleClose = () => {
    // Reset form
    setSessionType('behavioral')
    setDifficulty('medium')
    setQuestionCount('5')
    setSelectedCompany('')
    setSelectedDocumentId('')
    setCustomizeForJob(false)
    setErrorMessage(null)
    onClose()
  }

  const handleSubmit = async () => {
    const count = parseInt(questionCount)
    if (isNaN(count) || count < 1 || count > 20) {
      setErrorMessage('Question count must be between 1 and 20')
      return
    }

    if (sessionType === 'company_specific' && !selectedCompany) {
      setErrorMessage('Please select a company template')
      return
    }

    if (sessionType === 'resume_grill' && !selectedDocumentId) {
      setErrorMessage('Please select a resume/document to grill')
      return
    }

    setLoading(true)
    setErrorMessage(null)

    try {
      let endpoint = ''
      let body: any = {
        applicationId,
        difficulty,
        questionCount: count,
      }

      // Route to appropriate endpoint based on session type
      if (sessionType === 'company_specific') {
        endpoint = '/api/interview/company-prep'
        body.companySlug = selectedCompany
        body.customizeForJob = customizeForJob
      } else if (sessionType === 'resume_grill') {
        endpoint = '/api/interview/grill-resume'
        body.documentId = selectedDocumentId
      } else {
        endpoint = '/api/interview/generate-questions'
        body.sessionType = sessionType
        body.companyName = companyName
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create interview session')
      }

      onSuccess(data.session.id)
      handleClose()
    } catch (error: any) {
      console.error('Error creating interview:', error)
      setErrorMessage(error.message || 'Failed to create interview session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={handleClose}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <Card className="border-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Mic className="h-5 w-5" />
                      Start New Interview
                    </CardTitle>
                    <CardDescription>
                      Configure your AI-powered mock interview session
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
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Session Type */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Interview Type</Label>
                    <RadioGroup value={sessionType} onValueChange={(v) => setSessionType(v as SessionType)}>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-center space-x-3 border rounded-lg p-4 hover:border-primary cursor-pointer">
                          <RadioGroupItem value="behavioral" id="behavioral" />
                          <label htmlFor="behavioral" className="flex-1 cursor-pointer">
                            <p className="font-medium">Behavioral</p>
                            <p className="text-sm text-muted-foreground">STAR method, teamwork, leadership questions</p>
                          </label>
                        </div>

                        <div className="flex items-center space-x-3 border rounded-lg p-4 hover:border-primary cursor-pointer">
                          <RadioGroupItem value="technical" id="technical" />
                          <label htmlFor="technical" className="flex-1 cursor-pointer">
                            <p className="font-medium">Technical</p>
                            <p className="text-sm text-muted-foreground">Coding, algorithms, system design questions</p>
                          </label>
                        </div>

                        <div className="flex items-center space-x-3 border rounded-lg p-4 hover:border-primary cursor-pointer">
                          <RadioGroupItem value="mixed" id="mixed" />
                          <label htmlFor="mixed" className="flex-1 cursor-pointer">
                            <p className="font-medium">Mixed</p>
                            <p className="text-sm text-muted-foreground">Combination of behavioral and technical</p>
                          </label>
                        </div>

                        <div className="flex items-center space-x-3 border rounded-lg p-4 hover:border-primary cursor-pointer">
                          <RadioGroupItem value="resume_grill" id="resume_grill" />
                          <label htmlFor="resume_grill" className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">Resume Grill</p>
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <p className="text-sm text-muted-foreground">Deep-dive into your resume experiences</p>
                          </label>
                        </div>

                        <div className="flex items-center space-x-3 border rounded-lg p-4 hover:border-primary cursor-pointer">
                          <RadioGroupItem value="company_specific" id="company_specific" />
                          <label htmlFor="company_specific" className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">Company-Specific</p>
                              <Building2 className="h-4 w-4 text-primary" />
                            </div>
                            <p className="text-sm text-muted-foreground">Tailored to major tech companies</p>
                          </label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Company-specific options */}
                  {sessionType === 'company_specific' && (
                    <div className="space-y-3 animate-in slide-in-from-top-2">
                      <Label htmlFor="company" className="text-base font-semibold">Select Company</Label>
                      <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                        <SelectTrigger id="company">
                          <SelectValue placeholder="Choose a company..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Tech Companies</SelectLabel>
                            {COMPANY_TEMPLATES.map((company) => (
                              <SelectItem key={company.value} value={company.value}>
                                <span className="flex items-center gap-2">
                                  <span>{company.icon}</span>
                                  <span>{company.label}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>

                      <div className="flex items-center space-x-2 pt-2">
                        <input
                          type="checkbox"
                          id="customize"
                          checked={customizeForJob}
                          onChange={(e) => setCustomizeForJob(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <label htmlFor="customize" className="text-sm text-muted-foreground cursor-pointer">
                          Customize questions based on job description
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Resume Grill options */}
                  {sessionType === 'resume_grill' && (
                    <div className="space-y-3 animate-in slide-in-from-top-2">
                      <Label htmlFor="document" className="text-base font-semibold">Select Resume/Document</Label>
                      {documents.length > 0 ? (
                        <Select value={selectedDocumentId} onValueChange={setSelectedDocumentId}>
                          <SelectTrigger id="document">
                            <SelectValue placeholder="Choose a document..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Your Documents</SelectLabel>
                              {documents.map((doc) => (
                                <SelectItem key={doc.id} value={doc.id}>
                                  {doc.file_name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm text-muted-foreground p-4 border rounded-lg">
                          No documents found. Please upload a resume first.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Difficulty */}
                  <div className="space-y-3">
                    <Label htmlFor="difficulty" className="text-base font-semibold">Difficulty Level</Label>
                    <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                      <SelectTrigger id="difficulty">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy - Warm-up questions</SelectItem>
                        <SelectItem value="medium">Medium - Standard interview level</SelectItem>
                        <SelectItem value="hard">Hard - Challenging questions</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Question Count */}
                  <div className="space-y-3">
                    <Label htmlFor="count" className="text-base font-semibold">Number of Questions</Label>
                    <Input
                      id="count"
                      type="number"
                      min="1"
                      max="20"
                      value={questionCount}
                      onChange={(e) => setQuestionCount(e.target.value)}
                      placeholder="5"
                    />
                    <p className="text-sm text-muted-foreground">Choose between 1 and 20 questions</p>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={handleClose}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={loading || (sessionType === 'resume_grill' && documents.length === 0)}
                      className="glow-effect"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Start Interview
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Error Modal */}
      <AlertModal
        isOpen={!!errorMessage}
        onClose={() => setErrorMessage(null)}
        title="Error"
        message={errorMessage || ''}
      />
    </>
  )
}
