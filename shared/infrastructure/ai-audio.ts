/**
 * Gemini Audio Dialog Integration
 *
 * Handles audio transcription and conversation using Gemini 2.5 Flash Native Audio Dialog
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  throw new Error('GEMINI_API_KEY environment variable is not set')
}

const genAI = new GoogleGenerativeAI(apiKey)

/**
 * Transcription result from Gemini
 */
export interface TranscriptionResult {
  text: string
  confidence?: number
  timestamp: number
}

/**
 * Configuration for audio transcription
 */
export interface AudioTranscriptionConfig {
  mimeType: string
  sampleRate?: number
}

/**
 * Transcribe audio using Gemini 2.5 Flash Native Audio Dialog
 *
 * For MVP: Simple transcription without conversation context
 */
export async function transcribeAudio(
  audioBase64: string,
  config: AudioTranscriptionConfig
): Promise<TranscriptionResult> {
  try {
    // Use Gemini 2.5 Flash for transcription
    // Note: Native audio dialog model may not be available yet, using flash as fallback
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash'
    })

    const prompt = 'Transcribe this audio accurately. Return only the transcribed text, no additional commentary.'

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: config.mimeType,
          data: audioBase64
        }
      },
      { text: prompt }
    ])

    const response = await result.response
    const text = response.text().trim()

    return {
      text,
      confidence: estimateConfidence(text),
      timestamp: Date.now()
    }

  } catch (error) {
    console.error('Gemini transcription error:', error)

    if (error instanceof Error) {
      throw new Error(`Audio transcription failed: ${error.message}`)
    }

    throw new Error('Audio transcription failed: Unknown error')
  }
}

/**
 * Create an audio dialog session with Gemini
 *
 * For Phase 2: Dynamic question generation with conversation context
 */
export interface AudioDialogSession {
  sessionId: string
  chat: any // Gemini chat session
  conversationHistory: ConversationTurn[]
}

export interface ConversationTurn {
  question: string
  answer: string
  timestamp: number
}

/**
 * Initialize audio dialog session with system prompt
 */
export async function createAudioDialogSession(
  systemPrompt: string
): Promise<AudioDialogSession> {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        candidateCount: 1
      },
      systemInstruction: systemPrompt
    })

    const chat = model.startChat({
      history: []
    })

    return {
      sessionId: generateSessionId(),
      chat,
      conversationHistory: []
    }

  } catch (error) {
    console.error('Failed to create audio dialog session:', error)
    throw error
  }
}

/**
 * Send audio to dialog session and get response
 */
export async function sendAudioToDialog(
  session: AudioDialogSession,
  audioBase64: string,
  mimeType: string
): Promise<{
  transcription: string
  response: string
}> {
  try {
    // Send audio to Gemini
    const result = await session.chat.sendMessage([
      {
        inlineData: {
          mimeType,
          data: audioBase64
        }
      }
    ])

    const response = await result.response
    const aiResponse = response.text()

    // For MVP, we don't have separate transcription
    // In production with native audio dialog, Gemini would provide both
    const transcription = '[Audio transcribed]'

    return {
      transcription,
      response: aiResponse
    }

  } catch (error) {
    console.error('Audio dialog error:', error)
    throw error
  }
}

/**
 * Parse Gemini response that may have markdown code fences
 */
export function stripMarkdownCodeFences(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }
  return text.trim()
}

/**
 * Estimate transcription confidence based on heuristics
 *
 * Since Gemini doesn't directly provide confidence scores for text,
 * we use heuristics to estimate quality
 */
function estimateConfidence(transcription: string): number {
  if (!transcription || transcription.length === 0) {
    return 0
  }

  let confidence = 1.0

  // Factor 1: Length (very short = likely incomplete)
  const lengthFactor = Math.min(transcription.length / 50, 1)
  confidence *= lengthFactor

  // Factor 2: Word coherence (check for reasonable word length)
  const words = transcription.split(/\s+/)
  const avgWordLength = transcription.length / words.length

  if (avgWordLength < 2 || avgWordLength > 20) {
    confidence *= 0.5 // Likely gibberish
  }

  // Factor 3: Punctuation presence (indicates sentence structure)
  const hasPunctuation = /[.!?,;:]/.test(transcription)
  if (!hasPunctuation && transcription.length > 20) {
    confidence *= 0.8
  }

  // Factor 4: Contains actual words (not just symbols/numbers)
  const hasLetters = /[a-zA-Z]/.test(transcription)
  if (!hasLetters) {
    confidence *= 0.3
  }

  return Math.max(0, Math.min(1, confidence))
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return `audio-session-${Date.now()}-${Math.random().toString(36).substring(7)}`
}

/**
 * Validate audio data before sending to Gemini
 */
export function validateAudioData(
  audioBase64: string,
  mimeType: string
): { valid: boolean; error?: string } {
  // Check if base64 is not empty
  if (!audioBase64 || audioBase64.length === 0) {
    return { valid: false, error: 'Audio data is empty' }
  }

  // Check if mime type is supported
  const supportedTypes = [
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/mpeg',
    'audio/wav'
  ]

  const isSupported = supportedTypes.some(type =>
    mimeType.toLowerCase().includes(type.toLowerCase())
  )

  if (!isSupported) {
    return {
      valid: false,
      error: `Unsupported audio format: ${mimeType}. Supported: ${supportedTypes.join(', ')}`
    }
  }

  // Check if base64 is valid format
  try {
    // Basic validation - should be alphanumeric with +, /, and = padding
    if (!/^[A-Za-z0-9+/=]+$/.test(audioBase64)) {
      return { valid: false, error: 'Invalid base64 encoding' }
    }
  } catch {
    return { valid: false, error: 'Invalid base64 encoding' }
  }

  return { valid: true }
}

/**
 * Error class for audio processing failures
 */
export class AudioProcessingError extends Error {
  constructor(
    message: string,
    public code: 'TRANSCRIPTION_FAILED' | 'INVALID_AUDIO' | 'API_ERROR' | 'RATE_LIMITED',
    public recoverable: boolean = true
  ) {
    super(message)
    this.name = 'AudioProcessingError'
  }
}

/**
 * Retry wrapper for audio transcription with exponential backoff
 */
export async function transcribeAudioWithRetry(
  audioBase64: string,
  config: AudioTranscriptionConfig,
  maxRetries: number = 3
): Promise<TranscriptionResult> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await transcribeAudio(audioBase64, config)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      console.warn(`Transcription attempt ${attempt + 1} failed:`, lastError.message)

      // Don't retry on validation errors
      if (error instanceof AudioProcessingError && error.code === 'INVALID_AUDIO') {
        throw error
      }

      // Exponential backoff: 1s, 2s, 4s
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw new AudioProcessingError(
    `Transcription failed after ${maxRetries} attempts: ${lastError?.message}`,
    'TRANSCRIPTION_FAILED'
  )
}
