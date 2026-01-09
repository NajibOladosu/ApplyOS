import React from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/globals.css'

console.log('ApplyOS content script loaded on:', window.location.href)

// Initialize Quick Add overlay
function initQuickAdd() {
    // Create container for React app
    const container = document.createElement('div')
    container.id = 'applyos-extension-root'
    container.style.cssText = 'position: fixed; z-index: 999999;'
    document.body.appendChild(container)

    // Render Quick Add component
    const root = createRoot(container)
    root.render(<QuickAddButton />)
}

function QuickAddButton() {
    const [isOpen, setIsOpen] = React.useState(false)

    const handleClick = () => {
        console.log('Quick Add clicked')
        setIsOpen(true)

        // Send message to background
        chrome.runtime.sendMessage({
            type: 'QUICK_ADD',
            payload: { url: window.location.href }
        })
    }

    return (
        <>
            <button
                onClick={handleClick}
                className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl transition-all"
                title="Quick Add to ApplyOS"
            >
                +
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h2 className="text-xl font-bold mb-4">Quick Add</h2>
                        <p className="text-gray-600 mb-4">
                            Detecting application page...
                        </p>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="btn-secondary"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}

// Initialize when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQuickAdd)
} else {
    initQuickAdd()
}
