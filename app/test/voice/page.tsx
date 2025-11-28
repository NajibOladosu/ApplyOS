"use client"

import { useState } from 'react'
import { VoiceRecorder } from '@/components/interview/VoiceRecorder'
import { Card } from '@/components/ui/card'

export default function VoiceRecorderTestPage() {
  const [transcriptions, setTranscriptions] = useState<string[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [lastTranscriptionTime, setLastTranscriptionTime] = useState<number | null>(null)

  const handleTranscription = (transcription: string) => {
    const endTime = Date.now()
    const latency = lastTranscriptionTime ? endTime - lastTranscriptionTime : 0

    console.log('Transcription received:', transcription)
    console.log('Latency:', latency, 'ms')

    setTranscriptions(prev => [...prev, transcription])
    setLastTranscriptionTime(endTime)
  }

  const handleError = (error: Error) => {
    console.error('Voice recorder error:', error)
    setErrors(prev => [...prev, error.message])
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Voice Recorder Test Page</h1>
          <p className="text-gray-600">
            Test the Phase 1 MVP voice recording and transcription functionality
          </p>
        </div>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Voice Recorder Component</h2>
          <VoiceRecorder
            onTranscriptionReceived={handleTranscription}
            onError={handleError}
          />
        </Card>

        {transcriptions.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">
              Transcription History ({transcriptions.length})
            </h2>
            <div className="space-y-3">
              {transcriptions.map((text, index) => (
                <div
                  key={index}
                  className="p-4 bg-green-50 border border-green-200 rounded-lg"
                >
                  <div className="text-sm text-gray-500 mb-1">
                    Transcription #{index + 1}
                  </div>
                  <p className="text-gray-900">{text}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {errors.length > 0 && (
          <Card className="p-6 border-red-200">
            <h2 className="text-xl font-semibold mb-4 text-red-600">
              Errors ({errors.length})
            </h2>
            <div className="space-y-2">
              {errors.map((error, index) => (
                <div
                  key={index}
                  className="p-3 bg-red-50 border border-red-200 rounded text-red-800"
                >
                  {error}
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-6 bg-blue-50">
          <h2 className="text-xl font-semibold mb-3">Test Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Click "Start Recording" to begin</li>
            <li>Grant microphone permission when prompted</li>
            <li>Speak clearly into your microphone</li>
            <li>Watch the audio visualizer to confirm audio is being captured</li>
            <li>Click "Submit Answer" to stop and transcribe</li>
            <li>Verify transcription appears within 3 seconds</li>
            <li>Check the transcription accuracy</li>
          </ol>
        </Card>

        <Card className="p-6 bg-gray-100">
          <h2 className="text-xl font-semibold mb-3">Success Criteria</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            <li>Microphone permission request works</li>
            <li>Audio recording starts successfully</li>
            <li>Audio visualizer shows live audio levels</li>
            <li>Recording can be paused and resumed</li>
            <li>Transcription appears within 3 seconds of clicking submit</li>
            <li>Transcription text is accurate</li>
            <li>No console errors during the flow</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
