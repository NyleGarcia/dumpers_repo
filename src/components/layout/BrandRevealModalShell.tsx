import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import BrandModalBack from '../BrandModalBack'
import { preloadBlackstarLogo } from '../../lib/preloadBlackstarLogo'
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

const FLIP_EASE = [0.32, 0.72, 0, 1] as const
const EXPAND_EASE = [0.22, 1, 0.36, 1] as const
const BLINDS_EASE = [0.22, 1, 0.36, 1] as const
const WORMHOLE_EASE = [0.55, 0, 1, 0.45] as const

const BRAND_GRADIENT =
  'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #ea580c 100%)'

/**
 * Open sequence (strictly one-by-one):
 * 1. flip — card flips in-place at click origin, Black Star on back
 * 2. expand — branded card zooms to screen center
 * 3. blinds-open — side wipes reveal detail panel
 * 4. ready — interactive
 */
const TIMING = {
  backdropIn: 0.18,
  flipInPlace: 0.6,
  expandToCenter: 0.5,
  blindsIn: 0.8,
  wormholeOut: 0.62,
  backdropOut: 0.22,
} as const

const backFaceStyle: React.CSSProperties = {
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
  transform: 'rotateY(180deg) translateZ(1px)',
}

const frontFaceStyle: React.CSSProperties = {
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
  transform: 'translateZ(1px)',
}

type ModalStage = 'flip' | 'expand' | 'blinds-open' | 'ready' | 'wormhole-close'

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

function rectToBox(rect: { top: number; left: number; width: number; height: number }) {
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  }
}

function isOriginUsable(originRect: DOMRect | null): originRect is DOMRect {
  if (!originRect) return false
  return originRect.width > 0 && originRect.height > 0
}

function ms(seconds: number): number {
  return Math.round(seconds * 1000)
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
  const [stage, setStage] = useState<ModalStage>('flip')
  const originRef = useRef(originRect)
  originRef.current = originRect

  const targetRect = useMemo(
    () => computeTargetRect(size ?? 'md', originRect),
    [size, originRect]
  )

  const originBox = useMemo(() => rectToBox(originRef.current), [originRect])
  const interactive = stage === 'ready'

  useBodyScrollLock(true)

  useEffect(() => {
    preloadBlackstarLogo()
  }, [])

  useEffect(() => {
    if (stage === 'flip') {
      const timer = window.setTimeout(() => setStage('expand'), ms(TIMING.flipInPlace))
      return () => window.clearTimeout(timer)
    }
    if (stage === 'expand') {
      const timer = window.setTimeout(() => setStage('blinds-open'), ms(TIMING.expandToCenter))
      return () => window.clearTimeout(timer)
    }
    if (stage === 'blinds-open') {
      const timer = window.setTimeout(() => setStage('ready'), ms(TIMING.blindsIn))
      return () => window.clearTimeout(timer)
    }
    if (stage === 'wormhole-close') {
      const timer = window.setTimeout(
        () => onClose(),
        ms(TIMING.wormholeOut + TIMING.backdropOut * 0.5)
      )
      return () => window.clearTimeout(timer)
    }
  }, [stage, onClose])

  const requestClose = useCallback(() => {
    if (stage !== 'ready') return
    setStage('wormhole-close')
  }, [stage])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && stage === 'ready') {
        event.preventDefault()
        requestClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [stage, requestClose])

  const showFlipCard = stage === 'flip' || stage === 'expand'
  const showModal = stage === 'blinds-open' || stage === 'ready' || stage === 'wormhole-close'
  const showBlinds = stage === 'blinds-open'
  const closing = stage === 'wormhole-close'

  const flipCardBox = stage === 'flip' ? originBox : targetRect

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
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{
          duration: closing ? TIMING.backdropOut : TIMING.backdropIn,
          delay: closing ? TIMING.wormholeOut * 0.35 : 0,
        }}
        onClick={closeOnBackdrop && interactive ? requestClose : undefined}
      />

      {showFlipCard && (
        <motion.div
          className="fixed pointer-events-none z-[62]"
          style={{ perspective: 1200, transformStyle: 'preserve-3d' }}
          initial={originBox}
          animate={flipCardBox}
          transition={{
            duration: stage === 'flip' ? 0 : TIMING.expandToCenter,
            ease: EXPAND_EASE,
          }}
        >
          <motion.div
            className="relative w-full h-full"
            style={{ transformStyle: 'preserve-3d' }}
            initial={{ rotateY: 0 }}
            animate={{ rotateY: 180 }}
            transition={{
              duration: stage === 'flip' ? TIMING.flipInPlace : 0,
              ease: FLIP_EASE,
            }}
          >
            <div
              className="absolute inset-0 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 shadow-2xl"
              style={frontFaceStyle}
            />
            <div className="absolute inset-0" style={backFaceStyle}>
              <BrandModalBack className="w-full h-full rounded-2xl border-0" />
            </div>
          </motion.div>
        </motion.div>
      )}

      {showModal && (
        <motion.div
          className="fixed z-[60] pointer-events-auto"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            maxHeight: targetRect.height,
            transformOrigin: 'center center',
          }}
          initial={false}
          animate={
            closing
              ? {
                  scale: 0,
                  opacity: 0,
                  rotate: -540,
                  filter: 'blur(14px)',
                }
              : {
                  scale: 1,
                  opacity: 1,
                  rotate: 0,
                  filter: 'blur(0px)',
                }
          }
          transition={{
            duration: TIMING.wormholeOut,
            ease: WORMHOLE_EASE,
          }}
        >
          <div
            className={`relative bg-slate-900 border border-slate-700 rounded-2xl w-full h-full shadow-2xl flex flex-col min-w-0 overflow-hidden ${
              closing ? 'pointer-events-none' : ''
            }`}
            style={{
              maxHeight: 'min(90dvh, 36rem)',
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

              {showBlinds && (
                <div className="absolute inset-0 z-20 flex pointer-events-none overflow-hidden rounded-2xl">
                  <motion.div
                    className="w-1/2 h-full border-r border-orange-500/20"
                    style={{ background: BRAND_GRADIENT }}
                    initial={{ x: '0%' }}
                    animate={{ x: '-100%' }}
                    transition={{ duration: TIMING.blindsIn, ease: BLINDS_EASE }}
                  />
                  <motion.div
                    className="w-1/2 h-full border-l border-orange-500/20"
                    style={{ background: BRAND_GRADIENT }}
                    initial={{ x: '0%' }}
                    animate={{ x: '100%' }}
                    transition={{ duration: TIMING.blindsIn, ease: BLINDS_EASE }}
                  />
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
