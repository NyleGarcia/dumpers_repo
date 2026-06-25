import { supabase } from './supabase'

/** Fixed storage object name — one PNG per franchise instance. */
export const ORG_LOGO_OBJECT_NAME = 'ORG_LOGO.png' as const
export const ORG_LOGO_BUCKET = 'org-logo' as const
/** Optional local fallback for reference/dev installs (gitignored, not shipped). */
export const ORG_LOGO_LOCAL_PATH = '/ORG_LOGO.png' as const

export const ORG_LOGO_MAX_BYTES = 512 * 1024
export const ORG_LOGO_MAX_DIMENSION = 2048
export const ORG_LOGO_MIN_DIMENSION = 64

export interface OrgLogoStatus {
  configured: boolean
  updatedAt: string | null
}

export function buildOrgLogoStorageUrl(updatedAt: string): string | null {
  const base = import.meta.env.VITE_SUPABASE_URL
  if (!base) return null
  const cacheBuster = new Date(updatedAt).getTime()
  return `${base}/storage/v1/object/public/${ORG_LOGO_BUCKET}/${ORG_LOGO_OBJECT_NAME}?v=${cacheBuster}`
}

/** Storage URL when configured; otherwise optional gitignored local file path. */
export function resolveOrgLogoUrl(updatedAt: string | null | undefined): string | null {
  if (updatedAt) return buildOrgLogoStorageUrl(updatedAt)
  return ORG_LOGO_LOCAL_PATH
}

export async function fetchOrgLogoStatus(): Promise<OrgLogoStatus> {
  const { data, error } = await supabase.rpc('get_org_logo_status')

  if (error) {
    console.error('Error fetching org logo status:', error)
    return { configured: false, updatedAt: null }
  }

  const payload = data as { configured?: boolean; updated_at?: string | null } | null
  return {
    configured: payload?.configured ?? false,
    updatedAt: payload?.updated_at ?? null,
  }
}

export async function validateOrgLogoFile(
  file: File
): Promise<{ ok: true; width: number; height: number } | { ok: false; error: string }> {
  if (file.type !== 'image/png') {
    return { ok: false, error: 'Org logo must be a PNG file.' }
  }

  if (file.size > ORG_LOGO_MAX_BYTES) {
    return { ok: false, error: 'Org logo must be 512 KB or smaller.' }
  }

  if (!file.name.toLowerCase().endsWith('.png')) {
    return { ok: false, error: 'File name must end with .png.' }
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return { ok: false, error: 'Could not read this PNG. Try re-exporting it from your image editor.' }
  }

  const { width, height } = bitmap
  bitmap.close()

  if (width < ORG_LOGO_MIN_DIMENSION || height < ORG_LOGO_MIN_DIMENSION) {
    return {
      ok: false,
      error: `Org logo must be at least ${ORG_LOGO_MIN_DIMENSION}×${ORG_LOGO_MIN_DIMENSION} pixels.`,
    }
  }

  if (width > ORG_LOGO_MAX_DIMENSION || height > ORG_LOGO_MAX_DIMENSION) {
    return {
      ok: false,
      error: `Org logo must be ${ORG_LOGO_MAX_DIMENSION}×${ORG_LOGO_MAX_DIMENSION} pixels or smaller.`,
    }
  }

  return { ok: true, width, height }
}

export async function uploadOrgLogo(file: File): Promise<{ ok: true } | { ok: false; error: string }> {
  const validation = await validateOrgLogoFile(file)
  if (!validation.ok) return validation

  const { error: uploadError } = await supabase.storage
    .from(ORG_LOGO_BUCKET)
    .upload(ORG_LOGO_OBJECT_NAME, file, {
      upsert: true,
      contentType: 'image/png',
      cacheControl: '3600',
    })

  if (uploadError) {
    console.error('Org logo upload failed:', uploadError)
    return { ok: false, error: uploadError.message || 'Upload failed.' }
  }

  const { error: markError } = await supabase.rpc('mark_org_logo_uploaded')
  if (markError) {
    console.error('Org logo mark uploaded failed:', markError)
    return { ok: false, error: markError.message || 'Upload saved but settings update failed.' }
  }

  return { ok: true }
}

export async function removeOrgLogo(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: removeError } = await supabase.storage
    .from(ORG_LOGO_BUCKET)
    .remove([ORG_LOGO_OBJECT_NAME])

  if (removeError) {
    console.error('Org logo remove failed:', removeError)
    return { ok: false, error: removeError.message || 'Could not remove org logo.' }
  }

  const { error: clearError } = await supabase.rpc('clear_org_logo')
  if (clearError) {
    console.error('Org logo clear setting failed:', clearError)
    return { ok: false, error: clearError.message || 'File removed but settings update failed.' }
  }

  return { ok: true }
}

const preloadedUrls = new Set<string>()

/** Warm cache for blueprint modal flip back face. */
export function preloadOrgLogo(url: string | null | undefined): void {
  if (!url || typeof window === 'undefined' || preloadedUrls.has(url)) return
  preloadedUrls.add(url)
  const img = new Image()
  img.decoding = 'sync'
  img.src = url
}
