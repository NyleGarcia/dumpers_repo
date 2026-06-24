/**
 * Maps compendium / guide location names to spawn resolution strategy.
 *
 * - **spawn**: site-specific HPP keys (Bloom → Pyro3, CRU-L1 → Lagrange E, …)
 * - **overall**: compendium “broad” entries — same aggregate profile as RS Tracker Overall mode
 */

/** Compendium entries that intentionally use Overall cluster/spawn data, not a single site. */
export const BROAD_GUIDE_LOCATIONS = new Set<string>([
  'All Moons/Planets/Caves',
  'All Pyro Planets',
  'Pyro Asteroid Clusters',
  'Found in All Stanton Deposits (Rare)',
  'QV Breaker Stations (Nyx)',
])

/** Guide/compendium name → internal HPP spawn profile keys (site-specific only). */
export const GUIDE_LOCATION_SPAWN_KEYS: Record<string, readonly string[]> = {
  // Pyro planets
  'Pyro I': ['Pyro1'],
  'Pyro II': ['Pyro2'],
  Bloom: ['Pyro3'],
  'Pyro IV': ['Pyro4'],
  Terminus: ['Pyro6'],

  // Pyro V moons (Pyro5a–f)
  Adir: ['Pyro5c'],
  Fairo: ['Pyro5d'],
  Fuego: ['Pyro5e'],
  Ignis: ['Pyro5a'],
  Vatra: ['Pyro5b'],
  Vuur: ['Pyro5f'],

  // Stanton moons / planets
  Aberdeen: ['Stanton1b'],
  Arial: ['Stanton1c'],
  Magda: ['Stanton1d'],
  'Magda Sand Caves': ['Stanton1d'],
  Ita: ['Stanton1a'],
  Monox: ['Stanton1a', 'Stanton4', 'Stanton4a'],
  Hurston: ['Stanton1', 'Stanton1a', 'Stanton1b', 'Stanton1c', 'Stanton1d'],
  Cellin: ['Stanton2a'],
  Daymar: ['Stanton2b'],
  Yela: ['Stanton2c'],
  'Yela Ring': ['Stanton2c Belt', 'Stanton2c'],
  Lyria: ['Stanton3a'],
  Wala: ['Stanton3b'],
  microTech: ['Stanton4', 'Stanton4a', 'Stanton4b', 'Stanton4c'],
  Calliope: ['Stanton4a'],
  Clio: ['Stanton4b'],
  Euterpe: ['Stanton4c'],

  // Stanton Lagrange stations → belt templates (best ore-overlap match)
  'ARC-L1': ['Lagrange F'],
  'ARC-L2': ['Lagrange F'],
  'ARC-L3': ['Lagrange D'],
  'ARC-L4': ['Lagrange F'],
  'ARC-L5': ['Lagrange B'],
  'CRU-L1': ['Lagrange E'],
  'CRU-L2': ['Lagrange E'],
  'CRU-L3': ['Lagrange C'],
  'CRU-L4': ['Lagrange B'],
  'CRU-L5': ['Lagrange D'],
  'HUR-L1': ['Lagrange A'],
  'HUR-L2': ['Lagrange F'],
  'HUR-L3': ['Lagrange E'],
  'HUR-L4': ['Lagrange A'],
  'HUR-L5': ['Lagrange A'],
  'MIC-L1': ['Lagrange C'],
  'MIC-L2': ['Lagrange C'],
  'MIC-L3': ['Lagrange B'],
  'MIC-L4': ['Lagrange D'],
  'MIC-L5': ['Lagrange C'],

  // Already aligned in spawn data
  'Aaron Halo': ['Aaron Halo'],
  'Akiro Cluster': ['Akiro Cluster'],
  'Glaciem Ring': ['Glaciem Ring'],
  'Keeger Belt': ['Keeger Belt'],
}

export type GuideLocationResolution = 'overall' | 'spawn'

export function isBroadGuideLocation(guideLocationName: string): boolean {
  return BROAD_GUIDE_LOCATIONS.has(guideLocationName)
}

export function getGuideLocationResolution(guideLocationName: string): GuideLocationResolution {
  if (isBroadGuideLocation(guideLocationName)) return 'overall'
  return 'spawn'
}

export function getSpawnKeysForGuideLocation(guideLocationName: string): string[] {
  if (isBroadGuideLocation(guideLocationName)) return []
  const mapped = GUIDE_LOCATION_SPAWN_KEYS[guideLocationName]
  if (mapped?.length) return [...mapped]
  return [guideLocationName]
}

export function spawnKeyMatchesGuideLocation(
  spawnLocationName: string,
  guideLocationName: string
): boolean {
  if (isBroadGuideLocation(guideLocationName)) return false
  return getSpawnKeysForGuideLocation(guideLocationName).includes(spawnLocationName)
}
