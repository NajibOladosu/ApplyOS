"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Check,
  Info,
  LayoutDashboard,
  Loader2,
  MailCheck,
  Mic,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { Input } from "@/shared/ui/input"
import type { getPasswordStrength } from "@/lib/password-security"

type PasswordStrength = NonNullable<ReturnType<typeof getPasswordStrength>>

const EASE = [0.22, 1, 0.36, 1] as const

/* ------------------------------------------------------------------ */
/* Brand panel (left, always dark)                                     */
/* ------------------------------------------------------------------ */

const BRAND_POINTS: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: Sparkles,
    title: "AI answers, grounded in your resume",
    text: "Paste a posting, get every question drafted in first person — never invented.",
  },
  {
    icon: LayoutDashboard,
    title: "Pipeline tracking that never sleeps",
    text: "Statuses, deadlines and follow-ups in one board, with email nudges at 7, 3 & 1 days.",
  },
  {
    icon: Mic,
    title: "Practice out loud",
    text: "Live AI interviews scoring clarity, structure, depth and confidence in real time.",
  },
]

function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-[#0A0A0A] lg:flex lg:flex-col">
      {/* Grid pattern */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_80%_70%_at_30%_20%,black_40%,transparent_100%)]"
      />
      {/* Glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-primary/15 blur-[140px]"
      />

      <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
        <Link href="/" className="flex items-center gap-2.5" aria-label="ApplyOS home">
          <Image
            src="/ApplyOS%20Logo.webp"
            alt=""
            width={1073}
            height={1000}
            className="h-7 w-auto"
          />
          <span className="font-display text-lg font-bold tracking-tight text-white">
            <span className="text-primary-neon">Apply</span>OS
          </span>
        </Link>

        <div className="max-w-md">
          <h2 className="font-display text-3xl font-bold leading-[1.12] tracking-[-0.025em] text-white xl:text-4xl">
            Your job search,
            <span className="block bg-gradient-to-r from-primary-neon to-teal-300 bg-clip-text text-transparent">
              on autopilot.
            </span>
          </h2>

          <ul className="mt-10 space-y-6">
            {BRAND_POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <Icon className="h-4 w-4 text-primary-neon" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{title}</span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-white/60">
                    {text}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/50">
          <ShieldCheck className="h-3.5 w-3.5 text-primary-neon/70" />
          Row-level data isolation · Your data stays yours
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

const rise = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
}

export function AuthShell({
  title,
  subtitle,
  backTo,
  children,
  className,
}: {
  title: string
  subtitle: string
  backTo?: { href: string; label: string }
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className="icons-outline grid min-h-screen grid-cols-1 bg-background lg:grid-cols-2">
      <BrandPanel />

      <div className="flex flex-col px-6 py-10 sm:px-10">
        {/* Mobile brand header */}
        <div className="flex justify-center lg:hidden">
          <Link href="/" className="flex items-center gap-2.5" aria-label="ApplyOS home">
            <Image
              src="/ApplyOS%20Logo.webp"
              alt=""
              width={1073}
              height={1000}
              className="h-7 w-auto"
            />
            <span className="font-display text-lg font-bold tracking-tight text-foreground">
              <span className="text-primary-strong dark:text-primary">Apply</span>OS
            </span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className={cn("w-full max-w-[400px]", className)}
          >
            <motion.div variants={rise}>
              {backTo && (
                <Link
                  href={backTo.href}
                  className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  ← {backTo.label}
                </Link>
              )}
              <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-foreground">
                {title}
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
            </motion.div>

            <motion.div variants={rise} className="mt-8">
              {children}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Form primitives                                                     */
/* ------------------------------------------------------------------ */

export function AuthField({
  id,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  required,
  minLength,
  autoComplete,
  hint,
}: {
  id: string
  label: string
  type?: string
  placeholder?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  required?: boolean
  minLength?: number
  autoComplete?: string
  hint?: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-foreground">
        {label}
      </label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className="h-11 rounded-lg border-border/80 bg-card px-3.5 text-[15px] shadow-sm"
      />
      {hint}
    </div>
  )
}

export function FieldLabelRow({
  htmlFor,
  label,
  action,
}: {
  htmlFor: string
  label: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-foreground">
        {label}
      </label>
      {action}
    </div>
  )
}

export function AuthPrimaryButton({
  children,
  loading,
  disabled,
  type = "submit",
  onClick,
}: {
  children: React.ReactNode
  loading?: boolean
  disabled?: boolean
  type?: "submit" | "button"
  onClick?: () => void
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-[15px] font-semibold text-primary-foreground shadow-[0_6px_20px_-8px_rgba(24,187,112,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-8px_rgba(24,187,112,0.75)] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

export function AuthOutlineButton({
  children,
  asChild = false,
  href,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  asChild?: boolean
  href?: string
  disabled?: boolean
  onClick?: () => void
}) {
  const cls =
    "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border/80 bg-card text-[15px] font-medium text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 disabled:pointer-events-none disabled:opacity-60"
  if (asChild && href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  )
}

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77z"
      />
    </svg>
  )
}

export function AuthGoogleButton({
  onClick,
  disabled,
  loading,
}: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <AuthOutlineButton onClick={onClick} disabled={disabled}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleG />}
      Continue with Google
    </AuthOutlineButton>
  )
}

export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="relative" aria-hidden>
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border/70" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-background px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
          {label}
        </span>
      </div>
    </div>
  )
}

export function AuthAlert({
  tone,
  children,
}: {
  tone: "error" | "success"
  children: React.ReactNode
}) {
  const isError = tone === "error"
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: EASE }}
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-3 text-sm leading-relaxed",
        isError
          ? "border-destructive/20 bg-destructive/10 text-destructive"
          : "border-primary/25 bg-primary/10 text-primary-strong dark:text-primary"
      )}
    >
      {isError ? (
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
      )}
      <span className={isError ? "text-destructive" : "text-foreground"}>{children}</span>
    </motion.div>
  )
}

export function AuthFooterNote({ children }: { children: React.ReactNode }) {
  return (
    <motion.p variants={rise} className="mt-6 text-center text-sm text-muted-foreground">
      {children}
    </motion.p>
  )
}

/* ------------------------------------------------------------------ */
/* Password strength (4-segment)                                       */
/* ------------------------------------------------------------------ */

const STRENGTH_COLORS = ["bg-destructive", "bg-amber-500", "bg-lime-500", "bg-primary"]
const STRENGTH_TEXT = [
  "text-destructive",
  "text-amber-600 dark:text-amber-400",
  "text-lime-600 dark:text-lime-400",
  "text-primary-strong dark:text-primary",
]

export function PasswordStrengthBar({ strength }: { strength: PasswordStrength | null }) {
  if (!strength) return null
  const idx = Math.max(0, Math.min(3, strength.score))
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300",
              i <= idx ? STRENGTH_COLORS[idx] : "bg-muted"
            )}
          />
        ))}
        <span className={cn("ml-1 w-14 text-right text-xs font-medium", STRENGTH_TEXT[idx])}>
          {strength.label}
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Status tiles (check-email / verified / reset success)               */
/* ------------------------------------------------------------------ */

export function StatusTile({
  icon: Icon,
  children,
  size = "md",
}: {
  icon: LucideIcon
  children?: React.ReactNode
  size?: "md" | "lg"
}) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={cn(
        "mx-auto flex items-center justify-center rounded-2xl border border-primary/25 bg-primary/10",
        size === "lg" ? "h-20 w-20" : "h-16 w-16"
      )}
    >
      <Icon className={cn("text-primary-strong dark:text-primary", size === "lg" ? "h-9 w-9" : "h-8 w-8")} />
      {children}
    </motion.div>
  )
}

export { MailCheck }
