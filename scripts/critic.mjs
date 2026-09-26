#!/usr/bin/env node
/**
 * ApplyOS Design Gauntlet — CRITIC
 * --------------------------------
 * An executable, re-runnable code reviewer for the gauntlet's work.
 *
 * SCOPE: every file changed vs `main` (tracked modifications + untracked
 * new files), limited to .ts/.tsx/.css — i.e. exactly the surface the
 * gauntlet touched.
 *
 * MODES:
 *   node scripts/critic.mjs             → review + write report, exit 1 if errors
 *   node scripts/critic.mjs --quiet     → summary to stdout only
 *   node scripts/critic.mjs --selftest  → prove every rule fires on a violation
 *                                         fixture and stays silent on clean code
 *
 * The FIXER is the corrective pass that resolves every ERROR this script
 * emits (see scripts/README.md): it imports these same rules, so the two can
 * never disagree about what "clean" means. Re-run the critic after fixing;
 * the loop must end with 0 errors.
 */

import { execSync } from "node:child_process"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const root = process.cwd()
const quiet = process.argv.includes("--quiet")

// ---------------------------------------------------------------- scope
function inScopeFiles() {
  const tracked = execSync("git diff main --name-only", { encoding: "utf8" })
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  const untracked = execSync("git ls-files --others --exclude-standard", { encoding: "utf8" })
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  return [...new Set([...tracked, ...untracked])].filter((f) =>
    /\.(tsx?|css)$/.test(f)
  )
}

// ---------------------------------------------------------------- helpers
const issues = []
function issue(severity, rule, file, line, message) {
  issues.push({ severity, rule, file, line, message })
}

/** Extract quoted class strings + their source index from a tsx file. */
function classStrings(source) {
  const out = []
  const re = /className=(?:"([^"]*)"|'([^']*)')/g
  let m
  while ((m = re.exec(source))) out.push({ value: m[1] ?? m[2], index: m.index })
  return out
}

/** All `<h1..h4>` tag chunks (tag attrs, up to 500 chars) with source index. */
function headingChunks(source) {
  const out = []
  const re = /<h([1-4])\b[\s\S]{0,500}?(?=>)/g
  let m
  while ((m = re.exec(source))) out.push({ level: m[1], chunk: m[0], index: m.index })
  return out
}

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&apos;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

const lineOf = (source, idx) => source.slice(0, idx).split("\n").length

/**
 * Which surface does line `i` sit on? Walks upward and lets the nearest SOLID
 * background decide (opacity overlays such as bg-white/5 are not surfaces).
 * Shared with scripts/fixer.mjs so critic and fixer agree on "dark surface".
 */
const SOLID_BG_RE =
  /bg-\[(?:#[0-9a-fA-F]|rgb)|bg-(?:black|white|zinc-9\d{2}|primary|destructive|card|background|secondary)(?![\w-])\s*($|[,{)"'\s])/
const DARK_BG_RE = /bg-\[(?:#0|rgb\(0)|bg-(?:black|zinc-9\d{2}|primary|destructive)/
function surfaceAt(lines, i) {
  for (let j = i; j >= 0; j--) {
    const m = lines[j].match(SOLID_BG_RE)
    if (!m) continue
    const after = lines[j].slice(lines[j].indexOf(m[0]) + m[0].length)[0]
    if (after === "/") continue // opacity variant, not a surface
    return DARK_BG_RE.test(m[0]) ? "dark" : "light"
  }
  return "unknown"
}

/**
 * Radix UI components throw at RUNTIME when rendered outside the parent that
 * provides their context — <TabsTrigger> needs a <TabsList> because the list
 * supplies the RovingFocusGroup. TypeScript cannot see this and it only shows
 * up on an authenticated render, which is exactly how a <div>-wrapped tab
 * switcher reached production on /dashboard. This walks the JSX with a tag
 * stack and reports any component whose required ancestor is missing.
 */
const REQUIRED_ANCESTOR = {
  TabsList: ["Tabs"],
  TabsTrigger: ["TabsList"],
  TabsContent: ["Tabs"],
  SelectItem: ["Select"],
  SelectTrigger: ["Select"],
  SelectContent: ["Select"],
  RadioGroupItem: ["RadioGroup"],
  AccordionItem: ["Accordion"],
  AccordionTrigger: ["AccordionItem", "Accordion"],
  AccordionContent: ["AccordionItem", "Accordion"],
  DropdownMenuItem: ["DropdownMenu"],
  DropdownMenuTrigger: ["DropdownMenu"],
  DropdownMenuContent: ["DropdownMenu"],
  ToggleGroupItem: ["ToggleGroup"],
  DialogContent: ["Dialog"],
  DialogTrigger: ["Dialog"],
}

/**
 * Blank out comments while preserving byte offsets and line numbers, so the
 * JSX scanner cannot mistake example markup in a doc comment for real code
 * (that produced two false positives on its first run). String literals are
 * honored, so "https://…" never looks like a line comment.
 */
function stripComments(source) {
  let out = ""
  let i = 0
  let state = "code" // code | line | block | ' | " | `
  while (i < source.length) {
    const ch = source[i]
    const next = source[i + 1]
    if (state === "code") {
      if (ch === "/" && next === "/") {
        state = "line"
        out += "  "
        i += 2
        continue
      }
      if (ch === "/" && next === "*") {
        state = "block"
        out += "  "
        i += 2
        continue
      }
      if (ch === "'" || ch === '"' || ch === "`") state = ch
      out += ch
      i++
      continue
    }
    if (state === "line") {
      if (ch === "\n") {
        state = "code"
        out += ch
      } else out += " "
      i++
      continue
    }
    if (state === "block") {
      if (ch === "*" && next === "/") {
        state = "code"
        out += "  "
        i += 2
        continue
      }
      out += ch === "\n" ? ch : " "
      i++
      continue
    }
    // inside a string literal
    if (ch === "\\") {
      out += ch + (source[i + 1] ?? "")
      i += 2
      continue
    }
    if (ch === state) state = "code"
    out += ch
    i++
  }
  return out
}

function jsxContextIssues(file, rawSource) {
  const source = stripComments(rawSource)
  const out = []
  const stack = []
  let i = 0
  while (i < source.length) {
    const lt = source.indexOf("<", i)
    if (lt === -1) break
    const next = source[lt + 1]
    if (next === "!" || next === "%") {
      i = lt + 1
      continue
    }
    let j = lt + 1
    if (source[j] === "/") {
      // closing tag: pop back to the matching opening tag (lenient on mismatch)
      j++
      const start = j
      while (j < source.length && /[\w.$-]/.test(source[j])) j++
      const name = source.slice(start, j)
      while (j < source.length && source[j] !== ">") j++
      if (name) {
        const idx = stack.map((s) => s.name).lastIndexOf(name)
        if (idx !== -1) stack.length = idx
      }
      i = j + 1
      continue
    }
    if (!/[\w$]/.test(next ?? "")) {
      i = lt + 1 // not a tag (e.g. "a < b")
      continue
    }
    const start = j
    while (j < source.length && /[\w.$-]/.test(source[j])) j++
    const raw = source.slice(start, j)
    // scan attributes to the closing ">", honoring quotes and {expressions}
    let depth = 0
    let selfClosing = false
    while (j < source.length) {
      const ch = source[j]
      if (ch === '"' || ch === "'") {
        j++
        while (j < source.length && source[j] !== ch) j++
      } else if (ch === "{") depth++
      else if (ch === "}") depth--
      else if (ch === ">" && depth === 0) break
      else if (ch === "<" && depth === 0) break
      j++
    }
    if (source[j - 1] === "/") selfClosing = true
    const name = raw.split(".").pop()
    const need = REQUIRED_ANCESTOR[name]
    if (need && !need.some((n) => stack.some((s) => s.name === n))) {
      out.push({ name, need, line: lineOf(source, lt) })
    }
    if (!selfClosing && /^[A-Z]/.test(raw)) stack.push({ name })
    i = j + 1
  }
  return out
}

// ---------------------------------------------------------------- rules
const EXTERNAL_ALLOW = [
  "twitter.com",
  "x.com",
  "linkedin.com",
  "github.com",
  "chromewebstore.google.com",
  "google.com",
  "supabase.co",
]

function lintTsSource(file, source) {
  const lines = source.split("\n")

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const ln = i + 1
    const isProxy = file === "proxy.ts"

    // DESIGN-001: legacy effect classes must not be used by components
    if (/\b(?:glow-effect|glass-effect)\b/.test(line)) {
      const cls = (line.match(/\b(?:glow-effect|glass-effect)\b/g) || []).join(", ")
      issue("ERROR", "DESIGN-001", file, ln, `legacy effect class in use: ${cls} — use token-based primary button/card styles`)
    }

    // DESIGN-002: hardcoded color families that break the token system
    // (whitelisted: white/black with opacity overlays, and text-white on a
    //  solid dark bg — e.g. text on bg-primary or a fixed dark panel)
    const neutral = line.match(/\b(?:bg|text|border|from|to|via|ring|divide)-(?:zinc|gray|grey|slate|neutral|stone)-\d+/g)
    if (neutral) {
      issue("ERROR", "DESIGN-002", file, ln, `hardcoded neutral family: ${[...new Set(neutral)].join(", ")} — use semantic tokens (background/card/muted/border/foreground)`)
    }
    const clash = line.match(/\b(?:bg|text|border|from|to|via|ring)-(?:green|red)-\d+/g)
    if (clash) {
      issue("ERROR", "DESIGN-002", file, ln, `hardcoded green/red clashes with tokens: ${[...new Set(clash)].join(", ")} — use primary/destructive`)
    }
    if (/\bbg-white\b(?!\/)/.test(line)) {
      issue("ERROR", "DESIGN-002", file, ln, "solid bg-white — breaks dark mode, use bg-background/bg-card")
    }
    if (/\btext-black\b(?!\/)/.test(line)) {
      issue("ERROR", "DESIGN-002", file, ln, "solid text-black — breaks dark mode, use text-foreground")
    }
    if (/\btext-white\b(?!\/)/.test(line)) {
      // legitimate when the element sits on a fixed dark surface (marketing
      // dark panels, bg-primary buttons) — nearest solid bg decides
      const surrounding = lines.slice(Math.max(0, i - 8), i + 4).join("\n")
      const onSolidDarkBg =
        /bg-(?:primary|destructive|black)\b|bg-\[#0/.test(surrounding) || surfaceAt(lines, i) === "dark"
      if (!onSolidDarkBg) {
        issue("ERROR", "DESIGN-002", file, ln, "solid text-white not on a guaranteed-dark bg — use text-primary-foreground or the white/NN scale")
      }
    }

    // CORRECT-001: absolute local URLs in client code (breaks preview/any host)
    if (!isProxy && /https?:\/\/(?:localhost|127\.0\.0\.1)/.test(line)) {
      issue("ERROR", "CORRECT-001", file, ln, "absolute localhost/127.0.0.1 URL — use a relative path or an env-driven base URL")
    }

    // CORRECT-002: leftover debug logging
    if (/\bconsole\.(log|debug|info)\b/.test(line)) {
      const kind = (line.match(/console\.(log|debug|info)/) || [])[1]
      issue("ERROR", "CORRECT-002", file, ln, `leftover console.${kind} — remove or replace with structured logging`)
    }

    // VOICE-001: heading exclamation (voice rule: no "!" in headings)
    const heading = line.match(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/)
    if (heading && /!/.test(stripTags(heading[2]))) {
      issue("ERROR", "VOICE-001", file, ln, `heading contains "!": "${stripTags(heading[2]).slice(0, 60)}" — keep headers calm, sentence case`)
    }
  }

  // DESIGN-003: headings must use the display typeface
  for (const h of headingChunks(source)) {
    if (!/font-display/.test(h.chunk)) {
      const attrs = h.chunk
      const label = (attrs.match(/className="([^"]*)"/) || [])[1] || ""
      issue("ERROR", "DESIGN-003", file, lineOf(source, h.index), `h${h.level} missing font-display (${label.slice(0, 42)})`)
    }
  }

  // DESIGN-004: bg-primary + text-primary on one element = zero-contrast
  for (const { value, index } of classStrings(source)) {
    const toks = new Set(value.split(/\s+/))
    if (toks.has("bg-primary") && toks.has("text-primary")) {
      issue("ERROR", "DESIGN-004", file, lineOf(source, index), "bg-primary combined with text-primary — use text-primary-foreground")
    }
  }

  // CORRECT-003: external hrefs must be allowlisted domains
  const hrefRe = /href=["']([^"']+)["']/g
  let hm
  while ((hm = hrefRe.exec(source))) {
    const href = hm[1]
    if (/^https?:\/\//.test(href) && !/^\$\{/.test(href)) {
      let host = ""
      try {
        host = new URL(href).hostname
      } catch {
        continue
      }
      if (!EXTERNAL_ALLOW.some((d) => host === d || host.endsWith(`.${d}`))) {
        issue("WARN", "CORRECT-003", file, lineOf(source, hm.index), `unallowlisted external href: ${href.slice(0, 80)} — intentional? add to EXTERNAL_ALLOW or make env-driven`)
      }
    }
  }

  // CORRECT-005: next/image must have alt
  const imgRe = /<Image\b[\s\S]{0,400}?(?=>)/g
  let im
  while ((im = imgRe.exec(source))) {
    if (!/alt=/.test(im[0])) {
      issue("ERROR", "CORRECT-005", file, lineOf(source, im.index), "<Image> without alt attribute (a11y + next/image requirement)")
    }
  }

  // CORRECT-007: <form> must have onSubmit (real-bug pattern caught in gauntlet r2)
  const formRe = /<form\b[\s\S]{0,600}?(?=>)/g
  let fm
  while ((fm = formRe.exec(source))) {
    if (!/onSubmit=/.test(fm[0])) {
      issue("ERROR", "CORRECT-007", file, lineOf(source, fm.index), "<form> without onSubmit — submission will do a full page reload")
    }
  }

  // CORRECT-004: duplicate id= values in one file
  const ids = new Map()
  const idRe = /\bid=["']([^"']+)["']/g
  let idm
  while ((idm = idRe.exec(source))) {
    if (ids.has(idm[1])) {
      issue("ERROR", "CORRECT-004", file, lineOf(source, idm.index), `duplicate id="${idm[1]}" (first used at line ${ids.get(idm[1])})`)
    } else {
      ids.set(idm[1], lineOf(source, idm.index))
    }
  }

  // JSX-001: Radix components must sit inside the parent that supplies context
  for (const c of jsxContextIssues(file, source)) {
    issue("ERROR", "JSX-001", file, c.line, `<${c.name}> needs a <${c.need.join(" | ")}> ancestor — Radix throws at runtime without it`)
  }

  // PERF-001: hover scale on large blocks (warn — motion rule)
  for (let i = 0; i < lines.length; i++) {
    if (/whileHover=\{\{\s*scale:\s*1\.0\d/.test(lines[i])) {
      issue("WARN", "PERF-001", file, i + 1, "whileHover scale on a block — prefer translate/shadow for large surfaces")
    }
  }
}

function lintCssSource(file, source) {
  // CSS-001: raw #hex outside token definitions.
  // Blocks that define brand gradients (.text-gradient, glow/glass effects)
  // may use hex by design — tracked with a tiny block scanner.
  const lines = source.split("\n")
  let inBrandBlock = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/\.dark\s+\.text-gradient|\.text-gradient\s*\{|\.glow-effect|\.glass-effect|:root|\.dark\s*\{/.test(line)) {
      inBrandBlock++
    }
    const hex = line.match(/#[0-9a-fA-F]{6}\b/g) || []
    if (hex.length && inBrandBlock === 0 && !/--[\w-]+\s*:/.test(line)) {
      issue("WARN", "CSS-001", file, i + 1, `raw hex color ${[...new Set(hex)].join(", ")} outside token definitions`)
    }
    if (inBrandBlock > 0 && /^\s*\}/.test(line)) inBrandBlock--
  }
}

function lintTsFile(file) {
  lintTsSource(file, readFileSync(path.join(root, file), "utf8"))
}
function lintCssFile(file) {
  lintCssSource(file, readFileSync(path.join(root, file), "utf8"))
}

// ---------------------------------------------------------------- selftest
// Fixtures prove the critic DETECTS each violation (a green run on a clean
// repo means nothing if the rules are broken), and that it does NOT fire on
// correct code (false-positive guard — every one of these was a real bug in
// an earlier revision of this file).
const SELFTESTS = [
  { rule: "DESIGN-001", file: "app/x/page.tsx", src: `<div className="glow-effect rounded-lg" />` },
  { rule: "DESIGN-002", file: "app/x/page.tsx", src: `<span className="text-zinc-400">hi</span>` },
  { rule: "DESIGN-002", file: "app/x/page.tsx", src: `<span className="text-red-500">hi</span>` },
  { rule: "DESIGN-002", file: "app/x/page.tsx", src: `<div className="bg-white shadow" />` },
  { rule: "DESIGN-002", file: "app/x/page.tsx", src: `<div className="text-black" />` },
  { rule: "DESIGN-002", file: "app/x/page.tsx", src: `<div className="mt-4"><span className="text-white">orphan</span></div>` },
  { rule: "DESIGN-003", file: "app/x/page.tsx", src: `<h2 className="text-2xl font-bold">Title</h2>` },
  { rule: "DESIGN-004", file: "app/x/page.tsx", src: `<button className="bg-primary text-primary">Go</button>` },
  { rule: "CORRECT-001", file: "app/x/page.tsx", src: `fetch("http://localhost:3000/api/apply")` },
  { rule: "CORRECT-002", file: "app/x/page.tsx", src: `  console.log("debug me")` },
  { rule: "VOICE-001", file: "app/x/page.tsx", src: `<h2 className="font-display">Ship faster!</h2>` },
  { rule: "CORRECT-003", file: "app/x/page.tsx", src: `<a href="https://example.com/blog">ext</a>` },
  { rule: "CORRECT-004", file: "app/x/page.tsx", src: `<input id="email" />\n<input id="email" />` },
  { rule: "CORRECT-005", file: "app/x/page.tsx", src: `<Image src="/hero.png" width={10} height={10} />` },
  { rule: "CORRECT-007", file: "app/x/page.tsx", src: `<form className="grid gap-4">` },
  { rule: "PERF-001", file: "app/x/page.tsx", src: `<div whileHover={{ scale: 1.02 }} />` },
  { rule: "JSX-001", file: "app/x/page.tsx", src: `<Tabs value="a">\n  <div className="flex p-1">\n    <TabsTrigger value="a">A</TabsTrigger>\n  </div>\n</Tabs>` },
  { rule: "JSX-001", file: "app/x/page.tsx", src: `<form>\n  <RadioGroupItem value="a" />\n</form>` },
  { rule: "CSS-001", file: "app/globals.css", src: `.x {\n  color: #ff00aa;\n}` },
]
const NEGATIVE_TESTS = [
  { file: "app/x/page.tsx", src: `<div className="rounded-2xl border border-border/70 bg-card p-5">\n  <h2 className="font-display text-2xl">Clean</h2>\n  <span className="text-muted-foreground">ok</span>\n</div>` },
  { file: "app/x/page.tsx", src: `<section className="bg-[#0A0A0A]">\n  <p className="text-white/60">secondary</p>\n  <p className="text-white">primary</p>\n</section>` },
  { file: "app/x/page.tsx", src: `<button className="bg-primary text-primary-foreground">Go</button>` },
  { file: "app/x/page.tsx", src: `<form onSubmit={handleSubmit}>` },
  { file: "app/x/page.tsx", src: `<a href="https://github.com/NajibOladosu/ApplyOS">repo</a>` },
  { file: "app/x/page.tsx", src: `<div className="bg-white/5 text-white/80" />` },
  { file: "proxy.ts", src: `const ALLOWED = ["http://localhost:3000"]` },
  { file: "app/globals.css", src: `:root {\n  --primary: #18bb70;\n}` },
  { file: "app/x/page.tsx", src: `<Tabs value="a">\n  <TabsList>\n    <TabsTrigger value="a">A</TabsTrigger>\n  </TabsList>\n  <TabsContent value="a">ok</TabsContent>\n</Tabs>` },
  { file: "app/x/page.tsx", src: `/* a <TabsTrigger value="a">A</TabsTrigger> in prose must not count */\n<div className="bg-card" />` },
  { file: "app/x/page.tsx", src: `// <TabsList> also in a line comment\nconst url = "https://example.com/a"` },
  { file: "app/x/page.tsx", src: `<Select value="a">\n  <SelectTrigger><SelectValue /></SelectTrigger>\n  <SelectContent>\n    <SelectItem value="a">A</SelectItem>\n  </SelectContent>\n</Select>` },
]

function runSelfTest() {
  let pass = 0
  const failures = []
  for (const t of SELFTESTS) {
    issues.length = 0
    if (t.file.endsWith(".css")) lintCssSource(t.file, t.src)
    else lintTsSource(t.file, t.src)
    const hit = issues.find((i) => i.rule === t.rule)
    if (hit) pass++
    else failures.push(`MISS  ${t.rule.padEnd(11)} not detected in: ${t.src.replace(/\n/g, " ").slice(0, 60)}`)
  }
  for (const t of NEGATIVE_TESTS) {
    issues.length = 0
    if (t.file.endsWith(".css")) lintCssSource(t.file, t.src)
    else lintTsSource(t.file, t.src)
    if (issues.length === 0) pass++
    else failures.push(`FALSE ${issues[0].rule.padEnd(11)} on clean code: ${t.src.replace(/\n/g, " ").slice(0, 60)}`)
  }
  const total = SELFTESTS.length + NEGATIVE_TESTS.length
  console.log(`CRITIC SELFTEST: ${pass}/${total} passed (${SELFTESTS.length} detection + ${NEGATIVE_TESTS.length} false-positive guards)`)
  for (const f of failures) console.log(`  ✗ ${f}`)
  if (!failures.length) console.log("  ✓ every rule fires on its violation and stays silent on correct code")
  return failures.length ? 1 : 0
}

// ---------------------------------------------------------------- run
function main() {
  if (process.argv.includes("--selftest")) process.exit(runSelfTest())

  const files = inScopeFiles()
  for (const f of files) {
    if (!exists(f)) continue
    if (f.endsWith(".css")) lintCssFile(f)
    else lintTsFile(f)
  }
  function exists(f) {
    try {
      readFileSync(path.join(root, f))
      return true
    } catch {
      return false
    }
  }

  // -------------------------------------------------------------- report
  const errors = issues.filter((i) => i.severity === "ERROR")
  const warns = issues.filter((i) => i.severity === "WARN")
  issues.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)))

  let md = `# Critic Report — ApplyOS Design Gauntlet\n\n`
  md += `Generated: ${new Date().toISOString()}\n`
  md += `Scope: ${files.length} files changed vs main\n`
  md += `Result: **${errors.length} errors**, ${warns.length} warnings\n\n`
  md += `| Severity | Rule | File | Line | Issue |\n|---|---|---|---|---|\n`
  for (const i of issues) {
    md += `| ${i.severity} | ${i.rule} | \`${i.file}\` | ${i.line} | ${i.message.replace(/\|/g, "\\|")} |\n`
  }
  md += `\n## Rules\n\n`
  md += `- **DESIGN-001** legacy \`glow-effect\`/\`glass-effect\` classes in components\n`
  md += `- **DESIGN-002** hardcoded non-theme color tokens (white/black/zinc/green/red)\n`
  md += `- **DESIGN-003** headings missing \`font-display\`\n`
  md += `- **DESIGN-004** \`bg-primary\` + \`text-primary\` on one element (zero contrast)\n`
  md += `- **CORRECT-001** absolute localhost/127.0.0.1 URLs in client code\n`
  md += `- **CORRECT-002** leftover console.log/debug/info\n`
  md += `- **CORRECT-003** external href not on allowlist (warn)\n`
  md += `- **CORRECT-004** duplicate id in a file\n`
  md += `- **CORRECT-005** \`<Image>\` without alt\n`
  md += `- **CORRECT-007** \`<form>\` without onSubmit\n`
  md += `- **VOICE-001** heading contains "!"\n`
  md += `- **PERF-001** whileHover scale on blocks (warn)\n`
  md += `- **CSS-001** raw hex outside token definitions (warn)\n`
  md += `- **JSX-001** Radix component outside its required parent (runtime throw)\n`

  if (!quiet) {
    mkdirSync("docs/critique", { recursive: true })
    writeFileSync("docs/critique/critic-report.md", md)
  }

  // stdout summary
  console.log(`CRITIC: ${files.length} files scanned → ${errors.length} errors, ${warns.length} warnings`)
  for (const i of issues) {
    console.log(`  ${i.severity === "ERROR" ? "✗" : "⚠"} ${i.rule} ${i.file}:${i.line} — ${i.message}`)
  }
  if (!quiet) console.log(`\nReport: docs/critique/critic-report.md`)
  process.exit(errors.length > 0 ? 1 : 0)
}

// run as a CLI, or import as a library (scripts/fixer.mjs reuses the same rules)
const isEntry = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isEntry) main()

export { lintTsSource, lintCssSource, issues, surfaceAt }
