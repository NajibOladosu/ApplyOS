import { supabase } from './supabase-client'

// Types based on the database schema
export interface Application {
    id?: string
    user_id: string
    title: string
    company: string | null
    url: string | null
    job_description: string | null
    status: 'draft' | 'submitted' | 'in_review' | 'interview' | 'offer' | 'rejected'
    created_at?: string
}

export interface Document {
    id: string
    user_id: string
    file_name: string
    file_url: string
    file_type: string
    file_size: number
    created_at: string
}

export class APIClient {
    // Applications
    static async createApplication(data: Partial<Application>) {
        const { data: app, error } = await supabase
            .from('applications')
            .insert(data)
            .select()
            .single()

        if (error) throw error
        return app
    }

    static async getApplications() {
        const { data, error } = await supabase
            .from('applications')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error
        return data
    }

    static async updateApplication(id: string, updates: Partial<Application>) {
        const { data, error } = await supabase
            .from('applications')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data
    }

    // Documents
    static async uploadDocument(file: File, userId: string) {
        // Upload to storage
        const fileName = `${Date.now()}-${file.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('documents')
            .upload(`${userId}/${fileName}`, file)

        if (uploadError) throw uploadError

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('documents')
            .getPublicUrl(`${userId}/${fileName}`)

        // Create document record
        const { data: doc, error: docError } = await supabase
            .from('documents')
            .insert({
                user_id: userId,
                file_name: file.name,
                file_url: publicUrl,
                file_type: file.type,
                file_size: file.size
            })
            .select()
            .single()

        if (docError) throw docError
        return doc
    }

    static async getDocuments() {
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error
        return data
    }

    // Analytics stub
    static async getAnalytics() {
        // This would typically fetch from a specific endpoint or aggregate data
        // For now, we'll return basic counts from the applications table
        const { count, error } = await supabase
            .from('applications')
            .select('*', { count: 'exact', head: true })

        if (error) throw error

        return {
            totalApplications: count || 0,
            successRate: 0 // Placeholder
        }
    }
}
