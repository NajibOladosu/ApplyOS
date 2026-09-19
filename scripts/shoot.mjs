#!/usr/bin/env node
/**
 * PREVIEW SHOOTER — render real pages in a real browser.
 *
 * The authenticated pages cannot be verified by curl (they redirect to login)
 * or by tsc/eslint (the problems are visual). This drives headless Chromium
 * against the preview harness (NEXT_PUBLIC_PREVIEW=1) and writes full-page
 * screenshots so the pages can actually be looked at.
 *
 * USAGE
 *   node scripts/shoot.mjs                    → all routes, light, desktop
 *   node scripts/shoot.mjs dashboard          → one route by name
 *   node scripts/shoot.mjs --theme=both       → light and dark
 *   node scripts/shoot.mjs --width=390        → mobile viewport
 *   node scripts/shoot.mjs --out=/tmp/shots
 *
 * Requires: dev server running on PORT (default 3000) with NEXT_PUBLIC_PREVIEW=1.
 */

import chromium from "@sparticuz/chromium"
import { chromium as playwrightChromium } from "playwright-core"
import { mkdirSync } from "node:fs"
import path from "node:path"

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : fallback
}

const PORT = arg("port", "3000")
const BASE = `http://localhost:${PORT}`
const OUT = arg("out", "/tmp/shots")
const THEME = arg("theme", "light") // light | dark | both
const WIDTH = Number(arg("width", "1440"))
const HEIGHT = Number(arg("height", "900"))
const FULL = argv.includes("--viewport-only") ? false : true
const filter = argv.filter((a) => !a.startsWith("--"))[0]

const ROUTES = [
  { name: "dashboard", url: "/dashboard" },
  { name: "applications", url: "/applications" },
  { name: "application-detail", url: "/applications/app-001" },
  { name: "documents", url: "/documents" },
  { name: "document-detail", url: "/documents/doc-001" },
  { name: "interview", url: "/interview" },
  { name: "interview-report", url: "/interview/sess-001/report" },
  { name: "upload", url: "/upload" },
  { name: "notifications", url: "/notifications" },
  { name: "profile", url: "/profile" },
  { name: "settings", url: "/settings" },
  { name: "resources", url: "/resources" },
  { name: "feedback", url: "/feedback" },
  { name: "star-builder", url: "/interview/star" },
  { name: "apply-kit", url: "/apply" },
]

const targets = filter ? ROUTES.filter((r) => r.name.includes(filter)) : ROUTES
if (!targets.length) {
  console.error(`no route matches "${filter}" — available: ${ROUTES.map((r) => r.name).join(", ")}`)
  process.exit(1)
}

mkdirSync(OUT, { recursive: true })

// @sparticuz/chromium ships --single-process for Lambda cold starts, but it
// tears the browser down as soon as a second context/page is opened. We drive
// many pages here, so drop it (and keep the sandbox flags we need).
const CHROME_ARGS = [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"].filter(
  (a) => a !== "--single-process" && a !== "--in-process-gpu"
)

const browser = await playwrightChromium.launch({
  executablePath: await chromium.executablePath(),
  args: CHROME_ARGS,
  headless: true,
})

const themes = THEME === "both" ? ["light", "dark"] : [THEME]
const results = []

for (const theme of themes) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
    colorScheme: theme === "dark" ? "dark" : "light",
  })

  // Persist the theme choice the way the app's ThemeProvider expects to read it
  await context.addInitScript((t) => {
    try {
      localStorage.setItem("theme", t)
      localStorage.setItem("applyos-theme", t)
    } catch {}
    document.documentElement.classList.toggle("dark", t === "dark")
  }, theme)

  for (const route of targets) {
    const page = await context.newPage()
    const errors = []
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 200))
    })
    page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`))

    let status = 0
    try {
      const res = await page.goto(`${BASE}${route.url}`, { waitUntil: "networkidle", timeout: 45_000 })
      status = res?.status() ?? 0
      // let entry animations settle
      await page.waitForTimeout(900)

      // scroll through so lazy content and scroll-triggered motion render
      if (FULL) {
        await page.evaluate(async () => {
          const step = window.innerHeight * 0.8
          for (let y = 0; y < document.body.scrollHeight; y += step) {
            window.scrollTo(0, y)
            await new Promise((r) => setTimeout(r, 120))
          }
          window.scrollTo(0, 0)
        })
        await page.waitForTimeout(400)
      }

      const file = path.join(OUT, `${route.name}${theme === "dark" ? "-dark" : ""}${WIDTH < 800 ? "-mobile" : ""}.png`)
      await page.screenshot({ path: file, fullPage: FULL })
      results.push({ route: route.name, theme, status, file, errors })
    } catch (e) {
      results.push({ route: route.name, theme, status, file: null, errors: [...errors, String(e).slice(0, 200)] })
    }
    await page.close()
  }
  await context.close()
}

await browser.close()

console.log(`SHOOT ${results.length} page(s) → ${OUT}\n`)
for (const r of results) {
  const flag = r.status === 200 ? "✓" : "✗"
  console.log(`${flag} ${r.route.padEnd(20)} ${String(r.status).padEnd(4)} ${path.basename(r.file ?? "—")}`)
  for (const e of r.errors.slice(0, 3)) console.log(`     ! ${e}`)
}
const failed = results.filter((r) => r.status !== 200 || r.errors.length)
console.log(`\n${failed.length ? `${failed.length} page(s) with problems` : "all pages rendered cleanly"}`)
process.exit(failed.length ? 1 : 0)
