/**
 * Mission region constants - maps system regions to known locations
 * 
 * In Star Citizen, missions are organized by regions within each star system.
 * Different mission terminals/locations show missions for specific regions.
 */

export type SystemRegion = {
  system: string
  region: string
  label: string
  locations: string[]
  terminalLocations: string[]
}

/**
 * Pyro system regions and their known locations
 * Region data derived from game files (contract debugNames)
 * Lists planets/moons only - stations orbit these bodies
 */
export const PYRO_REGIONS: Record<string, SystemRegion> = {
  A: {
    system: 'Pyro',
    region: 'A',
    label: 'Pyro I',
    locations: [
      'Monox',
    ],
    terminalLocations: [],
  },
  B: {
    system: 'Pyro',
    region: 'B',
    label: 'Pyro II',
    locations: [
      'Bloom',
      'Ignis',
    ],
    terminalLocations: [],
  },
  C: {
    system: 'Pyro',
    region: 'C',
    label: 'Pyro III',
    locations: [
      'Fairo',
    ],
    terminalLocations: [],
  },
  D: {
    system: 'Pyro',
    region: 'D',
    label: 'Pyro IV/V',
    locations: [
      'Terminus',
      'Vatra',
    ],
    terminalLocations: [],
  },
}

/**
 * Nyx system - no sub-regions in game data (missions available system-wide)
 * Stanton system - no sub-regions in game data (missions available system-wide)
 * 
 * Only Pyro currently uses the region system (A, B, C, D)
 */

/**
 * Get region info by system and region letter
 */
export function getRegionInfo(system: string, region: string): SystemRegion | null {
  const sysLower = system?.toLowerCase()
  const regionUpper = region?.toUpperCase()
  
  if (sysLower === 'pyro' && PYRO_REGIONS[regionUpper]) {
    return PYRO_REGIONS[regionUpper]
  }
  // Stanton and Nyx don't use sub-regions - missions available system-wide
  return null
}

/**
 * Format region for display (e.g., "Pyro A" or "Pyro Region A")
 */
export function formatRegion(system: string, region: string | null, verbose = false): string {
  if (!region) return system
  
  const info = getRegionInfo(system, region)
  if (info && verbose) {
    return info.label
  }
  
  return `${system} ${region}`
}

/**
 * Get suggested terminal locations for a mission region
 */
export function getTerminalLocations(system: string, region: string): string[] {
  const info = getRegionInfo(system, region)
  return info?.terminalLocations || []
}
