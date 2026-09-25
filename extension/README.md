# ApplyOS Browser Extension

The browser half of ApplyOS: capture job postings, autofill application forms
from your saved profile, answer open-ended questions with AI, and keep the
tracker current — without leaving the page.

## Features

### Autofill (review-first)

- **Scan and review** — one button reads every question on the page (including
  open shadow roots, radio groups, and styled selects) and shows what ApplyOS
  would write, row by row, before anything is touched.
- **Deterministic matching** — fields are identified by the HTML `autocomplete`
  token first, then label aliases, then fuzzy similarity; anything below the
  confidence threshold is surfaced as "Unsure" rather than guessed.
- **Multi-step copilot** — "All steps" fills the current step, clicks Next (a
  navigation scorer refuses Back / Cancel / Withdraw / Save-draft buttons),
  rescans, and repeats until the review step. It never submits for you.
- **Fast mode** — skip the typing simulation for speed, or keep it for ATS
  platforms that validate on each keystroke.
- **AI answers** — open-ended questions ("Why this company?") get grounded
  answers built from your analysed resume, your autofill profile, and the
  saved-answers library, generated sequentially so one application tells one
  coherent story.
- **Auto-attach** — resume and cover-letter file inputs are filled from your
  document vault via `DataTransfer` (the drag-and-drop path), not left for
  manual uploading.
- **Answer library** — after a fill, questions you answered by hand are offered
  back as saved answers; recurring screening questions then fill themselves.
- **Right-click any field** — "Fill this field with ApplyOS" fills one field,
  with an AI answer when the profile has none. Keyboard shortcuts:
  `Alt+Shift+F` fills the form, `Alt+Shift+S` saves the job.

### Capture and tracking

- **Quick Add** — one click saves the posting you are reading, with title,
  company, and description extracted by platform-specific extractors.
- **Works beyond the list** — the context menu and shortcuts inject the bundle
  into the active tab on demand (`activeTab`), so capture and fill work on
  sites without a dedicated extractor.
- **Applications tab** — browse, search, and update statuses from the popup;
  deep-links into the web app for the full record.
- **Follow-up reminders** — an hourly sweep raises OS notifications for
  applications that have gone quiet (7 days: nudge, 21: decide), once per
  application per threshold. Badge shows the count due.

### Profile

- **One profile, every device** — identity, contact, links, work, eligibility,
  education, and voluntary answers live in `users.autofill_profile` and sync
  to the extension's local cache; offline edits win until they are pushed.

## Supported platforms

LinkedIn, Indeed, Workday, Greenhouse, Lever, Glassdoor, Ashby, and
SmartRecruiters — content scripts auto-run on all eight. Everywhere else, use
the right-click menu or the keyboard shortcuts.

## Store compliance

ApplyOS 1.0.0 was removed from the Chrome Web Store for declaring an unused
permission (*Purple Potassium*). Two mechanisms keep that from recurring:

- [`PERMISSIONS.md`](./PERMISSIONS.md) — the justification for every
  permission, written to be pasted into the Developer Dashboard.
- `npm run audit` — fails the build if any declared permission has no matching
  API call or any host permission has no reachable code path. Runs as part of
  `npm run build` and `npm run package`.

## Development setup

### Prerequisites

- Node.js 18+
- A Supabase project (the extension reads `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_APP_URL` from the
  repository root's `.env.local` at build time)

### Install and build

```bash
cd extension
npm install

# Development build with watch mode
npm run dev

# Production build (runs the permission audit + typecheck first)
npm run build

# Browser-specific builds (output to dist/<browser>)
npm run build:chrome
npm run build:firefox
npm run build:edge

# Chrome Web Store zip (deterministic; refuses to package if the audit fails)
npm run package
```

### Load unpacked

1. Run `npm run build`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select **`extension/dist/chrome`** — not the
   `extension/` root.

### Verification

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest: field matcher, fill engine, plan, profile, merge,
                    # reminder engine, step-navigation scoring
npm run audit       # permission audit
npm run verify:zip  # store-zip check: every manifest path must resolve to a
                    # non-empty entry (catches nested folders, backslash entry
                    # names from PowerShell zips, case mismatches, truncation)
                    # — also runs automatically inside `npm run package`
```

## Project structure

```text
extension/
├── src/
│   ├── background/        # Service worker: reminders, context menus, commands,
│   │                      # AI answer proxy, background capture
│   ├── content/           # Content script: page detection, extraction,
│   │                      # autofill runtime, step navigation
│   ├── popup/             # Popup UI (Autofill, This job, Applications)
│   ├── options/           # Settings page
│   ├── extractors/        # Platform-specific job data extractors
│   ├── lib/
│   │   ├── api/           # Supabase client + PostgREST helpers
│   │   ├── auth/          # Session management
│   │   ├── filler/        # The engine: dom -> matcher -> plan -> execute
│   │   ├── profile/       # Profile cache + cloud sync
│   │   ├── reminders/     # Follow-up reminder decision engine
│   │   └── design/        # Status metadata shared with the web app
│   └── shared/            # Canonical field registry + profile model
├── scripts/               # Permission audit, store packaging
├── manifest.json          # MV3 manifest (permissions documented in PERMISSIONS.md)
└── webpack.config.js
```

## Design system

The popup and options page share the web app's tokens one-for-one (light and
dark), with fonts self-hosted so the UI never depends on a network request.
See `src/styles/globals.css`, which mirrors `app/globals.css`.

## Roadmap

- Options-page profile editor with resume import (the
  `/api/extension/profile/import` endpoint and the blank-fields-only merge
  logic already ship in this branch).
- Floating one-click capture button on supported job pages.
- Profile section in the web app's profile page.

## License

MIT
