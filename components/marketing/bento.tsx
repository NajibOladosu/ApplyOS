"use client"

import * as React from "react"
import Link from "next/link"
import { useInView, useReducedMotion } from "framer-motion"
import {
  Brain,
  CalendarClock,
  Check,
  Chrome,
  Landmark,
  LayoutDashboard,
  Loader2,
  Mic,
  RefreshCw,
  ScrollText,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function BentoCard({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const ref = React.useRef<HTMLDivElement>(null)

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty("--bx", `${e.clientX - r.left}px`)
    el.style.setProperty("--by", `${e.clientY - r.top}px`)
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.25)]",
        className
      )}
    >
      {/* Cursor-tracked spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(280px circle at var(--bx, 50%) var(--by, 50%), rgba(24,187,112,0.10), transparent 65%)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}

function CardHead({
  icon: Icon,
  overline,
  title,
  description,
}: {
  icon: LucideIcon
  overline: string
  title: string
  description: string
}) {
  return (
    <>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary-strong transition-transform duration-300 group-hover:rotate-3 dark:text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-strong dark:text-primary">
        {overline}
      </p>
      <h3 className="mt-1.5 font-display text-lg font-bold tracking-tight text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Card A — AI Answer Engine (with question-list demo)                 */
/* ------------------------------------------------------------------ */

const QUESTION_ROWS = [
  { q: "Why do you want to work with us?", state: "drafted" as const },
  { q: "Describe a time you led a project end-to-end.", state: "drafted" as const },
  { q: "Where do you see yourself in five years?", state: "drafting" as const },
]

function EngineDemo() {
  return (
    <div className="mt-6 space-y-2">
      {QUESTION_ROWS.map((row) => (
        <div
          key={row.q}
          className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/60 p-3"
        >
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-foreground">
            {row.q}
          </span>
          {row.state === "drafted" ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary-strong dark:text-primary">
              <Check className="h-3 w-3" strokeWidth={3} />
              Drafted
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Drafting…
            </span>
          )}
        </div>
      ))}
      <Link
        href="/auth/signup"
        className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary-strong transition-colors hover:opacity-80 dark:text-primary"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Review drafts in the app →
      </Link>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Card B — Pipeline tracker (mini bars)                               */
/* ------------------------------------------------------------------ */

const PIPELINE_ROWS = [
  { label: "Draft", count: 3, pct: 25 },
  { label: "Submitted", count: 5, pct: 58 },
  { label: "In review", count: 2, pct: 25 },
  { label: "Interview", count: 1, pct: 12, pulse: true },
  { label: "Offer", count: 1, pct: 12 },
]

function PipelineDemo() {
  return (
    <div className="mt-6 space-y-3">
      {PIPELINE_ROWS.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              {row.pulse && (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              )}
              {row.label}
            </span>
            <span className="text-muted-foreground">{row.count}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/80"
              style={{ width: `${row.pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Card — ATS score (animated arc)                                     */
/* ------------------------------------------------------------------ */

function AtsArc({ score }: { score: number }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-40px" })
  const reduced = useReducedMotion()
  const R = 30
  const C = 2 * Math.PI * R
  const show = inView || reduced

  return (
    <div ref={ref} className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 72 72" className="h-16 w-16 -rotate-90">
        <circle cx="36" cy="36" r={R} fill="none" strokeWidth="7" className="stroke-muted" />
        <circle
          cx="36"
          cy="36"
          r={R}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={show ? C * (1 - score / 100) : C}
          className="stroke-primary"
          style={{
            transition: reduced
              ? "none"
              : "stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1) 0.15s",
          }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold text-foreground">
        {show ? score : "—"}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Grid                                                                */
/* ------------------------------------------------------------------ */

export function FeaturesBento() {
  return (
    <section id="features" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-strong dark:text-primary">
            Capabilities
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.025em] text-foreground md:text-4xl">
            Everything between &ldquo;found it&rdquo; and &ldquo;hired.&rdquo;
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            From parsing a posting to scoring your interview, every step runs on your data — not a
            template.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {/* A — AI Answer Engine */}
          <BentoCard className="sm:col-span-2 lg:col-span-4">
            <CardHead
              icon={Brain}
              overline="Core engine"
              title="AI answers, grounded in your resume"
              description="Paste a posting. ApplyOS extracts every question and drafts first-person answers using only the facts in your documents — never invented, never generic."
            />
            <EngineDemo />
          </BentoCard>

          {/* B — Pipeline tracker */}
          <BentoCard className="lg:col-span-2">
            <CardHead
              icon={LayoutDashboard}
              overline="Tracker"
              title="Your pipeline at a glance"
              description="Statuses, deadlines and follow-ups in one board — nothing slips between submitted and hired."
            />
            <PipelineDemo />
          </BentoCard>

          {/* ATS score */}
          <BentoCard className="lg:col-span-2">
            <div className="flex items-start gap-4">
              <AtsArc score={78} />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-strong dark:text-primary">
                  ATS
                </p>
                <h3 className="mt-1.5 font-display text-lg font-bold tracking-tight text-foreground">
                  Resume match, scored
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  See exactly which keywords are missing before the bots filter you out.
                </p>
              </div>
            </div>
          </BentoCard>

          {/* Voice interviews */}
          <BentoCard className="lg:col-span-2">
            <CardHead
              icon={Mic}
              overline="Practice"
              title="Rehearse out loud"
              description="Talk to an AI interviewer that scores clarity, structure, depth and confidence in real time."
            />
          </BentoCard>

          {/* Deadline radar */}
          <BentoCard className="lg:col-span-2">
            <CardHead
              icon={CalendarClock}
              overline="Alerts"
              title="Reminders that nudge"
              description="Email nudges at 7, 3 and 1 day before any deadline. You decide when to snooze — not the calendar."
            />
          </BentoCard>

          {/* Document intelligence */}
          <BentoCard className="lg:col-span-2">
            <CardHead
              icon={ScrollText}
              overline="Documents"
              title="Upload once, reuse everywhere"
              description="Resumes and transcripts parsed into structured data that powers every draft, answer and report."
            />
          </BentoCard>

          {/* Company prep */}
          <BentoCard className="lg:col-span-2">
            <CardHead
              icon={Landmark}
              overline="Prep"
              title="Know the room"
              description="Interview question banks and company context for the places you are actually applying to."
            />
          </BentoCard>

          {/* Chrome extension */}
          <BentoCard className="sm:col-span-2 lg:col-span-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-strong transition-transform duration-300 group-hover:rotate-3 dark:text-primary">
                <Chrome className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-strong dark:text-primary">
                  Browser extension
                </p>
                <h3 className="mt-1.5 font-display text-lg font-bold tracking-tight text-foreground">
                  Grab any posting with one click
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Extract questions, company and requirements straight from the job tab — no
                  copy-pasting into a spreadsheet.
                </p>
              </div>
              <a
                href="https://chromewebstore.google.com/detail/gikepikgajfppgebbgcikhocdeejandg"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 text-sm font-semibold text-primary-strong transition-all duration-200 hover:bg-primary hover:text-primary-foreground dark:text-primary"
              >
                <Chrome className="h-4 w-4" />
                Add to Chrome
              </a>
            </div>
          </BentoCard>
        </div>
      </div>
    </section>
  )
}
