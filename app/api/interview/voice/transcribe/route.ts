import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { transcribeAudioWithRetry, validateAudioData, AudioProcessingError } from '@/lib/ai-audio'
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/middleware/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * POST /api/interview/voice/transcribe
 *
 * Transcribe audio chunks using Gemini 2.5 Flash
 *
 * Body:
 * - audioChunks: string[] (Base64 encoded audio chunks)
 * - mimeType: string (e.g., 'audio/webm;codecs=opus')
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(
      request,
      RATE_LIMITS.ai,
      async () => user.id
    )
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const body = await request.json()
    const { audioChunks, mimeType } = body

    // Validation
    if (!audioChunks || !Array.isArray(audioChunks) || audioChunks.length === 0) {
      return NextResponse.json(
        { error: 'audioChunks array is required and must not be empty' },
        { status: 400 }
      )
    }

    if (!mimeType || typeof mimeType !== 'string') {
      return NextResponse.json(
        { error: 'mimeType string is required' },
        { status: 400 }
      )
    }

    // Combine audio chunks into single blob
    // For MVP, we concatenate the base64 strings
    // In production, you'd want to properly combine audio blobs
    const combinedAudio = audioChunks.join('')

    // Validate audio data
    const validation = validateAudioData(combinedAudio, mimeType)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Transcribe audio using Gemini
    try {
      const result = await transcribeAudioWithRetry(combinedAudio, {
        mimeType,
        sampleRate: 24000
      })

      return NextResponse.json({
        transcription: result.text,
        confidence: result.confidence,
        timestamp: result.timestamp,
        chunkCount: audioChunks.length
      })

    } catch (error) {
      if (error instanceof AudioProcessingError) {
        if (error.code === 'RATE_LIMITED') {
          return NextResponse.json(
            { error: 'Too many requests. Please wait a moment and try again.' },
            {
              status: 429,
              headers: { 'Retry-After': '60' }
            }
          )
        }

        if (error.code === 'INVALID_AUDIO') {
          return NextResponse.json(
            { error: error.message },
            { status: 400 }
          )
        }
      }

      throw error
    }

  } catch (error: any) {
    console.error('Transcription error:', error)

    return NextResponse.json(
      {
        error: error.message || 'Failed to transcribe audio',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
