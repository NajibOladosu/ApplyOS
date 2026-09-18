"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { Menu, X } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#extension", label: "Extension" },
]

export function MarketingNav() {
  const [scrolled, setScrolled] = React.useState(false)
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Lock body scroll while the mobile sheet is open
  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled || open
            ? "border-b border-border/60 bg-background/85 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
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

          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="relative text-sm font-medium text-muted-foreground transition-colors duration-200 after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-foreground after:transition-transform after:duration-200 after:ease-out hover:text-foreground hover:after:scale-x-100"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/blog"
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
            >
              Blog
            </Link>
          </nav>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link
              href="/auth/login"
              className="hidden rounded-lg px-3.5 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-secondary/70 sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-[0_4px_16px_-4px_rgba(24,187,112,0.5)] transition-all duration-200 hover:shadow-[0_6px_20px_-4px_rgba(24,187,112,0.65)] active:scale-[0.98]"
            >
              Start free
            </Link>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary/70 md:hidden"
              aria-expanded={open}
              aria-label={open ? "Close menu" : "Open menu"}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-x-0 top-16 bottom-0 z-40 flex flex-col overflow-y-auto bg-background md:hidden"
          >
            <nav className="flex flex-col px-6 pt-4" aria-label="Mobile">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="border-b border-border/50 py-4 text-base font-medium text-foreground transition-colors hover:text-primary-strong dark:hover:text-primary"
                >
                  {link.label}
                </a>
              ))}
              <Link
                href="/blog"
                onClick={() => setOpen(false)}
                className="border-b border-border/50 py-4 text-base font-medium text-foreground transition-colors hover:text-primary-strong dark:hover:text-primary"
              >
                Blog
              </Link>
            </nav>
            <div className="mt-auto space-y-3 px-6 pb-10 pt-8">
              <Link
                href="/auth/login"
                onClick={() => setOpen(false)}
                className="flex h-12 items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                onClick={() => setOpen(false)}
                className="flex h-12 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-[0_4px_16px_-4px_rgba(24,187,112,0.5)]"
              >
                Start free
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
