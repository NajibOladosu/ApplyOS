import React, { useState, useEffect } from 'react'
import { PageDetector } from './page-detector'
import { DataExtractor, type ExtractedData } from './data-extractor'
import { APIClient } from '../lib/api/api-client'
import { AuthManager } from '../lib/auth/auth-manager'
import { Loader2, Check, X, Building, MapPin, DollarSign, Briefcase, Save } from 'lucide-react'

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
                setData({
                    title: document.title,
                    url: window.location.href,
                    platform: 'unknown'
                })
                setStep('review')
            }
        } else {
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
                status: 'applied'
            })
            setStep('success')
            setTimeout(onClose, 2000)
        } catch (e) {
            console.error(e)
            alert('Failed to save application')
            setStep('review')
        }
    }

    // Common Overlay Styles - Dark Theme
    const overlayClass = "fixed inset-0 bg-black/80 backdrop-blur-sm z-[999999] flex items-center justify-center font-sans"
    const cardClass = "bg-[#101010] border border-[#1A1A1A] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col text-[#EDEDED]"
    const inputClass = "w-full pl-9 pr-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg focus:ring-1 focus:ring-[#00FF88] focus:border-[#00FF88] outline-none text-[#EDEDED] placeholder-[#555]"
    const labelClass = "block text-[10px] font-bold text-[#B5B5B5] uppercase mb-1 tracking-wider"

    if (step === 'auth_required') {
        return (
            <div className={overlayClass}>
                <div className="bg-[#101010] border border-[#1A1A1A] rounded-xl p-6 max-w-sm w-full shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                    <h2 className="text-xl font-bold mb-2 text-white">Sign in Required</h2>
                    <p className="text-[#B5B5B5] mb-4 text-sm">Please sign in to the ApplyOS extension to save this job.</p>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="flex-1 px-4 py-2 bg-[#1A1A1A] text-white rounded-lg hover:bg-[#2A2A2A] transition-colors border border-[#2A2A2A]">Cancel</button>
                        <button onClick={() => alert('Please click the extension icon to sign in')} className="flex-1 px-4 py-2 bg-[#00FF88] text-black font-bold rounded-lg hover:bg-[#00CC6A] transition-colors">OK</button>
                    </div>
                </div>
            </div>
        )
    }

    if (step === 'extracting' || step === 'saving') {
        return (
            <div className="fixed bottom-6 right-20 bg-[#101010] border border-[#1A1A1A] shadow-[0_0_20px_rgba(0,0,0,0.5)] rounded-full px-6 py-3 flex items-center gap-3 z-[999999] font-sans">
                <Loader2 className="w-5 h-5 animate-spin text-[#00FF88]" />
                <span className="font-medium text-[#EDEDED]">
                    {step === 'extracting' ? 'Analyzing page...' : 'Saving to ApplyOS...'}
                </span>
            </div>
        )
    }

    if (step === 'success') {
        return (
            <div className="fixed bottom-6 right-20 bg-[#101010] border border-[#00FF88]/30 shadow-[0_0_20px_rgba(0,255,136,0.2)] rounded-full px-6 py-3 flex items-center gap-3 z-[999999] font-sans">
                <Check className="w-5 h-5 text-[#00FF88]" />
                <span className="font-medium text-[#00FF88]">Saved successfully!</span>
            </div>
        )
    }

    return (
        <div className={overlayClass}>
            <div className={cardClass}>
                {/* Header */}
                <div className="px-6 py-4 border-b border-[#1A1A1A] flex justify-between items-center bg-[#0A0A0A]">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#00FF88] shadow-[0_0_10px_#00FF88]"></div>
                        <h2 className="text-lg font-bold text-white">Add Application</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-[#1A1A1A] rounded-full transition-colors text-gray-500 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-[#0A0A0A]/50">
                    <div>
                        <label className={labelClass}>Job Title</label>
                        <input
                            value={data.title || ''}
                            onChange={e => setData({ ...data, title: e.target.value })}
                            className={inputClass}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Company</label>
                            <div className="relative">
                                <Building className="absolute left-3 top-2.5 w-4 h-4 text-[#555]" />
                                <input
                                    value={data.company || ''}
                                    onChange={e => setData({ ...data, company: e.target.value })}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Location</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-[#555]" />
                                <input
                                    value={data.location || ''}
                                    onChange={e => setData({ ...data, location: e.target.value })}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Salary</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-[#555]" />
                                <input
                                    value={data.salary || ''}
                                    onChange={e => setData({ ...data, salary: e.target.value })}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Type</label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-[#555]" />
                                <input
                                    value={data.employmentType || ''}
                                    onChange={e => setData({ ...data, employmentType: e.target.value })}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Description</label>
                        <div className="border border-[#1A1A1A] rounded-lg p-3 bg-[#101010] max-h-32 overflow-y-auto text-xs text-[#888] font-mono leading-relaxed">
                            {data.description ? 'Detailed job description captured' : 'No description detected'}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[#1A1A1A] bg-[#0A0A0A] flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 text-[#B5B5B5] font-medium hover:text-white transition-colors text-sm">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-5 py-2.5 bg-[#00FF88] text-black font-bold rounded-lg hover:bg-[#00CC6A] transition-all shadow-[0_0_15px_rgba(0,255,136,0.2)] text-sm flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Save Application
                    </button>
                </div>
            </div>
        </div>
    )
}
