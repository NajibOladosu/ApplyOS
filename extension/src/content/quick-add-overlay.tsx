import React, { useState, useEffect } from 'react'
import { PageDetector } from './page-detector'
import { DataExtractor, type ExtractedData } from './data-extractor'
import { APIClient } from '../lib/api/api-client'
import { AuthManager } from '../lib/auth/auth-manager'
import { Loader2, Check, X, Building, MapPin, DollarSign, Briefcase } from 'lucide-react'

export function QuickAddOverlay({ onClose }: { onClose: () => void }) {
    const [step, setStep] = useState<'extracting' | 'review' | 'saving' | 'success' | 'auth_required'>('extracting')
    const [data, setData] = useState<Partial<ExtractedData>>({})
    const [user, setUser] = useState<any>(null)

    useEffect(() => {
        startExtraction()
    }, [])

    const startExtraction = async () => {
        // 1. Check Login
        const currentUser = await AuthManager.getCurrentUser()
        if (!currentUser) {
            setStep('auth_required')
            return
        }
        setUser(currentUser)

        // 2. Detect Page
        const detection = PageDetector.detect()

        // 3. Extract Data
        if (detection.isApplicationPage) {
            const extracted = await DataExtractor.extract(detection)
            if (extracted) {
                setData(extracted)
                setStep('review')
            } else {
                // Fallback if extraction fails but page detected
                setData({
                    title: document.title,
                    url: window.location.href,
                    platform: 'unknown'
                })
                setStep('review')
            }
        } else {
            // Manual entry mode
            setData({
                url: window.location.href,
                platform: 'unknown',
                title: document.title
            })
            setStep('review')
        }
    }

    const handleSave = async () => {
        if (!user || !data.title) return

        setStep('saving')
        try {
            await APIClient.createApplication({
                user_id: user.id,
                title: data.title,
                company: data.company || null,
                url: data.url,
                job_description: data.description || null,
                status: 'applied' // Default to applied since we are on the page
            })
            setStep('success')

            // Auto close after 2s
            setTimeout(onClose, 2000)
        } catch (e) {
            console.error(e)
            alert('Failed to save application')
            setStep('review')
        }
    }

    if (step === 'auth_required') {
        return (
            <div className="fixed inset-0 bg-black/50 z-[999999] flex items-center justify-center font-sans">
                <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
                    <h2 className="text-xl font-bold mb-2 text-gray-900">Sign in Required</h2>
                    <p className="text-gray-600 mb-4">Please sign in to the ApplyOS extension to save this job.</p>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="flex-1 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                        <button onClick={() => alert('Please click the extension icon to sign in')} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">OK</button>
                    </div>
                </div>
            </div>
        )
    }

    if (step === 'extracting' || step === 'saving') {
        return (
            <div className="fixed bottom-6 right-20 bg-white shadow-xl rounded-full px-6 py-3 flex items-center gap-3 z-[999999] font-sans border border-gray-100">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span className="font-medium text-gray-700">
                    {step === 'extracting' ? 'Analyzing page...' : 'Saving to ApplyOS...'}
                </span>
            </div>
        )
    }

    if (step === 'success') {
        return (
            <div className="fixed bottom-6 right-20 bg-green-50 shadow-xl rounded-full px-6 py-3 flex items-center gap-3 z-[999999] font-sans border border-green-200">
                <Check className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-700">Saved successfully!</span>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-[999999] flex items-center justify-center font-sans">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-900">Add Application</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Job Title</label>
                        <input
                            value={data.title || ''}
                            onChange={e => setData({ ...data, title: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-medium"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Company</label>
                            <div className="relative">
                                <Building className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input
                                    value={data.company || ''}
                                    onChange={e => setData({ ...data, company: e.target.value })}
                                    className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Location</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input
                                    value={data.location || ''}
                                    onChange={e => setData({ ...data, location: e.target.value })}
                                    className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Salary</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input
                                    value={data.salary || ''}
                                    onChange={e => setData({ ...data, salary: e.target.value })}
                                    className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Type</label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input
                                    value={data.employmentType || ''}
                                    onChange={e => setData({ ...data, employmentType: e.target.value })}
                                    className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Description</label>
                        <div className="border rounded-lg p-3 bg-gray-50 max-h-40 overflow-y-auto text-sm text-gray-600">
                            {data.description ? 'Detailed job description captured' : 'No description detected'}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        Save to ApplyOS
                    </button>
                </div>
            </div>
        </div>
    )
}
