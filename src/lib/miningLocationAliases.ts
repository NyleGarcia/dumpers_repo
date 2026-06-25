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

/**
 * Broad compendium labels that are not real mineable sites — exclude from By Location
 * browsing (e.g. "All Pyro Planets" only means "various pyro bodies", not one place).
 */
export const NON_SITE_BROAD_GUIDE_LOCATIONS = new Set<string>([
  'All Moons/Planets/Caves',
  'All Pyro Planets',
  'Found in All Stanton Deposits (Rare)',
])

export function isBroadGuideLocation(guideLocationName: string): boolean {
  return BROAD_GUIDE_LOCATIONS.has(guideLocationName)
}

export function isNonSiteBroadGuideLocation(guideLocationName: string): boolean {
  return NON_SITE_BROAD_GUIDE_LOCATIONS.has(guideLocationName)
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

/** Multi-site compendium detail — use when the tag label already shows best-at. */
export function formatOverallCompendiumDetail(bestLocation?: string): string | null {
  const compendium = getCompendiumGuideNamesForSpawnKey(bestLocation)
  if (compendium.length >= 2) {
    return `Overall best cluster odds map to: ${compendium.join(', ')}`
  }
  return null
}

/** Tooltip detail for overall best-at (e.g. broad-location chip tooltips without a tag label). */
export function formatOverallBestAtTooltip(
  bestLocation?: string,
  displayNameOverride?: string
): string | null {
  const compendiumDetail = formatOverallCompendiumDetail(bestLocation)
  if (compendiumDetail) return compendiumDetail
  if (displayNameOverride) return `Best overall at ${displayNameOverride}`
  const compendium = getCompendiumGuideNamesForSpawnKey(bestLocation)
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
  getSystemForGuideLocation,
} from './miningLocationNames'
