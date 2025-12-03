'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Mic, Brain, Volume2, Sparkles } from 'lucide-react'

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface AIOrbProps {
    state: OrbState
    className?: string
}

export function AIOrb({ state, className = '' }: AIOrbProps) {
    const [audioLevel, setAudioLevel] = useState(0)
    const [particlePositions, setParticlePositions] = useState<Array<{ x: number; y: number }>>([])

    // Generate particle positions for thinking state
    useEffect(() => {
        if (state === 'thinking') {
            const positions = Array.from({ length: 12 }, (_, i) => {
                const angle = (i / 12) * Math.PI * 2
                const radius = 100 + Math.random() * 20
                return {
                    x: Math.cos(angle) * radius,
                    y: Math.sin(angle) * radius,
                }
            })
            setParticlePositions(positions)
        }
    }, [state])

    // Simulate audio level for speaking state
    useEffect(() => {
        if (state === 'speaking') {
            const interval = setInterval(() => {
                setAudioLevel(Math.random() * 0.5 + 0.5)
            }, 100)
            return () => clearInterval(interval)
        } else {
            setAudioLevel(0)
        }
    }, [state])

    const getOrbConfig = () => {
        switch (state) {
            case 'idle':
                return {
                    scale: 1,
                    color: 'from-gray-400 via-gray-500 to-gray-600',
                    glowColor: 'rgba(156, 163, 175, 0.4)',
                    icon: Sparkles,
                    pulseSpeed: 3,
                }
            case 'listening':
                return {
                    scale: 1.05,
                    color: 'from-green-400 via-emerald-500 to-teal-600',
                    glowColor: 'rgba(16, 185, 129, 0.5)',
                    icon: Mic,
                    pulseSpeed: 1.5,
                }
            case 'thinking':
                return {
                    scale: 1,
                    color: 'from-amber-400 via-orange-500 to-red-500',
                    glowColor: 'rgba(251, 146, 60, 0.5)',
                    icon: Brain,
                    pulseSpeed: 2,
                }
            case 'speaking':
                return {
                    scale: 1 + audioLevel * 0.15,
                    color: 'from-blue-400 via-indigo-500 to-purple-600',
                    glowColor: 'rgba(99, 102, 241, 0.5)',
                    icon: Volume2,
                    pulseSpeed: 0.8,
                }
        }
    }

    const config = getOrbConfig()
    const StateIcon = config.icon

    return (
        <div className={`relative flex items-center justify-center ${className}`}>
            {/* Outer glow ring */}
            <motion.div
                className="absolute rounded-full"
                style={{
                    width: '280px',
                    height: '280px',
                    background: `radial-gradient(circle, ${config.glowColor} 0%, transparent 70%)`,
                }}
                animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.4, 0.6, 0.4],
                }}
                transition={{
                    duration: config.pulseSpeed,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
            />

            {/* Listening sound waves */}
            <AnimatePresence>
                {state === 'listening' && (
                    <>
                        {[0, 1, 2].map((i) => (
                            <motion.div
                                key={`wave-${i}`}
                                className="absolute rounded-full"
                                style={{
                                    width: '200px',
                                    height: '200px',
                                    border: '2px solid rgba(16, 185, 129, 0.3)',
                                }}
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{
                                    scale: [0.9, 1.8],
                                    opacity: [0.5, 0],
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    delay: i * 0.5,
                                    ease: 'easeOut',
                                }}
                            />
                        ))}
                    </>
                )}
            </AnimatePresence>

            {/* Thinking particles */}
            <AnimatePresence>
                {state === 'thinking' && (
                    <>
                        {particlePositions.map((pos, i) => (
                            <motion.div
                                key={`particle-${i}`}
                                className="absolute w-2 h-2 rounded-full"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.8), rgba(239, 68, 68, 0.8))',
                                }}
                                initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                                animate={{
                                    x: [0, pos.x * 0.5, pos.x, pos.x * 0.5, 0],
                                    y: [0, pos.y * 0.5, pos.y, pos.y * 0.5, 0],
                                    opacity: [0, 0.6, 1, 0.6, 0],
                                    scale: [0, 1, 1.2, 1, 0],
                                }}
                                transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    delay: i * 0.15,
                                    ease: 'easeInOut',
                                }}
                            />
                        ))}
                    </>
                )}
            </AnimatePresence>

            {/* Main orb container */}
            <motion.div
                className="relative"
                animate={{
                    scale: config.scale,
                    rotate: state === 'thinking' ? 360 : 0,
                }}
                transition={{
                    scale: {
                        duration: config.pulseSpeed,
                        repeat: Infinity,
                        repeatType: 'reverse',
                        ease: 'easeInOut',
                    },
                    rotate: {
                        duration: 8,
                        repeat: Infinity,
                        ease: 'linear',
                    },
                }}
            >
                {/* Main orb */}
                <motion.div
                    className={`relative w-48 h-48 rounded-full bg-gradient-to-br ${config.color} shadow-2xl overflow-hidden`}
                >
                    {/* Glass morphism effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/10" />

                    {/* Animated gradient overlay */}
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent"
                        animate={{
                            rotate: [0, 360],
                        }}
                        transition={{
                            duration: 8,
                            repeat: Infinity,
                            ease: 'linear',
                        }}
                    />

                    {/* Inner glow pulse */}
                    <motion.div
                        className="absolute inset-4 rounded-full bg-gradient-to-br from-white/30 to-transparent"
                        animate={{
                            scale: [0.9, 1, 0.9],
                            opacity: [0.5, 0.8, 0.5],
                        }}
                        transition={{
                            duration: config.pulseSpeed * 1.5,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                    />

                    {/* Center content */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        {state === 'speaking' ? (
                            // Waveform for speaking
                            <div className="flex items-center justify-center gap-1.5">
                                {[...Array(7)].map((_, i) => (
                                    <motion.div
                                        key={`bar-${i}`}
                                        className="w-2 bg-white rounded-full"
                                        animate={{
                                            height: [
                                                16,
                                                24 + audioLevel * 40 * Math.sin((i * Math.PI) / 6),
                                                16,
                                            ],
                                        }}
                                        transition={{
                                            duration: 0.4,
                                            repeat: Infinity,
                                            delay: i * 0.08,
                                            ease: 'easeInOut',
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            // Icon for other states
                            <motion.div
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                            >
                                <StateIcon className="w-16 h-16 text-white" strokeWidth={1.5} />
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </motion.div>

            {/* State label with enhanced styling */}
            <motion.div
                className="absolute -bottom-16 text-center"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <motion.div
                    className="px-6 py-2 rounded-full backdrop-blur-sm border border-gray-200 dark:border-gray-700"
                    style={{
                        background: `linear-gradient(135deg, ${config.glowColor}, transparent)`,
                    }}
                    animate={{
                        boxShadow: [
                            `0 0 20px ${config.glowColor}`,
                            `0 0 30px ${config.glowColor}`,
                            `0 0 20px ${config.glowColor}`,
                        ],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                >
                    <p className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                        {state === 'idle' && '✨ Ready'}
                        {state === 'listening' && '🎤 Listening'}
                        {state === 'thinking' && '🧠 Thinking'}
                        {state === 'speaking' && '🔊 Speaking'}
                    </p>
                </motion.div>
            </motion.div>
        </div>
    )
}
