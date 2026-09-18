"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { createClient } from "@/shared/db/supabase/client"
import {
  AuthAlert,
  AuthField,
  AuthFooterNote,
  AuthGoogleButton,
  AuthPrimaryButton,
  AuthShell,
  FieldLabelRow,
} from "@/components/marketing/auth-primitives"
import { Input } from "@/shared/ui/input"

function LoginContent() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [unverifiedEmail, setUnverifiedEmail] = useState("")
  const [showResendModal, setShowResendModal] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [returnTo, setReturnTo] = useState("")
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const errorParam = searchParams.get("error")
    const returnToParam = searchParams.get("returnTo")

    if (errorParam === "no_account") {
      setError("No account found. Please sign up first to create an account.")
    }

    if (returnToParam) {
      setReturnTo(returnToParam)
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setUnverifiedEmail("")
    setShowResendModal(false)

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // Get user from the sign-in response
    const user = authData.user
    if (!user) {
      setError("Failed to get user information")
      setLoading(false)
      return
    }

    // Check if user's email is verified using Supabase Auth's built-in verification
    if (!user.email_confirmed_at) {
      await supabase.auth.signOut()
      setUnverifiedEmail(user.email || email)
      setShowResendModal(true)
      setLoading(false)
      return
    }

    router.push("/dashboard")
  }

  const handleResendVerification = async () => {
    setResending(true)
    setResendSuccess(false)

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unverifiedEmail }),
      })

      if (response.ok) {
        setResendSuccess(true)
        setTimeout(() => {
          setShowResendModal(false)
          setResendSuccess(false)
          setUnverifiedEmail("")
        }, 3000)
      } else {
        setError("Failed to resend verification email")
      }
    } catch {
      setError("An error occurred")
    } finally {
      setResending(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)

    const state = Math.random().toString(36).substring(7)

    document.cookie = `auth_intent=login; path=/; max-age=3600; SameSite=Lax`
    document.cookie = `auth_state=${state}; path=/; max-age=3600; SameSite=Lax`
    if (returnTo) {
      document.cookie = `auth_returnTo=${encodeURIComponent(returnTo)}; path=/; max-age=3600; SameSite=Lax`
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const redirectTo = `${origin}/auth/callback`

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          prompt: "select_account",
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your command center.">
      <form onSubmit={handleLogin} className="space-y-5">
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

        <div className="space-y-1.5">
          <FieldLabelRow
            htmlFor="password"
            label="Password"
            action={
              <Link
                href="/auth/forgot-password"
                className="text-[13px] font-medium text-primary-strong transition-opacity hover:opacity-75 dark:text-primary"
              >
                Forgot password?
              </Link>
            }
          />
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="h-11 rounded-lg border-border/80 bg-card px-3.5 text-[15px] shadow-sm"
          />
        </div>

        <AuthPrimaryButton loading={loading} disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </AuthPrimaryButton>

        <div className="relative" aria-hidden>
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/70" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
              or
            </span>
          </div>
        </div>

        <AuthGoogleButton onClick={handleGoogleLogin} disabled={loading} loading={loading} />
      </form>

      <AuthFooterNote>
        New to ApplyOS?{" "}
        <Link
          href="/auth/signup"
          className="font-semibold text-primary-strong transition-opacity hover:opacity-75 dark:text-primary"
        >
          Create an account
        </Link>
      </AuthFooterNote>

      {/* Unverified email modal */}
      <AnimatePresence>
        {showResendModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm rounded-2xl border border-border/80 bg-card p-6 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Verify your email"
            >
              <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                Verify your email
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                We sent a verification link to{" "}
                <strong className="font-semibold text-foreground">{unverifiedEmail}</strong>.
                Open the link to finish signing in.
              </p>

              <p className="mt-4 rounded-lg border border-border/70 bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                Didn&apos;t receive it? Check your spam folder, or resend the email below.
              </p>

              {resendSuccess && (
                <div className="mt-3">
                  <AuthAlert tone="success">Verification email resent.</AuthAlert>
                </div>
              )}

              <div className="mt-5 space-y-2.5">
                <AuthPrimaryButton
                  type="button"
                  onClick={handleResendVerification}
                  loading={resending}
                  disabled={resending || resendSuccess}
                >
                  {resendSuccess ? "Email sent" : resending ? "Sending…" : "Resend verification email"}
                </AuthPrimaryButton>
                <button
                  type="button"
                  onClick={() => {
                    setShowResendModal(false)
                    setUnverifiedEmail("")
                    setResendSuccess(false)
                  }}
                  className="h-11 w-full rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Back to login
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
