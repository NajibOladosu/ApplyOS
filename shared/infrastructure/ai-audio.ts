/**
 * Gemini Audio Dialog Integration
 *
 * Handles audio transcription and conversation using Gemini 2.5 Flash Native Audio Dialog
 */

import 'server-only'
import { SPECIALIZED_MODELS } from '@/shared/infrastructure/ai/model-manager'
import { getGeminiClient } from '@/shared/infrastructure/ai/client'
import { AIConnectionError, resolveAISource } from '@/shared/infrastructure/ai/connections'
import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  AI_WRITING_STYLE_INSTRUCTION,
  sanitizeAIGeneratedText,
} from '@/shared/infrastructure/ai-style'

function requireClient() {
  const client = getGeminiClient()
  if (!client) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }
  return client
}

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
  let userOwnedAudio = false
  try {
    const selected = await resolveAISource('audio')
    userOwnedAudio = selected.source !== 'applyos'
    if (selected.source === 'openai') {
      const form = new FormData()
      const mime = config.mimeType.split(';')[0]
      const extension = mime === 'audio/webm' ? 'webm' : mime === 'audio/mp4' ? 'mp4' : 'wav'
      form.append('file', new Blob([Buffer.from(audioBase64, 'base64')], { type: mime }), `interview.${extension}`)
      form.append('model', 'gpt-4o-mini-transcribe')
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST', headers: { authorization: `Bearer ${selected.apiKey}` },
        body: form, signal: AbortSignal.timeout(60000),
      })
      if (!response.ok) throw new AIConnectionError(`OpenAI audio connection failed (HTTP ${response.status}). Check its API billing in Settings.`)
      const body = await response.json() as { text?: string }
      if (!body.text) throw new AIConnectionError('OpenAI returned no transcription. Check the audio connection in Settings.')
      return { text: body.text, confidence: estimateConfidence(body.text), timestamp: Date.now() }
    }
    // Audio transcription requires a multimodal model — kept centralized in SPECIALIZED_MODELS
    // because the text-only fallback chain in ModelManager cannot accept inlineData parts.
    const client = selected.source === 'gemini'
      ? new GoogleGenerativeAI(selected.apiKey!) : requireClient()
    const model = client.getGenerativeModel({
      model: selected.source === 'gemini' ? 'gemini-3.8-flash' : SPECIALIZED_MODELS.AUDIO_TRANSCRIPTION
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
    if (error instanceof AIConnectionError) throw error
    if (userOwnedAudio) {
      console.error('User-owned audio connection failed')
      throw new AIConnectionError('Your audio connection failed. Check its API key and billing in Settings.')
    }
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
  chat: unknown // Gemini chat session
  conversationHistory: ConversationTurn[]
  userOwned: boolean
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
  let userOwnedAudio = false
  try {
    const selected = await resolveAISource('audio')
    userOwnedAudio = selected.source !== 'applyos'
    if (selected.source === 'openai') {
      throw new AIConnectionError('This audio dialog requires Gemini. Use the OpenAI live interview connection instead.')
    }
    const client = selected.source === 'gemini'
      ? new GoogleGenerativeAI(selected.apiKey!) : requireClient()
    const model = client.getGenerativeModel({
      model: SPECIALIZED_MODELS.AUDIO_TRANSCRIPTION,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        candidateCount: 1
      },
      systemInstruction: `${systemPrompt}\n\n${AI_WRITING_STYLE_INSTRUCTION}`
    })

    const chat = model.startChat({
      history: []
    })

    return {
      sessionId: generateSessionId(),
      chat,
      conversationHistory: [],
      userOwned: userOwnedAudio,
    }

  } catch (error) {
    console.error('Failed to create audio dialog session')
    if (error instanceof AIConnectionError) throw error
    if (userOwnedAudio) throw new AIConnectionError('Your audio connection failed. Check its API key and billing in Settings.')
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
    const chat = session.chat as { sendMessage: (input: unknown) => Promise<{ response: { text: () => string } }> }
    const result = await chat.sendMessage([
      {
        inlineData: {
          mimeType,
          data: audioBase64
        }
      }
    ])

    const response = await result.response
    const aiResponse = sanitizeAIGeneratedText(response.text())

    // For MVP, we don't have separate transcription
    // In production with native audio dialog, Gemini would provide both
    const transcription = '[Audio transcribed]'

    return {
      transcription,
      response: aiResponse
    }

  } catch (error) {
    if (session.userOwned) throw new AIConnectionError('Your audio connection failed. Check its API key and billing in Settings.')
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
      if (error instanceof AIConnectionError || (error instanceof AudioProcessingError && error.code === 'INVALID_AUDIO')) {
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
