import Image from "next/image"
import Link from "next/link"
import { Github, Twitter } from "lucide-react"

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Chrome extension", href: "#extension" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Blog", href: "/blog" },
      {
        label: "Why we built ApplyOS",
        href: "/blog/why-we-built-applyos",
      },
      { label: "Feedback", href: "/feedback" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
]

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/60 bg-muted/20">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5" aria-label="ApplyOS home">
              <Image
                src="/ApplyOS%20Logo.webp"
                alt=""
                width={1073}
                height={1000}
                className="h-6 w-auto"
              />
              <span className="font-display text-base font-bold tracking-tight text-foreground">
                <span className="text-primary-strong dark:text-primary">Apply</span>OS
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              The AI-powered command center for job and scholarship applications — tracking,
              drafting and interview prep in one place.
            </p>
            <div className="mt-5 flex gap-2">
              <a
                href="https://github.com/NajibOladosu/ApplyOS"
                target="_blank"
                rel="noreferrer"
                aria-label="ApplyOS on GitHub"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors duration-200 hover:border-primary/40 hover:text-foreground"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="https://x.com/applyos"
                target="_blank"
                rel="noreferrer"
                aria-label="ApplyOS on X"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors duration-200 hover:border-primary/40 hover:text-foreground"
              >
                <Twitter className="h-4 w-4" />
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      {...("external" in link && link.external
                        ? { target: "_blank", rel: "noreferrer" }
                        : {})}
                      className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground/70 sm:flex-row">
          <p>© {new Date().getFullYear()} ApplyOS. All rights reserved.</p>
          <p>Built for job seekers worldwide.</p>
        </div>
      </div>
    </footer>
  )
}
