'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GeminiLiveClient } from '@/lib/gemini-live/client'
import type { ConnectionState } from '@/lib/gemini-live/types'

export default function TestLivePage() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [messages, setMessages] = useState<string[]>([])
  const [client, setClient] = useState<GeminiLiveClient | null>(null)
  const [sessionId, setSessionId] = useState('')

  const addMessage = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setMessages((prev) => [...prev, `[${timestamp}] ${message}`])
    console.log(`[${timestamp}] ${message}`)
  }

  const handleConnect = async () => {
    if (!sessionId) {
      addMessage('❌ Error: Please enter a session ID')
      return
    }

    try {
      addMessage('🔄 Initializing live session...')
      setConnectionState('connecting')

      // Call init endpoint to get token and config
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
      addMessage(`✅ Token received for model: ${model}`)

      // Create WebSocket client
      const wsClient = new GeminiLiveClient(
        { token, systemInstruction, model },
        {
          onConnected: () => {
            addMessage('✅ WebSocket connected')
            setConnectionState('connected')
          },
          onDisconnected: () => {
            addMessage('⚠️ WebSocket disconnected')
            setConnectionState('disconnected')
          },
          onError: (error) => {
            addMessage(`❌ Error: ${error.message}`)
            setConnectionState('error')
          },
          onSetupComplete: () => {
            addMessage('✅ Setup complete - ready for audio')
          },
          onServerContent: (content) => {
            addMessage(`📩 Received server content: ${JSON.stringify(content).substring(0, 100)}...`)
          },
          onToolCall: (toolCall) => {
            addMessage(`🔧 Tool call: ${toolCall.name}`)
          },
        }
      )

      // Connect to Gemini Live API
      addMessage('🔄 Connecting to Gemini Live API...')
      await wsClient.connect()
      setClient(wsClient)
    } catch (error: any) {
      addMessage(`❌ Connection failed: ${error.message}`)
      setConnectionState('error')
    }
  }

  const handleDisconnect = () => {
    if (client) {
      addMessage('🔄 Disconnecting...')
      client.disconnect()
      setClient(null)
      setConnectionState('disconnected')
    }
  }

  const handleSendTest = () => {
    if (!client) {
      addMessage('❌ Not connected')
      return
    }

    addMessage('📤 Sending test text message...')
    client.sendText('Hello, this is a test message')
  }

  const getStateColor = () => {
    switch (connectionState) {
      case 'connected':
        return 'bg-green-500'
      case 'connecting':
        return 'bg-yellow-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            Gemini Live API Connection Test
            <Badge className={getStateColor()}>{connectionState}</Badge>
          </CardTitle>
          <CardDescription>
            Test WebSocket connection to Gemini Live API with ephemeral tokens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Session ID Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Interview Session ID</label>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="Enter session ID to test"
              className="w-full p-2 border rounded"
              disabled={connectionState === 'connected'}
            />
            <p className="text-xs text-gray-500">
              Create an interview session first, then paste its ID here
            </p>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <Button
              onClick={handleConnect}
              disabled={connectionState !== 'disconnected' || !sessionId}
            >
              Connect
            </Button>
            <Button
              onClick={handleDisconnect}
              disabled={connectionState === 'disconnected'}
              variant="outline"
            >
              Disconnect
            </Button>
            <Button
              onClick={handleSendTest}
              disabled={connectionState !== 'connected'}
              variant="secondary"
            >
              Send Test Message
            </Button>
          </div>

          {/* Message Log */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Connection Log</label>
            <div className="border rounded p-4 h-96 overflow-y-auto bg-gray-50 dark:bg-gray-900 font-mono text-sm">
              {messages.length === 0 ? (
                <p className="text-gray-500">No messages yet. Click Connect to start.</p>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className="mb-1">
                    {msg}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-4 space-y-2">
            <h3 className="font-semibold text-sm">Test Instructions:</h3>
            <ol className="text-sm space-y-1 list-decimal list-inside">
              <li>Create an interview session in the application</li>
              <li>Copy the session ID</li>
              <li>Paste it in the input above</li>
              <li>Click Connect to test the WebSocket connection</li>
              <li>Watch the log for connection events</li>
              <li>Click "Send Test Message" to test bidirectional communication</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
