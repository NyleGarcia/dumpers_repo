import React, { useCallback, useId, useRef, useState } from 'react'

type TooltipSide = 'top' | 'bottom' | 'left' | 'right'

interface SiteTooltipProps {
  content: React.ReactNode
  side?: TooltipSide
  className?: string
  panelClassName?: string
  children: React.ReactElement
}

const sideClasses: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

export default function SiteTooltip({
  content,
  side = 'top',
  className = '',
  panelClassName = '',
  children,
}: SiteTooltipProps) {
  const [open, setOpen] = useState(false)
  const tooltipId = useId()
  const touchRef = useRef(false)

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

  const child = React.cloneElement(children, {
    'aria-describedby': open ? tooltipId : undefined,
    onMouseEnter: (e: React.MouseEvent) => {
      show()
      children.props.onMouseEnter?.(e)
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hide()
      children.props.onMouseLeave?.(e)
    },
    onFocus: (e: React.FocusEvent) => {
      show()
      children.props.onFocus?.(e)
    },
    onBlur: (e: React.FocusEvent) => {
      hide()
      children.props.onBlur?.(e)
    },
    onClick: (e: React.MouseEvent) => {
      if ('ontouchstart' in window) toggleTouch()
      children.props.onClick?.(e)
    },
  })

  return (
    <span className={`relative inline-flex ${className}`}>
      {child}
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className={`site-tooltip-panel absolute z-50 pointer-events-none max-w-xs sm:max-w-sm px-3 py-2 text-xs text-slate-200 bg-slate-900/95 backdrop-blur border border-orange-500/30 rounded-lg shadow-xl ${sideClasses[side]} ${panelClassName}`}
        >
          {content}
        </span>
      )}
    </span>
  )
}
