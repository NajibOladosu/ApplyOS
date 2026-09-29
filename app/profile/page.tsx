"use client"

import { useEffect, useState, useRef } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Calendar, Loader2, Edit2, Upload, BadgeCheck, FileSpreadsheet, ShieldAlert, Wand2 } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { MiniBar } from "@/components/data/stat"
import { createClient } from "@/shared/db/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import { PromptModal } from "@/components/modals/prompt-modal"
import { AlertModal } from "@/components/modals/alert-modal"
import { ImportApplicationsModal } from "@/modules/applications/components/modals/import-applications-modal"
import {
  EMPTY_AUTOFILL_PROFILE,
  countAutofillFields,
  normalizeAutofillProfile,
  type AutofillProfile,
} from "@/types/autofill"

interface Profile {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  created_at: string
  autofill_profile?: unknown
}

/** One labelled group inside the autofill card. */
function AutofillGroup({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="px-5 py-4">
      <div className="mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">{title}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground/80">{hint}</p> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function AutofillField({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-[13px] font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
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

  // Autofill profile — the details applications ask for, entered once here
  // and read by the AI drafts and the browser extension.
  const [autofill, setAutofill] = useState<AutofillProfile>(EMPTY_AUTOFILL_PROFILE)
  const [savingAutofill, setSavingAutofill] = useState(false)
  const [autofillError, setAutofillError] = useState<string | null>(null)
  const [autofillSuccess, setAutofillSuccess] = useState(false)

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
        setAutofill(() => {
          const next = normalizeAutofillProfile(p.autofill_profile)
          // The account email is the source of truth for contact.email.
          if (!next.contact.email.trim()) next.contact.email = p.email
          return next
        })
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

  const autofillProgress = countAutofillFields(autofill)

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

  const clearAutofillStatus = () => {
    setAutofillSuccess(false)
    setAutofillError(null)
  }

  const updateAutofillGroup = <K extends "identity" | "contact" | "links" | "work" | "education">(
    group: K,
    key: keyof AutofillProfile[K],
    value: string
  ) => {
    setAutofill((prev) => ({ ...prev, [group]: { ...prev[group], [key]: value } }))
    clearAutofillStatus()
  }

  const updateEligibility = (key: keyof AutofillProfile["eligibility"], value: string) => {
    setAutofill((prev) => ({
      ...prev,
      eligibility:
        key === "workAuthorization" || key === "securityClearance"
          ? { ...prev.eligibility, [key]: value }
          : { ...prev.eligibility, [key]: value === "" ? null : value === "true" },
    }))
    clearAutofillStatus()
  }

  const updateAutofillText = (key: "skills" | "certifications" | "languages", value: string) => {
    setAutofill((prev) => ({ ...prev, [key]: value }))
    clearAutofillStatus()
  }

  const handleSaveAutofill = async () => {
    if (!user) return
    setSavingAutofill(true)
    setAutofillError(null)
    setAutofillSuccess(false)
    try {
      const payload: Record<string, unknown> = { autofill_profile: autofill }

      // If the display name is empty, sync it from the autofill identity.
      const full = [autofill.identity.firstName, autofill.identity.lastName]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" ")
      if (full && !profile?.name?.trim()) payload.name = full

      const { error: updateError } = await supabase
        .from("users")
        .update(payload)
        .eq("id", user.id)

      if (updateError) throw updateError

      if (full && !profile?.name?.trim()) {
        setProfile((prev) => (prev ? { ...prev, name: full } : prev))
        setName(full)
      }
      setAutofillSuccess(true)
      setTimeout(() => setAutofillSuccess(false), 2500)
    } catch (err) {
      console.error("Error saving autofill profile:", err)
      setAutofillError("Failed to save your autofill details. Please try again.")
    } finally {
      setSavingAutofill(false)
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

        {/* Autofill profile — the details a job application asks for, entered
            once and reused by drafts and the browser extension. */}
        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex flex-col gap-4 border-b border-border/60 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary-strong dark:text-primary">
                <Wand2 className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-display text-[15px] font-bold tracking-tight text-foreground">
                  Autofill profile
                </h2>
                <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
                  The details a job application asks for — name, contact, address and
                  eligibility. Enter them once and drafts plus the browser extension
                  fill the forms for you.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <div className="w-36">
                <p className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                  <span>Completion</span>
                  <span className="tabular-nums">
                    {autofillProgress.filled}/{autofillProgress.total}
                  </span>
                </p>
                <div className="mt-1.5">
                  <MiniBar
                    ratio={
                      autofillProgress.total > 0
                        ? autofillProgress.filled / autofillProgress.total
                        : 0
                    }
                    tone="primary"
                  />
                </div>
              </div>
              <Button
                className="h-9 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_rgba(24,187,112,0.5)]"
                onClick={handleSaveAutofill}
                disabled={savingAutofill}
              >
                {savingAutofill ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save autofill details"
                )}
              </Button>
            </div>
          </div>

          <div className="divide-y divide-border/50">
            <AutofillGroup title="Identity">
              <AutofillField label="First name">
                <Input
                  value={autofill.identity.firstName}
                  onChange={(e) => updateAutofillGroup("identity", "firstName", e.target.value)}
                  placeholder="Ada"
                />
              </AutofillField>
              <AutofillField label="Last name">
                <Input
                  value={autofill.identity.lastName}
                  onChange={(e) => updateAutofillGroup("identity", "lastName", e.target.value)}
                  placeholder="Okafor"
                />
              </AutofillField>
              <AutofillField label="Preferred name">
                <Input
                  value={autofill.identity.preferredName}
                  onChange={(e) => updateAutofillGroup("identity", "preferredName", e.target.value)}
                  placeholder="Optional"
                />
              </AutofillField>
              <AutofillField label="Pronouns">
                <Input
                  value={autofill.identity.pronouns}
                  onChange={(e) => updateAutofillGroup("identity", "pronouns", e.target.value)}
                  placeholder="she/her"
                />
              </AutofillField>
            </AutofillGroup>

            <AutofillGroup title="Contact">
              <AutofillField label="Email">
                <Input
                  value={autofill.contact.email}
                  onChange={(e) => updateAutofillGroup("contact", "email", e.target.value)}
                  placeholder="you@example.com"
                />
              </AutofillField>
              <div className="grid grid-cols-[88px_1fr] gap-3">
                <AutofillField label="Code">
                  <Input
                    value={autofill.contact.phoneCountryCode}
                    onChange={(e) => updateAutofillGroup("contact", "phoneCountryCode", e.target.value)}
                    placeholder="234"
                    inputMode="numeric"
                  />
                </AutofillField>
                <AutofillField label="Phone number">
                  <Input
                    value={autofill.contact.phone}
                    onChange={(e) => updateAutofillGroup("contact", "phone", e.target.value)}
                    placeholder="801 234 5678"
                    inputMode="tel"
                  />
                </AutofillField>
              </div>
            </AutofillGroup>

            <AutofillGroup title="Address">
              <AutofillField label="Address line 1" className="sm:col-span-2">
                <Input
                  value={autofill.contact.addressLine1}
                  onChange={(e) => updateAutofillGroup("contact", "addressLine1", e.target.value)}
                  placeholder="Street and house / apartment number"
                />
              </AutofillField>
              <AutofillField label="Address line 2" className="sm:col-span-2">
                <Input
                  value={autofill.contact.addressLine2}
                  onChange={(e) => updateAutofillGroup("contact", "addressLine2", e.target.value)}
                  placeholder="District, block — optional"
                />
              </AutofillField>
              <AutofillField label="City">
                <Input
                  value={autofill.contact.city}
                  onChange={(e) => updateAutofillGroup("contact", "city", e.target.value)}
                  placeholder="Lagos"
                />
              </AutofillField>
              <AutofillField label="State / region">
                <Input
                  value={autofill.contact.state}
                  onChange={(e) => updateAutofillGroup("contact", "state", e.target.value)}
                  placeholder="Lagos State"
                />
              </AutofillField>
              <AutofillField label="Postal code">
                <Input
                  value={autofill.contact.postalCode}
                  onChange={(e) => updateAutofillGroup("contact", "postalCode", e.target.value)}
                  placeholder="101233"
                />
              </AutofillField>
              <AutofillField label="Country">
                <Input
                  value={autofill.contact.country}
                  onChange={(e) => updateAutofillGroup("contact", "country", e.target.value)}
                  placeholder="Nigeria"
                />
              </AutofillField>
            </AutofillGroup>

            <AutofillGroup title="Links" hint="Shared when a form asks for your online presence.">
              <AutofillField label="LinkedIn">
                <Input
                  value={autofill.links.linkedin}
                  onChange={(e) => updateAutofillGroup("links", "linkedin", e.target.value)}
                  placeholder="linkedin.com/in/you"
                />
              </AutofillField>
              <AutofillField label="GitHub">
                <Input
                  value={autofill.links.github}
                  onChange={(e) => updateAutofillGroup("links", "github", e.target.value)}
                  placeholder="github.com/you"
                />
              </AutofillField>
              <AutofillField label="Portfolio">
                <Input
                  value={autofill.links.portfolio}
                  onChange={(e) => updateAutofillGroup("links", "portfolio", e.target.value)}
                  placeholder="Optional"
                />
              </AutofillField>
              <AutofillField label="Website">
                <Input
                  value={autofill.links.website}
                  onChange={(e) => updateAutofillGroup("links", "website", e.target.value)}
                  placeholder="Optional"
                />
              </AutofillField>
              <AutofillField label="X / Twitter" className="sm:col-span-2">
                <Input
                  value={autofill.links.twitter}
                  onChange={(e) => updateAutofillGroup("links", "twitter", e.target.value)}
                  placeholder="Optional"
                />
              </AutofillField>
            </AutofillGroup>

            <AutofillGroup title="Work">
              <AutofillField label="Current company">
                <Input
                  value={autofill.work.currentCompany}
                  onChange={(e) => updateAutofillGroup("work", "currentCompany", e.target.value)}
                  placeholder="Acme Corp"
                />
              </AutofillField>
              <AutofillField label="Current title">
                <Input
                  value={autofill.work.currentTitle}
                  onChange={(e) => updateAutofillGroup("work", "currentTitle", e.target.value)}
                  placeholder="Software Engineer"
                />
              </AutofillField>
              <AutofillField label="Years of experience">
                <Input
                  value={autofill.work.yearsExperience}
                  onChange={(e) => updateAutofillGroup("work", "yearsExperience", e.target.value)}
                  placeholder="e.g. 4+"
                />
              </AutofillField>
              <AutofillField label="Notice period">
                <Input
                  value={autofill.work.noticePeriod}
                  onChange={(e) => updateAutofillGroup("work", "noticePeriod", e.target.value)}
                  placeholder="e.g. 1 month"
                />
              </AutofillField>
              <AutofillField label="Available start date">
                <Input
                  type="date"
                  value={autofill.work.availableStartDate}
                  onChange={(e) => updateAutofillGroup("work", "availableStartDate", e.target.value)}
                />
              </AutofillField>
              <div className="grid grid-cols-[1fr_96px] gap-3">
                <AutofillField label="Desired salary">
                  <Input
                    value={autofill.work.desiredSalary}
                    onChange={(e) => updateAutofillGroup("work", "desiredSalary", e.target.value)}
                    placeholder="e.g. 80000"
                    inputMode="numeric"
                  />
                </AutofillField>
                <AutofillField label="Currency">
                  <Input
                    value={autofill.work.salaryCurrency}
                    onChange={(e) => updateAutofillGroup("work", "salaryCurrency", e.target.value)}
                    placeholder="USD"
                  />
                </AutofillField>
              </div>
            </AutofillGroup>

            <AutofillGroup
              title="Eligibility"
              hint="Screening questions. Leave a row blank and ApplyOS will ask instead of guessing."
            >
              <AutofillField label="Work authorization">
                <Input
                  value={autofill.eligibility.workAuthorization}
                  onChange={(e) => updateEligibility("workAuthorization", e.target.value)}
                  placeholder="e.g. US citizen, E3 visa, right to work in Canada"
                />
              </AutofillField>
              <AutofillField label="Security clearance">
                <Input
                  value={autofill.eligibility.securityClearance}
                  onChange={(e) => updateEligibility("securityClearance", e.target.value)}
                  placeholder="None / level, if applicable"
                />
              </AutofillField>
              {(
                [
                  ["requiresSponsorship", "Requires sponsorship"],
                  ["willingToRelocate", "Willing to relocate"],
                  ["isOver18", "18 years or older"],
                  ["backgroundCheckConsent", "Consent to background check"],
                  ["nonCompete", "Bound by non-compete"],
                ] as const
              ).map(([key, label]) => (
                <AutofillField key={key} label={label}>
                  <select
                    value={
                      autofill.eligibility[key] === null
                        ? ""
                        : autofill.eligibility[key]
                          ? "true"
                          : "false"
                    }
                    onChange={(e) => updateEligibility(key, e.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-all focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">—</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </AutofillField>
              ))}
            </AutofillGroup>

            <AutofillGroup title="Education">
              <AutofillField label="School">
                <Input
                  value={autofill.education.school}
                  onChange={(e) => updateAutofillGroup("education", "school", e.target.value)}
                  placeholder="University of Lagos"
                />
              </AutofillField>
              <AutofillField label="Degree">
                <Input
                  value={autofill.education.degree}
                  onChange={(e) => updateAutofillGroup("education", "degree", e.target.value)}
                  placeholder="B.Sc. Computer Science"
                />
              </AutofillField>
              <AutofillField label="Field of study">
                <Input
                  value={autofill.education.fieldOfStudy}
                  onChange={(e) => updateAutofillGroup("education", "fieldOfStudy", e.target.value)}
                  placeholder="Computer Science"
                />
              </AutofillField>
              <AutofillField label="Graduation year">
                <Input
                  value={autofill.education.graduationYear}
                  onChange={(e) => updateAutofillGroup("education", "graduationYear", e.target.value)}
                  placeholder="2022"
                  inputMode="numeric"
                />
              </AutofillField>
            </AutofillGroup>

            <AutofillGroup title="Everything else" hint="Comma-separated where it helps.">
              <AutofillField label="Skills">
                <Input
                  value={autofill.skills}
                  onChange={(e) => updateAutofillText("skills", e.target.value)}
                  placeholder="TypeScript, React, Node.js"
                />
              </AutofillField>
              <AutofillField label="Certifications">
                <Input
                  value={autofill.certifications}
                  onChange={(e) => updateAutofillText("certifications", e.target.value)}
                  placeholder="AWS SA, Google UX"
                />
              </AutofillField>
              <AutofillField label="Languages" className="sm:col-span-2">
                <Input
                  value={autofill.languages}
                  onChange={(e) => updateAutofillText("languages", e.target.value)}
                  placeholder="English (native), Yoruba (native)"
                />
              </AutofillField>
            </AutofillGroup>
          </div>

          {(autofillSuccess || autofillError) && (
            <div
              className={
                "border-t px-5 py-3 text-xs " +
                (autofillSuccess
                  ? "border-primary/20 bg-primary/[0.06] text-primary-strong dark:text-primary"
                  : "border-destructive/20 bg-destructive/[0.06] text-destructive")
              }
            >
              {autofillSuccess
                ? "Autofill details saved. New drafts and the extension will use them."
                : autofillError}
            </div>
          )}
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
