"use client"

import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { useVoiceRecorder, formatDuration, MicrophonePermissionState } from '@/hooks/useVoiceRecorder'
import { type AudioChunk } from '@/lib/audio/recorder'
import { Mic, MicOff, Pause, Play, Square } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface VoiceRecorderProps {
  onTranscriptionReceived: (transcription: string) => void
  onError?: (error: Error) => void
  disabled?: boolean
}

export function VoiceRecorder({
  onTranscriptionReceived,
  onError,
  disabled = false
}: VoiceRecorderProps) {
  const [transcription, setTranscription] = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [audioBlobs, setAudioBlobs] = useState<Blob[]>([])

  const {
    isRecording,
    isPaused,
    audioLevel,
    permissionState,
    isSupported,
    recordingDuration,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording
  } = useVoiceRecorder({
    onAudioChunk: async (chunk: AudioChunk) => {
      // Collect blobs for batch transcription
      setAudioBlobs(prev => [...prev, chunk.blob])
    },
    onError: (err) => {
      onError?.(err)
    },
    onPermissionDenied: () => {
      onError?.(new Error('Microphone permission denied'))
    }
  })

  // Handle start recording
  const handleStart = async () => {
    setTranscription('')
    setAudioBlobs([])
    await startRecording()
  }

  // Handle stop and transcribe
  const handleStopAndTranscribe = async () => {
    stopRecording()

    if (audioBlobs.length === 0) {
      onError?.(new Error('No audio recorded'))
      return
    }

    setIsTranscribing(true)

    try {
      // Combine all audio blobs into one
      const combinedBlob = new Blob(audioBlobs, { type: 'audio/webm;codecs=opus' })

      // Convert to base64
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = reader.result as string
          const base64Data = base64.split(',')[1] // Remove data URL prefix
          resolve(base64Data)
        }
        reader.onerror = reject
        reader.readAsDataURL(combinedBlob)
      })

      const audioBase64 = await base64Promise

      // Send audio to transcription API
      const response = await fetch('/api/interview/voice/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioChunks: [audioBase64], // Send as single-element array
          mimeType: 'audio/webm;codecs=opus'
        })
      })

      if (!response.ok) {
        throw new Error('Transcription failed')
      }

      const data = await response.json()
      const text = data.transcription || ''

      setTranscription(text)
      onTranscriptionReceived(text)

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Transcription failed')
      onError?.(error)
    } finally {
      setIsTranscribing(false)
      setAudioBlobs([])
    }
  }

  // Check browser support
  if (!isSupported) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <MicOff className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">Voice recording not supported</p>
          <p className="text-sm text-gray-600 mt-1">
            Please use a modern browser (Chrome, Firefox, Edge, Safari 14.1+)
          </p>
        </div>
      </Card>
    )
  }

  // Show permission request
  if (permissionState === MicrophonePermissionState.DENIED) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <MicOff className="h-12 w-12 mx-auto mb-3" />
          <p className="font-medium">Microphone access denied</p>
          <p className="text-sm text-gray-600 mt-2">
            {error || 'Please grant microphone permission to use voice recording'}
          </p>

          <div className="mt-4 p-4 bg-gray-50 rounded-lg text-left text-sm text-gray-700">
            <p className="font-medium mb-2">To enable microphone access:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Click the lock/info icon in your browser's address bar</li>
              <li>Find "Microphone" in the permissions list</li>
              <li>Change it to "Allow" or "Ask"</li>
              <li>Reload the page and try again</li>
            </ol>
          </div>

          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="mt-4"
          >
            Reload Page
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Recording Controls */}
        <div className="flex items-center justify-center gap-3">
          {!isRecording ? (
            <Button
              onClick={handleStart}
              disabled={disabled || permissionState === MicrophonePermissionState.REQUESTING}
              size="lg"
              className="gap-2"
            >
              <Mic className="h-5 w-5" />
              {permissionState === MicrophonePermissionState.REQUESTING
                ? 'Requesting Permission...'
                : 'Start Recording'}
            </Button>
          ) : (
            <>
              <Button
                onClick={isPaused ? resumeRecording : pauseRecording}
                variant="outline"
                size="lg"
                className="gap-2"
              >
                {isPaused ? (
                  <>
                    <Play className="h-5 w-5" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-5 w-5" />
                    Pause
                  </>
                )}
              </Button>

              <Button
                onClick={handleStopAndTranscribe}
                size="lg"
                className="gap-2"
                disabled={isTranscribing}
              >
                <Square className="h-5 w-5" />
                {isTranscribing ? 'Transcribing...' : 'Submit Answer'}
              </Button>
            </>
          )}
        </div>

        {/* Recording Status */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-2"
            >
              {/* Duration */}
              <div className="text-lg font-mono text-gray-700">
                {formatDuration(recordingDuration)}
              </div>

              {/* Audio Visualizer */}
              {!isPaused && <AudioVisualizer level={audioLevel} />}

              {/* Status */}
              <div className="text-sm text-gray-500">
                {isPaused ? 'Paused' : 'Recording...'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transcription Display */}
        {transcription && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
          >
            <h3 className="text-sm font-medium mb-2 text-gray-700">Transcription</h3>
            <p className="text-gray-900">{transcription}</p>
          </motion.div>
        )}

        {/* Error Display */}
        {error && (
          <div className="text-sm text-red-600 text-center">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isTranscribing && (
          <div className="text-center text-sm text-gray-600">
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600"></div>
              <span>Transcribing your answer...</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

/**
 * Audio Visualizer Component
 */
function AudioVisualizer({ level }: { level: number }) {
  const bars = 10

  return (
    <div className="flex items-center gap-1 h-12">
      {Array.from({ length: bars }).map((_, i) => {
        const isActive = level > i / bars
        const height = isActive ? `${Math.min(level * 100, 100)}%` : '10%'
        const opacity = isActive ? 1 : 0.3

        return (
          <motion.div
            key={i}
            className="w-2 bg-green-500 rounded-full"
            animate={{
              height,
              opacity
            }}
            transition={{
              duration: 0.1
            }}
          />
        )
      })}
    </div>
  )
}
