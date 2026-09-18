"use client"

import { useState } from "react"
import Link from "next/link"
import { MailCheck } from "lucide-react"
import {
  AuthAlert,
  AuthField,
  AuthOutlineButton,
  AuthPrimaryButton,
  AuthShell,
  StatusTile,
} from "@/components/marketing/auth-primitives"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess(false)

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
      } else {
        setError(data.error || "Failed to send reset link")
      }
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={success ? "Check your inbox" : "Reset your password"}
      subtitle={
        success
          ? "Your reset link is on its way."
          : "Enter your email and we'll send you a link to set a new password."
      }
      backTo={{ href: "/auth/login", label: "Back to sign in" }}
    >
      {success ? (
        <div className="space-y-6">
          <StatusTile icon={MailCheck} size="lg" />
          <div className="space-y-3 text-center">
            <AuthAlert tone="success">
              We&apos;ve sent a password reset link to{" "}
              <strong className="font-semibold">{email}</strong>.
            </AuthAlert>
            <p className="text-xs leading-relaxed text-muted-foreground/80">
              The link expires in 24 hours. Don&apos;t see it? Check your spam folder.
            </p>
          </div>
          <AuthOutlineButton asChild href="/auth/login">
            Back to sign in
          </AuthOutlineButton>
        </div>
      ) : (
        <form onSubmit={handleResetRequest} className="space-y-5">
          {error && <AuthAlert tone="error">{error}</AuthAlert>}

          <AuthField
            id="email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <AuthPrimaryButton loading={loading} disabled={loading}>
            {loading ? "Sending link…" : "Send reset link"}
          </AuthPrimaryButton>

          <p className="text-center text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link
              href="/auth/login"
              className="font-semibold text-primary-strong transition-opacity hover:opacity-75 dark:text-primary"
            >
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  )
}
