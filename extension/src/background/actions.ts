/**
 * User-triggered page actions: context-menu items, keyboard shortcuts, and the
 * AI-answer proxy.
 *
 * Everything here runs without the popup open, which is what makes these entry
 * points different from the popup's flow: the profile comes from the
 * chrome.storage cache the popup/options page keep warm, and AI answers are
 * fetched here because content scripts cannot read the Supabase session from
 * chrome.storage (only extension pages and the worker can).
 */

import { normalizeProfile, type AutofillProfile } from '../shared/profile'
import { upsertApplication, getStoredSession, isConfigured } from '../lib/api/rest'

const PROFILE_CACHE_KEY = 'autofillProfile'

export type SendToTab = <T = unknown>(message: unknown) => Promise<T>

async function cachedProfile(): Promise<AutofillProfile> {
    const stored = await chrome.storage.local.get([PROFILE_CACHE_KEY])
    return normalizeProfile(stored[PROFILE_CACHE_KEY])
}

/**
 * Send a message to the active tab, injecting the content script first if this
 * page did not auto-load it (content scripts are registered for supported job
 * platforms; the user may also trigger an action elsewhere via activeTab).
 */
async function withActiveTab<T>(handler: (tabId: number, send: SendToTab) => Promise<T>): Promise<T | null> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return null

    const send: SendToTab = (message) => chrome.tabs.sendMessage(tab.id!, message)

    try {
        return await handler(tab.id, send)
    } catch {
        // No receiver: the content script is not on this page. Inject it
        // (activeTab covers the permission) and retry once.
        try {
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
            return await handler(tab.id, send)
        } catch {
            return null
        }
    }
}

// ---------------------------------------------------------------------------
// Fill the field under the right-click
// ---------------------------------------------------------------------------

export async function fillFieldFromContextMenu(): Promise<void> {
    const profile = await cachedProfile()

    await withActiveTab(async (_tabId, send) => {
        const first = await send<{
            filled: boolean
            label: string | null
            needsAnswer: boolean
            error?: string
        }>({ type: 'AUTOFILL_FILL_CONTEXT', profile })

        if (!first || first.filled || !first.needsAnswer) return

        // The engine does not know this question — fetch an AI answer and
        // write it into the same field.
        const answer = await fetchAiAnswer(first.label ?? '', await pageContextText(send))
        if (!answer) return

        await send({ type: 'AUTOFILL_FILL_CONTEXT', profile, answer })
    })
}

// ---------------------------------------------------------------------------
// Fill the whole form (context menu / Alt+Shift+F)
// ---------------------------------------------------------------------------

export async function fillFormFromCommand(): Promise<void> {
    const profile = await cachedProfile()

    await withActiveTab(async (_tabId, send) => {
        const scan = await send<{
            success: boolean
            rows?: Array<{
                index: number
                label: string
                kind: string
                status: string
                value: string | null
            }>
        }>({ type: 'AUTOFILL_SCAN', profile })

        if (!scan?.success || !scan.rows) return

        const ready = scan.rows.filter((row) => row.status === 'ready')
        if (ready.length > 0) {
            await send({ type: 'AUTOFILL_APPLY', indexes: ready.map((row) => row.index), slow: false })
        }

        // Open-ended questions the profile cannot answer: generate up to five,
        // sequentially so the API's previousAnswers context stays coherent.
        const openEnded = scan.rows
            .filter((row) => row.status === 'unknown' || row.status === 'missing-value')
            .filter((row) => row.kind === 'textarea')
            .slice(0, 5)

        if (openEnded.length > 0) {
            const pageText = await pageContextText(send)
            const answered: Array<{ question: string; answer: string }> = []
            for (const row of openEnded) {
                const answer = await fetchAiAnswer(row.label, pageText, answered)
                if (!answer) continue
                answered.push({ question: row.label, answer })
                await send({ type: 'AUTOFILL_FIELD', index: row.index, value: answer })
            }
        }
    })
}

// ---------------------------------------------------------------------------
// Save the job on this page (context menu / Alt+Shift+S)
// ---------------------------------------------------------------------------

export async function captureJobFromCommand(): Promise<void> {
    if (!isConfigured()) return

    const result = await withActiveTab(async (_tabId, send) => {
        const extraction = await send<{
            success: boolean
            data?: { title?: string; company?: string | null; jobDescription?: string | null; url?: string }
        }>({ type: 'EXTRACT_PAGE' })

        if (!extraction?.success || !extraction.data?.title) return null

        return upsertApplication({
            title: extraction.data.title,
            company: extraction.data.company ?? null,
            url: extraction.data.url ?? null,
            job_description: extraction.data.jobDescription ?? null,
        })
    })

    await notifyCaptureResult(result)
}

async function notifyCaptureResult(result: { id: string; created: boolean } | null): Promise<void> {
    if (result) {
        await chrome.notifications.create(`applyos:capture:${result.id}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
            title: result.created ? 'Job saved' : 'Already in your applications',
            message: result.created
                ? 'Saved as a draft. Open ApplyOS to add notes and set a status.'
                : 'Updated the existing application with the latest details from this page.',
            contextMessage: 'ApplyOS',
        })
    } else {
        await chrome.notifications.create('applyos:capture:failed', {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
            title: 'Could not save this job',
            message: 'Sign in to ApplyOS from the extension popup, then try again.',
            contextMessage: 'ApplyOS',
        })
    }
}

// ---------------------------------------------------------------------------
// AI answer proxy (content scripts cannot reach the session or the API)
// ---------------------------------------------------------------------------

async function fetchAiAnswer(
    question: string,
    jobDescription: string | undefined,
    previousAnswers?: Array<{ question: string; answer: string }>
): Promise<string | null> {
    if (!question.trim()) return null

    const session = await getStoredSession()
    if (!session?.access_token) return null

    const base = await getAppBaseUrl()
    if (!base) return null

    try {
        const response = await fetch(`${base}/api/extension/answer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ question, jobDescription, previousAnswers }),
        })
        if (!response.ok) return null
        const data = (await response.json()) as { answer?: string }
        return data.answer?.trim() || null
    } catch {
        return null
    }
}

/**
 * Answer a question on behalf of the content script (right-click "Redo answer"
 * or the popup's per-row generate). Keeps the token inside extension contexts.
 */
export async function proxyAiAnswer(
    question: string,
    jobDescription?: string,
    previousAnswers?: Array<{ question: string; answer: string }>
): Promise<{ answer: string | null }> {
    const answer = await fetchAiAnswer(question, jobDescription, previousAnswers)
    return { answer }
}

/**
 * Visible page text, capped, to ground AI answers when the posting has not
 * been saved as an application yet. Sent by the content script.
 */
async function pageContextText(send: SendToTab): Promise<string | undefined> {
    try {
        const result = await send<{ text?: string }>({ type: 'GET_PAGE_TEXT' })
        return result?.text || undefined
    } catch {
        return undefined
    }
}

async function getAppBaseUrl(): Promise<string> {
    const stored = await chrome.storage.local.get(['appBaseUrl'])
    return (stored.appBaseUrl as string) || 'https://www.applyos.io'
}
