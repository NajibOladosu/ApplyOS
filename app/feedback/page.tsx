"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { motion } from "framer-motion"
import { MessageSquare, Loader2, CheckCircle } from "lucide-react"
import type { FeedbackType } from "@/types/database"

export default function FeedbackPage() {
  const { toast } = useToast()
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("general")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const feedbackTypes: { value: FeedbackType; label: string; description: string }[] = [
    {
      value: "general",
      label: "General Feedback",
      description: "Share your thoughts and ideas about Trackly",
    },
    {
      value: "bug",
      label: "Bug Report",
      description: "Report issues or unexpected behavior",
    },
    {
      value: "feature",
      label: "Feature Request",
      description: "Suggest new features or improvements",
    },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !description.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill in both title and description",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: feedbackType,
          title: title.trim(),
          description: description.trim(),
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to submit feedback")
      }

      setSubmitted(true)
      setTitle("")
      setDescription("")
      setFeedbackType("general")

      toast({
        title: "Feedback submitted!",
        description: "Thank you for your feedback. We appreciate your input!",
        variant: "default",
      })

      // Reset after 3 seconds
      setTimeout(() => {
        setSubmitted(false)
      }, 3000)
    } catch (error) {
      console.error("Feedback submission failed:", error)
      toast({
        title: "Failed to submit",
        description:
          error instanceof Error
            ? error.message
            : "Failed to submit feedback. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
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
            <h2 className="text-2xl font-bold mb-2">Thank you!</h2>
            <p className="text-muted-foreground mb-6">
              Your feedback has been successfully submitted. We really appreciate your input and will review it carefully.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSubmitted(false)
                setTitle("")
                setDescription("")
                setFeedbackType("general")
              }}
            >
              Submit More Feedback
            </Button>
          </motion.div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Feedback</h1>
              <p className="text-muted-foreground">Help us improve Trackly with your feedback</p>
            </div>
          </div>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Send us your feedback</CardTitle>
              <CardDescription>
                Choose a category and tell us what's on your mind. We read all feedback and use it to improve Trackly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Feedback Type Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Feedback Type</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {feedbackTypes.map((type) => (
                      <motion.button
                        key={type.value}
                        type="button"
                        onClick={() => setFeedbackType(type.value)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          feedbackType === type.value
                            ? "border-primary bg-primary/5 shadow-md"
                            : "border-border hover:border-border/75 bg-background"
                        }`}
                      >
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs text-muted-foreground mt-1">{type.description}</div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Title Input */}
                <div className="space-y-2">
                  <label htmlFor="title" className="text-sm font-medium">
                    Title
                  </label>
                  <input
                    id="title"
                    type="text"
                    placeholder="Brief summary of your feedback"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Description Textarea */}
                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium">
                    Description
                  </label>
                  <textarea
                    id="description"
                    placeholder="Describe the feedback in detail..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isSubmitting}
                    rows={6}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Submit Button */}
                <motion.div
                  whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                  whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                >
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full"
                    size="lg"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Feedback"
                    )}
                  </Button>
                </motion.div>

                {/* Info */}
                <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                  <p className="text-xs text-muted-foreground">
                    💡 <strong>Tip:</strong> Be specific about what you're reporting or suggesting. This helps us understand and address your feedback better.
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  )
}
