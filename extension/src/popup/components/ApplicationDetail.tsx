import React, { useState } from 'react'
import { APIClient, type Application } from '../../lib/api/api-client'
import { ArrowLeft, Building, Trash2, Save, FileText, CheckCircle2 } from 'lucide-react'

interface ApplicationDetailProps {
    application: Application
    onBack: () => void
    onUpdate: (app: Application) => void
    onDelete: (id: string) => void
}

export function ApplicationDetail({ application, onBack, onUpdate, onDelete }: ApplicationDetailProps) {
    const [notes, setNotes] = useState(application.notes || '')
    const [status, setStatus] = useState<Application['status']>(application.status)
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        if (!application.id) return
        setSaving(true)
        try {
            const updated = await APIClient.updateApplication(application.id, {
                status,
                notes
            })
            onUpdate(updated as Application)
        } catch (e) {
            console.error('Update failed:', e)
            // @ts-ignore
            alert(`Failed to update: ${e.message || JSON.stringify(e)}`)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!application.id) return
        if (confirm('Are you sure you want to delete this application?')) {
            try {
                await APIClient.deleteApplication(application.id)
                onDelete(application.id)
            } catch (e) {
                console.error(e)
                alert('Failed to delete')
            }
        }
    }

    const statuses = ['draft', 'submitted', 'in_review', 'interview', 'offer', 'rejected']

    return (
        <div className="flex flex-col h-full bg-background animate-in slide-in-from-right-4 duration-200">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border bg-card/50 sticky top-0 z-10 backdrop-blur-md">
                <button
                    onClick={onBack}
                    className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-sm truncate">{application.title}</h2>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Building className="w-3 h-3" />
                        <span className="truncate">{application.company || 'Unknown Company'}</span>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`p-2 rounded-lg transition-colors ${saving ? 'text-muted-foreground' : 'text-primary hover:bg-primary/10'
                        }`}
                >
                    {saving ? <CheckCircle2 className="w-5 h-5 animate-pulse" /> : <Save className="w-5 h-5" />}
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Status Selector */}
                <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Status</label>
                    <div className="grid grid-cols-3 gap-2">
                        {statuses.map(s => (
                            <button
                                key={s}
                                onClick={() => setStatus(s as any)}
                                className={`text-[10px] py-1.5 px-2 rounded border capitalize transition-all ${status === s
                                    ? 'border-primary bg-primary/10 text-primary font-semibold shadow-[0_0_10px_rgba(0,255,136,0.1)]'
                                    : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
                                    }`}
                            >
                                {s.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Notes</label>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        className="w-full h-32 p-3 text-sm bg-card border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none leading-relaxed"
                        placeholder="Add private notes about this application..."
                    />
                </div>

                {/* Job Description Preview */}
                <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Job Description
                    </label>
                    <div className="p-3 bg-secondary/30 rounded-lg border border-border/50 text-xs text-muted-foreground max-h-40 overflow-y-auto whitespace-pre-wrap">
                        {application.job_description || 'No description saved.'}
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-border">
                    <button
                        onClick={handleDelete}
                        className="flex items-center justify-center w-full gap-2 p-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors border border-transparent hover:border-red-400/20"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete Application
                    </button>
                </div>
            </div>
        </div>
    )
}
