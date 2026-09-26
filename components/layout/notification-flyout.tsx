"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bell,
  BellOff,
  CheckCheck,
  Calendar,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import {
  getRecentNotifications,
  markAsRead,
  markAllAsRead,
} from "@/lib/services/notifications"
import type { Notification } from "@/types/database"

const typeConfig = {
  deadline: { icon: Calendar, tone: "bg-destructive/10 text-destructive", label: "Deadline" },
  status_update: { icon: TrendingUp, tone: "bg-primary/10 text-primary-strong dark:text-primary", label: "Status" },
  success: { icon: CheckCircle2, tone: "bg-primary/10 text-primary-strong dark:text-primary", label: "Done" },
  info: { icon: Bell, tone: "bg-muted text-muted-foreground", label: "Info" },
  warning: { icon: AlertCircle, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400", label: "Warning" },
  error: { icon: AlertCircle, tone: "bg-destructive/10 text-destructive", label: "Error" },
} as const

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

/** Group by day so 30 days of activity stays scannable. */
function dayBucket(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (sameDay(d, today)) return "Today"
  if (sameDay(d, yesterday)) return "Yesterday"
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}

interface NotificationFlyoutProps {
  open: boolean
  onClose: () => void
}

/**
 * The notifications surface. Opens from the top-bar bell and shows the
 * last 30 days of activity, grouped by day. The old /notifications page was
 * a full-width list of everything ever — the flyout keeps the scope honest.
 */
export function NotificationFlyout({ open, onClose }: NotificationFlyoutProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Fetch when the flyout opens, so the badge and the list stay in sync.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const items = await getRecentNotifications(30)
        if (!cancelled) setNotifications(items)
      } catch (err) {
        console.error("Error loading notifications:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [open])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const grouped = useMemo(() => {
    const map = new Map<string, Notification[]>()
    for (const n of notifications) {
      const key = dayBucket(n.created_at)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(n)
    }
    return Array.from(map.entries())
  }, [notifications])

  const handleMarkAsRead = async (notification: Notification) => {
    if (notification.is_read) return
    // Optimistic — the dot disappears immediately, the write follows.
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
    )
    try {
      await markAsRead(notification.id)
    } catch (err) {
      console.error("Error marking notification as read:", err)
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: false } : n))
      )
    }
  }

  const handleMarkAll = async () => {
    if (unreadCount === 0) return
    setMarkingAll(true)
    try {
      await markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch (err) {
      console.error("Error marking all as read:", err)
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <>
      {/* Click-away backdrop — keeps the bell area interactive everywhere */}
      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            aria-label="Close notifications"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onMouseDown={onClose}
            className="fixed inset-0 z-40 cursor-default"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute right-0 top-[calc(100%+10px)] z-50 flex w-[380px] max-w-[calc(100vw-2rem)] origin-top-right flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl shadow-black/10"
            role="dialog"
            aria-label="Notifications"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
              <div className="min-w-0">
                <p className="font-display text-[14px] font-bold tracking-tight text-foreground">
                  Notifications
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Activity from the last 30 days
                </p>
              </div>
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={markingAll || unreadCount === 0}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                {markingAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" />
                )}
                Mark all read
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[440px] overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div className="flex items-center justify-center py-14">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
                    <BellOff className="h-5 w-5 text-primary-strong dark:text-primary" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">You&apos;re all caught up</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Deadlines, status changes and analysis results land here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {grouped.map(([day, items]) => (
                    <section key={day}>
                      <div className="flex items-center gap-3 bg-muted/30 px-4 py-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                          {day}
                        </span>
                        <span className="h-px flex-1 bg-border/60" />
                        <span className="text-[10px] tabular-nums text-muted-foreground/60">
                          {items.length}
                        </span>
                      </div>
                      <ul>
                        {items.map((notification) => {
                          const config =
                            typeConfig[notification.type as keyof typeof typeConfig] ?? typeConfig.info
                          const Icon = config.icon
                          const unread = !notification.is_read

                          return (
                            <li key={notification.id}>
                              <button
                                type="button"
                                onClick={() => handleMarkAsRead(notification)}
                                className={cn(
                                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                                  unread && "bg-primary/[0.04]"
                                )}
                              >
                                <span
                                  className={cn(
                                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                                    config.tone
                                  )}
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-start gap-2">
                                    <span
                                      className={cn(
                                        "text-[13px] leading-snug",
                                        unread
                                          ? "font-semibold text-foreground"
                                          : "text-muted-foreground"
                                      )}
                                    >
                                      {notification.message}
                                    </span>
                                    {unread ? (
                                      <span
                                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                                        aria-label="Unread"
                                      />
                                    ) : null}
                                  </span>
                                  <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                                    <span className="font-medium uppercase tracking-[0.08em]">
                                      {config.label}
                                    </span>
                                    <span aria-hidden>·</span>
                                    <span title={new Date(notification.created_at).toLocaleString()}>
                                      {relativeTime(notification.created_at)}
                                    </span>
                                  </span>
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
