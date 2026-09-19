"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { motion } from "framer-motion"
import {
  Bell,
  CheckCheck,
  Calendar,
  TrendingUp,
  AlertCircle,
  Loader2,
} from "lucide-react"
import type { Notification } from "@/types/database"
import {
  getNotifications,
  markAllAsRead,
  markAsRead,
} from "@/lib/services/notifications"
import { AlertModal } from "@/components/modals/alert-modal"
import Link from "next/link"
import { ArrowRight, Inbox } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/data/empty-state"

const typeConfig = {
  deadline: { icon: Calendar, tone: "bg-destructive/10 text-destructive", label: "Deadline" },
  status_update: { icon: TrendingUp, tone: "bg-primary/10 text-primary-strong dark:text-primary", label: "Status" },
  success: { icon: CheckCheck, tone: "bg-primary/10 text-primary-strong dark:text-primary", label: "Done" },
  info: { icon: Bell, tone: "bg-muted text-muted-foreground", label: "Info" },
  warning: { icon: AlertCircle, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400", label: "Warning" },
  error: { icon: AlertCircle, tone: "bg-destructive/10 text-destructive", label: "Error" },
}

/** Relative time reads faster than a full timestamp for anything recent. */
function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

/** Group by day so a long history is scannable. */
function dayBucket(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (sameDay(d, today)) return "Today"
  if (sameDay(d, yesterday)) return "Yesterday"
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [markReadError, setMarkReadError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const items = await getNotifications()
        setNotifications(items)
      } catch (err) {
        console.error("Error loading notifications:", err)
        setError("Unable to load notifications. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const unreadCount = notifications.filter((n) => !n.is_read).length
  const visible = showUnreadOnly ? notifications.filter((n) => !n.is_read) : notifications

  // day-grouped view model
  const grouped = visible.reduce<Record<string, Notification[]>>((acc, n) => {
    const key = dayBucket(n.created_at)
    ;(acc[key] ??= []).push(n)
    return acc
  }, {})

  const handleMarkAllAsRead = async () => {
    if (notifications.length === 0 || unreadCount === 0) return
    setUpdating(true)
    try {
      await markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch (err) {
      console.error("Error marking all as read:", err)
      setMarkReadError("Failed to mark notifications as read.")
    } finally {
      setUpdating(false)
    }
  }

  const handleMarkAsRead = async (notification: Notification) => {
    if (notification.is_read) return
    try {
      await markAsRead(notification.id)
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, is_read: true } : n
        )
      )
    } catch (err) {
      console.error("Error marking notification as read:", err)
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          overline="Activity"
          title="Notifications"
          description={
            notifications.length === 0
              ? "Deadlines, status changes and analysis results land here."
              : unreadCount > 0
                ? `${unreadCount} unread of ${notifications.length}`
                : `All ${notifications.length} read`
          }
          actions={
            <>
              <button
                onClick={() => setShowUnreadOnly((v) => !v)}
                className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-[13px] font-medium transition-colors ${
                  showUnreadOnly
                    ? "border-primary/40 bg-primary/10 text-primary-strong dark:text-primary"
                    : "border-border/80 bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                Unread only
                <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{unreadCount}</span>
              </button>
              <Button
                variant="outline"
                onClick={handleMarkAllAsRead}
                disabled={updating || unreadCount === 0}
                className="h-9 rounded-lg border-border/80 bg-card"
              >
                {updating ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Updating…
                  </>
                ) : (
                  <>
                    <CheckCheck className="mr-2 h-3.5 w-3.5" />
                    Mark all read
                  </>
                )}
              </Button>
            </>
          }
        />

        {notifications.length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-card">
            <EmptyState
              variant="page"
              icon={<Bell className="h-5 w-5" />}
              title="You're all caught up"
              description="Deadline reminders, status changes and analysis results will show up here as they happen."
            />
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([day, items]) => (
              <section key={day}>
                <div className="mb-2 flex items-center gap-3">
                  <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                    {day}
                  </h2>
                  <span className="h-px flex-1 bg-border/60" />
                  <span className="text-[11px] tabular-nums text-muted-foreground/60">{items.length}</span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                  <ul className="divide-y divide-border/50">
                    {items.map((notification, index) => {
                      const config = typeConfig[notification.type as keyof typeof typeConfig] ?? typeConfig.info
                      const Icon = config.icon
                      const unread = !notification.is_read

                      return (
                        <motion.li
                          key={notification.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.2) }}
                        >
                          <button
                            onClick={() => handleMarkAsRead(notification)}
                            className={`flex w-full items-start gap-3.5 px-5 py-4 text-left transition-colors hover:bg-muted/40 ${
                              unread ? "bg-primary/[0.03]" : ""
                            }`}
                          >
                            <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${config.tone}`}>
                              <Icon className="h-4 w-4" />
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="flex items-start gap-2">
                                <span
                                  className={`text-[13.5px] leading-snug ${
                                    unread ? "font-semibold text-foreground" : "text-muted-foreground"
                                  }`}
                                >
                                  {notification.message}
                                </span>
                                {unread ? (
                                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                                ) : null}
                              </span>
                              <span className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground/80">
                                <span className="font-medium uppercase tracking-[0.08em]">{config.label}</span>
                                <span>·</span>
                                <span title={new Date(notification.created_at).toLocaleString()}>
                                  {relativeTime(notification.created_at)}
                                </span>
                              </span>
                            </span>
                          </button>
                        </motion.li>
                      )
                    })}
                  </ul>
                </div>
              </section>
            ))}

            {visible.length === 0 ? (
              <div className="rounded-2xl border border-border/70 bg-card">
                <EmptyState
                  icon={<CheckCheck className="h-5 w-5" />}
                  title="Nothing unread"
                  description="You've read everything here. Switch the filter off to see the full history."
                />
              </div>
            ) : null}

            {/* The old "Info Center" tile sat inside the list and read as a
                notification. It is a navigation affordance, so it now reads
                like one. */}
            <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Inbox className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[13.5px] font-semibold text-foreground">Looking for delivery preferences?</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Choose which alerts reach your inbox in Settings.
                  </p>
                </div>
              </div>
              <Link
                href="/settings"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3.5 text-[13px] font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary-strong dark:hover:text-primary"
              >
                Notification settings
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {/* Error Modal */}
        <AlertModal
          isOpen={!!markReadError}
          title="Error"
          message={markReadError || ""}
          type="error"
          onClose={() => setMarkReadError(null)}
        />
      </div>
    </DashboardLayout>
  )
}
