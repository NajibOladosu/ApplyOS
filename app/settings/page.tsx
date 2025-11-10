"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Bell,
  Download,
  Key,
  Palette,
  Globe,
  Loader2,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"

type NotificationPrefs = {
  email_notifications: boolean
  deadline_reminders: boolean
  status_updates: boolean
}

type AiSettings = {
  auto_generate_answers: boolean
}

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
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

        const meta = (user.user_metadata || {}) as any

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
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account settings and preferences
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={persistSettings}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
            {success && (
              <span className="text-xs text-primary">Saved.</span>
            )}
            {error && (
              <span className="text-xs text-destructive">{error}</span>
            )}
          </div>
        </div>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>
              Stored in your user metadata. Used to tailor how Trackly notifies you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive email updates for important events
                  </p>
                </div>
              </div>
              <Button
                variant={
                  notificationPrefs.email_notifications ? "default" : "outline"
                }
                size="sm"
                onClick={() =>
                  setNotificationPrefs((prev) => ({
                    ...prev,
                    email_notifications: !prev.email_notifications,
                  }))
                }
              >
                {notificationPrefs.email_notifications ? "Enabled" : "Disabled"}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Deadline Reminders</p>
                  <p className="text-sm text-muted-foreground">
                    Get reminded before application deadlines
                  </p>
                </div>
              </div>
              <Button
                variant={
                  notificationPrefs.deadline_reminders
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() =>
                  setNotificationPrefs((prev) => ({
                    ...prev,
                    deadline_reminders: !prev.deadline_reminders,
                  }))
                }
              >
                {notificationPrefs.deadline_reminders
                  ? "Enabled"
                  : "Disabled"}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Status Updates</p>
                  <p className="text-sm text-muted-foreground">
                    Notifications when application status changes
                  </p>
                </div>
              </div>
              <Button
                variant={
                  notificationPrefs.status_updates ? "default" : "outline"
                }
                size="sm"
                onClick={() =>
                  setNotificationPrefs((prev) => ({
                    ...prev,
                    status_updates: !prev.status_updates,
                  }))
                }
              >
                {notificationPrefs.status_updates ? "Enabled" : "Disabled"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* AI Settings */}
        <Card>
          <CardHeader>
            <CardTitle>AI Features</CardTitle>
            <CardDescription>
              Configure AI-powered features (per-user preferences stored in metadata).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Auto-generate Responses
              </label>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground max-w-md">
                  When enabled, Trackly can automatically generate AI answers
                  for new application questions using your documents and profile.
                </p>
                <Button
                  variant={
                    aiSettings.auto_generate_answers ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() =>
                    setAiSettings((prev) => ({
                      ...prev,
                      auto_generate_answers: !prev.auto_generate_answers,
                    }))
                  }
                >
                  {aiSettings.auto_generate_answers
                    ? "Enabled"
                    : "Disabled"}
                </Button>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Security (informational: flows depend on Supabase auth UIs) */}
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>
              Core security is handled by Supabase Auth. Use its built-in flows for password reset and MFA.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Key className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Change Password</p>
                  <p className="text-sm text-muted-foreground">
                    Use the password reset link sent via email from Supabase.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" disabled>
                Managed via Supabase
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Key className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">
                    Enable MFA in your Supabase auth settings or integrated IdP.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" disabled>
                Configure via Auth Provider
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Data & Privacy (coming soon) */}
        <Card>
          <CardHeader>
            <CardTitle>Data & Privacy</CardTitle>
            <CardDescription>
              Manage your data and privacy settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Download className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Export Data</p>
                  <p className="text-sm text-muted-foreground">
                    Download all your data as JSON or CSV (requires an API endpoint).
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" disabled>
                Coming soon
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Data Storage Location</p>
                  <p className="text-sm text-muted-foreground">
                    Managed by your Supabase project region.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" disabled>
                Managed via Supabase
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Customize how Trackly looks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Palette className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Theme</p>
                  <p className="text-sm text-muted-foreground">
                    Dark theme is enabled by default for this workspace.
                  </p>
                </div>
              </div>
              <Badge variant="default">Dark</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
