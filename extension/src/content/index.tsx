import { PageDetector } from './page-detector'
import { DataExtractor } from './data-extractor'
import { QuestionExtractor } from './question-extractor'
import { envelope, type AtsId } from '../types/messages'

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // The autofill protocol (extension/src/types/messages.ts) is handled by the
    // autofill listener, which may be loaded in this same frame. Decline
    // explicitly — returning undefined lets that listener answer. Answering here
    // would pre-empt it, because the first sendResponse wins.
    if ((request as { aos?: number })?.aos === 1) return undefined

    if (request.type === 'EXTRACT_PAGE') {
        handleExtraction().then(sendResponse)
        return true
    }
    if (request.type === 'EXTRACT_QUESTIONS') {
        try {
            const questions = QuestionExtractor.extract()
            sendResponse({ success: true, questions })
        } catch (e) {
            sendResponse({ success: false, error: e instanceof Error ? e.message : String(e) })
        }
        return false // Synchronous response (or fully handled)
    }

    // Without this branch an unrecognised type got no response at all: the
    // listener returned undefined, the port closed, and the sender's callback
    // fired with chrome.runtime.lastError ("message port closed before a
    // response was received") — which reads as a connection failure rather than
    // as "this build does not know that message".
    sendResponse({ success: false, error: `Unknown message type: ${String(request?.type)}` })
    return false
})

async function handleExtraction() {
    try {
        const detection = PageDetector.detect()

        // Always attempt extraction, even if not high confidence (let user edit)
        const data = await DataExtractor.extract(detection) || {
            title: document.title,
            url: window.location.href,
            platform: detection.platform,
            confidence: 0
        }

        return { success: true, data }
    } catch (error) {
        console.error('Extraction failed:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
}

// ---------------------------------------------------------------------------
// Frame registration
// ---------------------------------------------------------------------------
// With all_frames: true this script runs in every matching frame, including the
// cross-origin Greenhouse application iframe embedded in an employer's career
// site. The popup cannot know which frame holds the form, so each frame reports
// itself and the worker ranks them (service-worker.ts bestFrame).
//
// PageDetector.platform is NOT the autofill ATS id: it is a closed union of six
// job boards (page-detector.ts:3) and cannot express ashby/workable/icims/taleo.
// The real ATS identity comes from the adapter registry once it lands; until
// then only the three it can express are mapped, and everything else is
// 'generic' rather than a guess.
function platformToAtsId(platform: string): AtsId {
    switch (platform) {
        case 'greenhouse': return window.top === window.self ? 'greenhouse' : 'greenhouse_embed'
        case 'lever': return 'lever'
        case 'workday': return 'workday'
        default: return 'generic'
    }
}

function countFormControls(): number {
    return document.querySelectorAll(
        'form input:not([type="hidden"]), form textarea, form select'
    ).length
}

function announceFrame(): void {
    try {
        const detection = PageDetector.detect()
        const fieldCount = countFormControls()
        chrome.runtime.sendMessage(
            envelope({
                t: 'AOS_FRAME_HELLO' as const,
                ats: platformToAtsId(detection.platform),
                // origin + pathname only: query strings carry requisition tokens
                // and, on some ATS, candidate identifiers.
                url: window.location.origin + window.location.pathname,
                hasForm: fieldCount > 0,
                fieldCount,
                isTopFrame: window.top === window.self
            }),
            () => void chrome.runtime.lastError // worker asleep is not an error worth surfacing
        )
    } catch {
        // A frame we cannot announce is a frame the popup will not target. That
        // degrades to the existing top-frame behaviour rather than breaking.
    }
}

announceFrame()

console.log('ApplyOS Content Script Loaded (Message Mode)')
