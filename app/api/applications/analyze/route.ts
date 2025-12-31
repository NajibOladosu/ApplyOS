
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { analyzeResumeMatch } from '@/lib/ai'
import { getApplication } from '@/lib/services/applications'
import { getDocumentById, buildContextFromDocument } from '@/lib/services/documents'

export async function POST(req: Request) {
    try {
        const supabase = createRouteHandlerClient({ cookies })
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { applicationId, documentId } = body

        if (!applicationId || !documentId) {
            return NextResponse.json(
                { error: 'Application ID and Document ID are required' },
                { status: 400 }
            )
        }

        // Parallel fetch for speed
        const [application, document] = await Promise.all([
            getApplication(applicationId),
            getDocumentById(documentId)
        ])

        if (!application) {
            return NextResponse.json({ error: 'Application not found' }, { status: 404 })
        }

        if (!document) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        }

        // Check ownership/permissions (implicit in service calls usually, but good to be safe)
        if (application.user_id !== user.id || document.user_id !== user.id) {
            return NextResponse.json({ error: 'Unauthorized access to resources' }, { status: 403 })
        }

        if (!application.job_description) {
            return NextResponse.json(
                { error: 'Application is missing a job description. Please add one to proceed.' },
                { status: 400 }
            )
        }

        // Prepare Resume Text
        let resumeText = ''

        // First try structured context
        const context = buildContextFromDocument(document)
        if (context.resume && context.resume.length > 50) {
            resumeText = context.resume
        }
        // Fallback to raw extracted text if available
        else if (document.extracted_text) {
            resumeText = document.extracted_text
        }

        if (!resumeText || resumeText.length < 50) {
            return NextResponse.json(
                { error: 'Document content is empty or not yet processed. Please ensure the document is analyzed.' },
                { status: 400 }
            )
        }

        // Perform Analysis
        const analysis = await analyzeResumeMatch(resumeText, application.job_description)

        return NextResponse.json({ analysis })

    } catch (error: any) {
        console.error('Error in resume analysis:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to analyze resume' },
            { status: 500 }
        )
    }
}
