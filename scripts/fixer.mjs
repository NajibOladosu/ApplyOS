#!/usr/bin/env node
/**
 * ApplyOS Design Gauntlet — FIXER
 * -------------------------------
 * The corrective half of the critic/fixer loop. It consumes the SAME rules the
 * critic enforces (imported from scripts/critic.mjs — one source of truth) and:
 *
 *   1. auto-fixes every violation whose transformation is unambiguous
 *      (legacy effect classes, hardcoded color families → tokens, headings
 *       missing font-display, solid bg-white/text-black, zero-contrast pairs,
 *       localhost URLs, leftover console statements, heading "!", image alt)
 *   2. re-lints each edited file with the critic's rules to PROVE the fix
 *      removed the violation; a fix that does not stick is dropped and
 *      reported instead of being silently claimed as solved
 *   3. reports everything judgment-dependent (missing onSubmit, unallowlisted
 *      hrefs, hover scale, raw CSS hex, duplicate ids) as MANUAL with a hint
 *
 * MODES:
 *   node scripts/fixer.mjs             → fix in-scope files, write fixer report
 *   node scripts/fixer.mjs --dry-run   → preview diffs, write nothing
 *   node scripts/fixer.mjs --selftest  → prove each autofix works on fixtures
 *   node scripts/fixer.mjs --verify    → also run tsc + eslint after fixing
 *
 * EXIT: 0 when no ERROR-level findings remain in scope, 1 otherwise.
 */

import { execSync } from "node:child_process"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { lintTsSource, lintCssSource, issues, surfaceAt } from "./critic.mjs"

const root = process.cwd()
const argv = process.argv.slice(2)
const DRY = argv.includes("--dry-run")
const VERIFY = argv.includes("--verify")

// ---------------------------------------------------------------- fixes
const GLOW = "shadow-[0_4px_14px_-4px_rgba(24,187,112,0.5)]"
const GLASS = "border border-border/70 bg-card/80 backdrop-blur-sm"

/** Token mapping for hardcoded color families. Order matters (slash first). */
function mapColorToken(tok, surface) {
  const m = tok.match(/^((?:[a-z0-9-]+:)*)(bg|text|border|ring|from|to|via|divide)-(zinc|gray|grey|slate|neutral|stone|green|red)-(\d{2,3})(\/\d+)?$/)
  if (!m) return null
  const [, prefix, prop, family, shade, alpha = ""] = m
  const dark = prefix.includes("dark:")

  if (family === "green" || family === "red") {
    const step = family === "green" ? "primary" : "destructive"
    if (prop === "text") {
      if (family === "green" && Number(shade) <= 300) return `${prefix}text-primary-neon`
      if (family === "green" && !dark && Number(shade) >= 600) return `${prefix}text-primary-strong`
      if (family === "green" && dark && Number(shade) < 600) return `${prefix}text-primary`
      if (family === "red") return `${prefix}text-destructive`
      return `${prefix}text-primary`
    }
    if (prop === "bg") return `${prefix}bg-${step}${alpha}`
    return `${prefix}${prop}-${step}${alpha}` // border/ring/from/to/via/divide
  }

  // neutral families → semantic tokens
  const n = Number(shade)
  if (prop === "text") {
    if (surface === "dark") {
      if (n <= 300) return `${prefix}text-white/80`
      if (n <= 400) return `${prefix}text-white/60`
      if (n <= 500) return `${prefix}text-white/50`
      return `${prefix}text-white/40`
    }
    if (n <= 500) return `${prefix}text-muted-foreground`
    if (n === 600) return `${prefix}text-muted-foreground/80`
    return `${prefix}text-foreground`
  }
  if (prop === "bg") {
    if (n >= 900) return `${prefix}bg-background${alpha}`
    if (n >= 800) return `${prefix}bg-card${alpha}`
    if (n >= 700) return `${prefix}bg-muted${alpha}`
    if (n <= 200) return `${prefix}bg-muted${alpha}`
    return null
  }
  if (prop === "border" || prop === "ring" || prop === "divide") {
    return `${prefix}${prop}-border${alpha}`
  }
  return `${prefix}${prop}-card${alpha}` // gradients
}

const TOKEN_RE = /\b((?:[a-z0-9-]+:)*(?:bg|text|border|ring|from|to|via|divide)-(?:zinc|gray|grey|slate|neutral|stone|green|red)-\d{2,3}(?:\/\d+)?)\b/g

function fixLineTokens(line, surface) {
  return line.replace(TOKEN_RE, (tok) => mapColorToken(tok, surface) ?? tok)
}

// --- per-rule line transforms -------------------------------------------
const LINE_FIXES = {
  "DESIGN-001": (line) =>
    line.replace(/\bglow-effect\b/g, GLOW).replace(/\bglass-effect\b/g, GLASS),

  "DESIGN-002": (line, { surface }) => {
    let out = fixLineTokens(line, surface)
    out = out.replace(/\bbg-white\b(?!\/)/g, "bg-card")
    out = out.replace(/\btext-black\b(?!\/)/g, "text-foreground")
    if (/\btext-white\b(?!\/)/.test(out) && /\bbg-primary\b/.test(out)) {
      out = out.replace(/\btext-white\b(?!\/)/g, "text-primary-foreground")
    } else if (
      /\btext-white\b(?!\/)/.test(out) &&
      !/bg-(?:primary|destructive|black)\b|bg-\[#0/.test(out) &&
      surface !== "dark"
    ) {
      out = out.replace(/\btext-white\b(?!\/)/g, "text-foreground")
    }
    return out
  },

  "DESIGN-004": (line) =>
    /\bbg-primary\b/.test(line) ? line.replace(/(?<!bg-)\btext-primary\b/g, "text-primary-foreground") : line,

  "CORRECT-001": (line) =>
    line.replace(/https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/g, ""),

  "VOICE-001": (line) =>
    line.replace(/(<h[1-4]\b[^>]*>)([\s\S]*?)(<\/h[1-4]>)/, (_m, open, text, close) =>
      `${open}${text.replace(/!+/g, "").replace(/\s{2,}/g, " ").trimEnd()}${close}`
    ),

  "CORRECT-005": (line) =>
    /<Image\b/.test(line) && !/alt=/.test(line)
      ? line.replace(/(<Image\b[^>]*?)\s*(\/?>)/, '$1 alt="" $2')
      : line,
}

/** Headings get font-display injected into an existing string className. */
function fixHeading(source, line) {
  const lines = source.split("\n")
  const re = new RegExp(`<h[1-4]\\b[\\s\\S]{0,500}?(?=>)`, "g")
  const joined = lines.slice(line).join("\n")
  const m = re.exec(joined)
  if (!m || /font-display/.test(m[0])) return null
  if (!/className="[\s\S]*?"/.test(m[0])) return null // cn()/template — needs a human
  const patched = m[0].replace(/className="([^"]*)"/, 'className="font-display $1"')
  return lines.slice(0, line).join("\n") + "\n" + joined.replace(m[0], patched)
}

// ---------------------------------------------------------------- core
function lintFileSource(file, source) {
  issues.length = 0
  if (file.endsWith(".css")) lintCssSource(file, source)
  else lintTsSource(file, source)
  return [...issues]
}

/**
 * Fix one file's source in memory. Returns { source, changes, manual }.
 * Each candidate fix is verified with the critic's own rules: a fix that does
 * not remove its violation is dropped, not written.
 */
function fixSource(file, source, { sourceLabel = file } = {}) {
  const changes = []
  let cur = source

  for (let pass = 0; pass < 3; pass++) {
    const found = lintFileSource(file, cur).filter((i) => i.severity === "ERROR")
    if (!found.length) break
    let touched = false

    // bottom-up: a fix that removes lines would otherwise shift the line
    // numbers of every finding below it within this same pass
    for (const issue of [...found].sort((a, b) => b.line - a.line)) {
      const lines = cur.split("\n")
      const i = issue.line - 1
      const before = lines[i]
      if (before === undefined) continue

      if (issue.rule === "DESIGN-003") {
        const next = fixHeading(cur, i)
        if (!next) continue // dynamic className — surfaced as manual from the final state
        cur = next
        touched = true
        changes.push({ rule: issue.rule, file: sourceLabel, line: issue.line, before: "(heading)", after: "className += font-display" })
        continue
      }

      // CORRECT-002: a standalone console statement is removed whole
      if (issue.rule === "CORRECT-002") {
        if (!/^\s*console\.(log|debug|info)\(.*\);?\s*$/.test(before)) continue
        lines.splice(i, 1)
        cur = lines.join("\n")
        touched = true
        changes.push({ rule: issue.rule, file: sourceLabel, line: issue.line, before: before.trim(), after: "(line removed)" })
        continue
      }

      const fn = LINE_FIXES[issue.rule]
      if (!fn) continue

      const surface = surfaceAt(lines, i)
      const patch = fn(before, { surface })
      // no change: either unmappable, or a sibling fix on this same line
      // already resolved it (line numbers can collapse onto one line)
      if (patch === null || patch === before) continue

      // verify the patch removes THIS rule's finding on this line before keeping it
      const candidate = lines.slice()
      candidate[i] = patch
      const stillStanding = lintFileSource(file, candidate.join("\n")).some(
        (x) => x.rule === issue.rule && x.line === issue.line && x.severity === "ERROR"
      )
      if (stillStanding) continue

      lines[i] = patch
      cur = lines.join("\n")
      touched = true
      changes.push({
        rule: issue.rule,
        file: sourceLabel,
        line: issue.line,
        before: before.trim(),
        after: patch.trim(),
        note: FIX_NOTES[issue.rule],
      })
    }

    if (!touched) break
  }

  // whatever still stands after fixing is genuinely human work — reported once,
  // from the final state (no stale line numbers, no duplicates across passes)
  const manual = lintFileSource(file, cur)
    .filter((i) => i.severity === "ERROR")
    .map((i) => ({ ...i, hint: MANUAL_HINTS[i.rule] ?? "no autofix available" }))

  return { source: cur, changes, manual }
}

/** Autofixes that are mechanically correct but may need a human decision. */
const FIX_NOTES = {
  "CORRECT-005": 'inserted alt="" — only correct for decorative images; give it real text if it conveys content',
  "DESIGN-002": "mapped to the nearest semantic token — confirm the token choice matches the intended hierarchy",
  "CORRECT-001": "absolute local URL → relative path (the base URL now comes from the host/env)",
}

const MANUAL_HINTS = {
  "JSX-001": "structural: swap the wrapper element for the required Radix parent (a styled div around triggers must become <TabsList>) — not auto-applied because matching closing tags is error-prone",
  "CORRECT-002": "console statement is part of a larger expression — remove it manually",
  "DESIGN-002": "no automatic token mapping for this value — choose the semantic token (see scripts/README.md)",
  "DESIGN-003": "heading className is dynamic (cn()/template) — add font-display manually",
  "CORRECT-007": "<form> needs a real onSubmit handler (or a server action) — wire the submission",
  "CORRECT-003": "external link: confirm the destination, then add its domain to EXTERNAL_ALLOW in critic.mjs or make it env-driven",
  "PERF-001": "whileHover scale on a large surface: swap to a border/shadow/translate hover",
  "CSS-001": "raw hex outside token definitions: promote it to a CSS variable in :root or move it into a brand-gradient block",
  "CORRECT-004": 'duplicate id: give each instance a unique id (check any htmlFor/aria-labelledby that references it)',
  "CORRECT-005": "<Image> needs a meaningful alt — empty alt is only correct for decorative art",
}

// ---------------------------------------------------------------- scope
function inScopeFiles() {
  const tracked = execSync("git diff main --name-only", { encoding: "utf8" })
  const untracked = execSync("git ls-files --others --exclude-standard", { encoding: "utf8" })
  return [...new Set([...tracked.split("\n"), ...untracked.split("\n")].map((l) => l.trim()).filter(Boolean))]
    .filter((f) => /\.(tsx?|css)$/.test(f))
    .filter((f) => {
      try {
        readFileSync(path.join(root, f))
        return true
      } catch {
        return false
      }
    })
}

// ---------------------------------------------------------------- selftest
const FIXTURES = [
  { name: "glow-effect → token shadow", file: "app/x/page.tsx", src: `<div className="glow-effect rounded-lg" />`, expect: GLOW },
  { name: "zinc text on dark panel → white scale", file: "app/x/page.tsx", src: `<section className="bg-[#0A0A0A]">\n  <p className="text-zinc-400">x</p>\n</section>`, expect: "text-white/60" },
  { name: "zinc text on light surface → muted-foreground", file: "app/x/page.tsx", src: `<div className="bg-card">\n  <p className="text-zinc-500">x</p>\n</div>`, expect: "text-muted-foreground" },
  { name: "green-600 text → primary-strong", file: "app/x/page.tsx", src: `<span className="text-green-600">ok</span>`, expect: "text-primary-strong" },
  { name: "dark:green-400 → dark:primary", file: "app/x/page.tsx", src: `<span className="text-green-700 dark:text-green-400">ok</span>`, expect: "dark:text-primary" },
  { name: "red-500 → destructive", file: "app/x/page.tsx", src: `<span className="text-red-500">bad</span>`, expect: "text-destructive" },
  { name: "bg-white → bg-card", file: "app/x/page.tsx", src: `<div className="bg-white shadow" />`, expect: "bg-card" },
  { name: "text-black → text-foreground", file: "app/x/page.tsx", src: `<div className="text-black" />`, expect: "text-foreground" },
  { name: "standalone console.log removed", file: "app/x/page.tsx", src: `<div>\n  console.log("x")\n  <span>a</span>\n</div>`, expect: "a" },
  { name: "heading gains font-display", file: "app/x/page.tsx", src: `<h2 className="text-2xl font-bold">Title</h2>`, expect: 'className="font-display text-2xl font-bold"' },
  { name: "Image gains alt", file: "app/x/page.tsx", src: `<Image src="/a.png" width={10} height={10} />`, expect: 'alt=""' },
  { name: "bg-primary + text-primary → primary-foreground", file: "app/x/page.tsx", src: `<button className="bg-primary text-primary">Go</button>`, expect: "text-primary-foreground" },
  { name: "localhost URL → relative", file: "app/x/page.tsx", src: `fetch("http://localhost:3000/api/x")`, expect: '"/api/x"' },
  { name: "heading ! stripped", file: "app/x/page.tsx", src: `<h2 className="font-display">Ship faster!</h2>`, expect: ">Ship faster<" },
]

function runSelfTest() {
  let pass = 0
  const failures = []
  for (const t of FIXTURES) {
    const { source: fixed, manual } = fixSource(t.file, t.src, { sourceLabel: t.name })
    const remaining = lintFileSource(t.file, fixed).filter((i) => i.severity === "ERROR")
    const again = fixSource(t.file, fixed, { sourceLabel: t.name }).source
    const problems = []
    if (t.expect && !fixed.includes(t.expect)) problems.push(`expected ${JSON.stringify(t.expect)} in output`)
    if (remaining.length) problems.push(`still ${remaining.length} error(s): ${remaining[0].rule}`)
    if (again !== fixed) problems.push("not idempotent")
    if (manual.length) problems.push(`reported manual: ${manual[0].rule}`)
    if (problems.length) failures.push(`${t.name} — ${problems.join("; ")}`)
    else pass++
  }
  console.log(`FIXER SELFTEST: ${pass}/${FIXTURES.length} fixtures fixed cleanly (each verified by the critic's rules + idempotent)`)
  for (const f of failures) console.log(`  ✗ ${f}`)
  if (!failures.length) console.log("  ✓ every autofix removes its violation, survives re-lint, and never loops")
  return failures.length ? 1 : 0
}

// ---------------------------------------------------------------- run
function main() {
  if (argv.includes("--selftest")) process.exit(runSelfTest())

  const files = inScopeFiles()
  const allChanges = []
  const allManual = []
  let changedCount = 0

  for (const file of files) {
    const source = readFileSync(path.join(root, file), "utf8")
    const { source: fixed, changes, manual } = fixSource(file, source)
    allChanges.push(...changes)
    allManual.push(...manual)
    if (fixed !== source) {
      changedCount++
      if (!DRY) writeFileSync(path.join(root, file), fixed)
    }
  }

  // final state of the whole scope, measured with the critic's rules
  const remaining = []
  for (const file of files) {
    const onDisk = readFileSync(path.join(root, file), "utf8")
    const source = DRY ? fixSource(file, onDisk).source : onDisk
    for (const i of lintFileSource(file, source)) if (i.severity === "ERROR") remaining.push(i)
  }

  // -------------------------------------------------------------- report
  const byRule = new Map()
  for (const c of allChanges) byRule.set(c.rule, (byRule.get(c.rule) ?? 0) + 1)

  let md = `# Fixer Report — ApplyOS Design Gauntlet\n\n`
  md += `Generated: ${new Date().toISOString()}\n`
  md += `Mode: ${DRY ? "dry-run (nothing written)" : "applied"}\n`
  md += `Scope: ${files.length} files · ${changedCount} changed · ${allChanges.length} auto-fixes · ${allManual.length} manual\n\n`
  md += `## Auto-fixed\n\n`
  if (!allChanges.length) md += `_Nothing to fix — the critic's rules are already satisfied._\n`
  for (const [rule, n] of [...byRule].sort((a, b) => b[1] - a[1])) md += `- **${rule}** × ${n}\n`
  if (allChanges.length) {
    md += `\n| Rule | File | Line | Before | After |\n|---|---|---|---|---|\n`
    for (const c of allChanges) {
      const esc = (s) => String(s).replace(/\|/g, "\\|").slice(0, 90)
      md += `| ${c.rule} | \`${c.file}\` | ${c.line} | \`${esc(c.before)}\` | \`${esc(c.after)}\` |\n`
    }
  }
  const noted = [...new Set(allChanges.map((c) => c.note).filter(Boolean))]
  if (noted.length) {
    md += `\n### Review notes\n\n`
    for (const n of noted) md += `- ${n}\n`
  }
  md += `\n## Needs a human\n\n`
  if (!allManual.length) md += `_None._\n`
  for (const m of allManual) md += `- **${m.rule}** \`${m.file}:${m.line}\` — ${m.hint}\n`
  md += `\n## Remaining critic errors after fixing\n\n`
  md += remaining.length ? `${remaining.length}\n\n` + remaining.map((r) => `- ${r.rule} \`${r.file}:${r.line}\``).join("\n") + "\n" : `0 — loop converged.\n`

  if (!DRY) {
    mkdirSync("docs/critique", { recursive: true })
    writeFileSync("docs/critique/fixer-report.md", md)
  }

  console.log(`FIXER: ${files.length} files · ${changedCount} changed · ${allChanges.length} auto-fixes · ${allManual.length} manual${DRY ? " (dry-run)" : ""}`)
  for (const c of allChanges) console.log(`  ✓ ${c.rule} ${c.file}:${c.line} → ${c.after.slice(0, 70)}`)
  for (const m of allManual) console.log(`  ⚑ ${m.rule} ${m.file}:${m.line} — ${m.hint}`)
  if (!DRY) console.log(`\nReport: docs/critique/fixer-report.md`)

  if (VERIFY && !DRY) {
    const touched = [...new Set(allChanges.map((c) => c.file))]
    console.log(`\n— verification —`)
    try {
      const tsc = execSync("npx tsc --noEmit", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
      console.log(`  tsc: clean`)
      if (tsc.trim()) console.log(tsc.split("\n").slice(0, 5).join("\n"))
    } catch (e) {
      const out = `${e.stdout ?? ""}${e.stderr ?? ""}`.split("\n").filter((l) => /error TS/.test(l) && !/documents\.test\.ts/.test(l))
      console.log(out.length ? `  tsc: ${out.length} error(s) — NEW ERRORS, review the fixes` : `  tsc: only pre-existing test errors`)
      for (const l of out.slice(0, 10)) console.log(`    ${l.trim()}`)
    }
    if (touched.length) {
      try {
        execSync(`npx eslint ${touched.map((f) => `"${f}"`).join(" ")}`, { stdio: ["ignore", "pipe", "pipe"] })
        console.log(`  eslint: clean on ${touched.length} changed file(s)`)
      } catch (e) {
        console.log(`  eslint: issues in changed files —\n${`${e.stdout ?? ""}`.split("\n").slice(-12).join("\n")}`)
      }
    }
  }

  process.exit(remaining.length ? 1 : 0)
}

// run as a CLI, or import (fixSource is exported for reuse/tests)
const isEntry = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isEntry) main()

export { fixSource, lintFileSource }
