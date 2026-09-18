"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Shield } from "lucide-react"
import { createClient } from "@/shared/db/supabase/client"
import {
  AuthAlert,
  AuthField,
  AuthFooterNote,
  AuthGoogleButton,
  AuthOutlineButton,
  AuthPrimaryButton,
  AuthShell,
  PasswordStrengthBar,
  StatusTile,
} from "@/components/marketing/auth-primitives"
import { validatePassword, getPasswordStrength } from "@/lib/password-security"

function SignupContent() {
  const searchParams = useSearchParams()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const passwordStrength = password.length > 0 ? getPasswordStrength(password) : null
  const [checkingPassword, setCheckingPassword] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const errorParam = searchParams.get("error")
    if (errorParam === "already_registered") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing error from URL param on mount
      setError("You already have an account. Please sign in instead.")
    }
  }, [searchParams])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setCheckingPassword(true)
    setError("")

    try {
      // Validate password strength and check for breaches
      const passwordValidation = await validatePassword(password)

      if (!passwordValidation.valid) {
        setError(passwordValidation.message || "Invalid password")
        setLoading(false)
        setCheckingPassword(false)
        return
      }

      setCheckingPassword(false)

      // Call custom signup API that sends welcome email
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Signup failed")
        setLoading(false)
      } else {
        setSuccess(true)
        setLoading(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setLoading(false)
      setCheckingPassword(false)
    }
  }

  const handleGoogleSignup = async () => {
    setLoading(true)

    // Store intent in cookie so callback can access it
    document.cookie = "auth_intent=signup; path=/; max-age=3600; SameSite=Lax"

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

  if (success) {
    return (
      <AuthShell
        title="Verify your email"
        subtitle="Your account is ready — one last step."
      >
        <div className="space-y-6">
          <StatusTile icon={CheckCircle2} size="lg" />
          <div className="space-y-3 text-center">
            <p className="text-sm leading-relaxed text-muted-foreground">
              We&apos;ve sent a verification link to{" "}
              <strong className="font-semibold text-foreground">{email}</strong>.
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground/80">
              The link expires in 24 hours. Don&apos;t see it? Check your spam folder.
            </p>
          </div>
          <AuthOutlineButton asChild href="/auth/login">
            Back to login
          </AuthOutlineButton>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free to start. No credit card required."
    >
      <form onSubmit={handleSignup} className="space-y-5">
        {error && <AuthAlert tone="error">{error}</AuthAlert>}

        <AuthField
          id="name"
          label="Full name"
          placeholder="Najib Oladosu"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />

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

        <div className="space-y-2">
          <AuthField
            id="password"
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            hint={
              <>
                <PasswordStrengthBar strength={passwordStrength} />
                <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
                  <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="leading-relaxed">
                    8+ characters with uppercase, lowercase, a number and a special character.
                    {checkingPassword && (
                      <span className="mt-1 block font-medium text-primary-strong dark:text-primary">
                        Checking password security…
                      </span>
                    )}
                  </span>
                </div>
              </>
            }
          />
        </div>

        <AuthPrimaryButton loading={loading || checkingPassword} disabled={loading || checkingPassword}>
          {checkingPassword
            ? "Checking password…"
            : loading
              ? "Creating account…"
              : "Create account"}
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

        <AuthGoogleButton onClick={handleGoogleSignup} disabled={loading} loading={loading} />
      </form>

      <AuthFooterNote>
        <span className="block text-xs text-muted-foreground/70">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </span>
        <span className="mt-2 block">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-semibold text-primary-strong transition-opacity hover:opacity-75 dark:text-primary"
          >
            Sign in
          </Link>
        </span>
      </AuthFooterNote>
    </AuthShell>
  )
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  )
}
