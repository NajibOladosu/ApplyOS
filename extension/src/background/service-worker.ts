// Background service worker for ApplyOS.
//
// Spec: extension/AUTOFILL_ARCHITECTURE.md sections 8.1 and 8.2.
//
// THERE IS EXACTLY ONE chrome.runtime.onMessage LISTENER IN THIS WORKER, AND IT
// MUST STAY THAT WAY.
//
// Chrome invokes every registered onMessage listener and the FIRST call to
// sendResponse wins; later calls are dropped. The previous version of this file
// answered unrecognised types synchronously from a `default:` arm, so any second
// listener doing async work — awaiting getSession(), say — could never reply:
// the synchronous error always beat it. Adding an autofill listener alongside it
// would have failed silently and looked like a network bug. Route new message
// types through the dispatcher below instead of adding a listener.

import { isAosEnvelope, type CsToSwBody, type FrameRecord } from '../types/messages'

console.log('ApplyOS background service worker loaded')

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('ApplyOS extension installed')
        chrome.storage.local.set({
            settings: {
                enabledPlatforms: ['linkedin', 'indeed', 'workday', 'greenhouse', 'lever', 'glassdoor'],
                notifications: true,
                autoDetect: true
            }
        })
    }
})

// ---------------------------------------------------------------------------
// Frame registry
// ---------------------------------------------------------------------------
// With all_frames: true a tab runs one content script per matching frame. A
// chrome.tabs.sendMessage without an explicit frameId broadcasts to all of them
// and resolves with whichever replies first — on a Greenhouse embed that is the
// career site's own chrome, not the application form in the iframe. Frames
// self-register here so the popup can target the right one.
//
// This map is module scope and therefore dies with the worker (~30s idle). That
// is fine and deliberate: the registry is a cache of a fact that can be
// re-derived at any time by re-querying the frames, and a stale entry is worse
// than a missing one.

const frames = new Map<number, FrameRecord[]>()

function recordFrame(tabId: number, frameId: number, body: Extract<CsToSwBody, { t: 'AOS_FRAME_HELLO' }>): void {
    const list = frames.get(tabId)?.filter((f) => f.frameId !== frameId) ?? []
    list.push({
        tabId,
        frameId,
        ats: body.ats,
        url: body.url,
        hasForm: body.hasForm,
        fieldCount: body.fieldCount,
        isTopFrame: body.isTopFrame,
        seenAt: Date.now()
    })
    frames.set(tabId, list)
}

/**
 * Best frame to talk to in a tab: most fillable fields wins, top frame breaks a
 * tie. Returns null when nothing has registered, and the caller should fall back
 * to frame 0 rather than broadcasting.
 */
export function bestFrame(tabId: number): FrameRecord | null {
    const list = frames.get(tabId)
    if (!list || list.length === 0) return null
    const withForm = list.filter((f) => f.hasForm)
    const pool = withForm.length > 0 ? withForm : list
    return [...pool].sort(
        (a, b) => b.fieldCount - a.fieldCount || Number(b.isTopFrame) - Number(a.isTopFrame)
    )[0]
}

chrome.tabs.onRemoved.addListener((tabId) => frames.delete(tabId))
chrome.tabs.onUpdated.addListener((tabId, info) => {
    // A committed navigation invalidates every frame record for the tab.
    if (info.status === 'loading') frames.delete(tabId)
})

// ---------------------------------------------------------------------------
// The single dispatcher
// ---------------------------------------------------------------------------

type Respond = (response?: unknown) => void

/**
 * Returns true when the response will be delivered asynchronously, matching the
 * chrome.runtime.onMessage contract. Returning true without ever calling
 * sendResponse leaks the port, so every async path must respond on all branches.
 */
function dispatchAutofill(body: CsToSwBody, sender: chrome.runtime.MessageSender, respond: Respond): boolean {
    switch (body.t) {
        case 'AOS_FRAME_HELLO': {
            const tabId = sender.tab?.id
            if (typeof tabId === 'number' && typeof sender.frameId === 'number') {
                recordFrame(tabId, sender.frameId, body)
            }
            respond({ t: 'SW_ACK' })
            return false
        }

        default:
            // Known envelope, handler not implemented yet. Answer explicitly so the
            // caller gets a real error instead of a closed port.
            respond({
                t: 'SW_ERROR',
                code: 'UNKNOWN',
                message: `autofill handler not implemented: ${String((body as { t?: string }).t)}`
            })
            return false
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (isAosEnvelope(message)) {
        return dispatchAutofill(message.body as CsToSwBody, sender, sendResponse)
    }

    switch ((message as { type?: string })?.type) {
        case 'QUICK_ADD':
            console.log('Quick add request:', (message as { payload?: unknown }).payload)
            sendResponse({ success: true })
            return false

        case 'GET_BEST_FRAME': {
            const tabId = (message as { tabId?: number }).tabId
            sendResponse({ success: true, frame: typeof tabId === 'number' ? bestFrame(tabId) : null })
            return false
        }

        default:
            // Deliberately NO sendResponse here. See the header: a synchronous
            // catch-all reply from this listener would pre-empt any other
            // listener's async response. Returning undefined lets another
            // listener answer; if none does, the sender sees lastError, which is
            // the correct signal for a genuinely unhandled type.
            return undefined
    }
})

export function updateBadge(text: string, color: string) {
    chrome.action.setBadgeText({ text })
    chrome.action.setBadgeBackgroundColor({ color })
}
