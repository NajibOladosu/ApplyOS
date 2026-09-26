"use client"

import * as React from "react"
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion"
import { Check, CheckCircle2, Chrome, Loader2, Zap } from "lucide-react"

const EASE = [0.22, 1, 0.36, 1] as const

type Phase = "idle" | "scanning" | "done"

const QUESTIONS = [
  "Why do you want to work at Acme?",
  "Describe your experience with React performance.",
  "How do you handle conflicting priorities?",
  "What does success look like in the first 90 days?",
]

const POSTING_BARS = [
  "w-full",
  "w-11/12",
  "w-full",
  "w-4/5",
  "w-full",
  "w-3/5",
]

export function ExtensionSection() {
  const ref = React.useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: false, margin: "-25% 0px" })
  const reduced = useReducedMotion()
  const [phase, setPhase] = React.useState<Phase>("idle")

  React.useEffect(() => {
    if (!inView || reduced) return
    let t: number
    if (phase === "idle") t = window.setTimeout(() => setPhase("scanning"), 1400)
    else if (phase === "scanning") t = window.setTimeout(() => setPhase("done"), 1000)
    else t = window.setTimeout(() => setPhase("idle"), 3600)
    return () => window.clearTimeout(t)
  }, [inView, phase, reduced])

  // Reduced-motion users see the end state statically
  const effPhase: Phase = reduced ? "done" : phase

  return (
    <section id="extension" ref={ref} className="scroll-mt-20 py-24">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-6 lg:grid-cols-2 lg:gap-20">
        {/* Copy */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-strong dark:text-primary">
            Browser extension
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.025em] text-foreground md:text-4xl">
            Your job tab, on autopilot.
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
            One click extracts the questions, company and requirements from any job page — straight
            into your pipeline. No more copy-pasting into a spreadsheet.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="https://chromewebstore.google.com/detail/gikepikgajfppgebbgcikhocdeejandg"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_rgba(24,187,112,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_32px_-8px_rgba(24,187,112,0.7)] active:scale-[0.98]"
            >
              <Chrome className="h-4 w-4" />
              Add to Chrome
            </a>
            <span className="text-[13px] font-medium text-muted-foreground">
              Free · Works with any job board
            </span>
          </div>
        </div>

        {/* Browser mock */}
        <div className="relative">
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_32px_80px_-32px_rgba(0,0,0,0.4)]">
            {/* Chrome bar */}
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-border" />
              <span className="h-2.5 w-2.5 rounded-full bg-border" />
              <span className="h-2.5 w-2.5 rounded-full bg-border" />
              <div className="mx-auto flex h-6 w-full max-w-[240px] items-center justify-center rounded-md bg-muted/80 text-[10px] font-medium tracking-wide text-muted-foreground">
                acme.com/careers/fe-engineer
              </div>
            </div>

            {/* Page body */}
            <div className="relative min-h-[360px] p-5">
              {/* Skeleton job posting */}
              <div
                className={`transition-opacity duration-500 ${
                  effPhase === "done" ? "opacity-40" : "opacity-100"
                }`}
              >
                <div className="h-5 w-2/3 rounded-md bg-muted" />
                <div className="mt-2 h-3 w-1/3 rounded bg-muted/70" />
                <div className="mt-6 space-y-2">
                  {POSTING_BARS.map((w, i) => (
                    <div key={i} className={`h-2.5 rounded bg-muted/60 ${w}`} />
                  ))}
                </div>
                <div className="mt-7 inline-flex h-8 items-center rounded-md bg-foreground px-4 text-[11px] font-semibold text-background">
                  Apply now
                </div>
              </div>

              {/* Extract button */}
              <div className="absolute bottom-5 right-5">
                <div
                  className={`relative flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-xs font-semibold text-primary-foreground shadow-lg transition-transform duration-300 ${
                    phase === "scanning" ? "scale-[0.97]" : ""
                  }`}
                >
                  {phase === "idle" && !reduced && (
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-lg bg-primary"
                      style={{ animation: "hero-ping 2.4s cubic-bezier(0,0,0.2,1) infinite" }}
                    />
                  )}
                  <span className="relative">
                    {phase === "scanning" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Zap className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span className="relative">
                    {phase === "scanning" ? "Extracting…" : "Extract with ApplyOS"}
                  </span>
                </div>
              </div>

              {/* Extraction panel */}
              <AnimatePresence>
                {effPhase === "done" && (
                  <motion.div
                    initial={reduced ? false : { opacity: 0, x: 32 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="absolute inset-y-4 left-4 right-4 w-auto rounded-xl border border-border/80 bg-background/95 p-3.5 shadow-2xl backdrop-blur-sm sm:left-auto sm:w-[270px]"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-strong dark:text-primary">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      4 questions extracted
                    </div>
                    <div className="mt-2.5 space-y-1.5">
                      {QUESTIONS.map((q, i) => (
                        <motion.div
                          key={q}
                          initial={reduced ? false : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 + i * 0.09, duration: 0.3, ease: EASE }}
                          className="flex items-start gap-2 rounded-lg bg-muted/50 p-2"
                        >
                          <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary-strong dark:text-primary">
                            {i + 1}
                          </span>
                          <span className="text-[10.5px] leading-snug text-foreground/90">{q}</span>
                        </motion.div>
                      ))}
                    </div>
                    <div className="mt-2.5 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                      <Check className="h-3 w-3 text-primary-strong dark:text-primary" strokeWidth={3} />
                      Saved to your ApplyOS pipeline
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
