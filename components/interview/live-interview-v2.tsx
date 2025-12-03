'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AIBlob } from './ai-blob'
import type { BlobState } from './ai-blob'
import { AlertCircle } from 'lucide-react'
import { GeminiLiveClient } from '@/lib/gemini-live/client'
import type { ConnectionState, BufferedTurn } from '@/lib/gemini-live/types'
import type { ConversationTurn } from '@/types/database'
import { motion, AnimatePresence } from 'framer-motion'
import { InterviewReportModal } from '@/components/modals/interview-report-modal'
import { useRouter } from 'next/navigation'

interface LiveInterviewProps {
  sessionId: string
  onComplete?: (transcript: ConversationTurn[]) => void
  onError?: (error: Error) => void
}

export function LiveInterview({ sessionId, onComplete, onError }: LiveInterviewProps) {
  const router = useRouter()

  // Interview state
  const [interviewState, setInterviewState] = useState<'idle' | 'starting' | 'active' | 'ending' | 'completed' | 'generating-report'>('idle')
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [client, setClient] = useState<GeminiLiveClient | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Report state
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportData, setReportData] = useState<any>(null)
  const [generatingReport, setGeneratingReport] = useState(false)

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)

  // Transcript state
  const [transcript, setTranscript] = useState<ConversationTurn[]>([])
  const [currentAIMessage, setCurrentAIMessage] = useState<string>('')

  // Turn buffering
  const [turnBuffer, setTurnBuffer] = useState<BufferedTurn[]>([])
  const [turnCount, setTurnCount] = useState(0)
  const FLUSH_THRESHOLD = 8

  // Audio refs
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const playbackContextRef = useRef<AudioContext | null>(null)
  const nextPlayTimeRef = useRef<number>(0)
  const clientRef = useRef<GeminiLiveClient | null>(null)

  // Blob state
  const [blobState, setBlobState] = useState<BlobState>('idle')

  /**
   * Start the interview
   */
  const startInterview = async () => {
    try {
      setInterviewState('starting')
      setConnectionState('connecting')
      setError(null)

      // Initialize AudioContext for playback (must be created in user gesture)
      if (!playbackContextRef.current) {
        console.log('[Audio] Creating AudioContext from user interaction')
        playbackContextRef.current = new AudioContext()
        nextPlayTimeRef.current = playbackContextRef.current.currentTime

        // Resume if suspended
        if (playbackContextRef.current.state === 'suspended') {
          await playbackContextRef.current.resume()
        }
        console.log('[Audio] AudioContext ready, state:', playbackContextRef.current.state)
      }

      // Call init endpoint
      const response = await fetch('/api/interview/live-session/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to initialize session')
      }

      const { token, systemInstruction, model } = await response.json()

      // Create WebSocket client
      const wsClient = new GeminiLiveClient(
        { token, systemInstruction, model },
        {
          onConnected: () => {
            console.log('[Interview] WebSocket connected')
            setConnectionState('connected')
            setInterviewState('active')
          },
          onDisconnected: () => {
            console.log('[Interview] WebSocket disconnected')
            setConnectionState('disconnected')
            setBlobState('idle')
            stopRecording()
          },
          onError: (error) => {
            console.error('[Interview] Error:', error.message)
            setError(error.message)
            setConnectionState('error')
            setInterviewState('idle')
            setBlobState('idle')
            onError?.(error)
          },
          onSetupComplete: () => {
            console.log('[Interview] Setup complete, starting recording and interview...')
            // Start continuous audio streaming
            startRecording()
            // Send initial message to begin interview
            if (clientRef.current) {
              console.log('[Interview] Sending initial prompt to start interview')
              clientRef.current.sendText('Begin the interview. Greet the candidate and ask the first question.')
              setBlobState('speaking')
            }
          },
          onTextResponse: (text) => {
            setCurrentAIMessage(text)
            setBlobState('speaking')

            // Add to transcript
            const turn: ConversationTurn = {
              id: `${Date.now()}-ai`,
              session_id: sessionId,
              user_id: '',
              turn_number: turnCount + 1,
              speaker: 'ai',
              content: text,
              audio_url: null,
              audio_duration_seconds: null,
              timestamp: new Date().toISOString(),
              metadata: null,
              created_at: new Date().toISOString(),
            }
            setTranscript((prev) => [...prev, turn])

            // Buffer turn
            addTurn('ai', text)
          },
          onAudioResponse: (audioData) => {
            playAudioResponse(audioData)
          },
          onTurnComplete: () => {
            setBlobState('listening')
            setCurrentAIMessage('')
          },
        }
      )

      // Connect
      await wsClient.connect()
      setClient(wsClient)
      clientRef.current = wsClient
    } catch (err: any) {
      setError(err.message)
      setConnectionState('error')
      setInterviewState('idle')
      setBlobState('idle')
      onError?.(err)
    }
  }

  /**
   * Start audio recording
   */
  const startRecording = async () => {
    try {
      console.log('[Recording] Requesting microphone access...')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      console.log('[Recording] Microphone access granted')

      mediaStreamRef.current = stream

      // Create AudioContext for recording
      console.log('[Recording] Creating AudioContext for recording...')
      const audioContext = new AudioContext({ sampleRate: 16000 })
      console.log('[Recording] Recording AudioContext created, state:', audioContext.state)

      const source = audioContext.createMediaStreamSource(stream)
      console.log('[Recording] MediaStreamSource created')

      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      console.log('[Recording] ScriptProcessor created')

      let chunkCount = 0
      processor.onaudioprocess = (event) => {
        if (!client || connectionState !== 'connected') {
          if (chunkCount === 0) {
            console.log('[Recording] Audio processing skipped - client not connected')
          }
          return
        }

        try {
          const inputData = event.inputBuffer.getChannelData(0)

          // Calculate audio level for blob pulsation
          const sum = inputData.reduce((acc, val) => acc + Math.abs(val), 0)
          const level = sum / inputData.length
          setAudioLevel(Math.min(level * 10, 1)) // Normalize to 0-1

          // Convert to 16-bit PCM
          const pcm16 = new Int16Array(inputData.length)
          for (let i = 0; i < inputData.length; i++) {
            const clamped = Math.max(-1, Math.min(1, inputData[i]))
            pcm16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
          }

          // Convert to base64
          const uint8Array = new Uint8Array(pcm16.buffer)
          let binaryString = ''
          for (let i = 0; i < uint8Array.length; i++) {
            binaryString += String.fromCharCode(uint8Array[i])
          }
          const base64Audio = btoa(binaryString)

          // Send to Gemini
          client.sendAudio(base64Audio)

          // Log first few chunks
          if (chunkCount < 3) {
            console.log(`[Recording] Sent audio chunk ${chunkCount + 1}, size: ${base64Audio.length}, level: ${level.toFixed(4)}`)
          }
          chunkCount++
        } catch (error) {
          console.error('[Recording] Audio processing error:', error)
        }
      }

      console.log('[Recording] Connecting audio nodes...')
      source.connect(processor)
      processor.connect(audioContext.destination)
      console.log('[Recording] Audio nodes connected')

      audioContextRef.current = audioContext
      processorRef.current = processor

      setIsRecording(true)
      setBlobState('listening')
      console.log('[Recording] Recording active, blob state set to listening')
    } catch (err: any) {
      console.error('[Recording] Microphone access error:', err)
      setError(`Microphone access denied: ${err.message}`)
    }
  }

  /**
   * Stop recording
   */
  const stopRecording = () => {
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    setIsRecording(false)
    setBlobState('thinking')

    // Signal turn completion
    if (client && connectionState === 'connected') {
      client.sendText('')
    }
  }

  /**
   * Play audio response
   */
  const playAudioResponse = async (base64Audio: string) => {
    try {
      console.log('[Audio] Received audio data, length:', base64Audio.length)

      if (!playbackContextRef.current) {
        console.log('[Audio] Creating new AudioContext')
        playbackContextRef.current = new AudioContext()
        nextPlayTimeRef.current = playbackContextRef.current.currentTime
      }

      const playbackContext = playbackContextRef.current
      console.log('[Audio] AudioContext state:', playbackContext.state)

      if (playbackContext.state === 'suspended') {
        console.log('[Audio] Resuming suspended AudioContext')
        await playbackContext.resume()
        console.log('[Audio] AudioContext resumed, new state:', playbackContext.state)
      }

      // Decode base64 to PCM
      const binaryString = atob(base64Audio)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      console.log('[Audio] Decoded bytes:', bytes.length)

      // Convert to Int16Array
      const dataView = new DataView(bytes.buffer)
      const numSamples = Math.floor(bytes.length / 2)
      const pcm16 = new Int16Array(numSamples)

      for (let i = 0; i < numSamples; i++) {
        pcm16[i] = dataView.getInt16(i * 2, true)
      }

      // Convert to Float32Array
      const float32 = new Float32Array(pcm16.length)
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0
      }

      console.log('[Audio] Converted to float32, samples:', float32.length)

      // Create audio buffer
      const sampleRate = 24000
      const audioBuffer = playbackContext.createBuffer(1, float32.length, sampleRate)
      audioBuffer.copyToChannel(float32, 0)

      console.log('[Audio] Created buffer, duration:', audioBuffer.duration.toFixed(2), 's')

      // Schedule playback
      const currentTime = playbackContext.currentTime
      if (nextPlayTimeRef.current < currentTime) {
        nextPlayTimeRef.current = currentTime
      }

      const source = playbackContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(playbackContext.destination)

      console.log('[Audio] Starting playback at:', nextPlayTimeRef.current.toFixed(2), 's')
      source.start(nextPlayTimeRef.current)

      nextPlayTimeRef.current += audioBuffer.duration
      console.log('[Audio] Next play time:', nextPlayTimeRef.current.toFixed(2), 's')

      // Update blob state to speaking
      setBlobState('speaking')

      // Reset to listening after audio finishes
      setTimeout(() => {
        setBlobState('listening')
      }, audioBuffer.duration * 1000)
    } catch (error) {
      console.error('[Audio] Playback error:', error)
    }
  }

  /**
   * Add turn to buffer
   */
  const addTurn = async (speaker: 'ai' | 'user', content: string) => {
    const turn: BufferedTurn = {
      turn_number: turnCount + 1,
      speaker,
      content,
      timestamp: new Date().toISOString(),
    }

    const newBuffer = [...turnBuffer, turn]
    setTurnBuffer(newBuffer)
    setTurnCount(turnCount + 1)

    if (newBuffer.length >= FLUSH_THRESHOLD) {
      await flushTurns(newBuffer)
      setTurnBuffer([])
    }
  }

  /**
   * Flush turns
   */
  const flushTurns = async (turns: BufferedTurn[]) => {
    if (turns.length === 0) return

    try {
      await fetch('/api/interview/live-session/flush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, turns }),
      })
    } catch (error) {
      console.error('Flush error:', error)
    }
  }

  /**
   * End interview
   */
  const endInterview = async () => {
    try {
      setInterviewState('ending')
      stopRecording()

      if (client) {
        client.disconnect()
      }

      // Complete session
      const response = await fetch('/api/interview/live-session/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          remainingTurns: turnBuffer,
          transcript,
        }),
      })

      if (playbackContextRef.current) {
        playbackContextRef.current.close()
        playbackContextRef.current = null
      }

      setConnectionState('disconnected')
      setBlobState('idle')

      if (response.ok) {
        // Generate report
        setInterviewState('generating-report')
        setGeneratingReport(true)
        await generateReport()
        onComplete?.(transcript)
      }
    } catch (err: any) {
      setError(err.message)
      setInterviewState('idle')
    }
  }

  /**
   * Generate interview report
   */
  const generateReport = async () => {
    try {
      const response = await fetch('/api/interview/report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate report')
      }

      const data = await response.json()
      setReportData(data.reportData)
      setGeneratingReport(false)
      setInterviewState('completed')
      setShowReportModal(true)
    } catch (err: any) {
      console.error('Error generating report:', err)
      setError('Failed to generate report. Please try again.')
      setGeneratingReport(false)
      setInterviewState('completed')
    }
  }

  /**
   * Handle retake interview
   */
  const handleRetake = async () => {
    try {
      setShowReportModal(false)
      setGeneratingReport(true)

      const response = await fetch('/api/interview/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })

      if (!response.ok) {
        throw new Error('Failed to reset interview')
      }

      // Reset local state
      setTranscript([])
      setTurnBuffer([])
      setTurnCount(0)
      setReportData(null)
      setGeneratingReport(false)
      setError(null)
      setInterviewState('idle')
      setConnectionState('disconnected')
    } catch (err: any) {
      console.error('Error resetting interview:', err)
      setError('Failed to reset interview. Please refresh the page.')
      setGeneratingReport(false)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording()
      if (client) {
        client.disconnect()
      }
      if (playbackContextRef.current) {
        playbackContextRef.current.close()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4"
          >
            <div className="bg-destructive/10 backdrop-blur-sm border border-destructive/50 rounded-xl p-4 flex items-start gap-3 shadow-lg">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Error</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setError(null)}
                className="flex-shrink-0 h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="max-w-4xl w-full flex flex-col items-center space-y-12">
        {/* Blob */}
        <AIBlob state={blobState} audioLevel={audioLevel} />

        {/* AI Message */}
        <AnimatePresence mode="wait">
          {currentAIMessage && interviewState === 'active' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl"
            >
              <div className="bg-card/50 backdrop-blur-sm border border-primary/20 rounded-2xl p-6 text-center">
                <p className="text-lg leading-relaxed">{currentAIMessage}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Start/End Interview Button */}
        <div className="flex flex-col items-center gap-4">
          {interviewState === 'idle' && (
            <Button
              size="lg"
              onClick={startInterview}
              className="px-12 py-6 text-lg rounded-full bg-primary hover:bg-primary/90 text-background font-semibold"
            >
              Start Interview
            </Button>
          )}

          {interviewState === 'starting' && (
            <Button
              size="lg"
              disabled
              className="px-12 py-6 text-lg rounded-full"
            >
              Starting...
            </Button>
          )}

          {interviewState === 'active' && (
            <Button
              size="lg"
              variant="destructive"
              onClick={endInterview}
              className="px-12 py-6 text-lg rounded-full"
            >
              End Interview
            </Button>
          )}

          {interviewState === 'ending' && (
            <Button
              size="lg"
              disabled
              variant="destructive"
              className="px-12 py-6 text-lg rounded-full"
            >
              Ending...
            </Button>
          )}

          {interviewState === 'generating-report' && (
            <Button
              size="lg"
              disabled
              className="px-12 py-6 text-lg rounded-full"
            >
              Generating Report...
            </Button>
          )}

          {/* Status */}
          {interviewState === 'active' && transcript.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {Math.floor(transcript.length / 2)} questions answered
            </p>
          )}
        </div>
      </div>

      {/* Report Modal */}
      {reportData && (
        <InterviewReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportData={reportData}
          sessionId={sessionId}
          onRetake={handleRetake}
        />
      )}
    </div>
  )
}
