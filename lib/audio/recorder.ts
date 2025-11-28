/**
 * Audio Stream Recorder
 *
 * Handles browser audio recording using MediaRecorder API
 * Optimized for real-time streaming to Gemini Audio Dialog API
 */

export interface AudioRecorderConfig {
  mimeType?: string
  audioBitsPerSecond?: number
  sampleRate?: number
  channelCount?: number
  timeslice?: number // milliseconds between data available events
}

export interface AudioChunk {
  blob: Blob
  timestamp: number
  chunkIndex: number
}

export class AudioStreamRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private stream: MediaStream | null = null

  private chunkIndex = 0
  private isRecording = false

  private onChunkCallback: (chunk: AudioChunk) => void
  private onErrorCallback?: (error: Error) => void

  constructor(
    onChunk: (chunk: AudioChunk) => void,
    onError?: (error: Error) => void
  ) {
    this.onChunkCallback = onChunk
    this.onErrorCallback = onError
  }

  /**
   * Start recording audio from the provided MediaStream
   */
  async start(
    stream: MediaStream,
    config: AudioRecorderConfig = {}
  ): Promise<void> {
    if (this.isRecording) {
      throw new Error('Already recording')
    }

    this.stream = stream
    this.chunkIndex = 0

    // Default configuration optimized for speech and Gemini API
    const {
      mimeType = this.getSupportedMimeType(),
      audioBitsPerSecond = 32000, // 32kbps is sufficient for speech
      timeslice = 500 // 500ms chunks for low latency
    } = config

    try {
      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond
      })

      // Set up data available handler
      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.onChunkCallback({
            blob: event.data,
            timestamp: Date.now(),
            chunkIndex: this.chunkIndex++
          })
        }
      }

      // Set up error handler
      this.mediaRecorder.onerror = (event: Event) => {
        const error = new Error(`MediaRecorder error: ${event.type}`)
        console.error('MediaRecorder error:', error)
        this.onErrorCallback?.(error)
      }

      // Start recording with timeslice for regular chunks
      this.mediaRecorder.start(timeslice)
      this.isRecording = true

      // Set up audio visualization
      await this.setupAudioVisualization(stream, config)

    } catch (error) {
      const recordError = error instanceof Error
        ? error
        : new Error('Failed to start recording')
      console.error('Failed to start recording:', recordError)
      this.onErrorCallback?.(recordError)
      throw recordError
    }
  }

  /**
   * Stop recording and clean up resources
   */
  stop(): void {
    if (!this.isRecording) {
      return
    }

    // Stop MediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }

    // Stop all tracks in the stream
    this.stream?.getTracks().forEach(track => track.stop())

    // Close audio context
    this.audioContext?.close()

    // Clean up references
    this.mediaRecorder = null
    this.audioContext = null
    this.analyser = null
    this.sourceNode = null
    this.stream = null
    this.isRecording = false
  }

  /**
   * Pause recording (can be resumed)
   */
  pause(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause()
    }
  }

  /**
   * Resume recording after pause
   */
  resume(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume()
    }
  }

  /**
   * Get current audio level for visualization (0.0 - 1.0)
   */
  getAudioLevel(): number {
    if (!this.analyser) return 0

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(dataArray)

    // Calculate average frequency
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length

    // Normalize to 0-1 range
    return average / 255
  }

  /**
   * Check if currently recording
   */
  isActive(): boolean {
    return this.isRecording && this.mediaRecorder?.state === 'recording'
  }

  /**
   * Check if paused
   */
  isPaused(): boolean {
    return this.mediaRecorder?.state === 'paused' || false
  }

  /**
   * Get supported MIME type for this browser
   */
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus', // Best for Chrome/Edge
      'audio/webm',              // Fallback for Chrome/Edge
      'audio/ogg;codecs=opus',   // Firefox
      'audio/mp4',               // Safari
    ]

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }

    // Last resort - let browser choose
    return ''
  }

  /**
   * Set up audio visualization using Web Audio API
   */
  private async setupAudioVisualization(
    stream: MediaStream,
    config: AudioRecorderConfig
  ): Promise<void> {
    try {
      const { sampleRate = 24000 } = config

      this.audioContext = new AudioContext({ sampleRate })
      this.sourceNode = this.audioContext.createMediaStreamSource(stream)
      this.analyser = this.audioContext.createAnalyser()

      // Configure analyser for visualization
      this.analyser.fftSize = 256 // Smaller for real-time performance
      this.analyser.smoothingTimeConstant = 0.8

      // Connect nodes
      this.sourceNode.connect(this.analyser)

    } catch (error) {
      console.warn('Failed to set up audio visualization:', error)
      // Non-critical error, don't throw
    }
  }
}

/**
 * Check current microphone permission state
 */
export async function checkMicrophonePermission(): Promise<PermissionState | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions) {
      return null
    }

    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    console.log('Microphone permission state:', result.state)
    return result.state
  } catch (error) {
    console.warn('Could not check microphone permission:', error)
    return null
  }
}

/**
 * Request microphone access with optimized settings for speech
 */
export async function requestMicrophoneAccess(): Promise<MediaStream | null> {
  // Check if running in browser environment
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    console.error('MediaDevices API not available')
    return null
  }

  // Check permission state first
  const permissionState = await checkMicrophonePermission()
  console.log('Current permission state:', permissionState)

  if (permissionState === 'denied') {
    console.error('⚠️ Microphone permission is BLOCKED by browser')
    console.error('📍 You must manually unblock it:')
    console.error('   Chrome: Click the 🔒 icon in address bar → Site settings → Microphone → Allow')
    console.error('   Firefox: Click the 🔒 icon → Permissions → Microphone → Allow')
    console.error('   Safari: Safari → Settings → Websites → Microphone → Allow')

    const error = new Error('Microphone permission is blocked by browser. Please check your browser settings.')
    ;(error as any).name = 'PermissionBlockedError'
    throw error
  }

  try {
    console.log('🎤 Requesting microphone access...')

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,     // Reduce echo
        noiseSuppression: true,     // Reduce background noise
        autoGainControl: true,      // Normalize volume
        sampleRate: 24000,          // Optimal for Gemini (16kHz-48kHz range)
        channelCount: 1             // Mono is sufficient for speech
      }
    })

    console.log('✅ Microphone access granted')
    return stream
  } catch (error) {
    console.error('❌ Microphone access error:', error)

    if (error instanceof Error) {
      // Handle specific error types
      if (error.name === 'NotAllowedError') {
        console.error('⚠️ User denied microphone permission or permission was blocked by browser')
        console.error('📍 To fix: Click the 🔒 icon in address bar → Microphone → Allow')
      } else if (error.name === 'NotFoundError') {
        console.error('⚠️ No microphone device found')
      } else if (error.name === 'NotReadableError') {
        console.error('⚠️ Microphone is already in use by another application')
      } else if (error.name === 'SecurityError') {
        console.error('⚠️ getUserMedia must be called from a secure context (HTTPS or localhost)')
      }
    }

    throw error // Throw error instead of returning null for better error handling
  }
}

/**
 * Check if browser supports audio recording
 */
export function isAudioRecordingSupported(): boolean {
  return !!(
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  )
}

/**
 * Convert Blob to Base64 string for API transmission
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      // Remove data URL prefix (e.g., "data:audio/webm;base64,")
      const base64Data = base64.split(',')[1]
      resolve(base64Data)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Estimate audio quality based on blob size and duration
 */
export function estimateAudioQuality(blob: Blob, durationMs: number): {
  quality: 'excellent' | 'good' | 'fair' | 'poor'
  bitrate: number
} {
  const bitrateKbps = (blob.size * 8) / durationMs // bits per millisecond
  const bitrate = Math.round(bitrateKbps)

  let quality: 'excellent' | 'good' | 'fair' | 'poor'

  if (bitrate >= 32) {
    quality = 'excellent'
  } else if (bitrate >= 24) {
    quality = 'good'
  } else if (bitrate >= 16) {
    quality = 'fair'
  } else {
    quality = 'poor'
  }

  return { quality, bitrate }
}
