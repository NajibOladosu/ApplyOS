import { createClient } from '@/lib/supabase/client'
import type { EditorBlock } from '@/components/applications/resume-editor'

export type TemplateId = 'modern' | 'classic' | 'compact' | 'two-column' | 'photo-header'
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
    blocks: EditorBlock[] | null
    content_json: any | null
    template_id: TemplateId
    source_format: SourceFormat
    is_starred: boolean
    parent_document_id: string | null
    detected_layout: DetectedLayout | null
    created_at: string
    updated_at: string
}

export interface SaveVersionParams {
    id?: string
    document_id: string
    application_id?: string | null
    version_name: string
    blocks?: EditorBlock[] | null
    content_json?: any | null
    template_id?: TemplateId
    source_format?: SourceFormat
    parent_document_id?: string | null
    detected_layout?: DetectedLayout | null
}

export const resumeVersionsService = {
    async getVersions(documentId: string): Promise<ResumeVersion[]> {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('resume_versions')
            .select('*')
            .eq('document_id', documentId)
            .order('updated_at', { ascending: false })

        if (error) throw error
        return data as ResumeVersion[]
    },

    async getVersionsForApplication(applicationId: string): Promise<ResumeVersion[]> {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('resume_versions')
            .select('*')
            .eq('application_id', applicationId)
            .order('updated_at', { ascending: false })

        if (error) throw error
        return data as ResumeVersion[]
    },

    async saveVersion(params: SaveVersionParams): Promise<ResumeVersion> {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const payload: Record<string, unknown> = {
            ...params,
            user_id: user.id,
        }
        if (params.blocks !== undefined) payload.blocks = params.blocks
        if (params.content_json !== undefined) payload.content_json = params.content_json

        const { data, error } = await supabase
            .from('resume_versions')
            .upsert(payload)
            .select()
            .single()

        if (error) throw error
        return data as ResumeVersion
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
        const { error } = await supabase
            .from('resume_versions')
            .delete()
            .eq('id', id)

        if (error) throw error
    }
}
