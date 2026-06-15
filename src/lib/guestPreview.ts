export const GUEST_PREVIEW_STORAGE_KEY = 'dumpers_guest_preview'

export function readGuestPreviewSession(): boolean {
  if (typeof sessionStorage === 'undefined') return true
  const value = sessionStorage.getItem(GUEST_PREVIEW_STORAGE_KEY)
  // Default to true (guest preview / offline mode) if no value is set
  // Only return false if explicitly set to '0' (user signed out)
  if (value === null) return true
  return value === '1'
}

export function writeGuestPreviewSession(enabled: boolean): void {
  if (typeof sessionStorage === 'undefined') return
  if (enabled) {
    sessionStorage.setItem(GUEST_PREVIEW_STORAGE_KEY, '1')
  } else {
    sessionStorage.removeItem(GUEST_PREVIEW_STORAGE_KEY)
  }
}
