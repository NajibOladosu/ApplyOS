import { createClient } from '@/lib/supabase/client'
import type { EditorBlock } from '@/components/applications/resume-editor'

export interface ResumeVersion {
    id: string
    user_id: string
    document_id: string
    application_id: string | null
    version_name: string
    blocks: EditorBlock[]
    created_at: string
    updated_at: string
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

    async saveVersion(params: {
        id?: string
        document_id: string
        application_id?: string | null
        version_name: string
        blocks: EditorBlock[]
    }): Promise<ResumeVersion> {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const payload = {
            ...params,
            user_id: user.id,
            blocks: params.blocks
        }

        const { data, error } = await supabase
            .from('resume_versions')
            .upsert(payload)
            .select()
            .single()

        if (error) throw error
        return data as ResumeVersion
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
