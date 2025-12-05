/**
 * Audio processing utilities for Gemini Live API
 * Handles conversion to/from required formats (16-bit PCM, 16kHz, mono)
 */

/**
 * Convert Float32Array to 16-bit PCM
 */
function float32ToPCM16(float32Array: Float32Array): Int16Array {
  const pcm16 = new Int16Array(float32Array.length)

  for (let i = 0; i < float32Array.length; i++) {
    // Clamp to [-1, 1]
    const clamped = Math.max(-1, Math.min(1, float32Array[i]))
    // Convert to 16-bit PCM range [-32768, 32767]
    pcm16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
  }

  return pcm16
}

/**
 * Merge stereo channels to mono
 */
function mergeChannels(audioBuffer: AudioBuffer): Float32Array {
  const numberOfChannels = audioBuffer.numberOfChannels

  if (numberOfChannels === 1) {
    return audioBuffer.getChannelData(0)
  }

  const length = audioBuffer.length
  const mono = new Float32Array(length)

  // Average all channels
  for (let i = 0; i < length; i++) {
    let sum = 0
    for (let channel = 0; channel < numberOfChannels; channel++) {
      sum += audioBuffer.getChannelData(channel)[i]
    }
    mono[i] = sum / numberOfChannels
  }

  return mono
}

/**
 * Simple linear resampling
 * For production, consider using a more sophisticated resampling algorithm
 */
function resample(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number
): Float32Array {
  if (inputSampleRate === outputSampleRate) {
    return input
  }

  const ratio = inputSampleRate / outputSampleRate
  const outputLength = Math.ceil(input.length / ratio)
  const output = new Float32Array(outputLength)

  for (let i = 0; i < outputLength; i++) {
    const position = i * ratio
    const index = Math.floor(position)
    const fraction = position - index

    if (index + 1 < input.length) {
      // Linear interpolation
      output[i] = input[index] * (1 - fraction) + input[index + 1] * fraction
    } else {
      output[i] = input[index]
    }
  }

  return output
}

/**
 * Convert Int16Array to Base64 string
 */
function int16ArrayToBase64(int16Array: Int16Array): string {
  const uint8Array = new Uint8Array(int16Array.buffer)

  // For browser environments
  if (typeof window !== 'undefined') {
    // Convert to binary string
    let binaryString = ''
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i])
    }
    return btoa(binaryString)
  }

  // For Node.js environments (shouldn't be called client-side, but just in case)
  return Buffer.from(uint8Array).toString('base64')
}

/**
 * Convert Base64 string to Int16Array
 */
function base64ToInt16Array(base64: string): Int16Array {
  // For browser environments
  if (typeof window !== 'undefined') {
    const binaryString = atob(base64)
    const uint8Array = new Uint8Array(binaryString.length)

    for (let i = 0; i < binaryString.length; i++) {
      uint8Array[i] = binaryString.charCodeAt(i)
    }

    return new Int16Array(uint8Array.buffer)
  }

  // For Node.js environments
  const buffer = Buffer.from(base64, 'base64')
  return new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2)
}

/**
 * Convert Blob to Gemini-compatible format (16-bit PCM, 16kHz, mono, base64)
 */
export async function convertToGeminiFormat(blob: Blob): Promise<string> {
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const audioContext = new AudioContext({ sampleRate: 16000 })
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    // Convert to mono
    const monoData = mergeChannels(audioBuffer)

    // Resample to 16kHz if needed
    const resampled =
      audioBuffer.sampleRate !== 16000
        ? resample(monoData, audioBuffer.sampleRate, 16000)
        : monoData

    // Convert to 16-bit PCM
    const pcm16 = float32ToPCM16(resampled)

    // Convert to base64
    const base64 = int16ArrayToBase64(pcm16)

    // Close audio context to free resources
    await audioContext.close()

    return base64
  } catch (error) {
    console.error('Error converting audio to Gemini format:', error)
    throw new Error('Failed to convert audio format')
  }
}

/**
 * Convert Gemini audio response to AudioBuffer for playback
 */
export async function convertFromGeminiFormat(
  base64Audio: string,
  sampleRate: number = 24000 // Gemini typically uses 24kHz
): Promise<AudioBuffer> {
  try {
    // Decode base64 to Int16Array
    const pcm16 = base64ToInt16Array(base64Audio)

    // Convert 16-bit PCM to Float32Array
    const float32 = new Float32Array(pcm16.length)
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7fff)
    }

    // Create AudioBuffer
    const audioContext = new AudioContext()
    const audioBuffer = audioContext.createBuffer(1, float32.length, sampleRate)
    audioBuffer.copyToChannel(float32, 0)

    return audioBuffer
  } catch (error) {
    console.error('Error converting Gemini audio format:', error)
    throw new Error('Failed to convert Gemini audio format')
  }
}

/**
 * Play audio buffer through Web Audio API
 */
export async function playAudioBuffer(audioBuffer: AudioBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const audioContext = new AudioContext()
      const source = audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContext.destination)

      source.onended = () => {
        audioContext.close()
        resolve()
      }

      source.start(0)
    } catch (error) {
      console.error('Error playing audio:', error)
      reject(error)
    }
  })
}

/**
 * Estimate audio duration from PCM data
 */
export function estimateAudioDuration(
  pcm16Length: number,
  sampleRate: number = 16000
): number {
  return pcm16Length / sampleRate
}

/**
 * Validate audio blob before processing
 */
export function isValidAudioBlob(blob: Blob): boolean {
  // Check if blob is audio
  if (!blob.type.startsWith('audio/')) {
    console.warn('Invalid blob type:', blob.type)
    return false
  }

  // Check if blob has data
  if (blob.size === 0) {
    console.warn('Empty audio blob')
    return false
  }

  // Check size limits (10MB max)
  if (blob.size > 10 * 1024 * 1024) {
    console.warn('Audio blob too large:', blob.size)
    return false
  }

  return true
}
