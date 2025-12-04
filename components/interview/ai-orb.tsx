'use client'

import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createNoise3D } from 'simplex-noise'

export type OrbMode = 'idle' | 'user' | 'ai'

interface OrbProps {
  mode: OrbMode
  audioLevel?: number
}

function OrbMesh({ mode, audioLevel = 0 }: OrbProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const wireRef = useRef<THREE.Mesh>(null)
  const geometryRef = useRef<THREE.SphereGeometry | null>(null)

  const noise3D = useMemo(() => createNoise3D(), [])

  const colors = {
    idle: '#00FF6A',
    user: '#FFD600',
    ai: '#00FF6A',
  }

  const amplitudes = {
    idle: 0.15,
    user: 0.05,
    ai: 0.45,
  }

  const glows = {
    idle: 0.25,
    user: 0.15,
    ai: 0.45,
  }

  const scales = {
    idle: 1,
    user: 1,
    ai: 1.1,
  }

  useMemo(() => {
    geometryRef.current = new THREE.SphereGeometry(1, 64, 64)
  }, [])

  useFrame(({ clock }) => {
    if (!meshRef.current || !geometryRef.current) return

    const t = clock.getElapsedTime()
    const mesh = meshRef.current
    const wire = wireRef.current
    const geometry = geometryRef.current

    const targetScale = scales[mode]
    mesh.scale.set(targetScale, targetScale, targetScale)

    const positionAttribute = geometry.attributes.position
    const vertex = new THREE.Vector3()

    for (let i = 0; i < positionAttribute.count; i++) {
      vertex.fromBufferAttribute(positionAttribute, i)
      const originalVertex = vertex.clone().normalize()

      const noiseValue = noise3D(
        originalVertex.x * 2 + t * 0.5,
        originalVertex.y * 2 + t * 0.5,
        originalVertex.z * 2 + t * 0.5
      )

      const amp = amplitudes[mode] + (mode === 'user' ? audioLevel * 0.1 : 0)
      const displacement = 1 + noiseValue * amp

      vertex.copy(originalVertex).multiplyScalar(displacement)
      positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z)
    }

    positionAttribute.needsUpdate = true
    geometry.computeVertexNormals()

    if (wire && wire.geometry) {
      const wirePositionAttribute = wire.geometry.attributes.position
      for (let i = 0; i < positionAttribute.count; i++) {
        wirePositionAttribute.setXYZ(
          i,
          positionAttribute.getX(i),
          positionAttribute.getY(i),
          positionAttribute.getZ(i)
        )
      }
      wirePositionAttribute.needsUpdate = true
    }
  })

  return (
    <group>
      <mesh ref={meshRef} geometry={geometryRef.current || undefined}>
        <meshStandardMaterial
          color={colors[mode]}
          emissive={colors[mode]}
          emissiveIntensity={glows[mode]}
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>
      <mesh ref={wireRef} geometry={geometryRef.current || undefined}>
        <meshBasicMaterial
          wireframe
          color={colors[mode]}
          opacity={0.3}
          transparent
        />
      </mesh>
    </group>
  )
}

interface AIOrbProps {
  mode: OrbMode
  audioLevel?: number
  className?: string
}

export function AIOrb({ mode, audioLevel = 0, className = '' }: AIOrbProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${className}`}>
        <div className="w-48 h-48 rounded-full bg-gradient-to-br from-green-400 to-green-600 animate-pulse opacity-50" />
      </div>
    )
  }

  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas camera={{ position: [0, 0, 3], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[5, 5, 5]} intensity={2} />
        <pointLight position={[-5, -5, -5]} intensity={1} />
        <OrbMesh mode={mode} audioLevel={audioLevel} />
      </Canvas>
    </div>
  )
}
