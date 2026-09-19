"use client"

import { useEffect, useState, useRef } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Badge } from "@/shared/ui/badge"
import { Calendar, Loader2, Edit2, Upload, BadgeCheck, FileSpreadsheet, ShieldAlert } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { createClient } from "@/shared/db/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import { PromptModal } from "@/components/modals/prompt-modal"
import { AlertModal } from "@/components/modals/alert-modal"
import { ImportApplicationsModal } from "@/modules/applications/components/modals/import-applications-modal"

interface Profile {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  created_at: string
}

export default function ProfilePage() {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showDeletePrompt, setShowDeletePrompt] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)

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
          setError("You must be logged in to view your profile.")
          setLoading(false)
          return
        }

        setUser(user)

        const { data, error: profileError } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single()

        if (profileError) throw profileError

        const p = data as Profile
        setProfile(p)
        // Priority: Google full_name > database name > metadata name
        const fullName =
          user.user_metadata?.full_name ||
          p.name ||
          user.user_metadata?.name ||
          ""
        setName(fullName)
        setAvatarUrl(p.avatar_url || user.user_metadata?.avatar_url || "")
      } catch (err) {
        console.error("Error loading profile:", err)
        setError("Unable to load your profile. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [supabase])

  const initials =
    (name || profile?.email || user?.email || "?")
      .split(" ")
      .filter((part) => part)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"

  const handleSave = async () => {
    if (!user || !profile) return
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const { error: updateError } = await supabase
        .from("users")
        .update({
          name: name || null,
          avatar_url: avatarUrl || null,
        })
        .eq("id", user.id)

      if (updateError) throw updateError

      setProfile((prev) =>
        prev
          ? {
            ...prev,
            name: name || prev.name,
            avatar_url: avatarUrl || prev.avatar_url,
          }
          : prev
      )
      setSuccess(true)
    } catch (err) {
      console.error("Error updating profile:", err)
      setError("Failed to save changes. Please try again.")
    } finally {
      setSaving(false)
      setTimeout(() => setSuccess(false), 2500)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setUploadingAvatar(true)
    setAvatarError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/account/avatar", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        setAvatarError(data.error || "Failed to upload avatar")
        return
      }

      setAvatarUrl(data.avatar_url)
      setProfile((prev) =>
        prev
          ? { ...prev, avatar_url: data.avatar_url }
          : prev
      )
    } catch (err) {
      console.error("Error uploading avatar:", err)
      setAvatarError("An error occurred while uploading your avatar")
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleDeleteAccount = async () => {
    if (!user) return

    setDeletingAccount(true)
    setDeleteError(null)

    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await response.json()

      if (!response.ok) {
        console.error("❌ Deletion failed:", data)
        setDeleteError(data.error || "Failed to delete account. Please try again.")
        setDeletingAccount(false)
        return
      }


      // Wait a moment for backend to process, then redirect to home
      setTimeout(() => {
        window.location.href = "/"
      }, 1000)
    } catch (err) {
      console.error("Error deleting account:", err)
      setDeleteError("An unexpected error occurred. Please try again.")
      setDeletingAccount(false)
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

  if (!user || !profile) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <p className="text-sm text-destructive">
            {error || "Unable to load profile."}
          </p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          overline="Account"
          title="Profile"
          description="How you appear in ApplyOS, and the data the AI uses when it drafts for you."
        />

        {/* Identity card — the old layout repeated this information across two
            cards (a form plus a three-tile "Account Overview"). */}
        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex flex-col items-center gap-2 sm:items-start">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={uploadingAvatar}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-muted/60 transition-opacity hover:opacity-90 disabled:opacity-50"
                title="Change photo"
                aria-label="Change profile photo"
              >
                <span className="flex h-full w-full items-center justify-center font-display text-2xl font-bold text-foreground/70 select-none">
                  {initials}
                </span>
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full rounded-2xl object-cover"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = "none"
                    }}
                  />
                ) : null}
                <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  {uploadingAvatar ? (
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  ) : (
                    <Edit2 className="h-5 w-5 text-white" />
                  )}
                </span>
              </button>
              <span className="text-[11px] text-muted-foreground">PNG or JPG</span>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
                {name || profile.name || "Your name"}
              </h2>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{profile.email}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary-strong dark:text-primary">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Email verified
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  Free plan
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  Member since{" "}
                  {profile.created_at
                    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
                    : "—"}
                </span>
              </div>

              {avatarError ? <p className="mt-2 text-xs text-destructive">{avatarError}</p> : null}
            </div>
          </div>

          <div className="border-t border-border/60 px-5 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="name" className="text-[13px] font-medium text-foreground">
                  Full name
                </label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="text-[13px] font-medium text-foreground">
                  Email
                </label>
                <Input id="email" type="email" value={profile.email} disabled className="text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground">
                  Contact support to change the email on your account.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                className="h-9 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_rgba(24,187,112,0.5)]"
                onClick={handleSave}
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
              {success ? <span className="text-xs text-primary-strong dark:text-primary">Profile updated.</span> : null}
              {error ? <span className="text-xs text-destructive">{error}</span> : null}
            </div>
          </div>
        </section>

        {/* Data — import lives beside the account facts instead of in its own
            near-empty card, and the dead "Connected Accounts" card (two rows
            both labelled Coming soon) is gone. */}
        <section className="grid gap-2 overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/50">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-foreground">Import applications</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Bring your existing tracker across from a CSV export — statuses, priorities and deadlines included.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowImportModal(true)}
              className="h-9 shrink-0 rounded-lg border-border/80 text-[13px] font-medium"
            >
              <Upload className="mr-2 h-3.5 w-3.5" />
              Import CSV
            </Button>
          </div>
          {importSuccess ? (
            <p className="border-t border-primary/20 bg-primary/[0.06] px-5 py-3 text-xs text-primary-strong dark:text-primary">
              {importSuccess}
            </p>
          ) : null}
        </section>

        {/* Danger zone */}
        <section className="overflow-hidden rounded-2xl border border-destructive/30 bg-card">
          <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-destructive/25 bg-destructive/10">
                <ShieldAlert className="h-4 w-4 text-destructive" />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-foreground">Delete account</p>
                <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
                  Removes your profile, applications, questions, documents, notifications and status history. This
                  cannot be undone.
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowDeletePrompt(true)}
              className="h-9 shrink-0 rounded-lg text-[13px] font-semibold"
            >
              Delete account
            </Button>
          </div>
        </section>

        {/* Delete Account Prompt Modal */}
        <PromptModal
          isOpen={showDeletePrompt}
          title="Delete Your Account?"
          description="This action is permanent and cannot be undone. All your data including applications, documents, and settings will be deleted."
          placeholder="Type DELETE to confirm"
          requiredValue="DELETE"
          confirmText="Delete My Account"
          cancelText="Cancel"
          variant="destructive"
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDeletePrompt(false)}
          isLoading={deletingAccount}
        />

        {/* Delete Error Modal */}
        <AlertModal
          isOpen={!!deleteError}
          title="Error"
          message={deleteError || ""}
          type="error"
          onClose={() => setDeleteError(null)}
        />

        {/* Import Applications Modal */}
        <ImportApplicationsModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={(count) => {
            setShowImportModal(false)
            setImportSuccess(`Successfully imported ${count} application${count !== 1 ? "s" : ""}!`)
            // Clear the success message after 5 seconds
            setTimeout(() => setImportSuccess(null), 5000)
          }}
        />
      </div>
    </DashboardLayout>
  )
}
