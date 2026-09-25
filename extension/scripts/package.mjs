#!/usr/bin/env node
/**
 * Build a Chrome Web Store upload zip.
 *
 * Produces a deterministic archive: entries are sorted and timestamps pinned, so
 * packaging the same source twice gives the same bytes. That makes the artifact
 * hashable and comparable between the version that was reviewed and the version
 * running locally.
 *
 * Refuses to package if the permission audit fails, which keeps a build that
 * would be rejected (Purple Potassium) from ever being uploaded.
 *
 * Usage: npm run package
 */

import { readdirSync, readFileSync, statSync, writeFileSync, unlinkSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { verifyZip } from './verify-zip.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist', 'chrome')

function walk(dir, acc = []) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full, acc)
        else acc.push(full)
    }
    return acc
}

async function main() {
    // Gate on the permission audit before packaging.
    try {
        execFileSync(process.execPath, [join(ROOT, 'scripts', 'audit-permissions.mjs')], {
            stdio: 'inherit',
        })
    } catch {
        console.error('\nRefusing to package: the permission audit failed.')
        console.error('Uploading this build would repeat the Purple Potassium violation.')
        process.exit(1)
    }

    let manifest
    try {
        manifest = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8'))
    } catch {
        console.error(`No build found at ${DIST}. Run \`npm run build\` first.`)
        process.exit(1)
    }

    // jszip is a devDependency; fail with a useful message rather than a stack.
    let JSZip
    try {
        JSZip = (await import('jszip')).default
    } catch {
        console.error('jszip is required to package. Run `npm install` first.')
        process.exit(1)
    }

    const zip = new JSZip()
    const files = walk(DIST).sort()

    for (const file of files) {
        const name = relative(DIST, file).split('\\').join('/')
        zip.file(name, readFileSync(file), { date: new Date('2026-01-01T00:00:00Z') })
    }

    const out = join(ROOT, `applyos-extension-v${manifest.version}.zip`)
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    writeFileSync(out, buffer)

    // Verify what was actually written — the store resolves manifest paths
    // against the zip root with exact case, and a packaging regression is
    // cheaper to catch here than as a dashboard rejection.
    const verification = await verifyZip(buffer, out)
    if (!verification.ok) {
        unlinkSync(out)
        console.error('\nPackaged zip failed verification — deleted it so it cannot be uploaded:')
        for (const problem of verification.problems) {
            console.error(`  ✗ ${problem.id}${problem.path ? ` (${problem.path})` : ''}`)
            console.error(`      ${problem.detail}`)
        }
        process.exit(1)
    }

    const kb = (buffer.length / 1024).toFixed(1)
    console.log(`\nPackaged ${files.length} files → ${relative(ROOT, out)} (${kb} KiB)`)
    console.log(`  name:     ${manifest.name}`)
    console.log(`  version:  ${manifest.version}`)
    console.log(`  perms:    ${(manifest.permissions ?? []).join(', ')}`)
    console.log('  verified: every manifest path resolves to a non-empty entry')
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
