import React, { useState, useEffect } from 'react'
import { APIClient, type Application } from '../../lib/api/api-client'
import { Loader2, Search, Building, Calendar, ExternalLink } from 'lucide-react'

import { ApplicationDetail } from '../components/ApplicationDetail'

export function ApplicationsTab() {
    const [apps, setApps] = useState<Application[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedApp, setSelectedApp] = useState<Application | null>(null)

    useEffect(() => {
        loadApps()
    }, [])

    const loadApps = async () => {
        try {
            const data = await APIClient.getApplications()
            setApps(data as Application[])
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleUpdate = (updatedApp: Application) => {
        setApps(apps.map(app => app.id === updatedApp.id ? updatedApp : app))
        setSelectedApp(updatedApp)
    }

    const handleDelete = (id: string) => {
        setApps(apps.filter(app => app.id !== id))
        setSelectedApp(null)
    }

    if (selectedApp) {
        return (
            <ApplicationDetail
                application={selectedApp}
                onBack={() => setSelectedApp(null)}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
            />
        )
    }

    const filteredApps = apps.filter(app =>
        app.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.company?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'submitted': return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
            case 'in_review': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
            case 'interview': return 'text-purple-400 bg-purple-400/10 border-purple-400/20'
            case 'offer': return 'text-green-400 bg-green-400/10 border-green-400/20'
            case 'rejected': return 'text-red-400 bg-red-400/10 border-red-400/20'
            default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
        }
    }

    if (loading) {
        return (
            <div className="p-4 space-y-4">
                {/* Skeleton Search */}
                <div className="relative">
                    <div className="w-full h-9 bg-secondary/50 rounded-full animate-pulse" />
                </div>
                {/* Skeleton List */}
                <div className="space-y-3 pt-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="p-3 rounded-lg border border-border bg-card/50 space-y-2">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1.5 flex-1">
                                    <div className="h-4 w-3/4 bg-secondary/50 rounded animate-pulse" />
                                    <div className="h-3 w-1/2 bg-secondary/30 rounded animate-pulse" />
                                </div>
                                <div className="h-5 w-16 bg-secondary/30 rounded-md animate-pulse" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 space-y-4">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <input
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="input-field pl-9 h-9 text-sm rounded-full bg-secondary border-transparent focus:bg-background"
                    placeholder="Search applications..."
                />
            </div>

            {/* List */}
            <div className="space-y-2 pb-4">
                {filteredApps.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-xs">
                        No applications found.
                    </div>
                ) : (
                    filteredApps.map(app => (
                        <div
                            key={app.id}
                            onClick={() => setSelectedApp(app)}
                            className="bg-card border border-border rounded-lg p-3 hover:border-primary/30 transition-colors group cursor-pointer relative"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-semibold text-sm truncate pr-6">{app.title}</h3>
                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${getStatusColor(app.status)}`}>
                                    {app.status.replace('_', ' ')}
                                </span>
                            </div>

                            <div className="flex items-center text-xs text-muted-foreground gap-3">
                                <div className="flex items-center gap-1">
                                    <Building className="w-3 h-3" />
                                    {app.company || 'Unknown'}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(app.created_at || Date.now()).toLocaleDateString()}
                                </div>
                            </div>

                            {/* Hover Actions */}
                            <div className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.applyos.io'
                                        window.open(`${baseUrl}/applications/${app.id}`, '_blank')
                                    }}
                                    className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                    title="Open in ApplyOS"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
