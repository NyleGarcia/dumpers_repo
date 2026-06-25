import { useEffect } from 'react'

let lockCount = 0
let previousHtmlOverflow = ''
let previousBodyOverflow = ''
let previousBodyPaddingRight = ''

function getScrollbarWidth(): number {
  return window.innerWidth - document.documentElement.clientWidth
}

function usesStableScrollbarGutter(): boolean {
  if (typeof document === 'undefined') return false
  const gutter = getComputedStyle(document.documentElement).scrollbarGutter
  return gutter.includes('stable')
}

export function useBodyScrollLock(enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return

    lockCount += 1
    if (lockCount === 1) {
      const html = document.documentElement
      const body = document.body

      previousHtmlOverflow = html.style.overflow
      previousBodyOverflow = body.style.overflow
      previousBodyPaddingRight = body.style.paddingRight

      html.style.overflow = 'hidden'
      body.style.overflow = 'hidden'

      // index.css sets scrollbar-gutter: stable — gutter already reserves space;
      // adding paddingRight here causes the page to jump horizontally.
      const scrollbarWidth = getScrollbarWidth()
      if (scrollbarWidth > 0 && !usesStableScrollbarGutter()) {
        body.style.paddingRight = `${scrollbarWidth}px`
      }
    }

    return () => {
      lockCount -= 1
      if (lockCount === 0) {
        document.documentElement.style.overflow = previousHtmlOverflow
        document.body.style.overflow = previousBodyOverflow
        document.body.style.paddingRight = previousBodyPaddingRight
      }
    }
  }, [enabled])
}
