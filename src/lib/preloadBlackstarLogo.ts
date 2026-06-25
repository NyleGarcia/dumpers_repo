let preloaded = false

/** Warm cache for blueprint modal flip back face. */
export function preloadBlackstarLogo(): void {
  if (preloaded || typeof window === 'undefined') return
  preloaded = true
  const img = new Image()
  img.decoding = 'sync'
  img.src = '/blackstar.png'
}
