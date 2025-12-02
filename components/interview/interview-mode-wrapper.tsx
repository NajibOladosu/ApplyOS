'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Mic, ArrowLeft } from 'lucide-react'
import { InterviewSessionDetail } from './interview-session-detail'
import { ConversationalInterview } from './conversational-interview'
import { ConversationTranscript } from './conversation-transcript'
import { getInterviewSession, getConversationTurns } from '@/lib/services/interviews'
import type { InterviewSession, ConversationTurn } from '@/types/database'

interface InterviewModeWrapperProps {
    sessionId: string
    onComplete?: () => void
    onBack?: () => void
}

export function InterviewModeWrapper({ sessionId, onComplete, onBack }: InterviewModeWrapperProps) {
    const [session, setSession] = useState<InterviewSession | null>(null)
    const [mode, setMode] = useState<'select' | 'text' | 'conversation' | 'review'>('select')
    const [transcript, setTranscript] = useState<ConversationTurn[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadSession = async () => {
            try {
                const sessionData = await getInterviewSession(sessionId)
                setSession(sessionData)

                // If session is already in conversation mode or completed, load transcript
                if (sessionData.conversation_mode) {
                    if (sessionData.status === 'completed' && sessionData.full_transcript) {
                        setTranscript(sessionData.full_transcript)
                        setMode('review')
                    } else if (sessionData.status === 'in_progress') {
                        // Resume conversation
                        const turns = await getConversationTurns(sessionId)
                        setTranscript(turns)
                        setMode('conversation')
                    }
                } else if (sessionData.status === 'completed') {
                    // Text-based interview completed
                    setMode('text')
                }
            } catch (err) {
                console.error('Error loading session:', err)
            } finally {
                setLoading(false)
            }
        }

        loadSession()
    }, [sessionId])

    if (loading || !session) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        )
    }

    // Mode selection screen
    if (mode === 'select' && session.status === 'in_progress') {
        return (
            <div className="max-w-4xl mx-auto p-6 space-y-6">
                <div className="flex items-center space-x-4">
                    {onBack && (
                        <Button variant="ghost" size="sm" onClick={onBack}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                        </Button>
                    )}
                    <div>
                        <h2 className="text-2xl font-bold">Choose Interview Mode</h2>
                        <p className="text-gray-600 dark:text-gray-400">
                            Select how you'd like to practice your interview
                        </p>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Conversational Mode */}
                    <Card
                        className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-500"
                        onClick={() => setMode('conversation')}
                    >
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <Mic className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold mb-2">Conversational Mode</h3>
                                <Badge className="mb-3">Recommended</Badge>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Real-time voice conversation with an AI interviewer.
                                    Natural back-and-forth dialogue with dynamic follow-up questions.
                                </p>
                            </div>
                            <ul className="text-sm text-left space-y-2 w-full">
                                <li className="flex items-start">
                                    <span className="text-green-500 mr-2">✓</span>
                                    <span>Voice-based interaction</span>
                                </li>
                                <li className="flex items-start">
                                    <span className="text-green-500 mr-2">✓</span>
                                    <span>Automatic speech detection</span>
                                </li>
                                <li className="flex items-start">
                                    <span className="text-green-500 mr-2">✓</span>
                                    <span>Dynamic follow-up questions</span>
                                </li>
                                <li className="flex items-start">
                                    <span className="text-green-500 mr-2">✓</span>
                                    <span>More realistic interview experience</span>
                                </li>
                            </ul>
                        </div>
                    </Card>

                    {/* Text Mode */}
                    <Card
                        className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-500"
                        onClick={() => setMode('text')}
                    >
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-500 to-gray-700 flex items-center justify-center">
                                <MessageSquare className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold mb-2">Text Mode</h3>
                                <Badge variant="secondary" className="mb-3">Classic</Badge>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Traditional text-based Q&A format.
                                    Type your responses and receive detailed AI feedback.
                                </p>
                            </div>
                            <ul className="text-sm text-left space-y-2 w-full">
                                <li className="flex items-start">
                                    <span className="text-green-500 mr-2">✓</span>
                                    <span>Type your responses</span>
                                </li>
                                <li className="flex items-start">
                                    <span className="text-green-500 mr-2">✓</span>
                                    <span>Take your time to think</span>
                                </li>
                                <li className="flex items-start">
                                    <span className="text-green-500 mr-2">✓</span>
                                    <span>Edit before submitting</span>
                                </li>
                                <li className="flex items-start">
                                    <span className="text-green-500 mr-2">✓</span>
                                    <span>Detailed written feedback</span>
                                </li>
                            </ul>
                        </div>
                    </Card>
                </div>
            </div>
        )
    }

    // Render appropriate mode
    if (mode === 'conversation') {
        return (
            <ConversationalInterview
                sessionId={sessionId}
                onComplete={() => {
                    setMode('review')
                    onComplete?.()
                }}
            />
        )
    }

    if (mode === 'review' && transcript.length > 0) {
        return (
            <ConversationTranscript
                sessionId={sessionId}
                transcript={transcript}
                onClose={onBack}
            />
        )
    }

    // Default to text mode
    return (
        <InterviewSessionDetail
            sessionId={sessionId}
            onComplete={onComplete}
            onBack={onBack}
        />
    )
}
