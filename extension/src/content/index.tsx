import { PageDetector } from './page-detector'
import { DataExtractor } from './data-extractor'
import { QuestionExtractor } from './question-extractor'

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'EXTRACT_PAGE') {
        handleExtraction().then(sendResponse)
        return true
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
    } catch (error: any) {
        console.error('Extraction failed:', error)
        return { success: false, error: error.message }
    }
}

console.log('ApplyOS Content Script Loaded (Message Mode)')
