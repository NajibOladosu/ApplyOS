"use client"

import * as React from "react"
import Link from "next/link"
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion"
import { ArrowRight, Check, Clock, Play, Sparkles } from "lucide-react"

const EASE = [0.22, 1, 0.36, 1] as const

const DRAFTS = [
  {
    q: "Why do you want to work with us?",
    a: "I've spent the last three years building design systems at scale, and your team's platform-first approach to UI is exactly the problem I want to solve next — with the stack I know best.",
  },
  {
    q: "Describe a technical challenge you solved.",
    a: "I led the migration of our component library to a token-based architecture, which cut UI regression bugs by 43% and cut new-feature build time roughly in half.",
  },
]

const APP_ROWS = [
  {
    initials: "LI",
    title: "Senior Frontend Engineer",
    company: "Linear",
    status: "In review",
    tone: "bg-primary/10 text-primary-strong dark:text-primary",
  },
  {
    initials: "ST",
    title: "Product Designer",
    company: "Stripe",
    status: "Interview",
    tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    initials: "VB",
    title: "Full-Stack Engineer",
    company: "Vercel",
    status: "Submitted",
    tone: "bg-muted text-muted-foreground",
  },
]

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
}

/** Cycles through sample Q/A pairs, typing the answer character by character. */
function useTypedAnswer(reduced: boolean) {
  const [index, setIndex] = React.useState(0)
  const [chars, setChars] = React.useState(0)

  React.useEffect(() => {
    if (reduced) {
      setChars(DRAFTS[0].a.length)
      return
    }
    const full = DRAFTS[index].a
    if (chars < full.length) {
      const t = window.setTimeout(() => setChars((c) => c + 1), 18)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => {
      setIndex((i) => (i + 1) % DRAFTS.length)
      setChars(0)
    }, 2400)
    return () => window.clearTimeout(t)
  }, [chars, index, reduced])

  const draft = DRAFTS[index]
  return {
    q: draft.q,
    text: reduced ? draft.a : draft.a.slice(0, chars),
    typing: !reduced && chars < draft.a.length,
  }
}

export function Hero() {
  const reduced = useReducedMotion()
  const typed = useTypedAnswer(!!reduced)

  const [finePointer, setFinePointer] = React.useState(false)
  React.useEffect(() => {
    setFinePointer(window.matchMedia("(pointer: fine)").matches)
  }, [])

  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)
  const springX = useSpring(rotateX, { stiffness: 120, damping: 20 })
  const springY = useSpring(rotateY, { stiffness: 120, damping: 20 })

  const parallax = finePointer && !reduced

  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!parallax) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    rotateY.set(x * 6)
    rotateX.set(-y * 6)
  }

  const onLeave = () => {
    rotateX.set(0)
    rotateY.set(0)
  }

  const float = (
    duration: number,
    delay: number
  ): React.CSSProperties | undefined =>
    reduced ? undefined : { animation: `hero-bob ${duration}s ease-in-out ${delay}s infinite` }

  return (
    <section
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="relative overflow-hidden pt-32 pb-20 lg:pt-44 lg:pb-28"
    >
      {/* Subtle blueprint grid, masked to the top of the viewport */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(113,113,122,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(113,113,122,0.07)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_0%,black_45%,transparent_100%)]"
      />
      {/* Ambient glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-[-10%] h-[480px] w-[480px] rounded-full bg-primary/10 blur-[140px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[-15%] top-1/2 h-[400px] w-[400px] rounded-full bg-teal-400/5 blur-[140px]"
      />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-6 lg:grid-cols-12 lg:gap-10">
        {/* Copy */}
        <motion.div
          variants={container}
          initial={reduced ? false : "hidden"}
          animate="show"
          className="lg:col-span-7"
        >
          <motion.div variants={item}>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary-strong dark:text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Live voice interviews are here
            </span>
          </motion.div>

          <motion.h1
            variants={item}
            className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-[-0.035em] text-foreground md:text-[64px]"
          >
            The operating system
            <span className="text-gradient block">for your job search.</span>
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
          >
            Paste a job URL. ApplyOS extracts every question, drafts grounded answers from your
            resume, and keeps your entire pipeline — deadlines, statuses, interviews — in one
            command center.
          </motion.p>

          <motion.div variants={item} className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/auth/signup"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-[15px] font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_rgba(24,187,112,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-8px_rgba(24,187,112,0.7)] active:scale-[0.98]"
            >
              Start applying — it&apos;s free
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center gap-2.5 rounded-lg border border-border bg-card/60 px-6 text-[15px] font-medium text-foreground transition-all duration-200 hover:border-primary/40 hover:text-primary-strong dark:hover:text-primary"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15">
                <Play className="h-2.5 w-2.5 fill-current" />
              </span>
              See how it works
            </a>
          </motion.div>

          <motion.div
            variants={item}
            className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-medium text-muted-foreground"
          >
            {["Free to start", "No credit card", "2-minute setup"].map((label) => (
              <span key={label} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-primary-strong dark:text-primary" strokeWidth={2.5} />
                {label}
              </span>
            ))}
          </motion.div>
        </motion.div>

        {/* Product mock */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.25 }}
          className="lg:col-span-5"
        >
          <motion.div
            style={parallax ? { rotateX: springX, rotateY: springY, transformStyle: "preserve-3d" } : undefined}
            className="relative will-change-transform"
          >
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_40px_100px_-40px_rgba(0,0,0,0.45)]">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-border" />
                <span className="h-2.5 w-2.5 rounded-full bg-border" />
                <span className="h-2.5 w-2.5 rounded-full bg-border" />
                <div className="mx-auto flex h-6 w-full max-w-[220px] items-center justify-center rounded-md bg-muted/80 text-[10px] font-medium tracking-wide text-muted-foreground">
                  applyos.io/applications
                </div>
              </div>

              {/* Pipeline */}
              <div className="space-y-2.5 p-4">
                <div className="flex items-center justify-between pb-1">
                  <span className="font-display text-[13px] font-bold tracking-tight text-foreground">
                    Pipeline
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary-strong dark:text-primary">
                    12 active
                  </span>
                </div>

                {APP_ROWS.map((row) => (
                  <div
                    key={row.title}
                    className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary-strong dark:text-primary">
                      {row.initials}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-semibold leading-tight text-foreground">
                        {row.title}
                      </span>
                      <span className="block text-[10.5px] text-muted-foreground">{row.company}</span>
                    </span>
                    <span
                      className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.tone}`}
                    >
                      {row.status}
                    </span>
                  </div>
                ))}

                {/* AI draft card */}
                <div className="rounded-lg border border-primary/25 bg-primary/[0.06] p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-strong dark:text-primary">
                    <Sparkles className="h-3 w-3" />
                    AI draft
                  </div>
                  <p className="mt-1 truncate text-[11px] font-medium text-foreground">{typed.q}</p>
                  <p className="mt-1.5 min-h-[76px] text-[11px] leading-relaxed text-muted-foreground">
                    {typed.text}
                    {typed.typing && (
                      <span className="ml-0.5 inline-block h-3 w-px translate-y-0.5 animate-pulse bg-primary" />
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Floating chips */}
            <div
              style={float(5.5, 0)}
              className="absolute -top-5 right-2 flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 py-2 shadow-lg lg:-right-6"
            >
              <Clock className="h-3.5 w-3.5 text-primary-strong dark:text-primary" />
              <span className="text-[11px] font-medium text-foreground">Deadline in 3 days</span>
            </div>
            <div
              style={float(6.5, 0.9)}
              className="absolute -bottom-4 left-2 flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 py-2 shadow-lg lg:-left-6"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15">
                <Check className="h-2.5 w-2.5 text-primary-strong dark:text-primary" strokeWidth={3} />
              </span>
              <span className="text-[11px] font-medium text-foreground">Question extracted</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
