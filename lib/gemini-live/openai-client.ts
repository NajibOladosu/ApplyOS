import type { ConnectionState, GeminiLiveClientEvents, LiveSessionConfig } from './types'

/** Browser Realtime adapter with the same event surface as the existing interview UI. */
export class OpenAILiveClient {
  private ws: WebSocket | null = null
  private state: ConnectionState = 'disconnected'
  private events: Partial<GeminiLiveClientEvents>
  private config: LiveSessionConfig

  constructor(config: LiveSessionConfig, events: Partial<GeminiLiveClientEvents> = {}) {
    this.config = config
    this.events = events
  }

  on<K extends keyof GeminiLiveClientEvents>(event: K, handler: GeminiLiveClientEvents[K]): void {
    this.events[event] = handler as never
  }

  getState(): ConnectionState { return this.state }
  isConnected(): boolean { return this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN }

  connect(): Promise<void> {
    this.state = 'connecting'
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(this.config.model ?? 'gpt-realtime-mini')}`,
        ['realtime', `openai-insecure-api-key.${this.config.token}`],
      )
      this.ws = ws
      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error('OpenAI voice connection timed out.'))
      }, 10000)
      ws.onopen = () => {
        clearTimeout(timeout)
        this.state = 'connected'
        this.events.onConnected?.()
        resolve()
      }
      ws.onmessage = event => this.handleMessage(String(event.data))
      ws.onerror = () => {
        clearTimeout(timeout)
        this.state = 'error'
        const error = new Error('OpenAI voice connection failed. Check its API billing in Settings.')
        this.events.onError?.(error)
        reject(error)
      }
      ws.onclose = () => {
        clearTimeout(timeout)
        this.state = 'closed'
        this.events.onDisconnected?.()
      }
    })
  }

  private handleMessage(raw: string): void {
    try {
      const event = JSON.parse(raw) as Record<string, unknown>
      const type = event.type as string
      if (type === 'session.created') this.events.onSetupComplete?.()
      if (type === 'response.output_audio.delta' && typeof event.delta === 'string') this.events.onAudioResponse?.(event.delta)
      if (type === 'response.output_audio_transcript.delta' && typeof event.delta === 'string') this.events.onOutputTranscription?.(event.delta)
      if (type === 'response.output_text.delta' && typeof event.delta === 'string') this.events.onTextResponse?.(event.delta)
      if (type === 'conversation.item.input_audio_transcription.completed' && typeof event.transcript === 'string') {
        this.events.onInputTranscription?.(event.transcript)
      }
      if (type === 'response.function_call_arguments.done') {
        const name = event.name as string
        const args = JSON.parse((event.arguments as string) || '{}') as Record<string, unknown>
        this.events.onToolCall?.({ functionCalls: [{ name, args }] })
        if (typeof event.call_id === 'string') {
          this.send({ type: 'conversation.item.create', item: {
            type: 'function_call_output', call_id: event.call_id, output: 'The ApplyOS action was received.',
          } })
          this.send({ type: 'response.create' })
        }
      }
      if (type === 'response.done') this.events.onTurnComplete?.()
      if (type === 'error') this.events.onError?.(new Error('OpenAI voice request failed. Check its API billing in Settings.'))
    } catch (error) {
      this.events.onError?.(error instanceof Error ? error : new Error('Invalid voice response.'))
    }
  }

  private send(event: unknown): void {
    if (this.isConnected()) this.ws!.send(JSON.stringify(event))
  }

  sendAudio(base64Audio: string): void {
    if (!base64Audio || !this.isConnected()) return
    // Existing interview recorder supplies signed 16 kHz PCM; Realtime accepts 24 kHz.
    const binary = atob(base64Audio)
    const input = new Int16Array(binary.length / 2)
    for (let i = 0; i < input.length; i++) {
      input[i] = (binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8)) << 16 >> 16
    }
    const output = new Uint8Array(Math.ceil(input.length * 1.5) * 2)
    for (let i = 0; i < output.length / 2; i++) {
      const point = i / 1.5
      const left = Math.floor(point)
      const fraction = point - left
      const sample = Math.round(input[left] * (1 - fraction) + input[Math.min(left + 1, input.length - 1)] * fraction)
      output[i * 2] = sample & 255
      output[i * 2 + 1] = (sample >> 8) & 255
    }
    let encoded = ''
    for (let i = 0; i < output.length; i++) encoded += String.fromCharCode(output[i])
    this.send({ type: 'input_audio_buffer.append', audio: btoa(encoded) })
  }

  sendText(text: string): void {
    this.send({ type: 'conversation.item.create', item: {
      type: 'message', role: 'user', content: [{ type: 'input_text', text: text || 'Continue the interview.' }],
    } })
    this.send({ type: 'response.create' })
  }

  disconnect(): void {
    this.ws?.close(1000, 'Client disconnect')
    this.ws = null
    this.state = 'disconnected'
  }
}
