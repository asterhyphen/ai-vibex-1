'use client'

import React, { Component, Suspense, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'
import { HeroFallback } from './HeroFallback'
import type { MouseOffset } from './FloatingObject'
import { cn } from '@/lib/utils/format'

const emptySubscribe = () => () => {}

const LazyHeroCanvas = React.lazy(() => import('./HeroCanvas'))

class WebGLErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

function isLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & {
    deviceMemory?: number
    connection?: { saveData?: boolean }
  }
  if (nav.connection?.saveData) return true
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 2) {
    return true
  }
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) {
    return true
  }
  return false
}

function hasWebGLSupport(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    )
  } catch {
    return false
  }
}

interface HeroSceneProps {
  className?: string
}

/**
 * Lazy-loaded 3D canteen still-life hero scene.
 * Automatically renders the static radial gradient fallback when
 * prefers-reduced-motion is enabled or WebGL is unavailable.
 */
export function HeroScene({ className }: HeroSceneProps) {
  const prefersReducedMotion = useReducedMotion()
  const webglReady = useSyncExternalStore(
    emptySubscribe,
    () => hasWebGLSupport() && !isLowPowerDevice(),
    () => false
  )
  const mouseRef = useRef<MouseOffset>({ x: 0, y: 0 })

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
    mouseRef.current = { x: nx, y: ny }
  }

  const handlePointerLeave = () => {
    mouseRef.current = { x: 0, y: 0 }
  }

  const shouldShowFallback = Boolean(prefersReducedMotion) || !webglReady

  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={cn(
        'relative w-full h-full min-h-[340px] sm:min-h-[420px] lg:min-h-[480px] rounded-3xl overflow-hidden',
        className
      )}
      style={{
        background:
          'radial-gradient(ellipse at 60% 40%, #7A1F3D 0%, #2B1117 55%, #14080C 100%)',
      }}
    >
      {shouldShowFallback ? (
        <HeroFallback />
      ) : (
        <WebGLErrorBoundary fallback={<HeroFallback />}>
          <Suspense fallback={<HeroFallback />}>
            <LazyHeroCanvas mouseRef={mouseRef} />
          </Suspense>
        </WebGLErrorBoundary>
      )}
    </div>
  )
}
