import { FileCheck2, ShieldCheck, Sparkles, Timer } from "lucide-react"

const POINTS = [
  { icon: ShieldCheck, label: "Row-level data isolation — your data stays yours" },
  { icon: FileCheck2, label: "PDF, DOCX & text — we extract it all" },
  { icon: Sparkles, label: "Answers grounded in your resume, never invented" },
  { icon: Timer, label: "Deadline emails at 7, 3 & 1 days out" },
]

export function TrustStrip() {
  return (
    <section className="border-y border-border/60 bg-muted/30">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-5">
        {POINTS.map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground"
          >
            <Icon className="h-4 w-4 shrink-0 text-primary-strong dark:text-primary" strokeWidth={2.25} />
            {label}
          </span>
        ))}
      </div>
    </section>
  )
}
