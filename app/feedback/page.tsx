"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { useToast } from "@/shared/ui/use-toast"
import { motion } from "framer-motion"
import { MessageSquare, Loader2, CheckCircle, Bug, Lightbulb } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import type { FeedbackType } from "@/types/database"

export default function FeedbackPage() {
  const { toast } = useToast()
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("general")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const feedbackTypes: {
    value: FeedbackType
    label: string
    description: string
    icon: typeof MessageSquare
  }[] = [
    {
      value: "general",
      label: "General feedback",
      description: "Share your thoughts on ApplyOS",
      icon: MessageSquare,
    },
    {
      value: "bug",
      label: "Bug report",
      description: "Something behaved unexpectedly",
      icon: Bug,
    },
    {
      value: "feature",
      label: "Feature request",
      description: "Suggest an improvement",
      icon: Lightbulb,
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
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
              <CheckCircle className="h-8 w-8 text-primary-strong dark:text-primary" />
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Thanks — we have it
            </h2>
            <p className="text-muted-foreground mb-6">
              Your feedback went straight to the team. If it needs a reply we will follow up by email.
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
              Send more feedback
            </Button>
          </motion.div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <PageHeader
          overline="Support"
          title="Feedback"
          description="Bugs, requests or anything else — it all reaches the people building ApplyOS."
        />

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="rounded-2xl border-border/70">
            <CardHeader className="px-5 py-4">
              <CardTitle className="font-display text-lg font-semibold tracking-[-0.01em]">
                New ticket
              </CardTitle>
              <CardDescription>
                Pick the closest category — it routes your note to the right place.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Feedback Type Selection */}
                <div className="space-y-3">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                    Category
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {feedbackTypes.map((type) => {
                      const active = feedbackType === type.value
                      const Icon = type.icon
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setFeedbackType(type.value)}
                          aria-pressed={active}
                          className={`group flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                            active
                              ? "border-primary/45 bg-primary/[0.07]"
                              : "border-border/70 bg-background/40 hover:border-border hover:bg-muted/40"
                          }`}
                        >
                          <span
                            className={`mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                              active
                                ? "border-primary/35 bg-primary/12 text-primary-strong dark:text-primary"
                                : "border-border/70 bg-muted/50 text-muted-foreground group-hover:text-foreground"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-foreground">
                              {type.label}
                            </span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                              {type.description}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Title Input */}
                <div className="space-y-2">
                  <label
                    htmlFor="title"
                    className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70"
                  >
                    Title
                  </label>
                  <input
                    id="title"
                    type="text"
                    placeholder="One line that sums it up"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 transition-all focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                {/* Description Textarea */}
                <div className="space-y-2">
                  <label
                    htmlFor="description"
                    className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70"
                  >
                    Details
                  </label>
                  <textarea
                    id="description"
                    placeholder="What happened, what you expected, and what you were doing at the time."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isSubmitting}
                    rows={6}
                    className="w-full resize-none rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 transition-all focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                {/* Submit Button */}
                <div className="flex flex-col gap-3 border-t border-border/50 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Tickets are triaged weekly. Bug reports get a reply fastest.
                  </p>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="shrink-0 sm:w-auto"
                    size="default"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Send feedback"
                    )}
                  </Button>
                </div>

              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  )
}
