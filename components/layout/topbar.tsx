"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Bell, Search, Menu, FileText, Briefcase, X, Loader2 } from "lucide-react"
import { Input } from "@/shared/ui/input"
import { Button } from "@/shared/ui/button"
import { Badge } from "@/shared/ui/badge"
import { useAuth } from "@/contexts/AuthContext"
import { getNotifications } from "@/lib/services/notifications"
import { getApplications } from "@/modules/applications/services/application.service"
import { getDocuments } from "@/modules/documents/services/document.service"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/shared/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"

interface TopBarProps {
  onMenuClick?: () => void
}

type SearchResult = {
  id: string
  title: string
  subtitle?: string
  type: "application" | "document"
  href: string
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState<number>(0)

  // Search state
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const notifications = await getNotifications()
        const unread = notifications.filter((n) => !n.is_read).length
        setUnreadCount(unread)
      } catch (error) {
        // Fail silently; do not break top bar if notifications fail
        console.error("Error loading notifications:", error)
      }
    }

    if (user) {
      void loadNotifications()
    } else {
      setUnreadCount(0)
    }
  }, [user])

  // ⌘K / Ctrl+K focuses search
  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }
    document.addEventListener("keydown", handleShortcut)
    return () => document.removeEventListener("keydown", handleShortcut)
  }, [])

  // Handle search logic
  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([])
        setShowResults(false)
        return
      }

      setIsSearching(true)
      try {
        const [apps, docs] = await Promise.all([getApplications(), getDocuments()])

        const filteredApps: SearchResult[] = apps
          .filter(
            (app) =>
              app.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              app.company?.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map((app) => ({
            id: app.id,
            title: app.title,
            subtitle: app.company ?? undefined,
            type: "application",
            href: `/applications/${app.id}`,
          }))

        const filteredDocs: SearchResult[] = docs
          .filter((doc) => doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()))
          .map((doc) => ({
            id: doc.id,
            title: doc.file_name,
            type: "document",
            href: `/documents/${doc.id}`,
          }))

        const combined = [...filteredApps, ...filteredDocs].slice(0, 8)
        setSearchResults(combined)
        setShowResults(combined.length > 0)
        setSelectedIndex(-1)
      } catch (error) {
        console.error("Search error:", error)
      } finally {
        setIsSearching(false)
      }
    }

    const timer = setTimeout(performSearch, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : prev))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault()
      const selected = searchResults[selectedIndex]
      router.push(selected.href)
      setShowResults(false)
      setSearchQuery("")
    } else if (e.key === "Escape") {
      setShowResults(false)
    }
  }

  const name =
    (user?.user_metadata &&
      (user.user_metadata.name || user.user_metadata.full_name)) ||
    user?.email?.split("@")[0] ||
    "User"

  const email = user?.email || ""

  const initials =
    name
      .split(" ")
      .filter((part: string) => Boolean(part))
      .slice(0, 2)
      .map((part: string) => part[0]?.toUpperCase())
      .join("") || "U"

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl sm:px-6 md:px-8">
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 flex-shrink-0 md:hidden"
        onClick={onMenuClick}
        aria-label="Toggle menu"
      >
        <Menu className="h-[18px] w-[18px]" />
      </Button>

      {/* Search Bar */}
      <div className="relative hidden flex-1 sm:block" ref={searchRef}>
        <div className="relative mx-auto w-full max-w-lg">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-foreground/70" />
          <Input
            ref={searchInputRef}
            type="search"
            placeholder="Search applications, documents…"
            className="h-9 rounded-lg border-transparent bg-muted/50 pl-9 pr-14 text-sm transition-all focus-visible:border-primary/40 focus-visible:bg-card focus-visible:ring-primary/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() =>
              searchQuery.length >= 2 && searchResults.length > 0 && setShowResults(true)
            }
            onKeyDown={handleKeyDown}
          />

          {/* Right cluster: kbd hint / loader / clear */}
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            {isSearching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : searchQuery ? (
              <button
                onClick={() => {
                  setSearchQuery("")
                  searchInputRef.current?.focus()
                }}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="hidden rounded border border-border/70 bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70 lg:block">
                ⌘K
              </kbd>
            )}
          </div>
        </div>

        {/* Search Results Dropdown */}
        <AnimatePresence>
          {showResults && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.99 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[400px] overflow-y-auto rounded-xl border border-border/70 bg-card p-1.5 shadow-2xl"
            >
              {searchResults.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => {
                    router.push(result.href)
                    setShowResults(false)
                    setSearchQuery("")
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors",
                    selectedIndex === index ? "bg-primary/10" : "hover:bg-muted/60"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      result.type === "application"
                        ? "bg-primary/10 text-primary-strong dark:text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {result.type === "application" ? (
                      <Briefcase className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {result.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {result.subtitle || result.type}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                    {result.type}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right Side Actions */}
      <div className="flex flex-shrink-0 items-center gap-1.5 md:gap-3">
        <ThemeToggle />

        {/* Notifications Bell */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          onClick={() => router.push("/notifications")}
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full p-0 text-[10px] font-bold"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>

        <div className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />

        {/* User chip */}
        <button
          type="button"
          onClick={() => router.push("/profile")}
          className="group flex items-center gap-2.5 rounded-lg p-1 pr-2 transition-colors hover:bg-secondary/60"
          aria-label="Open profile"
        >
          <span className="hidden text-right sm:block">
            <span className="block max-w-[120px] truncate text-[13px] font-semibold leading-tight text-foreground md:max-w-[140px]">
              {name}
            </span>
            {email && (
              <span className="block max-w-[120px] truncate text-[11px] leading-tight text-muted-foreground md:max-w-[150px]">
                {email}
              </span>
            )}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 shadow-sm shadow-primary/20">
            <span className="text-xs font-bold text-primary-foreground">{initials}</span>
          </span>
        </button>
      </div>
    </header>
  )
}
