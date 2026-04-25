import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/globals.css'

interface Settings {
    enabledPlatforms: string[]
    notifications: boolean
    autoDetect: boolean
}

const DEFAULT_SETTINGS: Settings = {
    enabledPlatforms: ['linkedin', 'indeed', 'workday', 'greenhouse', 'lever', 'glassdoor'],
    notifications: true,
    autoDetect: true
}

const PLATFORMS = [
    { id: 'linkedin', label: 'LinkedIn' },
    { id: 'indeed', label: 'Indeed' },
    { id: 'workday', label: 'Workday' },
    { id: 'greenhouse', label: 'Greenhouse' },
    { id: 'lever', label: 'Lever' },
    { id: 'glassdoor', label: 'Glassdoor' }
]

function Options() {
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        chrome.storage.local.get(['settings'], (result) => {
            if (result.settings) {
                setSettings({ ...DEFAULT_SETTINGS, ...result.settings })
            }
        })
    }, [])

    const handlePlatformToggle = (platformId: string) => {
        setSettings(prev => ({
            ...prev,
            enabledPlatforms: prev.enabledPlatforms.includes(platformId)
                ? prev.enabledPlatforms.filter(p => p !== platformId)
                : [...prev.enabledPlatforms, platformId]
        }))
        setSaved(false)
    }

    const handleNotificationsToggle = () => {
        setSettings(prev => ({ ...prev, notifications: !prev.notifications }))
        setSaved(false)
    }

    const handleSave = () => {
        chrome.storage.local.set({ settings }, () => {
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        })
    }

    return (
        <div className="max-w-4xl mx-auto p-8 bg-background min-h-screen text-foreground">
            <h1 className="text-3xl font-bold mb-6">ApplyOS Settings</h1>

            <div className="space-y-6">
                <div className="card">
                    <h2 className="text-xl font-semibold mb-4">Platform Detection</h2>
                    <p className="text-muted-foreground mb-4">
                        Configure which job platforms to automatically detect
                    </p>

                    <div className="space-y-2">
                        {PLATFORMS.map(platform => (
                            <label key={platform.id} className="flex items-center space-x-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={settings.enabledPlatforms.includes(platform.id)}
                                    onChange={() => handlePlatformToggle(platform.id)}
                                    className="rounded accent-primary w-4 h-4"
                                />
                                <span className="text-foreground group-hover:text-primary transition-colors">
                                    {platform.label}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="card">
                    <h2 className="text-xl font-semibold mb-4">Notifications</h2>
                    <label className="flex items-center space-x-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={settings.notifications}
                            onChange={handleNotificationsToggle}
                            className="rounded accent-primary w-4 h-4"
                        />
                        <span className="text-foreground group-hover:text-primary transition-colors">
                            Enable browser notifications
                        </span>
                    </label>
                </div>

                <button onClick={handleSave} className="btn-primary">
                    {saved ? '✓ Saved!' : 'Save Settings'}
                </button>
            </div>
        </div>
    )
}

const root = createRoot(document.getElementById('root')!)
root.render(<Options />)
