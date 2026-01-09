import React from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/globals.css'

function Options() {
    return (
        <div className="max-w-4xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-6">ApplyOS Settings</h1>

            <div className="space-y-6">
                <div className="card">
                    <h2 className="text-xl font-semibold mb-4">Platform Detection</h2>
                    <p className="text-gray-600 mb-4">
                        Configure which job platforms to automatically detect
                    </p>

                    <div className="space-y-2">
                        {['LinkedIn', 'Indeed', 'Workday', 'Greenhouse', 'Lever', 'Glassdoor'].map(platform => (
                            <label key={platform} className="flex items-center space-x-2">
                                <input type="checkbox" defaultChecked className="rounded" />
                                <span>{platform}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="card">
                    <h2 className="text-xl font-semibold mb-4">Notifications</h2>
                    <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span>Enable browser notifications</span>
                    </label>
                </div>

                <button className="btn-primary">
                    Save Settings
                </button>
            </div>
        </div>
    )
}

const root = createRoot(document.getElementById('root')!)
root.render(<Options />)
