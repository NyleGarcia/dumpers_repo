import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import BrandModalBack from '../BrandModalBack'
import AppModal, { type AppModalSize, type AppModalZIndex } from './AppModal'

const sizeMaxWidth: Record<AppModalSize, number> = {
  sm: 448,
  md: 512,
  lg: 576,
}

const zIndexClasses: Record<AppModalZIndex, string> = {
  60: 'z-[60]',
  70: 'z-[70]',
  80: 'z-[80]',
}

const OPEN_EASE = [0.32, 0.72, 0, 1] as const
const BLINDS_OPEN_EASE = [0.22, 1, 0.36, 1] as const
const CLOSE_BLINDS_EASE = [0.4, 0, 0.2, 1] as const
const CLOSE_FLY_EASE = [0.4, 0, 1, 1] as const

const BRAND_GRADIENT =
  'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #ea580c 100%)'

/** Tuned for readable flip + blinds without feeling sluggish. */
const TIMING = {
  openInteractiveMs: 800,
  closeUnmountMs: 480,
  backdropIn: 0.2,
  backdropOut: 0.18,
  backdropOutDelay: 0.26,
  flipIn: 0.5,
  flipOut: 0.28,
  flipOutDelay: 0.12,
  blindsIn: 0.4,
  blindsInDelay: 0.35,
  blindsOut: 0.26,
  contentFadeIn: 0.18,
  contentFadeInDelay: 0.45,
  contentFadeOut: 0.1,
} as const

export interface BrandRevealModalShellProps {
  title: string
  subtitle?: string
  onClose: () => void
  originRect: DOMRect | null
  size?: AppModalSize
  zIndex?: AppModalZIndex
  children: React.ReactNode
  footer?: React.ReactNode
  headerExtra?: React.ReactNode
  closeOnBackdrop?: boolean
  titleId?: string
}

function computeTargetRect(size: AppModalSize, originRect: DOMRect | null) {
  const width = Math.min(sizeMaxWidth[size], window.innerWidth - 32)
  const left = (window.innerWidth - width) / 2
  const top = Math.max(16, window.innerHeight * 0.06)
  const height = Math.min(
    window.innerHeight * 0.88,
    Math.max(originRect?.height ?? 280, 320)
  )
  return { top, left, width, height }
}

function isOriginUsable(originRect: DOMRect | null): originRect is DOMRect {
  if (!originRect) return false
  return originRect.width > 0 && originRect.height > 0
}

export default function BrandRevealModalShell({
  title,
  subtitle,
  onClose,
  originRect,
  size = 'md',
  zIndex = 70,
  children,
  footer,
  headerExtra,
  closeOnBackdrop = true,
  titleId: titleIdProp,
}: BrandRevealModalShellProps) {
  const reducedMotion = usePrefersReducedMotion()
  const generatedId = useId()
  const titleId = titleIdProp ?? generatedId

  if (reducedMotion || !isOriginUsable(originRect)) {
    return (
      <AppModal
        title={title}
        subtitle={subtitle}
        onClose={onClose}
        size={size}
        zIndex={zIndex}
        footer={footer}
        headerExtra={headerExtra}
        closeOnBackdrop={closeOnBackdrop}
        titleId={titleId}
      >
        {children}
      </AppModal>
    )
  }

  return (
    <BrandRevealAnimatedModal
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      originRect={originRect}
      size={size}
      zIndex={zIndex}
      footer={footer}
      headerExtra={headerExtra}
      closeOnBackdrop={closeOnBackdrop}
      titleId={titleId}
    >
      {children}
    </BrandRevealAnimatedModal>
  )
}

function BrandRevealAnimatedModal({
  title,
  subtitle,
  onClose,
  originRect,
  size,
  zIndex,
  children,
  footer,
  headerExtra,
  closeOnBackdrop,
  titleId,
}: BrandRevealModalShellProps & { originRect: DOMRect; titleId: string }) {
  const [phase, setPhase] = useState<'enter' | 'open' | 'exit'>('enter')
  const [interactive, setInteractive] = useState(false)
  const originRef = useRef(originRect)
  originRef.current = originRect

  const targetRect = useMemo(
    () => computeTargetRect(size ?? 'md', originRect),
    [size, originRect]
  )

  useBodyScrollLock(true)

  useEffect(() => {
    const openTimer = window.setTimeout(() => {
      setPhase('open')
      setInteractive(true)
    }, TIMING.openInteractiveMs)
    return () => window.clearTimeout(openTimer)
  }, [])

  const finishClose = useCallback(() => {
    onClose()
  }, [onClose])

  const requestClose = useCallback(() => {
    setInteractive(false)
    setPhase('exit')
    window.setTimeout(finishClose, TIMING.closeUnmountMs)
  }, [finishClose])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && interactive) {
        event.preventDefault()
        requestClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [interactive, requestClose])

  const blindsOpen = phase === 'enter' || phase === 'open'
  const origin = originRef.current

  const flipPosition =
    phase === 'exit'
      ? origin
      : targetRect

  const flipRotate = phase === 'exit' ? 0 : 180
  const flipOpacity = phase === 'open' ? 0 : 1

  return (
    <div
      className={`fixed inset-0 ${zIndexClasses[zIndex ?? 70]} flex items-start justify-center overflow-hidden p-4`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <motion.div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'exit' ? 0 : 1 }}
        transition={{
          duration: phase === 'exit' ? TIMING.backdropOut : TIMING.backdropIn,
          delay: phase === 'exit' ? TIMING.backdropOutDelay : 0,
        }}
        onClick={closeOnBackdrop && interactive ? requestClose : undefined}
      />

      <motion.div
        className="fixed pointer-events-none"
        style={{ perspective: 1200, transformStyle: 'preserve-3d' }}
        initial={{
          top: origin.top,
          left: origin.left,
          width: origin.width,
          height: origin.height,
          opacity: 1,
        }}
        animate={{
          ...flipPosition,
          opacity: flipOpacity,
        }}
        transition={{
          duration: phase === 'exit' ? TIMING.flipOut : TIMING.flipIn,
          delay: phase === 'exit' ? TIMING.flipOutDelay : 0,
          ease: phase === 'exit' ? CLOSE_FLY_EASE : OPEN_EASE,
        }}
      >
        <motion.div
          className="relative w-full h-full"
          style={{ transformStyle: 'preserve-3d' }}
          initial={{ rotateY: 0 }}
          animate={{ rotateY: flipRotate }}
          transition={{
            duration: phase === 'exit' ? TIMING.flipOut : TIMING.flipIn,
            delay: phase === 'exit' ? TIMING.flipOutDelay : 0,
            ease: phase === 'exit' ? CLOSE_FLY_EASE : OPEN_EASE,
          }}
        >
          <div
            className="absolute inset-0 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 shadow-2xl"
            style={{ backfaceVisibility: 'hidden' }}
          />
          <div
            className="absolute inset-0 rounded-2xl overflow-hidden"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <BrandModalBack className="w-full h-full rounded-2xl border-0" />
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full shadow-2xl flex flex-col min-w-0 overflow-hidden"
        style={{
          maxWidth: sizeMaxWidth[size ?? 'md'],
          maxHeight: 'min(90dvh, 36rem)',
          marginTop: 'max(1rem, 6vh)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'exit' ? 0 : 1 }}
        transition={{
          duration: phase === 'exit' ? TIMING.contentFadeOut : TIMING.contentFadeIn,
          delay: phase === 'exit' ? 0 : TIMING.contentFadeInDelay,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex flex-col flex-1 min-h-0 min-w-0">
          <div className="flex items-start justify-between gap-3 p-3 sm:p-4 border-b border-slate-700 shrink-0">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-bold text-white leading-snug">
                {title}
              </h2>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={interactive ? requestClose : undefined}
              className="text-slate-400 hover:text-white text-xl leading-none shrink-0 disabled:opacity-40"
              aria-label="Close"
              disabled={!interactive}
            >
              ×
            </button>
          </div>

          {headerExtra}

          <div className="p-3 sm:p-4 overflow-y-auto overscroll-contain flex-1 min-h-0 min-w-0">
            {children}
          </div>

          {footer && (
            <div className="p-3 sm:p-4 border-t border-slate-700 shrink-0">{footer}</div>
          )}

          <AnimatePresence>
            {(phase === 'enter' || phase === 'exit') && (
              <motion.div
                className="absolute inset-0 z-20 flex pointer-events-none overflow-hidden rounded-2xl"
                initial={false}
              >
                <motion.div
                  className="w-1/2 h-full border-r border-orange-500/20"
                  style={{ background: BRAND_GRADIENT }}
                  initial={{ x: '0%' }}
                  animate={{ x: blindsOpen ? '-100%' : '0%' }}
                  transition={{
                    duration: phase === 'exit' ? TIMING.blindsOut : TIMING.blindsIn,
                    delay: phase === 'enter' ? TIMING.blindsInDelay : 0,
                    ease: phase === 'exit' ? CLOSE_BLINDS_EASE : BLINDS_OPEN_EASE,
                  }}
                />
                <motion.div
                  className="w-1/2 h-full border-l border-orange-500/20"
                  style={{ background: BRAND_GRADIENT }}
                  initial={{ x: '0%' }}
                  animate={{ x: blindsOpen ? '100%' : '0%' }}
                  transition={{
                    duration: phase === 'exit' ? TIMING.blindsOut : TIMING.blindsIn,
                    delay: phase === 'enter' ? TIMING.blindsInDelay : 0,
                    ease: phase === 'exit' ? CLOSE_BLINDS_EASE : BLINDS_OPEN_EASE,
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
