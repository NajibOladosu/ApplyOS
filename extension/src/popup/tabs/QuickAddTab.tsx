import React, { useState, useEffect } from 'react'
import { APIClient } from '../../lib/api/api-client'
import { AuthManager } from '../../lib/auth/auth-manager'
import { Loader2, Check, AlertCircle, Building, MapPin, DollarSign, Briefcase, Save, RefreshCw } from 'lucide-react'

export function QuickAddTab() {
    const [step, setStep] = useState<'analyzing' | 'review' | 'saving' | 'success' | 'error'>('analyzing')
    const [data, setData] = useState<any>({})
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    useEffect(() => {
        analyzePage()
    }, [])

    const analyzePage = async () => {
        setStep('analyzing')
        setErrorMsg(null)

        try {
            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

            if (!tab?.id) {
                throw new Error('No active tab found')
            }

            // Inject content script if needed (handled by manifest, but ensure it's ready)
            // Send message
            chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE' }, (response) => {
                if (chrome.runtime.lastError) {
                    // Content script might not be injected (e.g. on chrome:// pages or restricted domains)
                    console.error(chrome.runtime.lastError)
                    setData({
                        title: tab.title || '',
                        url: tab.url || '',
                        platform: 'unknown',
                        manual_entry: true
                    })
                    setStep('review')
                    return
                }

                if (response && response.success) {
                    setData(response.data)
                    setStep('review')
                } else {
                    setData({
                        title: tab.title || '',
                        url: tab.url || '',
                        platform: 'unknown',
                        manual_entry: true
                    })
                    setStep('review')
                }
            })

        } catch (e: any) {
            console.error(e)
            setErrorMsg(e.message)
            setStep('error')
        }
    }

    const handleSave = async () => {
        const user = await AuthManager.getCurrentUser()
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
        } catch (e) {
            console.error(e)
            alert('Failed to save application')
            setStep('review')
        }
    }

    if (step === 'analyzing') {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6 bg-card m-4 rounded-xl border border-border">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                <h3 className="font-bold text-foreground">Analyzing Page...</h3>
                <p className="text-xs text-muted-foreground mt-1">Looking for job details</p>
            </div>
        )
    }

    if (step === 'success') {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6 bg-card m-4 rounded-xl border border-primary/30">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3 text-primary">
                    <Check className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-foreground">Saved Successfully!</h3>
                <p className="text-xs text-muted-foreground mt-1">Application added to your list.</p>
                <button
                    onClick={() => window.location.reload()} // Reset state
                    className="mt-4 text-xs text-primary hover:underline"
                >
                    Add another
                </button>
            </div>
        )
    }

    if (step === 'error') {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6 bg-card m-4 rounded-xl border border-destructive/30">
                <AlertCircle className="w-8 h-8 text-destructive mb-3" />
                <h3 className="font-bold text-foreground">Error</h3>
                <p className="text-xs text-muted-foreground mt-1">{errorMsg || 'Failed to analyze page'}</p>
                <button
                    onClick={analyzePage}
                    className="mt-4 px-4 py-2 bg-secondary text-foreground text-xs rounded-lg hover:bg-secondary/80"
                >
                    Try Again
                </button>
            </div>
        )
    }

    return (
        <div className="p-4 space-y-4 pb-20">
            {/* Header Info */}
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-1 rounded">
                    {data.platform || 'MANUAL ENTRY'}
                </span>
                <button
                    onClick={analyzePage}
                    className="text-[10px] text-primary hover:underline flex items-center gap-1"
                >
                    <RefreshCw className="w-3 h-3" /> Re-scan
                </button>
            </div>

            {/* Form */}
            <div className="space-y-3">
                <div>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Job Title</label>
                    <input
                        value={data.title || ''}
                        onChange={e => setData({ ...data, title: e.target.value })}
                        className="input-field text-sm font-semibold"
                        placeholder="e.g. Senior Frontend Engineer"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Company</label>
                        <div className="relative">
                            <Building className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                                value={data.company || ''}
                                onChange={e => setData({ ...data, company: e.target.value })}
                                className="input-field pl-8 text-sm"
                                placeholder="Company"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Location</label>
                        <div className="relative">
                            <MapPin className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                                value={data.location || ''}
                                onChange={e => setData({ ...data, location: e.target.value })}
                                className="input-field pl-8 text-sm"
                                placeholder="Remote"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Salary</label>
                        <div className="relative">
                            <DollarSign className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                                value={data.salary || ''}
                                onChange={e => setData({ ...data, salary: e.target.value })}
                                className="input-field pl-8 text-sm"
                                placeholder="N/A"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Type</label>
                        <div className="relative">
                            <Briefcase className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                                value={data.employmentType || ''}
                                onChange={e => setData({ ...data, employmentType: e.target.value })}
                                className="input-field pl-8 text-sm"
                                placeholder="Full-time"
                            />
                        </div>
                    </div>
                </div>

                {data.description && (
                    <div className="text-[10px] text-muted-foreground bg-secondary/50 p-2 rounded flex items-center gap-2">
                        <Check className="w-3 h-3 text-primary" />
                        Description extracted successfully ({data.description.length} chars)
                    </div>
                )}
            </div>

            {/* Footer Action */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
                <button
                    onClick={handleSave}
                    className="w-full btn-primary h-10 shadow-[0_0_15px_rgba(0,255,136,0.2)]"
                >
                    <Save className="w-4 h-4 mr-2" />
                    Save Application
                </button>
            </div>
        </div>
    )
}
