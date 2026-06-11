export const GUEST_PREVIEW_STORAGE_KEY = 'dumpers_guest_preview'

export function readGuestPreviewSession(): boolean {
  if (typeof sessionStorage === 'undefined') return false
  return sessionStorage.getItem(GUEST_PREVIEW_STORAGE_KEY) === '1'
}

export function writeGuestPreviewSession(enabled: boolean): void {
  if (typeof sessionStorage === 'undefined') return
  if (enabled) {
    sessionStorage.setItem(GUEST_PREVIEW_STORAGE_KEY, '1')
  } else {
    sessionStorage.removeItem(GUEST_PREVIEW_STORAGE_KEY)
  }
}
