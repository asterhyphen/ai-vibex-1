'use client'

import { useRef, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import * as THREE from 'three'

export interface MouseOffset {
  x: number
  y: number
}

interface FloatingObjectProps {
  children: ReactNode
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** Staggered spawn delay in seconds before scaling 0 -> 1 over 1s */
  delay?: number
  floatSpeed?: number
  floatIntensity?: number
  rotationIntensity?: number
  /** How strongly the object tilts toward the pointer */
  tiltIntensity?: number
  mouseRef?: RefObject<MouseOffset>
}

/**
 * Wraps a 3D canteen prop with drei's Float motion, staggered 0 -> 1 spawn
 * animation over 1s, and smooth pointer-reactive tilt.
 */
export function FloatingObject({
  children,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  delay = 0,
  floatSpeed = 1.6,
  floatIntensity = 0.45,
  rotationIntensity = 0.35,
  tiltIntensity = 0.22,
  mouseRef,
}: FloatingObjectProps) {
  const spawnGroupRef = useRef<THREE.Group>(null)
  const tiltGroupRef = useRef<THREE.Group>(null)
  const elapsedRef = useRef(0)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1)
    elapsedRef.current += dt

    if (spawnGroupRef.current) {
      const progress = Math.max(
        0,
        Math.min(1, (elapsedRef.current - delay) / 1.0)
      )
      if (progress <= 0) {
        spawnGroupRef.current.visible = false
        spawnGroupRef.current.scale.setScalar(0.001)
      } else {
        spawnGroupRef.current.visible = true
        // Ease-out cubic for crisp spawn settle
        const eased = 1 - Math.pow(1 - progress, 3)
        spawnGroupRef.current.scale.setScalar(Math.max(0.001, eased))
      }
    }

    if (tiltGroupRef.current) {
      const pointer = mouseRef?.current ?? state.pointer
      const targetX = rotation[0] + -pointer.y * tiltIntensity
      const targetY = rotation[1] + pointer.x * tiltIntensity
      const lerpAlpha = 1 - Math.exp(-6 * dt)

      tiltGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        tiltGroupRef.current.rotation.x,
        targetX,
        lerpAlpha
      )
      tiltGroupRef.current.rotation.y = THREE.MathUtils.lerp(
        tiltGroupRef.current.rotation.y,
        targetY,
        lerpAlpha
      )
      tiltGroupRef.current.rotation.z = rotation[2]
    }
  })

  return (
    <group position={position}>
      <group ref={spawnGroupRef} scale={0.001} visible={false}>
        <Float
          speed={floatSpeed}
          rotationIntensity={rotationIntensity}
          floatIntensity={floatIntensity}
        >
          <group ref={tiltGroupRef} rotation={rotation}>
            {children}
          </group>
        </Float>
      </group>
    </group>
  )
}
