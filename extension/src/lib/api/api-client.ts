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
    priority: 'low' | 'medium' | 'high'
    platform?: string | null
    notes?: string | null
    ai_cover_letter?: string | null
    manual_cover_letter?: string | null
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

    static async deleteApplication(id: string) {
        const { error } = await supabase
            .from('applications')
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
    }

    // AI Features
    static async checkCompatibility(jobDescription: string, documentId?: string) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const { data: { session } } = await supabase.auth.getSession()

        const response = await fetch(`${baseUrl}/api/ai/compatibility`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({ jobDescription, documentId: documentId || undefined })
        })

        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.error || `API error: ${response.statusText}`)
        }

        return await response.json()
    }

    static async saveQuestions(applicationId: string, questions: any[]) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const records = questions.map(q => ({
            application_id: applicationId,
            user_id: user.id,
            question_text: q.text,
            type: q.type,
            required: q.required,
            // Add default status/empty answer
            ai_answer: null
        }))

        const { data, error } = await supabase
            .from('questions')
            .insert(records)
            .select()

        if (error) throw error
        return data
    }

    static async generateAnswers(applicationId: string, extraContext?: string) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const { data: { session } } = await supabase.auth.getSession()

        const response = await fetch(`${baseUrl}/api/questions/regenerate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({ applicationId, extraContext })
        })

        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.error || `API error: ${response.statusText}`)
        }

        return await response.json()
    }

    static async generateCoverLetter(applicationId: string) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const { data: { session } } = await supabase.auth.getSession()

        const response = await fetch(`${baseUrl}/api/cover-letter/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({ applicationId })
        })

        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.error || `API error: ${response.statusText}`)
        }

        return await response.json()
    }

    static async getQuestions(applicationId: string) {
        const { data, error } = await supabase
            .from('questions')
            .select('*')
            .eq('application_id', applicationId)
            .order('created_at', { ascending: true })

        if (error) throw error
        return data
    }

    static async createQuestion(applicationId: string, text: string) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const { data, error } = await supabase
            .from('questions')
            .insert({
                application_id: applicationId,
                question_text: text
            })
            .select()
            .single()

        if (error) throw error
        return data
    }

    static async deleteQuestion(id: string) {
        const { error } = await supabase
            .from('questions')
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
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

    static async getApplicationDocuments(applicationId: string) {
        const { data, error } = await supabase
            .from('application_documents')
            .select('document_id')
            .eq('application_id', applicationId)

        if (error) throw error
        return (data || []).map(row => row.document_id)
    }

    static async updateApplicationDocuments(applicationId: string, documentIds: string[]) {
        // Delete all existing relationships for this application
        const { error: deleteError } = await supabase
            .from('application_documents')
            .delete()
            .eq('application_id', applicationId)

        if (deleteError) throw deleteError

        // Insert new relationships
        if (documentIds.length > 0) {
            const { error: insertError } = await supabase
                .from('application_documents')
                .insert(
                    documentIds.map(docId => ({
                        application_id: applicationId,
                        document_id: docId,
                    }))
                )

            if (insertError) throw insertError
        }
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
