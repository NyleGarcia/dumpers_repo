import { useEffect } from 'react'

let lockCount = 0
let previousOverflow = ''
let previousPaddingRight = ''

function getScrollbarWidth(): number {
  return window.innerWidth - document.documentElement.clientWidth
}

export function useBodyScrollLock(enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return

    lockCount += 1
    if (lockCount === 1) {
      previousOverflow = document.body.style.overflow
      previousPaddingRight = document.body.style.paddingRight
      const scrollbarWidth = getScrollbarWidth()
      document.body.style.overflow = 'hidden'
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`
      }
    }

    return () => {
      lockCount -= 1
      if (lockCount === 0) {
        document.body.style.overflow = previousOverflow
        document.body.style.paddingRight = previousPaddingRight
      }
    }
  }, [enabled])
}
