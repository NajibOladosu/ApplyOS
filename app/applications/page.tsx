"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/shared/ui/button"
import { cn } from "@/shared/lib/utils"
import { Checkbox } from "@/shared/ui/checkbox"
import { motion } from "framer-motion"
import {
  Archive,
  ArchiveRestore,
  Briefcase,
  Calendar,
  Eye,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  Trash2,
  Wand2,
} from "lucide-react"
import Link from "next/link"
import {
  getApplications,
  deleteApplication,
  deleteApplications,
  updateApplicationsStatus,
  setApplicationArchived,
} from "@/modules/applications/services/application.service"
import type { Application, ApplicationStatus } from "@/types/database"
import { AddApplicationModal } from "@/modules/applications/components/modals/add-application-modal"
import { ConfirmModal } from "@/components/modals/confirm-modal"
import { AlertModal } from "@/components/modals/alert-modal"
import { BulkActionToolbar } from "@/modules/applications/components/bulk-action-toolbar"
import {
  daysUntilDeadline,
  urgencyTier,
  urgencyLabel,
  type UrgencyTier,
} from "@/modules/applications/lib/deadline"

type SortKey = "newest" | "deadline" | "priority"

const urgencyClass: Record<UrgencyTier, string> = {
  overdue: "text-destructive bg-destructive/10 border-destructive/30",
  critical: "text-orange-600 bg-orange-500/10 border-orange-500/30 dark:text-orange-400",
  soon: "text-amber-600 bg-amber-500/10 border-amber-500/30 dark:text-amber-400",
  later: "text-muted-foreground",
  none: "text-muted-foreground",
}

const statusChip: Record<ApplicationStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  submitted: {
    label: "Submitted",
    cls: "bg-primary/10 text-primary-strong dark:text-primary",
  },
  in_review: {
    label: "In Review",
    cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  interview: {
    label: "Interview",
    cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  offer: {
    label: "Offer",
    cls: "bg-primary/15 font-semibold text-primary-strong dark:text-primary",
  },
  rejected: { label: "Rejected", cls: "bg-destructive/10 text-destructive" },
}

const priorityDot: Record<Application["priority"], string> = {
  low: "bg-muted-foreground/40",
  medium: "bg-amber-500",
  high: "bg-destructive",
}

function initialsFor(app: Application) {
  const source = app.company || app.title
  return (
    source
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "AP"
  )
}

function emptyStateText(searchQuery: string, selectedStatus: string) {
  if (searchQuery) {
    return {
      title: "No applications found",
      body: "Try adjusting your search or filters.",
    }
  }
  if (selectedStatus === "archive") {
    return {
      title: "Archive is empty",
      body: "Applications you archive will appear here.",
    }
  }
  if (selectedStatus !== "all") {
    return {
      title: "No applications found",
      body: "Try adjusting your search or filters.",
    }
  }
  return {
    title: "No applications yet",
    body: "Create your first application to get started.",
  }
}

const FILTERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "in_review", label: "In Review" },
  { value: "interview", label: "Interview" },
  { value: "archive", label: "Archive" },
]

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>("newest")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => {
    fetchApplications()
  }, [])

  const fetchApplications = async () => {
    try {
      const data = await getApplications()
      setApplications(data)
    } catch (error) {
      console.error("Error fetching applications:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = (id: string) => {
    setDeletingId(id)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletingId) return

    setDeleteLoading(true)
    try {
      await deleteApplication(deletingId)
      setApplications((apps) => apps.filter((app) => app.id !== deletingId))
      setDeleteConfirmOpen(false)
      setDeletingId(null)
    } catch (error) {
      console.error("Error deleting application:", error)
      setDeleteError("Failed to delete application. Please try again.")
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleCancelDelete = () => {
    setDeleteConfirmOpen(false)
    setDeletingId(null)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredApplications.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredApplications.map((a) => a.id)))
    }
  }

  const handleBulkDelete = async () => {
    setBulkLoading(true)
    try {
      const ids = Array.from(selectedIds)
      await deleteApplications(ids)
      setApplications((apps) => apps.filter((a) => !selectedIds.has(a.id)))
      setSelectedIds(new Set())
      setBulkDeleteConfirmOpen(false)
    } catch (error) {
      console.error("Bulk delete failed:", error)
      setDeleteError("Failed to delete the selected applications. Please try again.")
    } finally {
      setBulkLoading(false)
    }
  }

  const handleArchiveToggle = async (id: string, archived: boolean) => {
    // Optimistic: drop it from the current view immediately.
    setApplications((apps) => apps.map((a) => (a.id === id ? { ...a, archived } : a)))
    try {
      await setApplicationArchived(id, archived)
    } catch (error) {
      console.error("Archive toggle failed:", error)
      setApplications((apps) =>
        apps.map((a) => (a.id === id ? { ...a, archived: !archived } : a))
      )
      setDeleteError(
        archived
          ? "Failed to archive the application. Please try again."
          : "Failed to restore the application. Please try again."
      )
    }
  }

  const handleBulkStatusChange = async (status: ApplicationStatus) => {
    const ids = Array.from(selectedIds)
    setBulkLoading(true)
    try {
      await updateApplicationsStatus(ids, status)
      setApplications((apps) =>
        apps.map((a) => (selectedIds.has(a.id) ? { ...a, status } : a))
      )
      setSelectedIds(new Set())
    } catch (error) {
      console.error("Bulk status update failed:", error)
      setDeleteError("Failed to update status for the selected applications.")
    } finally {
      setBulkLoading(false)
    }
  }

  const filteredApplications = applications
    .filter((app) => {
      const matchesSearch =
        app.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (app.company && app.company.toLowerCase().includes(searchQuery.toLowerCase()))
      // Archive tab shows only archived; every other tab excludes archived
      // so the active pipeline stays uncluttered.
      if (selectedStatus === "archive") {
        return matchesSearch && app.archived
      }
      if (app.archived) return false
      const matchesStatus = selectedStatus === "all" || app.status === selectedStatus
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      if (sortBy === "deadline") {
        const da = daysUntilDeadline(a.deadline)
        const db = daysUntilDeadline(b.deadline)
        if (da === null && db === null) return 0
        if (da === null) return 1
        if (db === null) return -1
        return da - db
      }
      const priorityOrder = { high: 0, medium: 1, low: 2 } as const
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })

  const filterCounts: Record<string, number> = FILTERS.reduce(
    (acc, f) => {
      acc[f.value] =
        f.value === "all"
          ? applications.filter((a) => !a.archived).length
          : f.value === "archive"
            ? applications.filter((a) => a.archived).length
            : applications.filter((a) => !a.archived && a.status === f.value).length
      return acc
    },
    {} as Record<string, number>
  )

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Applications
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage and track every job and scholarship application.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/apply"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3.5 text-[13px] font-medium text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Apply Kit
            </Link>
            <Button
              className="h-9 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_rgba(24,187,112,0.5)] hover:bg-primary hover:shadow-[0_6px_20px_-4px_rgba(24,187,112,0.65)]"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.5} />
              New application
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-border/70 bg-card p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
              <input
                type="search"
                placeholder="Search by title or company…"
                className="h-9 w-full rounded-lg border border-transparent bg-muted/50 pl-9 pr-3 text-sm text-foreground transition-all placeholder:text-muted-foreground focus-visible:border-primary/40 focus-visible:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground/70">Sort</span>
              <select
                className="h-9 rounded-lg border border-border/80 bg-card px-2.5 text-[13px] font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                aria-label="Sort applications"
              >
                <option value="newest">Newest first</option>
                <option value="deadline">Deadline (soonest)</option>
                <option value="priority">Priority (high first)</option>
              </select>
            </div>
          </div>

          {/* Status chips */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-3">
            {FILTERS.map((f) => {
              const active = selectedStatus === f.value
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setSelectedStatus(f.value)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-all duration-150",
                    active
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  {f.value === "archive" && <Archive className="h-3 w-3" />}
                  {f.label}
                  <span className={cn("text-[11px]", active ? "opacity-60" : "opacity-50")}>
                    {filterCounts[f.value] ?? 0}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Bulk Action Toolbar */}
        <BulkActionToolbar
          selectedCount={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          onDelete={() => setBulkDeleteConfirmOpen(true)}
          onStatusChange={handleBulkStatusChange}
          disabled={bulkLoading}
        />

        {/* Select-all toggle */}
        {filteredApplications.length > 0 && selectedIds.size > 0 && (
          <div className="flex items-center gap-2 px-1">
            <Checkbox
              checked={selectedIds.size === filteredApplications.length}
              indeterminate={selectedIds.size < filteredApplications.length}
              onChange={toggleSelectAll}
              aria-label="Select all applications"
            />
            <span className="text-xs text-muted-foreground">
              {selectedIds.size} of {filteredApplications.length} selected
            </span>
          </div>
        )}

        {/* Applications list */}
        {filteredApplications.length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-card p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
              <Briefcase className="h-6 w-6 text-primary-strong dark:text-primary" />
            </div>
            <h3 className="font-display text-base font-bold tracking-tight text-foreground">
              {emptyStateText(searchQuery, selectedStatus).title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {emptyStateText(searchQuery, selectedStatus).body}
            </p>
            {(selectedStatus === "all" || selectedStatus === "archive") && !searchQuery && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_rgba(24,187,112,0.5)] transition-all duration-200 hover:-translate-y-0.5"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Add your first application
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredApplications.map((app, index) => (
              <motion.div
                key={app.id}
                initial={index < 12 ? { opacity: 0, y: 14 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.03, ease: [0.22, 1, 0.36, 1] }}
              >
                <div
                  className={cn(
                    "group rounded-2xl border bg-card p-3.5 transition-all duration-200 sm:p-4",
                    selectedIds.has(app.id)
                      ? "border-primary/50 bg-primary/[0.04]"
                      : "border-border/70 hover:border-primary/30"
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className={cn(
                          "shrink-0 transition-opacity duration-150",
                          selectedIds.size > 0
                            ? "opacity-100"
                            : "opacity-0 focus-within:opacity-100 group-hover:opacity-100"
                        )}
                      >
                        <Checkbox
                          checked={selectedIds.has(app.id)}
                          onChange={() => toggleSelect(app.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${app.title}`}
                        />
                      </div>

                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary-strong dark:text-primary">
                        {initialsFor(app)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/applications/${app.id}`}
                            className="truncate text-[15px] font-semibold text-foreground transition-colors hover:text-primary-strong dark:hover:text-primary"
                          >
                            {app.title}
                          </Link>
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${priorityDot[app.priority]}`}
                            title={`${app.priority} priority`}
                          />
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {app.company && <span className="truncate">{app.company}</span>}
                          <span className="capitalize">{app.type}</span>
                          {(() => {
                            const days = daysUntilDeadline(app.deadline)
                            const tier = urgencyTier(days)
                            const isPill =
                              tier === "overdue" || tier === "critical" || tier === "soon"
                            return (
                              <span
                                className={cn(
                                  "flex items-center gap-1.5",
                                  isPill && "rounded border px-1.5 py-0.5 font-medium",
                                  isPill && urgencyClass[tier]
                                )}
                              >
                                <Calendar className="h-3.5 w-3.5" />
                                <span>
                                  {urgencyLabel(days)}
                                  {app.deadline && tier !== "later" && (
                                    <span className="ml-1 opacity-70">
                                      · {new Date(app.deadline).toLocaleDateString()}
                                    </span>
                                  )}
                                  {app.deadline && tier === "later" && (
                                    <span className="ml-1">
                                      ({new Date(app.deadline).toLocaleDateString()})
                                    </span>
                                  )}
                                </span>
                              </span>
                            )
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                          statusChip[app.status].cls
                        )}
                      >
                        {statusChip[app.status].label}
                      </span>

                      {app.url && (
                        <a
                          href={app.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hidden items-center gap-1 text-xs font-medium text-primary-strong transition-opacity hover:opacity-75 md:flex dark:text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span>Posting</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}

                      <div className="flex items-center gap-0.5 opacity-60 transition-opacity duration-150 group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="h-8 w-8"
                        >
                          <Link href={`/applications/${app.id}`} aria-label={`Open ${app.title}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleArchiveToggle(app.id, !app.archived)}
                          aria-label={app.archived ? `Restore ${app.title}` : `Archive ${app.title}`}
                          title={app.archived ? "Restore to active" : "Archive"}
                        >
                          {app.archived ? (
                            <ArchiveRestore className="h-4 w-4" />
                          ) : (
                            <Archive className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDeleteClick(app.id)}
                          aria-label={`Delete ${app.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add Application Modal */}
      <AddApplicationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchApplications}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Delete Application?"
        description="This action cannot be undone. Are you sure you want to delete this application?"
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isLoading={deleteLoading}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={bulkDeleteConfirmOpen}
        title={`Delete ${selectedIds.size} application${selectedIds.size !== 1 ? "s" : ""}?`}
        description="This action cannot be undone."
        confirmText="Delete all"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkDeleteConfirmOpen(false)}
        isLoading={bulkLoading}
      />

      {/* Delete Error Modal */}
      <AlertModal
        isOpen={!!deleteError}
        title="Error"
        message={deleteError || ""}
        type="error"
        onClose={() => setDeleteError(null)}
      />
    </DashboardLayout>
  )
}
