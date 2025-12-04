/**
 * TypeScript interfaces for Gemini Live API
 * Based on official API documentation
 */

export interface LiveSessionConfig {
  token: string
  model?: string
  systemInstruction?: string
  tools?: any[]
}

export interface AudioChunk {
  mimeType: string
  data: string // Base64-encoded audio
}

export interface RealtimeInput {
  mediaChunks: AudioChunk[]
}

export interface TextPart {
  text: string
}

export interface InlineDataPart {
  inlineData: {
    mimeType: string
    data: string // Base64-encoded audio
  }
}

export type ContentPart = TextPart | InlineDataPart

export interface ModelTurn {
  parts: ContentPart[]
}

export interface ServerContent {
  modelTurn?: ModelTurn
  turnComplete?: boolean
}

export interface ToolCall {
  functionCalls?: Array<{
    name: string
    args: Record<string, any>
  }>
}

export interface SetupMessage {
  setup: {
    model?: string
    generationConfig?: {
      responseModalities?: string[]
      speechConfig?: {
        voiceConfig?: {
          prebuiltVoiceConfig?: {
            voiceName?: string
          }
        }
      }
    }
    systemInstruction?: {
      parts: Array<{ text: string }>
    }
    tools?: any[]
  }
}

export interface ClientMessage {
  realtimeInput?: RealtimeInput
  clientContent?: {
    turns: Array<{
      role: 'user' | 'model'
      parts: Array<{ text: string }>
    }>
    turnComplete?: boolean
  }
  toolResponse?: {
    functionResponses: Array<{
      response: Record<string, any>
      id: string
    }>
  }
}

export interface ServerMessage {
  setupComplete?: boolean
  serverContent?: ServerContent
  toolCall?: ToolCall
  toolCallCancellation?: {
    ids: string[]
  }
}

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'closed'

export interface GeminiLiveClientEvents {
  onConnected: () => void
  onSetupComplete: () => void
  onContent: (content: ServerContent) => void
  onAudioResponse: (audioData: string) => void
  onTextResponse: (text: string) => void
  onTurnComplete: () => void
  onToolCall: (toolCall: ToolCall) => void
  onError: (error: Error) => void
  onDisconnected: () => void
}

export interface BufferedTurn {
  turn_number: number
  speaker: 'ai' | 'user'
  content: string
  timestamp: string
  metadata?: {
    questionId?: string
    type?: 'introduction' | 'question' | 'follow_up' | 'conclusion'
  }
}
