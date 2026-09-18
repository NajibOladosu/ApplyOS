import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-[#0A0A0A]">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[640px] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]"
      />
      <div className="relative mx-auto max-w-3xl px-6 py-24 text-center sm:py-28">
        <h2 className="font-display text-3xl font-bold leading-[1.1] tracking-[-0.03em] text-white md:text-5xl">
          Your next role is one command center away.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/60">
          Set up in two minutes. Track everything, draft every answer, and walk into every
          interview prepared.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/auth/signup"
            className="group inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-7 text-[15px] font-semibold text-primary-foreground shadow-[0_8px_32px_-8px_rgba(24,187,112,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-8px_rgba(24,187,112,0.75)] active:scale-[0.98]"
          >
            Start applying free
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/auth/login"
            className="text-sm font-medium text-white/60 transition-colors hover:text-white"
          >
            I already have an account →
          </Link>
        </div>
        <p className="mt-6 text-xs text-white/40">
          Free to start · No credit card · Delete your data anytime
        </p>
      </div>
    </section>
  )
}
