"use client"

import * as React from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Check } from "lucide-react"

const EASE = [0.22, 1, 0.36, 1] as const

const STEPS = [
  {
    n: "1",
    title: "Paste the job URL",
    desc: "Drop any posting into ApplyOS — or upload your resume once and reuse it everywhere.",
    visual: (
      <div className="inline-flex max-w-full items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 font-mono text-[11px] text-muted-foreground shadow-sm">
        <span className="truncate">acme.com/careers/fe-engineer</span>
        <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
          ↵
        </kbd>
      </div>
    ),
  },
  {
    n: "2",
    title: "AI drafts, you refine",
    desc: "Every question answered in first person, grounded in your documents. Edit in seconds, not hours.",
    visual: (
      <div className="space-y-1.5">
        {["14 questions extracted", "First drafts ready — grounded in your resume"].map((t) => (
          <div key={t} className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
            <Check
              className="h-3.5 w-3.5 shrink-0 text-primary-strong dark:text-primary"
              strokeWidth={2.5}
            />
            {t}
          </div>
        ))}
      </div>
    ),
  },
  {
    n: "3",
    title: "Track until you're hired",
    desc: "Statuses, deadlines, interviews and follow-ups in one pipeline — with reminders that never sleep.",
    visual: (
      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] font-medium">
        <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">Submitted</span>
        <span className="text-muted-foreground/50" aria-hidden>
          →
        </span>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary-strong dark:text-primary">
          In review
        </span>
        <span className="text-muted-foreground/50" aria-hidden>
          →
        </span>
        <span className="rounded-full bg-primary px-2.5 py-1 text-primary-foreground">Offer</span>
      </div>
    ),
  },
]

const grid = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
}

const col = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
}

export function HowItWorks() {
  const reduced = useReducedMotion()

  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 border-y border-border/60 bg-muted/30 py-24"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-strong dark:text-primary">
            How it works
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.025em] text-foreground md:text-4xl">
            From job URL to submitted — in minutes.
          </h2>
        </div>

        <div className="relative mt-16">
          {/* Connector line (desktop) */}
          <div
            aria-hidden
            className="absolute left-4 right-[33.5%] top-4 hidden h-px bg-border md:block"
          />
          <motion.div
            aria-hidden
            initial={reduced ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
            className="absolute left-4 right-[33.5%] top-4 hidden h-px origin-left bg-primary md:block"
          />

          <motion.div
            variants={grid}
            initial={reduced ? false : "hidden"}
            whileInView={reduced ? undefined : "show"}
            viewport={{ once: true, margin: "-80px" }}
            className="grid gap-12 md:grid-cols-3 md:gap-8"
          >
            {STEPS.map((step) => (
              <motion.div key={step.n} variants={col} className="relative">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-background font-display text-[13px] font-bold text-primary-strong dark:text-primary">
                  {step.n}
                </div>
                <h3 className="mt-4 font-display text-base font-bold tracking-tight text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
                <div className="mt-4">{step.visual}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
