import React from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/globals.css'
import { QuickAddOverlay } from './quick-add-overlay'
import { Plus } from 'lucide-react'

console.log('ApplyOS content script loaded on:', window.location.href)

function QuickAddButton() {
    const [showOverlay, setShowOverlay] = React.useState(false)

    return (
        <>
            {!showOverlay && (
                <button
                    onClick={() => setShowOverlay(true)}
                    className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl transition-all hover:scale-105 z-[999998]"
                    title="Quick Add to ApplyOS"
                    style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}
                >
                    <Plus className="w-8 h-8" />
                </button>
            )}

            {showOverlay && <QuickAddOverlay onClose={() => setShowOverlay(false)} />}
        </>
    )
}

// Initialize on content script load
function init() {
    const container = document.createElement('div')
    container.id = 'applyos-extension-root'
    container.style.cssText = 'position: fixed; z-index: 999999; pointer-events: none;'

    // Make children clickable
    const style = document.createElement('style')
    style.textContent = '#applyos-extension-root > * { pointer-events: auto; }'
    document.head.appendChild(style)

    document.body.appendChild(container)

    const root = createRoot(container)
    root.render(<QuickAddButton />)
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
} else {
    init()
}
