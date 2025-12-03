'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

export type BlobState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface AIBlobProps {
  state: BlobState
  audioLevel?: number
  className?: string
}

export function AIBlob({ state, audioLevel = 0, className = '' }: AIBlobProps) {
  const [morphPath, setMorphPath] = useState(0)

  // Organic shape morphing animation
  useEffect(() => {
    const interval = setInterval(() => {
      setMorphPath((prev) => (prev + 1) % 4)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Define organic blob shapes (more irregular and blob-like)
  const blobPaths = [
    // Shape 1 - Irregular blob
    'M 180,90 Q 140,60 160,120 T 140,180 Q 120,220 160,250 T 200,280 Q 240,290 280,260 T 320,220 Q 340,180 320,140 T 300,100 Q 260,70 220,90 T 180,90 Z',
    // Shape 2 - Wobbly blob
    'M 190,85 Q 150,70 145,130 T 130,190 Q 125,240 170,270 T 220,285 Q 270,295 310,265 T 335,215 Q 345,165 325,125 T 285,85 Q 245,65 205,80 T 190,85 Z',
    // Shape 3 - Asymmetric blob
    'M 195,95 Q 155,85 150,145 T 140,205 Q 135,255 180,280 T 235,290 Q 285,295 320,255 T 340,195 Q 345,145 315,110 T 270,85 Q 230,75 195,95 Z',
    // Shape 4 - Fluid blob
    'M 185,100 Q 145,95 155,155 T 145,215 Q 140,265 185,285 T 240,295 Q 290,300 325,265 T 345,210 Q 350,160 320,120 T 275,90 Q 235,80 200,95 T 185,100 Z',
  ]

  // Circle path for listening state
  const circlePath = 'M 225,75 C 275,75 325,125 325,175 C 325,225 275,275 225,275 C 175,275 125,225 125,175 C 125,125 175,75 225,75 Z'

  // Get current path based on state
  const getCurrentPath = () => {
    if (state === 'listening') {
      return circlePath
    }
    return blobPaths[morphPath]
  }

  // Animation variants
  const blobVariants = {
    idle: {
      scale: 1,
      rotate: 0,
    },
    listening: {
      scale: [1, 1 + audioLevel * 0.3, 1],
      rotate: 0,
    },
    thinking: {
      scale: [1, 1.05, 1],
      rotate: [0, 5, -5, 0],
    },
    speaking: {
      scale: [1, 1.1, 1],
      rotate: 0,
    },
  }

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Outer glow */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{
          scale: state === 'listening' ? [1, 1.2, 1] : [1, 1.1, 1],
          opacity: state === 'listening' ? [0.3, 0.5, 0.3] : [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: state === 'listening' ? 0.5 : 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <div className="w-[450px] h-[450px] rounded-full bg-primary/30 blur-3xl" />
      </motion.div>

      {/* Main blob */}
      <motion.div
        className="relative z-10"
        variants={blobVariants}
        animate={state}
        transition={{
          duration: state === 'listening' ? 0.1 : 1.5,
          repeat: state === 'listening' ? Infinity : 0,
          ease: 'easeInOut',
        }}
      >
        <svg
          width="450"
          height="350"
          viewBox="0 0 450 350"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Blob shape */}
          <motion.path
            d={getCurrentPath()}
            fill="url(#blobGradient)"
            initial={false}
            animate={{ d: getCurrentPath() }}
            transition={{
              duration: 2,
              ease: 'easeInOut',
            }}
          />

          {/* Gradient definition */}
          <defs>
            <linearGradient
              id="blobGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop
                offset="0%"
                style={{ stopColor: '#00FF88', stopOpacity: 1 }}
              />
              <stop
                offset="50%"
                style={{ stopColor: '#00DD77', stopOpacity: 0.9 }}
              />
              <stop
                offset="100%"
                style={{ stopColor: '#00BB66', stopOpacity: 0.8 }}
              />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>

      {/* Pulsing particles for listening state */}
      {state === 'listening' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[...Array(8)].map((_, i) => {
            const angle = (i / 8) * Math.PI * 2
            const distance = 180 + audioLevel * 50
            return (
              <motion.div
                key={i}
                className="absolute w-3 h-3 rounded-full bg-primary"
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 0.6, 0],
                  scale: [0, 1, 0],
                  x: Math.cos(angle) * distance,
                  y: Math.sin(angle) * distance,
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: 'easeOut',
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
