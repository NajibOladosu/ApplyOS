// Background service worker for ApplyOS extension

console.log('ApplyOS background service worker loaded')

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('ApplyOS extension installed')

        // Set default settings
        chrome.storage.local.set({
            settings: {
                enabledPlatforms: ['linkedin', 'indeed', 'workday', 'greenhouse', 'lever', 'glassdoor'],
                notifications: true,
                autoDetect: true
            }
        })
    }
})

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message)

    switch (message.type) {
        case 'QUICK_ADD':
            // Handle quick add request
            console.log('Quick add request:', message.payload)
            sendResponse({ success: true })
            break

        case 'AUTH_CHECK':
            // Check authentication status
            chrome.storage.local.get(['supabase_session'], (result) => {
                sendResponse({ authenticated: !!result.supabase_session })
            })
            return true // Keep message channel open for async response

        default:
            sendResponse({ error: 'Unknown message type' })
    }
})

// Update extension badge
function updateBadge(text: string, color: string) {
    chrome.action.setBadgeText({ text })
    chrome.action.setBadgeBackgroundColor({ color })
}

// Export for use in other modules
export { updateBadge }
