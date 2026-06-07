const BUILD_ID = import.meta.env.VITE_BUILD_ID as string | undefined

export function setupCacheBusting(): void {
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      window.location.reload()
    }
  })
}

export async function checkAppVersion(): Promise<void> {
  if (!BUILD_ID || BUILD_ID === 'dev') return

  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) return

    const { buildId } = await response.json() as { buildId?: string }
    if (buildId && buildId !== BUILD_ID) {
      window.location.reload()
    }
  } catch {
    // Offline or version file missing — keep running
  }
}
