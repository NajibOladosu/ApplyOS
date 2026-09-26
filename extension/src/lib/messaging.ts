/**
 * Message passing to the active tab, with the inject-then-retry fallback.
 *
 * Content scripts auto-run on the supported job platforms. Everywhere else the
 * user can still trigger a scan/fill — activeTab + scripting let us inject the
 * bundle on demand, which is the difference between "works on the big five"
 * and "works anywhere the user asks for it".
 */

export async function sendToActiveTab<T = unknown>(message: unknown): Promise<T | null> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return null

    try {
        return (await chrome.tabs.sendMessage(tab.id, message)) as T
    } catch {
        try {
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
            return (await chrome.tabs.sendMessage(tab.id, message)) as T
        } catch {
            return null
        }
    }
}
