/**
 * Compendium location resolution policy for the Mining Tracker / RS Tracker.
 *
 * Spawn key ↔ display name ↔ guide name data lives in miningLocationNames.ts
 * (sourced from game-mining-locations.json).
 */

import {
  getCompendiumGuideNamesForSpawnKey,
  getDisplayNameForSpawnKey,
  getPrimaryCompendiumGuideName,
  getSpawnKeysForGuideName,
} from './miningLocationNames'

/** Compendium entries that intentionally use Overall cluster/spawn data, not a single site. */
export const BROAD_GUIDE_LOCATIONS = new Set<string>([
  'All Moons/Planets/Caves',
  'All Pyro Planets',
  'Pyro Asteroid Clusters',
  'Found in All Stanton Deposits (Rare)',
  'QV Breaker Stations (Nyx)',
])

export function isBroadGuideLocation(guideLocationName: string): boolean {
  return BROAD_GUIDE_LOCATIONS.has(guideLocationName)
}

export type GuideLocationResolution = 'overall' | 'spawn'

export function getGuideLocationResolution(guideLocationName: string): GuideLocationResolution {
  if (isBroadGuideLocation(guideLocationName)) return 'overall'
  return 'spawn'
}

export function getSpawnKeysForGuideLocation(guideLocationName: string): string[] {
  if (isBroadGuideLocation(guideLocationName)) return []
  const mapped = getSpawnKeysForGuideName(guideLocationName)
  if (mapped.length) return mapped
  return [guideLocationName]
}

export function spawnKeyMatchesGuideLocation(
  spawnLocationName: string,
  guideLocationName: string
): boolean {
  if (isBroadGuideLocation(guideLocationName)) return false
  return getSpawnKeysForGuideLocation(guideLocationName).includes(spawnLocationName)
}

/** Card/chip tag for overall aggregate data — never shows raw internal spawn keys. */
export function formatOverallTagLabel(
  bestLocation?: string,
  displayNameOverride?: string
): string {
  if (displayNameOverride) return `Overall · best at ${displayNameOverride}`
  const primary = getPrimaryCompendiumGuideName(bestLocation)
  if (primary) return `Overall · best at ${primary}`
  const display = getDisplayNameForSpawnKey(bestLocation)
  if (display !== bestLocation) return `Overall · best at ${display}`
  return 'Overall'
}

/** Tooltip detail for overall best-at; lists compendium sites when ambiguous. */
export function formatOverallBestAtTooltip(
  bestLocation?: string,
  displayNameOverride?: string
): string | null {
  const compendium = getCompendiumGuideNamesForSpawnKey(bestLocation)
  if (compendium.length >= 2) {
    return `Overall best cluster odds map to: ${compendium.join(', ')}`
  }
  if (displayNameOverride) return `Best overall at ${displayNameOverride}`
  if (compendium.length === 1) return `Best overall at ${compendium[0]}`
  const display = getDisplayNameForSpawnKey(bestLocation)
  if (display !== bestLocation) return `Best overall at ${display}`
  return null
}

export {
  getCompendiumGuideNamesForSpawnKey,
  getDisplayNameForSpawnKey,
  getGuideNamesForSpawnKey,
  getPrimaryCompendiumGuideName,
  getSpawnKeysForGuideName,
} from './miningLocationNames'
