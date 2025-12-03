/**
 * Gemini Live API WebSocket Client
 * Handles bidirectional audio streaming with Gemini 2.0 Flash
 */

import type {
  LiveSessionConfig,
  ConnectionState,
  GeminiLiveClientEvents,
  SetupMessage,
  ClientMessage,
  ServerMessage,
  ServerContent,
} from './types'

export class GeminiLiveClient {
  private ws: WebSocket | null = null
  private config: LiveSessionConfig
  private connectionState: ConnectionState = 'disconnected'
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private reconnectDelay = 2000 // Start with 2 seconds
  private heartbeatInterval: NodeJS.Timeout | null = null
  private events: Partial<GeminiLiveClientEvents> = {}

  constructor(
    config: LiveSessionConfig,
    events?: Partial<GeminiLiveClientEvents>
  ) {
    this.config = config
    if (events) {
      this.events = events
    }
  }

  /**
   * Register event handlers
   */
  on<K extends keyof GeminiLiveClientEvents>(
    event: K,
    handler: GeminiLiveClientEvents[K]
  ): void {
    this.events[event] = handler as any
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.connectionState
  }

  /**
   * Connect to Gemini Live API
   */
  async connect(): Promise<void> {
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      console.warn('Already connected or connecting')
      return
    }

    this.connectionState = 'connecting'
    this.reconnectAttempts = 0

    return this.establishConnection()
  }

  /**
   * Establish WebSocket connection
   */
  private async establishConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Gemini Live API WebSocket endpoint
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.config.token}`

        console.log('Attempting WebSocket connection to Gemini Live API...')
        this.ws = new WebSocket(wsUrl)

        // Add connection timeout (10 seconds)
        const connectionTimeout = setTimeout(() => {
          if (this.connectionState === 'connecting') {
            console.error('WebSocket connection timeout')
            this.ws?.close()
            reject(new Error('Connection timeout - Gemini Live API did not respond within 10 seconds'))
          }
        }, 10000)

        this.ws.onopen = () => {
          clearTimeout(connectionTimeout)
          console.log('WebSocket connected to Gemini Live API')
          this.connectionState = 'connected'
          this.reconnectAttempts = 0
          this.events.onConnected?.()

          // Send setup message
          this.sendSetup()

          // Start heartbeat
          this.startHeartbeat()

          resolve()
        }

        this.ws.onmessage = async (event) => {
          clearTimeout(connectionTimeout)
          await this.handleMessage(event.data)
        }

        this.ws.onerror = (error) => {
          clearTimeout(connectionTimeout)
          console.error('WebSocket error event:', error)
          console.error('WebSocket readyState:', this.ws?.readyState)
          this.connectionState = 'error'

          // Provide a more detailed error message
          let errorMessage = 'WebSocket connection failed'
          if (this.ws?.readyState === WebSocket.CLOSED) {
            errorMessage += ' - Connection was closed. This may indicate an invalid API key or incorrect endpoint.'
          } else if (this.ws?.readyState === WebSocket.CLOSING) {
            errorMessage += ' - Connection is closing.'
          }

          const detailedError = new Error(errorMessage)
          this.events.onError?.(detailedError)
          reject(detailedError)
        }

        this.ws.onclose = (event) => {
          clearTimeout(connectionTimeout)
          console.log(`WebSocket closed: code=${event.code}, reason="${event.reason || 'No reason provided'}", wasClean=${event.wasClean}`)

          // Provide detailed close reason
          let closeReason = event.reason || 'Connection closed'
          let shouldRetry = true

          if (event.code === 1006) {
            closeReason = 'Abnormal closure - possibly network issue or invalid endpoint'
          } else if (event.code === 1008) {
            closeReason = 'Policy violation - possibly invalid API key or authentication failure'
            shouldRetry = false // Don't retry auth failures
          } else if (event.code === 1011) {
            // Check if it's a quota error
            const reason = event.reason?.toLowerCase() || ''
            if (reason.includes('quota') || reason.includes('exceeded')) {
              closeReason = `Quota exceeded: ${event.reason}`
              shouldRetry = false // Don't retry quota errors
            } else {
              closeReason = 'Server error - Gemini API encountered an internal error'
            }
          }

          // If connection never opened, reject the promise (check BEFORE changing state)
          const wasConnecting = this.connectionState === 'connecting'

          this.connectionState = 'closed'
          this.stopHeartbeat()
          this.events.onDisconnected?.()

          if (wasConnecting) {
            reject(new Error(`Connection failed: ${closeReason} (code: ${event.code})`))
          }

          // Attempt reconnection if not a clean close and not a quota/auth error
          if (shouldRetry && event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect()
          } else if (!shouldRetry) {
            // Notify about non-retryable error
            this.events.onError?.(new Error(closeReason))
          }
        }
      } catch (error) {
        console.error('Failed to establish connection:', error)
        this.connectionState = 'error'
        reject(error)
      }
    })
  }

  /**
   * Send setup message to configure the session
   */
  private sendSetup(): void {
    const setupMessage: SetupMessage = {
      setup: {
        model: this.config.model || 'models/gemini-2.5-flash-native-audio-preview-09-2025',
        generationConfig: {
          responseModalities: ['audio'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Puck', // Professional voice
              },
            },
          },
        },
      },
    }

    // Add system instruction if provided
    if (this.config.systemInstruction) {
      setupMessage.setup.systemInstruction = {
        parts: [{ text: this.config.systemInstruction }],
      }
    }

    console.log('[Client] Sending setup message')
    this.send(setupMessage)
  }

  /**
   * Handle incoming WebSocket messages (supports both text and binary)
   */
  private async handleMessage(data: string | Blob | ArrayBuffer): Promise<void> {
    try {
      // Convert Blob/ArrayBuffer to text if needed
      let messageText: string

      if (data instanceof Blob) {
        // Convert Blob to text
        messageText = await data.text()
      } else if (data instanceof ArrayBuffer) {
        // Convert ArrayBuffer to text
        const decoder = new TextDecoder()
        messageText = decoder.decode(data)
      } else {
        // Already a string
        messageText = data
      }

      // Parse the JSON message
      const message: ServerMessage = JSON.parse(messageText)

      // Handle setup complete
      if (message.setupComplete) {
        console.log('Setup complete')
        this.events.onSetupComplete?.()
        return
      }

      // Handle server content (AI response)
      if (message.serverContent) {
        this.handleServerContent(message.serverContent)
        return
      }

      // Handle tool calls
      if (message.toolCall) {
        console.log('Tool call received:', message.toolCall)
        this.events.onToolCall?.(message.toolCall)
        return
      }

      // Handle tool call cancellation
      if (message.toolCallCancellation) {
        console.log('Tool call cancelled:', message.toolCallCancellation.ids)
        return
      }
    } catch (error) {
      console.error('Error handling message:', error)
      this.events.onError?.(error as Error)
    }
  }

  /**
   * Handle server content (AI responses)
   */
  private handleServerContent(content: ServerContent): void {
    console.log('[Client] Server content received:', {
      hasParts: !!content.modelTurn?.parts,
      partCount: content.modelTurn?.parts?.length,
      turnComplete: content.turnComplete,
    })

    this.events.onContent?.(content)

    if (content.modelTurn?.parts) {
      for (const part of content.modelTurn.parts) {
        // Handle text response
        if ('text' in part) {
          console.log('[Client] AI text:', part.text.substring(0, 100))
          this.events.onTextResponse?.(part.text)
        }

        // Handle audio response
        if ('inlineData' in part && part.inlineData.mimeType.startsWith('audio/')) {
          console.log('[Client] AI audio received, MIME:', part.inlineData.mimeType, 'size:', part.inlineData.data.length)
          this.events.onAudioResponse?.(part.inlineData.data)
        }
      }
    }

    if (content.turnComplete) {
      console.log('[Client] Turn complete')
      this.events.onTurnComplete?.()
    }
  }

  /**
   * Send audio chunk to Gemini
   */
  sendAudio(base64Audio: string): void {
    if (this.connectionState !== 'connected') {
      console.warn('Cannot send audio: not connected')
      return
    }

    const message: ClientMessage = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: base64Audio,
          },
        ],
      },
    }

    this.send(message)
  }

  /**
   * Send text message to Gemini
   */
  sendText(text: string): void {
    if (this.connectionState !== 'connected') {
      console.warn('Cannot send text: not connected')
      return
    }

    const message: ClientMessage = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      },
    }

    this.send(message)
  }

  /**
   * Send message to WebSocket
   */
  private send(message: SetupMessage | ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not ready to send')
      return
    }

    try {
      this.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error('Error sending message:', error)
      this.events.onError?.(error as Error)
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send empty audio chunk as heartbeat
        this.sendAudio('')
      }
    }, 30000) // Every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * Attempt reconnection with exponential backoff
   */
  private attemptReconnect(): void {
    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

    console.log(
      `Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
    )

    setTimeout(() => {
      this.establishConnection().catch((error) => {
        console.error('Reconnection failed:', error)
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.events.onError?.(new Error('Max reconnection attempts reached'))
        }
      })
    }, delay)
  }

  /**
   * Disconnect from Gemini Live API
   */
  disconnect(): void {
    this.stopHeartbeat()

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }

    this.connectionState = 'disconnected'
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState === 'connected' && this.ws?.readyState === WebSocket.OPEN
  }
}
