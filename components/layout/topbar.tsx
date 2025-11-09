"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Search, Menu } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/AuthContext"
import { getNotifications } from "@/lib/services/notifications"

interface TopBarProps {
  onMenuClick?: () => void
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState<number>(0)

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

  const name =
    (user?.user_metadata && (user.user_metadata.name || user.user_metadata.full_name)) ||
    user?.email?.split("@")[0] ||
    "User"

  const email = user?.email || ""

  const initials = name
    .split(" ")
    .filter((part: string) => Boolean(part))
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join("") || "U"

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-4 sm:px-6 md:px-8 gap-4">
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden flex-shrink-0"
        onClick={onMenuClick}
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Search Bar - Hidden on mobile, shown on tablet and up */}
      <div className="hidden sm:flex flex-1 max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search applications, documents..."
            className="pl-10 text-sm"
          />
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
        {/* Notifications Bell */}
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => router.push("/notifications")}
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] rounded-full p-0 flex items-center justify-center text-[0.6rem]"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>

        {/* User Profile Section - Hidden on small mobile, shown on larger screens */}
        <div className="hidden sm:flex items-center gap-2 md:gap-3">
          <div className="text-right">
            <p className="text-sm font-medium truncate max-w-[100px] md:max-w-[140px]">
              {name}
            </p>
            {email && (
              <p className="text-xs text-muted-foreground truncate max-w-[100px] md:max-w-[160px]">
                {email}
              </p>
            )}
          </div>
          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <span className="text-sm font-bold text-primary-foreground">
              {initials}
            </span>
          </div>
        </div>

        {/* Avatar Only on Small Mobile */}
        <div className="sm:hidden h-10 w-10 flex-shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
          <span className="text-sm font-bold text-primary-foreground">
            {initials}
          </span>
        </div>
      </div>
    </header>
  )
}
