"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, Shield } from "lucide-react"
import { createClient } from "@/shared/db/supabase/client"
import {
  AuthAlert,
  AuthField,
  AuthPrimaryButton,
  AuthShell,
  PasswordStrengthBar,
  StatusTile,
} from "@/components/marketing/auth-primitives"
import { validatePassword, getPasswordStrength } from "@/lib/password-security"

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const passwordStrength = password.length > 0 ? getPasswordStrength(password) : null
  const [checkingPassword, setCheckingPassword] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let authListener: { subscription: { unsubscribe: () => void } } | null = null
    let timeoutTimer: NodeJS.Timeout

    const setupAuth = async () => {
      // 1. Check if we already have a session
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        setLoading(false)
        return
      }

      // 2. Manual Hash Parsing Fallback (Robustness for Implicit Flow)
      const hash = window.location.hash
      if (hash && hash.includes("access_token") && hash.includes("type=recovery")) {
        try {
          const params = new URLSearchParams(hash.substring(1)) // remove #
          const accessToken = params.get("access_token")
          const refreshToken = params.get("refresh_token")

          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })

            if (!error && data.session) {
              setLoading(false)
              return
            }
          }
        } catch (e) {
          console.error("Manual hash parsing failed", e)
        }
      }

      // 3. If no session yet, listen for the implicit flow to complete
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          if (session) {
            setLoading(false)
            setError("")
            clearTimeout(timeoutTimer)
          }
        }
      })
      authListener = data

      // 4. Set a timeout — if no session by now, the link is likely invalid or expired.
      timeoutTimer = setTimeout(() => {
        supabase.auth.getSession().then(({
          data: { session },
        }) => {
          if (!session) {
            setLoading(false)
            setError("Valid verification link required. If your link has expired, please request a new one.")
          }
        })
      }, 5000)
    }

    setupAuth()

    return () => {
      if (authListener) authListener.subscription.unsubscribe()
      clearTimeout(timeoutTimer)
    }
  }, [supabase.auth])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)
    setCheckingPassword(true)
    setError("")

    try {
      const passwordValidation = await validatePassword(password)

      if (!passwordValidation.valid) {
        setError(passwordValidation.message || "Invalid password")
        setLoading(false)
        setCheckingPassword(false)
        return
      }

      setCheckingPassword(false)

      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
        setTimeout(() => {
          router.push("/auth/login")
        }, 2000)
      }
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setLoading(false)
      setCheckingPassword(false)
    }
  }

  const mismatch =
    confirmPassword.length > 0 && password !== confirmPassword

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a strong password to keep your account secure."
      backTo={{ href: "/auth/login", label: "Back to sign in" }}
    >
      {loading && !success && !checkingPassword ? (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
            <KeyRound className="h-6 w-6 animate-pulse text-primary-strong dark:text-primary" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Verifying your link…</p>
        </div>
      ) : success ? (
        <div className="space-y-6">
          <StatusTile icon={KeyRound} size="lg" />
          <div className="space-y-3 text-center">
            <AuthAlert tone="success">
              Your password has been updated. Redirecting you to sign in…
            </AuthAlert>
          </div>
        </div>
      ) : (
        <form onSubmit={handleUpdatePassword} className="space-y-5">
          {error && <AuthAlert tone="error">{error}</AuthAlert>}

          <div className="space-y-2">
            <AuthField
              id="password"
              label="New password"
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

          <AuthField
            id="confirmPassword"
            label="Confirm new password"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            hint={
              mismatch ? (
                <p className="text-xs font-medium text-destructive">Passwords don&apos;t match yet.</p>
              ) : undefined
            }
          />

          <AuthPrimaryButton loading={loading || checkingPassword} disabled={loading || checkingPassword}>
            {checkingPassword
              ? "Checking password…"
              : loading
                ? "Updating password…"
                : "Update password"}
          </AuthPrimaryButton>
        </form>
      )}
    </AuthShell>
  )
}
