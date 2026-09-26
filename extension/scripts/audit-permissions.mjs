#!/usr/bin/env node
/**
 * Permission audit — guards against the "Purple Potassium" takedown recurring.
 *
 * Chrome removed ApplyOS 1.0.0 because `notifications` was declared in the
 * manifest while no code ever called `chrome.notifications.*`. Reviewers check
 * exactly one thing: does every declared permission have a matching API call?
 *
 * This script answers that question mechanically, so the answer can never drift
 * again. It runs on every build and fails the build on any unjustified entry.
 *
 * Two directions are checked:
 *   1. Every declared permission must be *used* somewhere in src/.
 *   2. Every declared host must be *reachable* — referenced by a content script
 *      match or a network/base-URL constant. Stale hosts are the "HOST
 *      permission not used" variant of the same violation.
 *
 * Usage: node scripts/audit-permissions.mjs [--json]
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')

/**
 * Each entry states the API call that justifies the permission.
 * `test` is matched against the concatenated source of every src/ file.
 * `note` is copied verbatim into PERMISSIONS.md, so write it for a reviewer.
 */
const PERMISSION_RULES = {
    storage: {
        test: /chrome\.storage\.(local|sync|session)\./,
        note: 'Persists the autofill profile, saved answers, and reminder state on the user\'s device.',
    },
    scripting: {
        test: /chrome\.scripting\.executeScript\(/,
        note: 'Injects the autofill/extraction bundle into the active tab when the user explicitly asks to fill or scan a page.',
    },
    contextMenus: {
        test: /chrome\.contextMenus\./,
        note: 'Right-click "Fill this field / Fill this application / Save this job with ApplyOS". Registered on install and handled by the background worker.',
    },
    notifications: {
        test: /chrome\.notifications\.create\(/,
        note: 'Follow-up reminders ("7 days since you applied to X") and application deadline alerts the user opts into.',
    },
    alarms: {
        test: /chrome\.alarms\.create\(/,
        note: 'Schedules the periodic check that produces the reminders above. A service worker cannot hold a timer, so this API is required to deliver them at all.',
    },
    activeTab: {
        // activeTab is a user-gesture grant, not an API. It is justified by the
        // extension reading the active tab's url/title after a user click.
        test: /chrome\.tabs\.query\(\s*\{[^}]*active:\s*true/,
        note: 'Reads the current tab\'s URL and title so the popup can prefill the job it is looking at. Granted only for the tab the user is on, only after they click the extension.',
    },
}

/**
 * Permissions that must NOT be present. Each is either unnecessary or a
 * strictly broader version of something already declared.
 */
const FORBIDDEN = {
    tabs: {
        reason:
            'Reading url/title on the active tab is already covered by activeTab. The `tabs` permission ' +
            'would additionally expose browsing history is not used anywhere.',
        unless: /chrome\.tabs\.(query|get)\([^)]*\)[\s\S]{0,200}?(pendingUrl|favIconUrl)/,
    },
    webRequest: { reason: 'No request interception is performed.' },
    history: { reason: 'Browsing history is never read.' },
    bookmarks: { reason: 'Bookmarks are never read.' },
    cookies: { reason: 'Cookies are never read directly; Supabase auth uses chrome.storage.' },
    downloads: { reason: 'Files are created via Blob URLs, not chrome.downloads.' },
    geolocation: { reason: 'Location comes from the user\'s saved profile, not the device sensor.' },
    clipboardRead: { reason: 'The clipboard is never read.' },
    '<all_urls>': { reason: 'Host access is limited to the platforms the product actually supports.' },
}

function walk(dir, acc = []) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full, acc)
        else if (/\.(ts|tsx|js|jsx)$/.test(entry)) acc.push(full)
    }
    return acc
}

function stripComments(source) {
    // Remove block and line comments so quoted examples in docs never satisfy a
    // rule. Mirrors the fix already applied to the web app's critic.
    return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function main() {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'))
    const files = walk(SRC)
    const sources = files.map((f) => ({
        path: relative(ROOT, f),
        code: stripComments(readFileSync(f, 'utf8')),
    }))
    const haystack = sources.map((s) => s.code).join('\n')

    const permissions = manifest.permissions ?? []
    const hosts = manifest.host_permissions ?? []
    const matchPatterns = (manifest.content_scripts ?? []).flatMap((cs) => cs.matches ?? [])

    const problems = []
    const ok = []

    // Direction 1: declared permission must be used.
    for (const permission of permissions) {
        const rule = PERMISSION_RULES[permission]
        if (!rule) {
            problems.push({
                id: 'PERM-UNKNOWN',
                permission,
                detail: `No justification recorded for "${permission}". Add it to PERMISSION_RULES with the API call that uses it, or remove it from the manifest.`,
            })
            continue
        }
        const match = rule.test.exec(haystack)
        if (!match) {
            // Locate the file where a call *would* live to make the error actionable.
            problems.push({
                id: 'PERM-UNUSED',
                permission,
                detail: `Declared but no matching call found. Expected something like: ${rule.test}`,
            })
        } else {
            const where = sources.find((s) => rule.test.test(s.code))
            ok.push({ permission, where: where?.path ?? 'src/', note: rule.note })
        }
    }

    // Direction 1b: forbidden / broader-than-needed permissions.
    for (const [permission, rule] of Object.entries(FORBIDDEN)) {
        const present = permission === '<all_urls>' ? hosts.includes(permission) : permissions.includes(permission)
        if (!present) continue
        if (rule.unless && rule.unless.test(haystack)) continue
        problems.push({
            id: 'PERM-BROAD',
            permission,
            detail: rule.reason,
        })
    }

    // Direction 2: every host must be reachable from a match pattern or a
    // network call. Catches hosts left behind when a platform is dropped.
    const hostUsed = (host) => {
        if (host === '*://*/*' || host === '<all_urls>') return true
        // Normalise "https://*.foo.com/*" -> "foo.com"
        const bare = host.replace(/^https?:\/\//, '').replace(/\/(\*)?$/, '').replace(/^\*\./, '')
        const apex = bare.replace(/^www\./, '')
        return (
            matchPatterns.some((m) => m.includes(apex)) ||
            haystack.includes(apex)
        )
    }

    for (const host of hosts) {
        if (!hostUsed(host)) {
            problems.push({
                id: 'HOST-UNUSED',
                permission: host,
                detail: 'Declared as a host permission but no content script matches it and no code references it. Remove it, or wire up the feature that needs it.',
            })
        }
    }

    const json = process.argv.includes('--json')

    if (json) {
        console.log(JSON.stringify({ permissions, hosts, ok, problems }, null, 2))
    } else {
        console.log(`PERMISSION AUDIT: ${permissions.length} permission(s), ${hosts.length} host(s)`)
        for (const entry of ok) {
            console.log(`  \u2713 ${entry.permission.padEnd(14)} used in ${entry.where}`)
        }
        for (const problem of problems) {
            console.log(`  \u2717 ${problem.id} ${problem.permission}`)
            console.log(`      ${problem.detail}`)
        }
        if (problems.length === 0) {
            console.log('\nAll declared permissions have a matching API call.')
        } else {
            console.log(`\n${problems.length} problem(s). Chrome Web Store rejects unused permissions (Purple Potassium).`)
        }
    }

    process.exit(problems.length === 0 ? 0 : 1)
}

main()
