# Permission justifications

Chrome Web Store review flagged `alarms` as unused (*Purple Potassium*). The
2.2.1 manifest removes it, and the background worker no longer schedules alarms.
Earlier versions also declared `notifications` before it was implemented; that
permission is now used by capture results and user-initiated reminder checks.

This file explains the permissions in the upload. Use the matching justifications
in the Developer Dashboard when resubmitting. `scripts/audit-permissions.mjs`
checks the source; packaging also rejects a stale built manifest.

Every permission below is actively used. None are held "for future features".

---

## Permissions

### `activeTab`

**Used by:** `src/lib/page-detect.ts`, `src/background/actions.ts`, `src/popup/components/ApplicationDetail.tsx`

Reads the URL and title of the tab the user is looking at, so the popup can prefill a
job it was not written for. Granted only for the current tab, and only after the user
clicks the extension — it is not persistent host access.

Also what lets the popup offer to scan a site ApplyOS has no built-in extractor for.
Because of `activeTab`, the extension does **not** need `<all_urls>`.

### `contextMenus`

**Used by:** `src/background/service-worker.ts` (`chrome.contextMenus.create`, `.removeAll`, `.onClicked`)

Adds three items to the page's right-click menu, each an explicit user action:

1. **Fill this field with ApplyOS** (on editable fields) — fills the single
   field under the cursor, generating an AI answer when the profile has no
   saved one.
2. **Fill this application with ApplyOS** — fills the form on the page from the
   saved profile, the same engine the popup drives.
3. **Save this job to ApplyOS** — captures the posting into the tracker.

The menus are registered on install/startup and removed before re-creating, so
no duplicate items accumulate across updates.

### `notifications`

**Used by:** `src/background/service-worker.ts`, `src/background/actions.ts` (`chrome.notifications.create`)

Delivers follow-up and long-silence notifications **when the user opens the
popup or presses Check now in Settings**. The popup checks after authentication,
not on an hourly schedule. Each application is notified only once per threshold.
`src/background/actions.ts` also creates notifications for context-menu and
keyboard-shortcut job capture results. There are no background-only reminders.

### `scripting`

**Used by:** `src/lib/page-detect.ts`, `src/background/actions.ts` (`chrome.scripting.executeScript`)

Injects the extraction and autofill bundle into the active tab when the user asks
ApplyOS to read or fill a page it does not already run on (right-click menu,
keyboard shortcut, or the popup's scan button). Programmatic injection is
a deliberate choice over a `<all_urls>` content script: the extension is dormant on
every site except the job platforms below until the user asks otherwise.

### `storage`

**Used by:** `src/background/service-worker.ts`, `src/lib/theme.ts`, `src/lib/api/supabase-client.ts`

Persists, on the user's device only:

- the autofill profile and saved answers,
- the Supabase auth session,
- reminder history (so a reminder is shown once per threshold),
- user preferences.

---

## Host permissions

Persistent host permissions are restricted to endpoints fetched by extension
pages or the service worker (including Supabase auth and PostgREST). The wildcard
for ApplyOS includes both the apex domain and its subdomains.

| Host | Why |
| --- | --- |
| `https://*.applyos.io/*` | Calls to ApplyOS APIs for analysis, answers and cover letters |
| `https://*.supabase.co/*` | Supabase auth, application/profile data and document storage, at the project URL set at build time |

The eight supported job sites remain in `content_scripts.matches` for automatic
extraction and autofill; those declarative matches do not need matching
`host_permissions`. One-off scans/injections after a popup click, shortcut or
context-menu action use `activeTab` instead of persistent host access.

### Grants deliberately *not* requested

- **`alarms`** — no hourly sweep; checks happen on popup open or in Settings.
- **Job-platform host permissions / `<all_urls>`** — automatic scripts use
  `content_scripts.matches`; one-off actions use `activeTab`.
- **`tabs`** — not needed. The four sensitive tab properties (`url`, `pendingUrl`,
  `title`, `favIconUrl`) are only ever read on the active tab, which `activeTab`
  already grants. Requesting `tabs` would widen access to every tab for no benefit.
- **`cookies`, `history`, `bookmarks`, `webRequest`, `downloads`, `geolocation`,
  `clipboardRead`** — none are used anywhere in the codebase.

---

## Verifying this document

```sh
cd extension
npm run audit      # every permission must resolve to a matching API call
npm test           # includes reminder-engine behaviour
npm run build      # rebuild the actual Chrome upload files
npm run package    # rejects a dist manifest that differs from audited source
```

The audit is wired into `npm run build`, so a build that declares an unused
permission cannot be produced.
