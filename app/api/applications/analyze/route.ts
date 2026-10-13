import { createClient } from '@/shared/db/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { analyzeResumeMatch } from '@/shared/infrastructure/ai'
import { buildContextFromDocument } from '@/modules/documents/services/document.service'
import { legacyBlocksToPlainText, tipTapToPlainText } from '@/lib/editor/plain-text'
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/middleware/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
    try {
        let supabase
        const authHeader = req.headers.get('Authorization')

        if (authHeader?.startsWith('Bearer ')) {
            supabase = createSupabaseClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: authHeader } } },
            )
        } else {
            supabase = await createClient()
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const rateLimitResponse = await rateLimitMiddleware(req, RATE_LIMITS.ai, async () => user.id)
        if (rateLimitResponse) return rateLimitResponse

        const body = await req.json()
        const applicationId = typeof body?.applicationId === 'string' ? body.applicationId : ''
        const documentId = typeof body?.documentId === 'string' ? body.documentId : ''
        const requestedVersionId = typeof body?.resumeVersionId === 'string'
            ? body.resumeVersionId
            : ''

        if (!applicationId || !documentId) {
            return NextResponse.json(
                { error: 'Application ID and Document ID are required' },
                { status: 400 },
            )
        }

        const [appResult, docResult] = await Promise.all([
            supabase
                .from('applications')
                .select('*')
                .eq('id', applicationId)
                .single(),
            supabase
                .from('documents')
                .select('*')
                .eq('id', documentId)
                .single(),
        ])

        const application = appResult.data
        const document = docResult.data

        if (appResult.error || !application) {
            return NextResponse.json({ error: 'Application not found or access denied' }, { status: 404 })
        }
        if (docResult.error || !document) {
            return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 })
        }
        if (application.user_id !== user.id || document.user_id !== user.id) {
            return NextResponse.json({ error: 'Unauthorized access to resources' }, { status: 403 })
        }
        if (!application.job_description?.trim()) {
            return NextResponse.json(
                { error: 'Application is missing a job description. Please add one to proceed.' },
                { status: 400 },
            )
        }

        // Apply Kit callers created before version-aware analysis do not send a
        // version id. They intentionally analyze the immutable original upload.
        let versionQuery = supabase
            .from('resume_versions')
            .select('*')
            .eq('document_id', documentId)

        versionQuery = requestedVersionId
            ? versionQuery.eq('id', requestedVersionId)
            : versionQuery.eq('is_original', true)

        const { data: resumeVersion, error: versionError } = await versionQuery.maybeSingle()
        if (versionError || !resumeVersion) {
            return NextResponse.json(
                { error: 'Resume version not found. Refresh the page and choose a saved version.' },
                { status: 404 },
            )
        }
        if (resumeVersion.user_id !== user.id) {
            return NextResponse.json({ error: 'Unauthorized resume version' }, { status: 403 })
        }

        let resumeText = tipTapToPlainText(resumeVersion.content_json)
        if (!resumeText) resumeText = legacyBlocksToPlainText(resumeVersion.blocks)

        // Version 1 points to the source upload rather than duplicating all of
        // its parsed data. Fall back to that source only for the original.
        if (!resumeText && resumeVersion.is_original) {
            const context = buildContextFromDocument(document)
            const structuredText = context.resume?.trim() || ''
            resumeText = structuredText.length >= 50
                ? structuredText
                : document.extracted_text || structuredText
        }

        if (!resumeText || resumeText.trim().length < 50) {
            return NextResponse.json(
                { error: 'This resume version has no readable content. Open it in the editor and save a new version first.' },
                { status: 400 },
            )
        }

        const now = new Date().toISOString()
        const analysisIdentity = {
            application_id: applicationId,
            document_id: documentId,
            resume_version_id: resumeVersion.id,
        }

        const { error: pendingError } = await supabase
            .from('document_analyses')
            .upsert(
                {
                    ...analysisIdentity,
                    analysis_status: 'pending',
                    updated_at: now,
                },
                { onConflict: 'application_id,resume_version_id' },
            )

        if (pendingError) {
            console.error('Failed to initialize versioned Job Fit analysis:', pendingError)
            return NextResponse.json({ error: 'Unable to save Job Fit analysis' }, { status: 500 })
        }

        try {
            const analysis = await analyzeResumeMatch(resumeText, application.job_description)
            const completedAt = new Date().toISOString()

            const { error: updateError } = await supabase
                .from('document_analyses')
                .upsert(
                    {
                        ...analysisIdentity,
                        analysis_result: analysis,
                        analysis_status: 'success',
                        summary_generated_at: completedAt,
                        updated_at: completedAt,
                    },
                    { onConflict: 'application_id,resume_version_id' },
                )

            if (updateError) {
                console.error('Failed to save versioned Job Fit analysis:', updateError)
                return NextResponse.json({ error: 'Analysis completed but could not be saved' }, { status: 500 })
            }

            const { error: appUpdateError } = await supabase
                .from('applications')
                .update({
                    last_analyzed_document_id: documentId,
                    last_analyzed_resume_version_id: resumeVersion.id,
                })
                .eq('id', applicationId)

            if (appUpdateError) {
                console.error('Failed to update the last analyzed resume version:', appUpdateError)
            }

            return NextResponse.json({ analysis, resumeVersionId: resumeVersion.id })
        } catch (analysisError) {
            await supabase
                .from('document_analyses')
                .upsert(
                    {
                        ...analysisIdentity,
                        analysis_status: 'failed',
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'application_id,resume_version_id' },
                )
            throw analysisError
        }
    } catch (error) {
        console.error('Error in Job Fit analysis:', error)
        const message = error instanceof Error && error.message.includes('AI is not configured')
            ? error.message
            : 'Failed to analyze resume. Please try again.'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
