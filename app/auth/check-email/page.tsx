"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Inbox, Mail, MailX } from "lucide-react"
import {
  AuthAlert,
  AuthOutlineButton,
  AuthPrimaryButton,
  AuthShell,
  StatusTile,
} from "@/components/marketing/auth-primitives"

const TIPS = [
  { icon: Inbox, text: "Check your inbox" },
  { icon: MailX, text: "Not there? Check your spam folder" },
  { icon: Mail, text: "The link expires in 24 hours" },
]

function CheckEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get("email") || ""
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendError, setResendError] = useState("")

  const handleResendEmail = async () => {
    if (!email) return

    setResending(true)
    setResendError("")

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (response.ok) {
        setResendSuccess(true)
        setTimeout(() => {
          setResendSuccess(false)
        }, 5000)
      } else {
        const data = await response.json()
        setResendError(data.error || "Failed to resend verification email")
      }
    } catch {
      setResendError("An error occurred while resending email")
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthShell
      title="Check your email"
      subtitle="Click the verification link in the email to confirm your account."
    >
      <div className="space-y-6">
        <StatusTile icon={Mail} size="lg" />

        {email && (
          <div className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
            Sent to <span className="font-semibold text-foreground">{email}</span>
          </div>
        )}

        <ul className="space-y-2.5">
          {TIPS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card">
                <Icon className="h-3.5 w-3.5 text-primary-strong dark:text-primary" />
              </span>
              {text}
            </li>
          ))}
        </ul>

        {resendSuccess && <AuthAlert tone="success">Verification email resent.</AuthAlert>}
        {resendError && <AuthAlert tone="error">{resendError}</AuthAlert>}

        <div className="space-y-2.5 pt-1">
          <AuthPrimaryButton
            type="button"
            onClick={handleResendEmail}
            loading={resending}
            disabled={resending || resendSuccess}
          >
            {resendSuccess ? "Email sent" : resending ? "Sending…" : "Resend verification email"}
          </AuthPrimaryButton>
          <AuthOutlineButton asChild href="/auth/login">
            Back to login
          </AuthOutlineButton>
        </div>

        <p className="text-center text-xs leading-relaxed text-muted-foreground/70">
          Still nothing? Make sure the address above is correct and check your spam folder.
        </p>
      </div>
    </AuthShell>
  )
}

export default function CheckEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <CheckEmailContent />
    </Suspense>
  )
}
