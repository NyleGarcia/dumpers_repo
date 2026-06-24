import React, { useCallback, useId, useLayoutEffect, useRef, useState } from 'react'

type TooltipSide = 'top' | 'bottom' | 'left' | 'right'

interface SiteTooltipProps {
  content: React.ReactNode
  side?: TooltipSide
  className?: string
  panelClassName?: string
  children: React.ReactNode
}

const VIEWPORT_PAD = 8

const sideClasses: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 mb-2',
  bottom: 'top-full left-1/2 mt-2',
  left: 'right-full top-1/2 mr-2',
  right: 'left-full top-1/2 ml-2',
}

function sideTransform(side: TooltipSide, shiftX: number): string {
  if (side === 'top' || side === 'bottom') {
    return `translateX(calc(-50% + ${shiftX}px))`
  }
  return 'translateY(-50%)'
}

export default function SiteTooltip({
  content,
  side = 'top',
  className = '',
  panelClassName = '',
  children,
}: SiteTooltipProps) {
  const [open, setOpen] = useState(false)
  const [resolvedSide, setResolvedSide] = useState<TooltipSide>(side)
  const [shiftX, setShiftX] = useState(0)
  const tooltipId = useId()
  const touchRef = useRef(false)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLSpanElement>(null)

  const show = useCallback(() => {
    if (!touchRef.current) setOpen(true)
  }, [])

  const hide = useCallback(() => {
    if (!touchRef.current) setOpen(false)
  }, [])

  const toggleTouch = useCallback(() => {
    touchRef.current = true
    setOpen((prev) => !prev)
    window.setTimeout(() => {
      touchRef.current = false
    }, 300)
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setResolvedSide(side)
      setShiftX(0)
      return
    }

    const anchor = anchorRef.current
    const panel = panelRef.current
    if (!anchor || !panel) return

    const anchorRect = anchor.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()

    let nextSide = resolvedSide
    if (side === 'top' || side === 'bottom') {
      nextSide = side
      if (side === 'top' && anchorRect.top - panelRect.height - VIEWPORT_PAD < VIEWPORT_PAD) {
        nextSide = 'bottom'
      } else if (
        side === 'bottom' &&
        anchorRect.bottom + panelRect.height + VIEWPORT_PAD > window.innerHeight - VIEWPORT_PAD
      ) {
        nextSide = 'top'
      }
    }

    if (nextSide !== resolvedSide) {
      setResolvedSide(nextSide)
      return
    }

    let deltaX = 0
    if (nextSide === 'top' || nextSide === 'bottom') {
      if (panelRect.left < VIEWPORT_PAD) {
        deltaX = VIEWPORT_PAD - panelRect.left
      } else if (panelRect.right > window.innerWidth - VIEWPORT_PAD) {
        deltaX = window.innerWidth - VIEWPORT_PAD - panelRect.right
      }
    }

    setShiftX(deltaX)
  }, [open, side, content, resolvedSide])

  return (
    <span
      ref={anchorRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={() => {
        if ('ontouchstart' in window) toggleTouch()
      }}
      aria-describedby={open ? tooltipId : undefined}
    >
      {children}
      {open && (
        <span
          ref={panelRef}
          id={tooltipId}
          role="tooltip"
          style={{ transform: sideTransform(resolvedSide, shiftX) }}
          className={`site-tooltip-panel absolute z-50 pointer-events-none text-left min-w-[18rem] w-max max-w-[min(100vw-2rem,32rem)] max-h-[min(70vh,20rem)] overflow-y-auto px-3 py-2 text-xs leading-relaxed text-slate-200 bg-slate-900/95 backdrop-blur border border-orange-500/30 rounded-lg shadow-xl ${sideClasses[resolvedSide]} ${panelClassName}`}
        >
          {content}
        </span>
      )}
    </span>
  )
}
