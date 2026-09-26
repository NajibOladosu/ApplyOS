import { PageDetector } from './page-detector'
import { DataExtractor } from './data-extractor'
import { QuestionExtractor } from './question-extractor'
import {
    handleScan,
    handleApply,
    handleFillField,
    handleFillContext,
    rememberContextTarget,
    handleNavigate,
    handleLearn,
    handleAttach,
    handleClearHighlights,
    handleReset,
} from './autofill-runtime'

// Listen for messages from the popup and the background worker.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'EXTRACT_PAGE') {
        handleExtraction().then(sendResponse)
        return true
    }
    if (request.type === 'GET_PAGE_TEXT') {
        try {
            // Capped visible text, used to ground AI answers when the posting
            // has not been saved as an application yet.
            const text = (document.body.innerText || '').replace(/\n{3,}/g, '\n\n').slice(0, 12_000)
            sendResponse({ text })
        } catch (e: any) {
            sendResponse({ text: null, error: e.message })
        }
        return false
    }
    if (request.type === 'EXTRACT_QUESTIONS') {
        try {
            const questions = QuestionExtractor.extract()
            sendResponse({ success: true, questions })
        } catch (e: any) {
            sendResponse({ success: false, error: e.message })
        }
        return false // Synchronous response (or fully handled)
    }

    // ── Autofill runtime ────────────────────────────────────────────────────
    if (request.type === 'AUTOFILL_SCAN') {
        try {
            sendResponse(handleScan(request))
        } catch (e: any) {
            sendResponse({ success: false, error: e.message })
        }
        return false
    }
    if (request.type === 'AUTOFILL_APPLY') {
        handleApply(request)
            .then(sendResponse)
            .catch((e: any) => sendResponse({ success: false, error: e.message }))
        return true
    }
    if (request.type === 'AUTOFILL_FIELD') {
        handleFillField(request)
            .then(sendResponse)
            .catch((e: any) => sendResponse({ success: false, error: e.message }))
        return true
    }
    if (request.type === 'AUTOFILL_FILL_CONTEXT') {
        handleFillContext(request)
            .then(sendResponse)
            .catch((e: any) => sendResponse({ success: false, error: e.message }))
        return true
    }
    if (request.type === 'AUTOFILL_NAVIGATE') {
        handleNavigate(request)
            .then(sendResponse)
            .catch((e: any) => sendResponse({ success: false, error: e.message }))
        return true
    }
    if (request.type === 'AUTOFILL_LEARN') {
        try {
            sendResponse(handleLearn())
        } catch (e: any) {
            sendResponse({ success: false, error: e.message })
        }
        return false
    }
    if (request.type === 'AUTOFILL_ATTACH') {
        try {
            sendResponse(handleAttach(request))
        } catch (e: any) {
            sendResponse({ ok: false, error: e.message })
        }
        return false
    }
    if (request.type === 'AUTOFILL_CLEAR_HIGHLIGHTS') {
        sendResponse(handleClearHighlights())
        return false
    }
    if (request.type === 'AUTOFILL_RESET') {
        sendResponse(handleReset())
        return false
    }
})

// Remember the element under the right-click so the background's context-menu
// handler can fill exactly that field.
document.addEventListener('contextmenu', rememberContextTarget, { capture: true, passive: true })

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
    } catch (error: any) {
        console.error('Extraction failed:', error)
        return { success: false, error: error.message }
    }
}

console.log('ApplyOS Content Script Loaded (Message Mode)')
