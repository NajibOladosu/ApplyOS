/**
 * Fetching document bytes for auto-attach.
 *
 * Auto-attach (ResumeMate/JobJet's most-praised convenience) needs the actual
 * resume file in the content script. Extension messaging serialises with JSON,
 * so bytes travel as base64 — a resume is a few hundred KB, well within the
 * 64 MB message limit, and the decode is a one-shot atob.
 */

import { supabase } from './api/supabase-client'

export interface DocumentBytes {
    documentId: string
    fileName: string
    mimeType: string
    base64: string
}

/** A document row reduced to what auto-attach needs. */
export interface DocumentMeta {
    id: string
    fileName: string
    fileUrl: string
    fileType: string | null
}

export async function listDocuments(): Promise<DocumentMeta[]> {
    const { data, error } = await supabase
        .from('documents')
        .select('id, file_name, file_url, file_type')
        .order('created_at', { ascending: false })
        .limit(50)

    if (error) return []
    return (data ?? []).map((row: any) => ({
        id: row.id,
        fileName: row.file_name ?? 'document',
        fileUrl: row.file_url,
        fileType: row.file_type ?? null,
    }))
}

function guessMime(fileName: string, fileType: string | null): string {
    if (fileType && fileType !== 'application/octet-stream') return fileType
    const lower = fileName.toLowerCase()
    if (lower.endsWith('.pdf')) return 'application/pdf'
    if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    if (lower.endsWith('.doc')) return 'application/msword'
    if (lower.endsWith('.txt')) return 'text/plain'
    return 'application/pdf'
}

/** Download a vault document and encode it for AUTOFILL_ATTACH. */
export async function fetchDocumentBytes(documentId: string): Promise<DocumentBytes | null> {
    const { data, error } = await supabase
        .from('documents')
        .select('id, file_name, file_url, file_type')
        .eq('id', documentId)
        .single()

    if (error || !data?.file_url) return null

    try {
        const response = await fetch(data.file_url)
        if (!response.ok) return null

        const buffer = await response.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        // Chunked to stay well under the String.fromCharCode argument limit.
        const chunk = 0x8000
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
        }

        return {
            documentId: data.id,
            fileName: data.file_name ?? 'resume.pdf',
            mimeType: guessMime(data.file_name ?? 'resume.pdf', data.file_type),
            base64: btoa(binary),
        }
    } catch {
        return null
    }
}
