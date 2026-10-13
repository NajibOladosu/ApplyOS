import { createClient } from '@/shared/db/supabase/client'
import type { EditorBlock, TemplateId } from '@/modules/applications/components/editor/types'

export type { TemplateId } from '@/modules/applications/components/editor/types'

export type SourceFormat = 'pdf' | 'docx' | 'txt' | 'json'

export interface DetectedLayout {
    columnCount: number
    hasPhoto: boolean
    hasSidebar: boolean
    confidence: number
    suggestedTemplate: TemplateId
}

export interface ResumeVersion {
    id: string
    user_id: string
    document_id: string
    application_id: string | null
    version_name: string
    version_number: number
    blocks: EditorBlock[] | null
    content_json: unknown | null
    template_id: TemplateId
    source_format: SourceFormat
    is_starred: boolean
    is_original: boolean
    parent_document_id: string | null
    detected_layout: DetectedLayout | null
    created_at: string
    updated_at: string
}

export interface CreateVersionParams {
    document_id: string
    application_id?: string | null
    version_name: string
    blocks?: EditorBlock[] | null
    content_json?: unknown | null
    template_id?: TemplateId
    source_format?: SourceFormat
    is_original?: boolean
    parent_document_id?: string | null
    detected_layout?: DetectedLayout | null
}

export function sourceFormatFromFileName(fileName: string): SourceFormat {
    const ext = fileName.toLowerCase().split('.').pop()
    if (ext === 'docx' || ext === 'doc') return 'docx'
    if (ext === 'txt') return 'txt'
    if (ext === 'json') return 'json'
    return 'pdf'
}

export const resumeVersionsService = {
    /** All immutable snapshots for a document, from the original to the latest. */
    async getVersions(documentId: string): Promise<ResumeVersion[]> {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('resume_versions')
            .select('*')
            .eq('document_id', documentId)
            .order('created_at', { ascending: true })

        if (error) throw error
        return (data ?? []) as ResumeVersion[]
    },

    async getVersionsForApplication(applicationId: string): Promise<ResumeVersion[]> {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('resume_versions')
            .select('*')
            .eq('application_id', applicationId)
            .order('created_at', { ascending: false })

        if (error) throw error
        return (data ?? []) as ResumeVersion[]
    },

    /** Create a new immutable resume snapshot. */
    async createVersion(params: CreateVersionParams): Promise<ResumeVersion> {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const { data, error } = await supabase
            .from('resume_versions')
            .insert({
                ...params,
                user_id: user.id,
                is_original: params.is_original ?? false,
            })
            .select()
            .single()

        if (error) throw error
        return data as ResumeVersion
    },

    /** Fallback for legacy databases where an upload predates the backfill. */
    async ensureOriginalVersion(document: {
        id: string
        file_name: string
        created_at?: string | null
    }): Promise<ResumeVersion> {
        const existing = await this.getVersions(document.id)
        const original = existing.find((version) => version.is_original)
        if (original) return original

        return this.createVersion({
            document_id: document.id,
            application_id: null,
            version_name: 'Original upload',
            content_json: null,
            blocks: null,
            template_id: 'modern',
            source_format: sourceFormatFromFileName(document.file_name),
            is_original: true,
            parent_document_id: document.id,
        })
    },

    async setStarred(id: string, applicationId: string | null): Promise<void> {
        const supabase = createClient()
        if (applicationId) {
            const { error: clearErr } = await supabase
                .from('resume_versions')
                .update({ is_starred: false })
                .eq('application_id', applicationId)
            if (clearErr) throw clearErr
        }
        const { error } = await supabase
            .from('resume_versions')
            .update({ is_starred: true })
            .eq('id', id)
        if (error) throw error
    },

    async deleteVersion(id: string): Promise<void> {
        const supabase = createClient()
        const { data: version, error: lookupError } = await supabase
            .from('resume_versions')
            .select('is_original')
            .eq('id', id)
            .single()

        if (lookupError) throw lookupError
        if (version?.is_original) throw new Error('The original upload cannot be deleted')

        const { error } = await supabase
            .from('resume_versions')
            .delete()
            .eq('id', id)

        if (error) throw error
    }
}
