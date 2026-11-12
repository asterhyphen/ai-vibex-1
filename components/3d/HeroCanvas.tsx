'use client'

import { Component, Suspense, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Environment } from '@react-three/drei'
import * as THREE from 'three'
import { FloatingObject, type MouseOffset } from './FloatingObject'

const BURGUNDY = '#7A1F3D'
const BURGUNDY_DEEP = '#2B1117'
const GOLD = '#B8893B'
const IVORY = '#FAF7F4'

class SilentEnvBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

function TrayMesh() {
  const legPositions: [number, number, number][] = [
    [-0.68, -0.08, -0.48],
    [0.68, -0.08, -0.48],
    [-0.68, -0.08, 0.48],
    [0.68, -0.08, 0.48],
  ]

  return (
    <group>
      {/* Main tray surface */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.05, 1.2]} />
        <meshStandardMaterial
          color={BURGUNDY}
          roughness={0.35}
          metalness={0.18}
        />
      </mesh>

      {/* Gold rim strips */}
      <mesh position={[0, 0.04, 0.58]}>
        <boxGeometry args={[1.62, 0.04, 0.04]} />
        <meshStandardMaterial color={GOLD} roughness={0.25} metalness={0.75} />
      </mesh>
      <mesh position={[0, 0.04, -0.58]}>
        <boxGeometry args={[1.62, 0.04, 0.04]} />
        <meshStandardMaterial color={GOLD} roughness={0.25} metalness={0.75} />
      </mesh>
      <mesh position={[0.78, 0.04, 0]}>
        <boxGeometry args={[0.04, 0.04, 1.14]} />
        <meshStandardMaterial color={GOLD} roughness={0.25} metalness={0.75} />
      </mesh>
      <mesh position={[-0.78, 0.04, 0]}>
        <boxGeometry args={[0.04, 0.04, 1.14]} />
        <meshStandardMaterial color={GOLD} roughness={0.25} metalness={0.75} />
      </mesh>

      {/* 4 small legs */}
      {legPositions.map((pos, idx) => (
        <mesh key={idx} position={pos} castShadow>
          <cylinderGeometry args={[0.045, 0.035, 0.14, 8]} />
          <meshStandardMaterial color={GOLD} roughness={0.28} metalness={0.72} />
        </mesh>
      ))}
    </group>
  )
}

function SteamParticles() {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([])
  const matRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([])

  const seeds = useMemo(
    () => [
      { phase: 0.0, xOffset: -0.05, zOffset: 0.03, speed: 0.42 },
      { phase: 0.25, xOffset: 0.06, zOffset: -0.04, speed: 0.38 },
      { phase: 0.5, xOffset: -0.02, zOffset: -0.05, speed: 0.46 },
      { phase: 0.75, xOffset: 0.04, zOffset: 0.05, speed: 0.4 },
    ],
    []
  )

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    seeds.forEach((seed, i) => {
      const mesh = meshRefs.current[i]
      const mat = matRefs.current[i]
      if (!mesh || !mat) return

      const cycle = (t * seed.speed + seed.phase) % 1
      mesh.position.y = 0.34 + cycle * 0.78
      mesh.position.x = seed.xOffset + Math.sin(t * 2.2 + i) * 0.06
      mesh.position.z = seed.zOffset + Math.cos(t * 1.8 + i) * 0.05

      const scale = 0.65 + cycle * 0.85
      mesh.scale.setScalar(scale)

      // Fade in smoothly then dissipate at top
      const fadeIn = Math.min(1, cycle * 4)
      const fadeOut = 1 - cycle
      mat.opacity = 0.52 * fadeIn * fadeOut
    })
  })

  return (
    <group>
      {seeds.map((_, idx) => (
        <mesh
          key={idx}
          ref={(el) => {
            meshRefs.current[idx] = el
          }}
        >
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial
            ref={(el) => {
              matRefs.current[idx] = el
            }}
            color={IVORY}
            transparent
            opacity={0.4}
            roughness={0.9}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

function CupMesh() {
  return (
    <group>
      {/* Low-poly cup */}
      <mesh position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.2, 0.5, 8]} />
        <meshStandardMaterial color={GOLD} roughness={0.28} metalness={0.58} />
      </mesh>

      {/* Filter coffee inside */}
      <mesh position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.255, 0.255, 0.02, 8]} />
        <meshStandardMaterial color={BURGUNDY_DEEP} roughness={0.4} />
      </mesh>

      {/* Cup handle */}
      <mesh position={[0.27, 0.04, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <torusGeometry args={[0.12, 0.032, 8, 12, Math.PI]} />
        <meshStandardMaterial color={GOLD} roughness={0.28} metalness={0.62} />
      </mesh>

      {/* Saucer */}
      <mesh position={[0, -0.22, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <torusGeometry args={[0.36, 0.042, 8, 16]} />
        <meshStandardMaterial color={BURGUNDY} roughness={0.35} metalness={0.25} />
      </mesh>
      <mesh position={[0, -0.23, 0]} receiveShadow>
        <cylinderGeometry args={[0.34, 0.26, 0.03, 12]} />
        <meshStandardMaterial color={BURGUNDY} roughness={0.35} metalness={0.2} />
      </mesh>

      {/* Rising steam particles */}
      <SteamParticles />
    </group>
  )
}

function PlateMesh() {
  return (
    <group>
      {/* Flat ceramic disc */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.6, 0.6, 0.05, 16]} />
        <meshStandardMaterial color={IVORY} roughness={0.25} metalness={0.08} />
      </mesh>

      {/* Gold decorative ring */}
      <mesh position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.47, 0.024, 8, 24]} />
        <meshStandardMaterial color={GOLD} roughness={0.24} metalness={0.78} />
      </mesh>

      {/* Burgundy low-poly centerpiece */}
      <mesh position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.07, 12]} />
        <meshStandardMaterial color={BURGUNDY} roughness={0.36} metalness={0.18} />
      </mesh>
      <mesh position={[0, 0.13, 0]} castShadow>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color={GOLD} roughness={0.25} metalness={0.7} />
      </mesh>
    </group>
  )
}

function ClockMesh() {
  const minuteHandRef = useRef<THREE.Group>(null)
  const hourHandRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (minuteHandRef.current) {
      minuteHandRef.current.rotation.z = -t * 0.45
    }
    if (hourHandRef.current) {
      hourHandRef.current.rotation.z = -t * 0.08 + 0.7
    }
  })

  return (
    <group>
      {/* Clock dial */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.05, 32]} />
        <meshStandardMaterial color={IVORY} roughness={0.25} metalness={0.08} />
      </mesh>

      {/* Burgundy backing */}
      <mesh position={[0, 0, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.49, 0.49, 0.04, 32]} />
        <meshStandardMaterial color={BURGUNDY} roughness={0.35} metalness={0.2} />
      </mesh>

      {/* Gold outer bezel */}
      <mesh>
        <torusGeometry args={[0.51, 0.042, 12, 32]} />
        <meshStandardMaterial color={GOLD} roughness={0.22} metalness={0.8} />
      </mesh>

      {/* Center pin */}
      <mesh position={[0, 0, 0.04]}>
        <sphereGeometry args={[0.038, 10, 10]} />
        <meshStandardMaterial color={GOLD} roughness={0.25} metalness={0.75} />
      </mesh>

      {/* Hour hand */}
      <group ref={hourHandRef} position={[0, 0, 0.036]}>
        <mesh position={[0, 0.11, 0]}>
          <boxGeometry args={[0.036, 0.22, 0.018]} />
          <meshStandardMaterial color={BURGUNDY} roughness={0.35} />
        </mesh>
      </group>

      {/* Minute hand */}
      <group ref={minuteHandRef} position={[0, 0, 0.042]}>
        <mesh position={[0, 0.16, 0]}>
          <boxGeometry args={[0.024, 0.32, 0.018]} />
          <meshStandardMaterial color={BURGUNDY_DEEP} roughness={0.35} />
        </mesh>
      </group>
    </group>
  )
}

function SceneRig({ mouseRef }: { mouseRef: RefObject<MouseOffset> }) {
  const orbitGroupRef = useRef<THREE.Group>(null)
  const parallaxGroupRef = useRef<THREE.Group>(null)

  useFrame((state, delta) => {
    if (orbitGroupRef.current) {
      // Slow auto-orbit (0.003 rad/frame)
      orbitGroupRef.current.rotation.y += 0.003
    }

    if (parallaxGroupRef.current) {
      const pointer = mouseRef.current ?? state.pointer
      const dt = Math.min(delta, 0.1)
      const alpha = 1 - Math.exp(-5 * dt)
      parallaxGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        parallaxGroupRef.current.rotation.x,
        -pointer.y * 0.14,
        alpha
      )
      parallaxGroupRef.current.rotation.z = THREE.MathUtils.lerp(
        parallaxGroupRef.current.rotation.z,
        -pointer.x * 0.1,
        alpha
      )
    }
  })

  return (
    <group ref={parallaxGroupRef}>
      <group ref={orbitGroupRef}>
        {/* Canteen Tray */}
        <FloatingObject
          position={[-0.1, -0.58, 0.05]}
          rotation={[0.2, -0.25, 0.04]}
          delay={0}
          floatSpeed={1.3}
          floatIntensity={0.28}
          rotationIntensity={0.2}
          tiltIntensity={0.18}
          mouseRef={mouseRef}
        >
          <TrayMesh />
        </FloatingObject>

        {/* Coffee Cup + Steam */}
        <FloatingObject
          position={[-0.92, 0.32, 0.4]}
          rotation={[0.14, 0.25, -0.05]}
          delay={0.16}
          floatSpeed={1.8}
          floatIntensity={0.48}
          rotationIntensity={0.3}
          tiltIntensity={0.24}
          mouseRef={mouseRef}
        >
          <CupMesh />
        </FloatingObject>

        {/* Plate */}
        <FloatingObject
          position={[0.92, -0.06, 0.42]}
          rotation={[0.42, -0.3, -0.14]}
          delay={0.3}
          floatSpeed={1.5}
          floatIntensity={0.4}
          rotationIntensity={0.32}
          tiltIntensity={0.25}
          mouseRef={mouseRef}
        >
          <PlateMesh />
        </FloatingObject>

        {/* Pickup Window Clock */}
        <FloatingObject
          position={[0.48, 0.92, -0.35]}
          rotation={[0.08, -0.22, 0.06]}
          delay={0.44}
          floatSpeed={1.4}
          floatIntensity={0.38}
          rotationIntensity={0.22}
          tiltIntensity={0.22}
          mouseRef={mouseRef}
        >
          <ClockMesh />
        </FloatingObject>
      </group>
    </group>
  )
}

export interface HeroCanvasProps {
  mouseRef: RefObject<MouseOffset>
}

export default function HeroCanvas({ mouseRef }: HeroCanvasProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      camera={{ position: [0, 0.65, 4.9], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      className="h-full w-full"
    >
      <ambientLight intensity={0.65} color={IVORY} />
      <directionalLight position={[4, 6, 4]} intensity={1.35} color="#FFF6E8" castShadow />
      <directionalLight position={[-4, 3, -3]} intensity={0.65} color={GOLD} />
      <pointLight position={[0, 1.5, 2.5]} intensity={0.75} color={BURGUNDY} />

      <SilentEnvBoundary>
        <Suspense fallback={null}>
          <Environment preset="city" />
        </Suspense>
      </SilentEnvBoundary>

      <SceneRig mouseRef={mouseRef} />

      <ContactShadows
        position={[0, -1.42, 0]}
        opacity={0.42}
        scale={7.5}
        blur={2.4}
        far={3.5}
        color={BURGUNDY_DEEP}
      />
    </Canvas>
  )
}
