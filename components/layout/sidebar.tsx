"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/shared/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import {
  Bell,
  BookOpen,
  Briefcase,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Mic,
  Settings,
  Upload,
  User,
  X,
  type LucideIcon,
} from "lucide-react"
import { motion } from "framer-motion"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/apply", label: "Apply Kit", icon: Briefcase },
      { href: "/applications", label: "Applications", icon: FileText },
      { href: "/interview", label: "Interview", icon: Mic },
    ],
  },
  {
    label: "Library",
    items: [
      { href: "/documents", label: "Documents", icon: FolderOpen },
      { href: "/upload", label: "Upload", icon: Upload },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/resources", label: "Resources", icon: BookOpen },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/profile", label: "Profile", icon: User },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()

  const name: string =
    (user?.user_metadata &&
      (user.user_metadata.name || user.user_metadata.full_name)) ||
    user?.email?.split("@")[0] ||
    "User"
  const email = user?.email || ""
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"

  const handleLogout = async () => {
    await signOut()
    router.push("/auth/login")
  }

  const handleNavClick = () => {
    onClose?.()
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -256 }}
        animate={{ x: isOpen ? 0 : -256 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border/70 bg-card md:static md:transform-none md:translate-x-0 md:z-auto"
      >
        {/* Logo */}
        <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border/60 px-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5"
            onClick={handleNavClick}
            aria-label="ApplyOS dashboard"
          >
            <Image
              src="/ApplyOS%20Logo.webp"
              alt=""
              width={1073}
              height={1000}
              className="h-6 w-auto"
            />
            <span className="font-display text-[17px] font-bold tracking-tight text-foreground">
              <span className="text-primary-strong dark:text-primary">Apply</span>OS
            </span>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-6 overflow-y-auto p-4 min-h-0">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/")

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleNavClick}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors duration-150",
                        isActive
                          ? "bg-primary/10 text-primary-strong dark:text-primary"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                      )}
                    >
                      {isActive ? (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
                        />
                      ) : null}
                      <Icon
                        className={cn(
                          "h-[17px] w-[17px] shrink-0 transition-transform duration-200 group-hover:scale-105",
                          isActive
                            ? "text-primary-strong dark:text-primary"
                            : "text-muted-foreground/80 group-hover:text-foreground"
                        )}
                      />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer: feedback + user card */}
        <div className="flex-shrink-0 space-y-3 border-t border-border/60 p-4">
          <Link
            href="/feedback"
            onClick={handleNavClick}
            className="flex items-center gap-2 px-3 text-xs font-medium text-muted-foreground/70 transition-colors hover:text-foreground"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Send feedback
          </Link>

          <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60">
              <span className="text-xs font-bold text-primary-foreground">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-foreground">{name}</p>
              {email && (
                <p className="truncate text-[11px] text-muted-foreground">{email}</p>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  )
}
