/**
 * Reads the active tab's job posting (if any) using the content script, with
 * an on-demand injection fallback for sites it isn't auto-injected on.
 *
 * Shared by the "This page" view (which shows what the page contains) and the
 * save flow (which pre-fills the review form).
 */

export interface ExtractedData {
    title?: string | null
    company?: string | null
    location?: string | null
    description?: string | null
    url?: string | null
    salary?: string | null
    employmentType?: string | null
    platform?: string
    confidence?: number
    manual_entry?: boolean
}

export interface ActiveTabInfo {
    tab: chrome.tabs.Tab | null
    /** The extracted posting, or null when the page is not a job posting. */
    posting: ExtractedData | null
}

function requestExtraction(tabId: number): Promise<any> {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_PAGE' }, (response) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
            else resolve(response)
        })
    })
}

export async function extractActiveTab(): Promise<ActiveTabInfo> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return { tab: null, posting: null }

    let response: any
    try {
        response = await requestExtraction(tab.id)
    } catch {
        // The content script only auto-injects on supported hosts. On any other
        // site the user has explicitly asked us to read the page, so inject on
        // demand via activeTab and retry once.
        try {
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
            // The script registers its message listener synchronously, but give
            // the isolated world a beat to settle before the retry.
            await new Promise((resolve) => setTimeout(resolve, 400))
            response = await requestExtraction(tab.id)
        } catch (error) {
            console.warn('[ApplyOS] could not read the active tab', error)
            return { tab, posting: null }
        }
    }

    const data: ExtractedData | null = response?.success ? response.data : null
    const posting =
        data && (data.title || data.company)
            ? { ...data, url: data.url || tab.url || null }
            : null

    return { tab, posting }
}

/** True when the extracted data is good enough to treat as a detected job. */
export function isPosting(posting: ExtractedData | null | undefined): boolean {
    return Boolean(posting && (posting.title || posting.company))
}
