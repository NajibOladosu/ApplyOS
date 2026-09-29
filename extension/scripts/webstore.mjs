#!/usr/bin/env node
/**
 * Chrome Web Store API v2 client used by the publish workflow.
 *
 * Usage:
 *   node scripts/webstore.mjs version          # print the newest version the store knows about
 *   node scripts/webstore.mjs publish <zip>    # upload the zip and submit it for review
 *
 * Env: CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN, CWS_PUBLISHER_ID,
 *      CWS_EXTENSION_ID
 */

import { readFileSync } from 'node:fs'

const API = 'https://chromewebstore.googleapis.com'
const POLL_INTERVAL_MS = 5_000
const POLL_ATTEMPTS = 24

function env(name) {
    const value = process.env[name]
    if (!value) {
        console.error(`Missing required env var ${name}`)
        process.exit(1)
    }
    return value
}

async function accessToken() {
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: env('CWS_CLIENT_ID'),
            client_secret: env('CWS_CLIENT_SECRET'),
            refresh_token: env('CWS_REFRESH_TOKEN'),
            grant_type: 'refresh_token',
        }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(`OAuth token exchange failed: ${JSON.stringify(body)}`)
    return body.access_token
}

async function call(token, method, url, body) {
    const isZip = Buffer.isBuffer(body)
    const headers = { Authorization: `Bearer ${token}` }
    if (body) headers['Content-Type'] = isZip ? 'application/zip' : 'application/json'
    const res = await fetch(url, {
        method,
        headers,
        body: isZip ? body : body && JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${JSON.stringify(json)}`)
    return json
}

const itemPath = () => `publishers/${env('CWS_PUBLISHER_ID')}/items/${env('CWS_EXTENSION_ID')}`
const fetchStatus = (token) => call(token, 'GET', `${API}/v2/${itemPath()}:fetchStatus`)

function compareVersions(a, b) {
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
        if (diff !== 0) return diff
    }
    return 0
}

function storeVersions(status) {
    return [status.publishedItemRevisionStatus, status.submittedItemRevisionStatus]
        .flatMap((revision) => revision?.distributionChannels ?? [])
        .map((channel) => channel.crxVersion)
        .filter(Boolean)
}

async function latestVersion() {
    const token = await accessToken()
    const versions = storeVersions(await fetchStatus(token))
    console.log(versions.sort(compareVersions).at(-1) ?? '0.0.0')
}

async function publish(zipPath) {
    const token = await accessToken()

    const status = await fetchStatus(token)
    if (status.takenDown) throw new Error('Item is taken down; resolve the policy violation in the dashboard first.')

    const upload = await call(
        token,
        'POST',
        `${API}/upload/v2/${itemPath()}:upload`,
        readFileSync(zipPath),
    )
    let uploadState = upload.uploadState
    for (let i = 0; uploadState === 'IN_PROGRESS' && i < POLL_ATTEMPTS; i++) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
        uploadState = (await fetchStatus(token)).lastAsyncUploadState
    }
    if (uploadState !== 'SUCCEEDED') {
        throw new Error(`Upload did not succeed (state: ${uploadState}): ${JSON.stringify(upload)}`)
    }
    console.log(`Uploaded ${upload.crxVersion ?? zipPath}`)

    const result = await call(token, 'POST', `${API}/v2/${itemPath()}:publish`, {
        publishType: 'DEFAULT_PUBLISH',
    })
    console.log(`Submitted for publishing — state: ${result.state}`)
    for (const warning of result.warningInfo?.warnings ?? []) console.warn(`warning: ${JSON.stringify(warning)}`)
}

const [command, arg] = process.argv.slice(2)
const run = command === 'version' ? latestVersion() : command === 'publish' && arg ? publish(arg) : null
if (!run) {
    console.error('Usage: webstore.mjs version | publish <zip>')
    process.exit(1)
}
run.catch((error) => {
    console.error(error.message)
    process.exit(1)
})
