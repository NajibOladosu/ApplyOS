"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Bell, Download, Key, Palette, Star, Loader2, Sun, Moon, Monitor, Chrome } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { cn } from "@/shared/lib/utils"
import { ToggleSwitch } from "@/shared/ui/toggle-switch"
import { createClient } from "@/shared/db/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog"

type NotificationPrefs = {
  email_notifications: boolean
  deadline_reminders: boolean
  status_updates: boolean
}

type AiSettings = {
  auto_generate_answers: boolean
}


/** Section wrapper: one heading, then rows — replaces the six stacked cards
 *  that each carried a heading, a description and a single control. */
function SettingsSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="flex items-start gap-3 border-b border-border/60 px-5 py-4">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/50 text-muted-foreground">
          {icon}
        </span>
        <div>
          <h2 className="font-display text-[15px] font-bold tracking-tight text-foreground">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="divide-y divide-border/50">{children}</div>
    </section>
  )
}

function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const supabase = createClient()
  const { theme, setTheme } = useTheme()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Local, persisted-like settings (stored in user metadata for now)
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
    email_notifications: true,
    deadline_reminders: true,
    status_updates: true,
  })
  const [aiSettings, setAiSettings] = useState<AiSettings>({
    auto_generate_answers: true,
  })

  // Password change modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) {
          setError("You must be logged in to view settings.")
          setLoading(false)
          return
        }
        setUser(user)

        const meta = (user.user_metadata || {}) as Record<string, unknown>

        setNotificationPrefs({
          email_notifications:
            typeof meta.email_notifications === "boolean"
              ? meta.email_notifications
              : true,
          deadline_reminders:
            typeof meta.deadline_reminders === "boolean"
              ? meta.deadline_reminders
              : true,
          status_updates:
            typeof meta.status_updates === "boolean"
              ? meta.status_updates
              : true,
        })

        setAiSettings({
          auto_generate_answers:
            typeof meta.auto_generate_answers === "boolean"
              ? meta.auto_generate_answers
              : true,
        })
      } catch (err) {
        console.error("Error loading settings:", err)
        setError("Unable to load your settings. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [supabase])

  const persistSettings = async () => {
    if (!user) return
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const updatedMetadata = {
        ...user.user_metadata,
        ...notificationPrefs,
        ...aiSettings,
      }

      const { error: updateError } = await supabase.auth.updateUser({
        data: updatedMetadata,
      })

      if (updateError) throw updateError
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
    } catch (err) {
      console.error("Error saving settings:", err)
      setError("Failed to save settings. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    setPasswordError(null)
    setPasswordSuccess(false)

    // Validation
    if (!currentPassword.trim()) {
      setPasswordError("Current password is required")
      return
    }
    if (!newPassword.trim()) {
      setPasswordError("New password is required")
      return
    }
    if (!confirmPassword.trim()) {
      setPasswordError("Password confirmation is required")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match")
      return
    }
    if (newPassword === currentPassword) {
      setPasswordError("New password must be different from current password")
      return
    }

    setPasswordLoading(true)
    try {
      // First, verify current password by attempting to sign in
      if (!user?.email) {
        throw new Error("User email not found")
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })

      if (signInError) {
        setPasswordError("Current password is incorrect")
        return
      }

      // If verification successful, update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        setPasswordError(
          updateError.message || "Failed to update password. Please try again."
        )
        return
      }

      setPasswordSuccess(true)
      // Clear form
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      // Close modal after success
      setTimeout(() => {
        setShowPasswordModal(false)
        setPasswordSuccess(false)
      }, 1500)
    } catch (err) {
      console.error("Error changing password:", err)
      setPasswordError("An error occurred while changing your password")
    } finally {
      setPasswordLoading(false)
    }
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

  if (!user) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <p className="text-sm text-destructive">
            {error || "You must be logged in to manage settings."}
          </p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          overline="Account"
          title="Settings"
          description="Notifications, AI behaviour, appearance and data. Changes apply to your account only."
          actions={
            <div className="flex items-center gap-3">
              {success ? <span className="text-xs text-primary-strong dark:text-primary">Saved.</span> : null}
              {error ? <span className="text-xs text-destructive">{error}</span> : null}
              <Button
                className="h-9 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_rgba(24,187,112,0.5)]"
                onClick={persistSettings}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          }
        />

        {/* Notifications */}
        <SettingsSection
          icon={<Bell className="h-4 w-4" />}
          title="Notifications"
          description="Choose what ApplyOS tells you about, and when."
        >
          {(
            [
              {
                key: "email_notifications" as const,
                label: "Email notifications",
                hint: "Important activity delivered to your inbox",
              },
              {
                key: "deadline_reminders" as const,
                label: "Deadline reminders",
                hint: "A nudge before an application deadline passes",
              },
              {
                key: "status_updates" as const,
                label: "Status updates",
                hint: "When an application moves between stages",
              },
            ]
          ).map((row) => (
            <SettingsRow key={row.key} label={row.label} hint={row.hint}>
              <ToggleSwitch
                checked={notificationPrefs[row.key]}
                onChange={(checked) => setNotificationPrefs((prev) => ({ ...prev, [row.key]: checked }))}
              />
            </SettingsRow>
          ))}
        </SettingsSection>

        {/* AI */}
        <SettingsSection
          icon={<Star className="h-4 w-4" />}
          title="AI features"
          description="How much the assistant does without being asked."
        >
          <SettingsRow
            label="Auto-generate answers"
            hint="Draft interview and application answers from your documents and profile"
          >
            <ToggleSwitch
              checked={aiSettings.auto_generate_answers}
              onChange={(checked) => setAiSettings({ auto_generate_answers: checked })}
            />
          </SettingsRow>
        </SettingsSection>

        {/* Appearance */}
        <SettingsSection
          icon={<Palette className="h-4 w-4" />}
          title="Appearance"
          description="Applies to this browser only."
        >
          <SettingsRow label="Theme" hint="Follow your system or pick one">
            <div className="inline-flex rounded-lg border border-border/70 bg-muted/50 p-0.5">
              {(
                [
                  { value: "light", label: "Light", icon: Sun },
                  { value: "dark", label: "Dark", icon: Moon },
                  { value: "system", label: "System", icon: Monitor },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  aria-pressed={theme === value}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                    theme === value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </SettingsRow>
        </SettingsSection>

        {/* Security */}
        <SettingsSection
          icon={<Key className="h-4 w-4" />}
          title="Security"
          description="Keep your account safe."
        >
          <SettingsRow label="Password" hint="Update the password you sign in with">
            <Button
              variant="outline"
              onClick={() => setShowPasswordModal(true)}
              className="h-9 rounded-lg border-border/80 text-[13px] font-medium"
            >
              Change password
            </Button>
          </SettingsRow>
        </SettingsSection>

        {/* Data */}
        <SettingsSection
          icon={<Download className="h-4 w-4" />}
          title="Data and privacy"
          description="Take your data with you."
        >
          <SettingsRow label="Export data" hint="Applications, documents and interview history as CSV or JSON">
            <Button variant="outline" disabled className="h-9 rounded-lg border-border/80 text-[13px] font-medium">
              Coming soon
            </Button>
          </SettingsRow>
        </SettingsSection>

        {/* Extension */}
        <SettingsSection
          icon={<Chrome className="h-4 w-4" />}
          title="Browser extension"
          description="Capture a job posting without leaving the page."
        >
          <SettingsRow label="Chrome extension" hint="Available on the Chrome Web Store">
            <a
              href="https://chromewebstore.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3.5 text-[13px] font-medium text-foreground transition-colors hover:border-primary/40"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          </SettingsRow>
        </SettingsSection>

        {/* Password Change Modal */}
        <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Password</DialogTitle>
              <DialogDescription>
                Enter your current password and choose a new one.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Current Password */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Password</label>
                <Input
                  type="password"
                  placeholder="Enter your current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={passwordLoading}
                />
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <label className="text-sm font-medium">New Password</label>
                <Input
                  type="password"
                  placeholder="Enter your new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={passwordLoading}
                />
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Confirm New Password</label>
                <Input
                  type="password"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={passwordLoading}
                />
              </div>

              {/* Error Message */}
              {passwordError && (
                <div className="rounded-md bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">{passwordError}</p>
                </div>
              )}

              {/* Success Message */}
              {passwordSuccess && (
                <div className="rounded-md bg-primary/10 p-3">
                  <p className="text-sm text-primary">
                    Password changed successfully!
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowPasswordModal(false)}
                disabled={passwordLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleChangePassword}
                disabled={passwordLoading}
              >
                {passwordLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
