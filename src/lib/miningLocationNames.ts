/**
 * Runtime lookups for mining location display names and guide↔spawn resolution.
 * Data is generated in game-mining-locations.json by parse-extracted-data.mjs.
 */

import { miningLocations } from '../data'

export interface LocationAlias {
  spawnKey: string
  guideName?: string
  guideNames?: string[]
  displayName?: string
  system?: string
  source?: string
}

const locationAliases = miningLocations.locationAliases ?? {}
const guideToSpawnKeys = miningLocations.guideToSpawnKeys ?? {}

export function getLocationAlias(spawnKey: string | undefined): LocationAlias | null {
  if (!spawnKey) return null
  return locationAliases[spawnKey] ?? null
}

/** Member-facing label for an internal HPP spawn key. */
export function getDisplayNameForSpawnKey(spawnKey: string | undefined): string {
  if (!spawnKey) return 'Unknown'
  return locationAliases[spawnKey]?.displayName ?? spawnKey
}

/** All guide/starmap names associated with a spawn key (includes broad buckets and PYR nav labels). */
export function getGuideNamesForSpawnKey(spawnKey: string | undefined): string[] {
  if (!spawnKey) return []
  const alias = locationAliases[spawnKey]
  if (alias?.guideNames?.length) return alias.guideNames
  if (alias?.guideName) return [alias.guideName]
  return []
}

/** Compendium site names only — excludes broad buckets and PYR Lagrange nav labels. */
export function getCompendiumGuideNamesForSpawnKey(spawnKey: string | undefined): string[] {
  return getGuideNamesForSpawnKey(spawnKey).filter(
    (name) => name !== 'Pyro Asteroid Clusters' && !/^PYR\d/i.test(name)
  )
}

/** When exactly one compendium site maps to this spawn key. */
export function getPrimaryCompendiumGuideName(spawnKey: string | undefined): string | null {
  const names = getCompendiumGuideNamesForSpawnKey(spawnKey)
  return names.length === 1 ? names[0] : null
}

/** Compendium / guide name → internal spawn profile keys. */
export function getSpawnKeysForGuideName(guideName: string): string[] {
  const mapped = guideToSpawnKeys[guideName]
  return mapped?.length ? [...mapped] : []
}

export { locationAliases, guideToSpawnKeys }
