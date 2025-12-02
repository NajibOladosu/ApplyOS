'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface AIOrbProps {
    state: OrbState
    className?: string
}

export function AIOrb({ state, className = '' }: AIOrbProps) {
    const [audioLevel, setAudioLevel] = useState(0)

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
                    opacity: 0.8,
                    color: 'from-blue-400 to-purple-500',
                    pulseSpeed: 2,
                    showRings: false,
                    showParticles: false,
                }
            case 'listening':
                return {
                    scale: 1.1,
                    opacity: 1,
                    color: 'from-green-400 to-emerald-500',
                    pulseSpeed: 1.5,
                    showRings: true,
                    showParticles: false,
                }
            case 'thinking':
                return {
                    scale: 1,
                    opacity: 0.9,
                    color: 'from-amber-400 to-orange-500',
                    pulseSpeed: 1,
                    showRings: false,
                    showParticles: true,
                }
            case 'speaking':
                return {
                    scale: 1 + audioLevel * 0.2,
                    opacity: 1,
                    color: 'from-blue-500 to-indigo-600',
                    pulseSpeed: 0.5,
                    showRings: false,
                    showParticles: false,
                }
        }
    }

    const config = getOrbConfig()

    return (
        <div className={`relative flex items-center justify-center ${className}`}>
            {/* Listening rings */}
            <AnimatePresence>
                {config.showRings && (
                    <>
                        {[0, 1, 2].map((i) => (
                            <motion.div
                                key={`ring-${i}`}
                                className="absolute rounded-full border-2 border-green-400/30"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{
                                    scale: [0.8, 1.5, 2],
                                    opacity: [0.6, 0.3, 0],
                                }}
                                exit={{ scale: 2, opacity: 0 }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    delay: i * 0.4,
                                    ease: 'easeOut',
                                }}
                                style={{
                                    width: '200px',
                                    height: '200px',
                                }}
                            />
                        ))}
                    </>
                )}
            </AnimatePresence>

            {/* Thinking particles */}
            <AnimatePresence>
                {config.showParticles && (
                    <>
                        {[...Array(8)].map((_, i) => {
                            const angle = (i / 8) * Math.PI * 2
                            const radius = 80
                            const x = Math.cos(angle) * radius
                            const y = Math.sin(angle) * radius

                            return (
                                <motion.div
                                    key={`particle-${i}`}
                                    className="absolute w-3 h-3 rounded-full bg-amber-400"
                                    initial={{ x: 0, y: 0, opacity: 0 }}
                                    animate={{
                                        x: [0, x, 0],
                                        y: [0, y, 0],
                                        opacity: [0, 1, 0],
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        delay: i * 0.2,
                                        ease: 'easeInOut',
                                    }}
                                />
                            )
                        })}
                    </>
                )}
            </AnimatePresence>

            {/* Main orb */}
            <motion.div
                className={`relative w-40 h-40 rounded-full bg-gradient-to-br ${config.color} shadow-2xl`}
                animate={{
                    scale: config.scale,
                    opacity: config.opacity,
                }}
                transition={{
                    scale: {
                        duration: config.pulseSpeed,
                        repeat: Infinity,
                        repeatType: 'reverse',
                        ease: 'easeInOut',
                    },
                    opacity: {
                        duration: 0.3,
                    },
                }}
            >
                {/* Inner glow */}
                <motion.div
                    className="absolute inset-0 rounded-full bg-white/20"
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{
                        duration: config.pulseSpeed * 1.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                />

                {/* Speaking waveform effect */}
                {state === 'speaking' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        {[...Array(5)].map((_, i) => (
                            <motion.div
                                key={`wave-${i}`}
                                className="w-1 bg-white/60 rounded-full mx-0.5"
                                animate={{
                                    height: [20, 40 + audioLevel * 30, 20],
                                }}
                                transition={{
                                    duration: 0.3,
                                    repeat: Infinity,
                                    delay: i * 0.05,
                                    ease: 'easeInOut',
                                }}
                            />
                        ))}
                    </div>
                )}
            </motion.div>

            {/* State label */}
            <motion.div
                className="absolute -bottom-12 text-center"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 capitalize">
                    {state === 'idle' && 'Ready'}
                    {state === 'listening' && 'Listening...'}
                    {state === 'thinking' && 'Thinking...'}
                    {state === 'speaking' && 'Speaking...'}
                </p>
            </motion.div>
        </div>
    )
}
