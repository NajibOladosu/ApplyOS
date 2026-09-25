#!/usr/bin/env node
/**
 * Verify a Chrome Web Store upload zip — mechanically, the way the store reads it.
 *
 * "The icon file icons/icon-128.png is missing from the uploaded package" does
 * not mean the bytes are absent. The store resolves every manifest path
 * relative to a manifest.json at the ZIP ROOT, with exact case, forward-slash
 * separators, one entry per file, and non-zero length. A zip that looks
 * perfectly fine in Explorer or macOS Finder can still fail all of that:
 *
 *   - zipped the FOLDER instead of its contents  -> manifest at chrome/manifest.json
 *   - PowerShell Compress-Archive (PS 5.1)       -> entries named icons\icon-16.png
 *   - re-zipped on a case-insensitive filesystem  -> Icons/Icon-16.PNG
 *   - a truncated upload                          -> zero-byte entries
 *   - a script adding files twice                 -> duplicate entries
 *
 * Usage:
 *   node scripts/verify-zip.mjs              # newest applyos-extension-v*.zip
 *   node scripts/verify-zip.mjs <zip>        # any zip, e.g. the exact file you uploaded
 *
 * Exits non-zero if the zip would be rejected, with the reason named.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

export async function verifyZip(buffer, label = 'zip') {
    const JSZip = (await import('jszip')).default
    const problems = []

    let zip
    try {
        zip = await JSZip.loadAsync(buffer)
    } catch (error) {
        return {
            ok: false,
            problems: [
                {
                    id: 'ZIP-UNREADABLE',
                    detail: `Not a readable zip: ${error.message}`,
                },
            ],
        }
    }

    // ── Entry-table health — problems here make a zip look fine everywhere ──
    // ── except to Chrome. ────────────────────────────────────────────────────
    const entries = Object.values(zip.files).filter((entry) => !entry.dir)
    const names = entries.map((entry) => entry.name)
    const seen = new Set()

    for (const name of names) {
        if (name.includes('\\')) {
            problems.push({
                id: 'ZIP-BACKSLASH',
                detail: `Entry "${name}" uses a backslash separator. Chrome compares manifest paths against forward-slash entry names, so it will never match. This is the classic PowerShell 5.1 Compress-Archive bug — rebuild with \`npm run package\`.`,
            })
        }
        if (name.includes('__MACOSX') || name.split('/').some((part) => part.startsWith('._'))) {
            problems.push({
                id: 'ZIP-JUNK',
                detail: `Entry "${name}" is Finder metadata. Re-zip without macOS resource forks or use \`npm run package\`.`,
            })
        }
        if (seen.has(name)) {
            problems.push({ id: 'ZIP-DUPLICATE', detail: `Entry "${name}" appears more than once.` })
        }
        seen.add(name)
    }

    // ── The manifest must sit at the root, full stop ─────────────────────────
    const rootManifest = zip.file('manifest.json')
    if (!rootManifest) {
        const nested = names.filter((name) => name.endsWith('/manifest.json') || name === 'manifest.json')
        const hint = nested.length
            ? `Found manifest at: ${nested.join(', ')}. You zipped the folder instead of its contents — the store only reads a root-level manifest.json, so every path in it (icons included) resolves against the wrong root.`
            : 'No manifest.json anywhere in the archive.'
        problems.push({ id: 'ZIP-NO-ROOT-MANIFEST', detail: hint })
        return { ok: false, problems }
    }

    let manifest
    try {
        manifest = JSON.parse(await rootManifest.async('string'))
    } catch (error) {
        problems.push({ id: 'ZIP-BAD-MANIFEST', detail: `Root manifest.json is not valid JSON: ${error.message}` })
        return { ok: false, problems }
    }

    // ── Every path the manifest references must exist, exact case, non-empty ─
    const literal = new Set()
    const globs = new Set()
    const add = (path) => {
        if (typeof path === 'string' && path) literal.add(path)
    }

    for (const icon of Object.values(manifest.icons ?? {})) add(icon)
    for (const icon of Object.values(manifest.action?.default_icon ?? {})) add(icon)
    add(manifest.action?.default_popup)
    add(manifest.background?.service_worker)
    add(manifest.options_page)
    add(manifest.options_ui?.page)
    add(manifest.devtools_page)
    for (const script of manifest.content_scripts ?? []) {
        for (const js of script.js ?? []) add(js)
        for (const css of script.css ?? []) add(css)
    }
    for (const group of manifest.web_accessible_resources ?? []) {
        for (const resource of group.resources ?? []) {
            if (resource.includes('*')) globs.add(resource)
            else add(resource)
        }
    }

    const byName = new Map(entries.map((entry) => [entry.name, entry]))

    for (const path of literal) {
        const entry = byName.get(path)
        if (!entry) {
            const caseVariant = names.find((name) => name.toLowerCase() === path.toLowerCase())
            problems.push({
                id: 'ZIP-FILE-MISSING',
                path,
                detail: caseVariant
                    ? `Manifest references "${path}" but the zip contains "${caseVariant}". Zip entry names are case-sensitive to the store.`
                    : `Manifest references "${path}" but no entry has that exact path.`,
            })
            continue
        }
        const bytes = await entry.async('uint8array')
        if (bytes.length === 0) {
            problems.push({
                id: 'ZIP-FILE-EMPTY',
                path,
                detail: `"${path}" is present but zero bytes — the archive was truncated or built from an empty directory.`,
            })
        }
    }

    const globToRegExp = (glob) =>
        new RegExp('^' + glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$')
    for (const glob of globs) {
        const pattern = globToRegExp(glob)
        if (!names.some((name) => pattern.test(name))) {
            problems.push({
                id: 'ZIP-GLOB-EMPTY',
                path: glob,
                detail: `Web-accessible pattern "${glob}" matches no files in the zip.`,
            })
        }
    }

    return { ok: problems.length === 0, problems, manifest, fileCount: names.length, label }
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function resolveTarget(argument) {
    if (argument) {
        if (!existsSync(argument)) {
            console.error(`No such file: ${argument}`)
            process.exit(2)
        }
        return argument
    }

    const candidates = readdirSync(ROOT)
        .filter((name) => /^applyos-extension-v.*\.zip$/.test(name))
        .map((name) => ({ name, mtime: statSync(join(ROOT, name)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)

    if (candidates.length === 0) {
        console.error('No applyos-extension-v*.zip found. Run `npm run package` or pass a zip path.')
        process.exit(2)
    }
    return join(ROOT, candidates[0].name)
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const target = resolveTarget(process.argv[2])
    const result = await verifyZip(readFileSync(target), target)

    console.log(`ZIP VERIFY: ${target}`)
    if (result.fileCount !== undefined) {
        console.log(`  entries:   ${result.fileCount}`)
        console.log(`  name:      ${result.manifest?.name}`)
        console.log(`  version:   ${result.manifest?.version}`)
    }

    if (result.ok) {
        console.log('\nEvery path the manifest references resolves to a non-empty entry. Safe to upload.')
    } else {
        console.log(`\n${result.problems.length} problem(s) — this is the zip the store would reject:`)
        for (const problem of result.problems) {
            console.log(`  ✗ ${problem.id}${problem.path ? ` (${problem.path})` : ''}`)
            console.log(`      ${problem.detail}`)
        }
        process.exit(1)
    }
}
