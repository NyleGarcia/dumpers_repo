/** Browser-local persistence for guest preview (no Supabase). */

export const GUEST_ACQUIRED_STORAGE_KEY = 'acquired_blueprints'

export const MINING_TRACKER_STORAGE_KEY = 'dumpers_mining_tracker'

export interface MiningTrackerEntry {
  id: string
  oreName: string
  location: string | null
  rarity: string
  addedAt: number
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function readGuestAcquiredBlueprints(): Record<string, boolean> {
  if (typeof localStorage === 'undefined') return {}
  return safeParse<Record<string, boolean>>(
    localStorage.getItem(GUEST_ACQUIRED_STORAGE_KEY),
    {}
  )
}

export function writeGuestAcquiredBlueprints(acquired: Record<string, boolean>): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(GUEST_ACQUIRED_STORAGE_KEY, JSON.stringify(acquired))
}

export function readMiningTrackerEntries(): MiningTrackerEntry[] {
  if (typeof localStorage === 'undefined') return []
  return safeParse<MiningTrackerEntry[]>(localStorage.getItem(MINING_TRACKER_STORAGE_KEY), [])
}

export function writeMiningTrackerEntries(entries: MiningTrackerEntry[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(MINING_TRACKER_STORAGE_KEY, JSON.stringify(entries))
}

export function miningTrackerEntryId(oreName: string, location: string | null): string {
  return `${oreName}::${location ?? '*'}`
}
