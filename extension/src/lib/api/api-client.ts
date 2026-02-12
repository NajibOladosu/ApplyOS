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
    note_category?: string | null
    note_is_pinned?: boolean
    last_analyzed_document_id?: string | null
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
            .select('*, application_notes(content, category, is_pinned)')
            .order('created_at', { ascending: false })

        if (error) throw error

        return data.map((app: any) => ({
            ...app,
            notes: app.application_notes?.[0]?.content || null,
            note_category: app.application_notes?.[0]?.category || null,
            note_is_pinned: app.application_notes?.[0]?.is_pinned || false
        }))
    }

    static async updateApplication(id: string, updates: Partial<Application>) {
        // Separate notes from other updates
        const { notes, note_category, note_is_pinned, ...appUpdates } = updates

        // Update application record if there are fields to update
        let updatedApp = null
        if (Object.keys(appUpdates).length > 0) {
            const { data, error } = await supabase
                .from('applications')
                .update(appUpdates)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            updatedApp = data
        }

        // Handle notes update if provided (or if category/pinned provided)
        if (typeof notes !== 'undefined' || typeof note_category !== 'undefined' || typeof note_is_pinned !== 'undefined') {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                // Check for existing note
                const { data: existingNote } = await supabase
                    .from('application_notes')
                    .select('id')
                    .eq('application_id', id)
                    .maybeSingle()

                const noteUpdates: any = {
                    updated_at: new Date().toISOString()
                }
                if (typeof notes !== 'undefined') noteUpdates.content = notes
                if (typeof note_category !== 'undefined') noteUpdates.category = note_category
                if (typeof note_is_pinned !== 'undefined') noteUpdates.is_pinned = note_is_pinned

                if (existingNote) {
                    await supabase
                        .from('application_notes')
                        .update(noteUpdates)
                        .eq('id', existingNote.id)
                } else if (notes) {
                    // Only insert if content is not empty (or if we really want to create empty note?)
                    await supabase
                        .from('application_notes')
                        .insert({
                            application_id: id,
                            user_id: user.id,
                            content: notes || '',
                            category: note_category || null,
                            is_pinned: note_is_pinned || false
                        })
                }
            }
        }

        // If we didn't update the app record, fetch it to return valid object
        if (!updatedApp) {
            const { data, error } = await supabase
                .from('applications')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            updatedApp = data
        }

        // Return combined object with the updated note
        return {
            ...updatedApp,
            notes: typeof notes !== 'undefined' ? notes : (updatedApp as any).notes
        }
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
    static async checkCompatibility(applicationId: string, documentId: string) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const { data: { session } } = await supabase.auth.getSession()

        const response = await fetch(`${baseUrl}/api/applications/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({ applicationId, documentId })
        })

        if (!response.ok) {
            const text = await response.text().catch(() => '')
            let errorMsg = ''
            try { errorMsg = JSON.parse(text)?.error } catch { }
            throw new Error(errorMsg || `HTTP ${response.status}: ${text.substring(0, 200)}`)
        }

        return await response.json()
    }

    static async getAnalysis(applicationId: string, documentId: string) {
        const { data, error } = await supabase
            .from('document_analyses')
            .select('*')
            .eq('application_id', applicationId)
            .eq('document_id', documentId)
            .maybeSingle()

        if (error) throw error
        return data
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

    static async generateCoverLetter(applicationId: string, instructions?: string) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const { data: { session } } = await supabase.auth.getSession()

        const response = await fetch(`${baseUrl}/api/cover-letter/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({ applicationId, instructions })
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

    static async updateQuestion(id: string, updates: any) {
        const { data, error } = await supabase
            .from('questions')
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
