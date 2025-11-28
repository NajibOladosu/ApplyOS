/**
 * React Hook for Voice Recording
 *
 * Provides state management and controls for audio recording
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  AudioStreamRecorder,
  requestMicrophoneAccess,
  isAudioRecordingSupported,
  blobToBase64,
  type AudioChunk
} from '@/lib/audio/recorder'

export enum MicrophonePermissionState {
  NOT_REQUESTED = 'not_requested',
  REQUESTING = 'requesting',
  GRANTED = 'granted',
  DENIED = 'denied',
  ERROR = 'error'
}

export interface UseVoiceRecorderOptions {
  onAudioChunk?: (chunk: AudioChunk, base64: string) => void
  onError?: (error: Error) => void
  onPermissionDenied?: () => void
  timeslice?: number // milliseconds between chunks
}

export interface UseVoiceRecorderReturn {
  // State
  isRecording: boolean
  isPaused: boolean
  audioLevel: number
  permissionState: MicrophonePermissionState
  isSupported: boolean
  recordingDuration: number // seconds
  error: string | null

  // Actions
  startRecording: () => Promise<void>
  stopRecording: () => void
  pauseRecording: () => void
  resumeRecording: () => void
  resetRecorder: () => void
}

export function useVoiceRecorder(
  options: UseVoiceRecorderOptions = {}
): UseVoiceRecorderReturn {
  const { onAudioChunk, onError, onPermissionDenied, timeslice = 500 } = options

  // State
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [permissionState, setPermissionState] = useState<MicrophonePermissionState>(
    MicrophonePermissionState.NOT_REQUESTED
  )
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Refs
  const recorderRef = useRef<AudioStreamRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const startTimeRef = useRef<number>(0)
  const durationIntervalRef = useRef<number | null>(null)
  const audioLevelIntervalRef = useRef<number | null>(null)

  // Check if browser supports audio recording
  const isSupported = isAudioRecordingSupported()

  /**
   * Handle audio chunk from recorder
   */
  const handleAudioChunk = useCallback(
    async (chunk: AudioChunk) => {
      if (!onAudioChunk) return

      try {
        // Convert blob to base64 for API transmission
        const base64 = await blobToBase64(chunk.blob)
        onAudioChunk(chunk, base64)
      } catch (err) {
        console.error('Failed to process audio chunk:', err)
        const error = err instanceof Error ? err : new Error('Failed to process audio')
        onError?.(error)
      }
    },
    [onAudioChunk, onError]
  )

  /**
   * Handle recording errors
   */
  const handleError = useCallback(
    (err: Error) => {
      console.error('Recording error:', err)
      setError(err.message)
      setIsRecording(false)
      onError?.(err)
    },
    [onError]
  )

  /**
   * Start recording
   */
  const startRecording = useCallback(async () => {
    if (!isSupported) {
      const err = new Error('Audio recording is not supported in this browser')
      setError(err.message)
      return
    }

    if (isRecording) {
      console.warn('Already recording')
      return
    }

    try {
      setError(null)
      setPermissionState(MicrophonePermissionState.REQUESTING)

      // Request microphone access
      let stream: MediaStream | null = null
      try {
        stream = await requestMicrophoneAccess()
      } catch (micError) {
        console.error('Permission error:', micError)
        setPermissionState(MicrophonePermissionState.DENIED)

        // Provide helpful error message based on error type
        const errorName = micError instanceof Error ? micError.name : 'Unknown'
        if (errorName === 'PermissionBlockedError') {
          setError('🔒 Microphone is BLOCKED. Click the lock icon (🔒) in your address bar, find "Microphone", and change it to "Allow". Then reload the page.')
        } else if (errorName === 'NotAllowedError') {
          setError('❌ Microphone access denied. Please allow microphone access when prompted, or click the lock icon in your address bar to change permissions.')
        } else if (errorName === 'NotFoundError') {
          setError('🎤 No microphone found. Please connect a microphone and try again.')
        } else if (errorName === 'NotReadableError') {
          setError('⚠️ Microphone is in use by another application. Please close other apps using the microphone.')
        } else {
          setError('Failed to access microphone. Please check your browser permissions and console logs.')
        }

        onPermissionDenied?.()
        return
      }

      if (!stream) {
        setPermissionState(MicrophonePermissionState.DENIED)
        setError('Failed to access microphone')
        onPermissionDenied?.()
        return
      }

      setPermissionState(MicrophonePermissionState.GRANTED)
      streamRef.current = stream

      // Create recorder
      recorderRef.current = new AudioStreamRecorder(handleAudioChunk, handleError)

      // Start recording
      await recorderRef.current.start(stream, {
        timeslice
      })

      setIsRecording(true)
      setIsPaused(false)
      startTimeRef.current = Date.now()

      // Start duration counter
      durationIntervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
        setRecordingDuration(elapsed)
      }, 1000)

      // Start audio level monitoring
      audioLevelIntervalRef.current = window.setInterval(() => {
        if (recorderRef.current) {
          setAudioLevel(recorderRef.current.getAudioLevel())
        }
      }, 100)

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start recording')
      setPermissionState(MicrophonePermissionState.ERROR)
      setError(error.message)
      handleError(error)
    }
  }, [isSupported, isRecording, handleAudioChunk, handleError, onPermissionDenied, timeslice])

  /**
   * Stop recording
   */
  const stopRecording = useCallback(() => {
    if (!isRecording) {
      return
    }

    // Stop recorder
    if (recorderRef.current) {
      recorderRef.current.stop()
      recorderRef.current = null
    }

    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    // Clear intervals
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }

    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current)
      audioLevelIntervalRef.current = null
    }

    setIsRecording(false)
    setIsPaused(false)
    setAudioLevel(0)
  }, [isRecording])

  /**
   * Pause recording
   */
  const pauseRecording = useCallback(() => {
    if (!isRecording || isPaused) {
      return
    }

    recorderRef.current?.pause()
    setIsPaused(true)
  }, [isRecording, isPaused])

  /**
   * Resume recording
   */
  const resumeRecording = useCallback(() => {
    if (!isRecording || !isPaused) {
      return
    }

    recorderRef.current?.resume()
    setIsPaused(false)
  }, [isRecording, isPaused])

  /**
   * Reset recorder state
   */
  const resetRecorder = useCallback(() => {
    stopRecording()
    setRecordingDuration(0)
    setError(null)
    setPermissionState(MicrophonePermissionState.NOT_REQUESTED)
  }, [stopRecording])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopRecording()
    }
  }, [stopRecording])

  return {
    // State
    isRecording,
    isPaused,
    audioLevel,
    permissionState,
    isSupported,
    recordingDuration,
    error,

    // Actions
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecorder
  }
}

/**
 * Format recording duration as MM:SS
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
