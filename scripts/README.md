# Critic → Fixer loop

Two small agents that keep the Design Gauntlet's standards enforced automatically
instead of by memory. Both are plain Node scripts — no API keys, no network.

| npm script | What it does |
|---|---|
| `npm run critic` | Review every file changed vs `main` → `docs/critique/critic-report.md`, exit 1 on any error |
| `npm run critic:selftest` | Prove every critic rule fires on a violation and stays silent on clean code |
| `npm run fix` | Auto-fix every mechanically-safe finding, verify each fix with the critic's rules, report the rest as human work |
| `npm run fix:dry` | Preview the fixes without writing anything |
| `npm run fix:selftest` | Prove every autofix removes its violation and is idempotent |
| `npm run loop` | The full pass: critic → fixer (`--verify`, runs tsc + eslint) → critic |

**The loop is done when `npm run loop` ends with `0 errors, 0 warnings` and exit 0.**

## Rules the critic enforces

| Rule | Meaning |
|---|---|
| DESIGN-001 | legacy `glow-effect` / `glass-effect` classes → token-based primary shadows |
| DESIGN-002 | hardcoded color families (zinc/gray/slate/stone/neutral, green/red), solid `bg-white` / `text-black`, `text-white` with no dark surface behind it |
| DESIGN-003 | `<h1..h4>` without `font-display` |
| DESIGN-004 | `bg-primary` + `text-primary` on one element (zero contrast) |
| CORRECT-001 | absolute `localhost` / `127.0.0.1` URLs in client code |
| CORRECT-002 | leftover `console.log` / `debug` / `info` |
| CORRECT-003 ⚠ | external `href` outside the allowlist (warn — confirm intent) |
| CORRECT-004 | duplicate `id` in one file |
| CORRECT-005 | `<Image>` without `alt` |
| CORRECT-007 | `<form>` without `onSubmit` (full-page reload bug) |
| VOICE-001 | `!` in a heading |
| PERF-001 ⚠ | `whileHover` scale on a large surface |
| CSS-001 ⚠ | raw `#hex` outside token definitions |

Shared logic lives in `scripts/critic.mjs`; `scripts/fixer.mjs` imports the same
linter so the two can never disagree about what "clean" means — and the fixer
re-lints after every change to prove the fix actually removed the violation.

## What the fixer will not touch

Fixes that need a decision rather than a substitution are escalated with a hint,
never guessed at: missing `onSubmit` (which handler?), unallowlisted external
links (real destination?), hover-scale removal (which hover treatment?), raw CSS
hex (which variable?), duplicate ids (which references break?), and `<Image>`
alt text (`alt=""` is inserted, but flagged for review when it may convey content).

## Extending the rules

Add detection in `scripts/critic.mjs` (`lintTsSource` / `lintCssSource`) and a
fixture in each script's `SELFTESTS` / `FIXTURES`. Add an autofix to `LINE_FIXES`
in `scripts/fixer.mjs`, or a `MANUAL_HINTS` entry if it needs a human. Run both
selftests — a rule that cannot be proven to fire is not a rule.

## Current status

```
CRITIC:  42 files scanned → 0 errors, 0 warnings   (exit 0)
FIXER:   42 files · 0 changed · 0 auto-fixes · 0 manual
tsc:     only pre-existing test-file errors · eslint: clean
critic:selftest 25/25 · fix:selftest 14/14
```
