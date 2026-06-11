import type { MiningData } from '../hooks/useArchiveData'
import { LOCATION_SYSTEMS } from './miningConstants'

export function buildLocationOresMap(data: MiningData[]): Record<string, MiningData[]> {
  const map: Record<string, MiningData[]> = {}
  for (const ore of data) {
    for (const loc of ore.locations) {
      if (!map[loc]) map[loc] = []
      map[loc].push(ore)
    }
  }
  return map
}

export function getSortedLocations(locationOresMap: Record<string, MiningData[]>): string[] {
  return Object.keys(locationOresMap).sort((a, b) => {
    const sysA = LOCATION_SYSTEMS[a] || 'Unknown'
    const sysB = LOCATION_SYSTEMS[b] || 'Unknown'
    if (sysA !== sysB) return sysA.localeCompare(sysB)
    return a.localeCompare(b)
  })
}

export function findOreByName(data: MiningData[], oreName: string): MiningData | undefined {
  return data.find((o) => o.ore_name.toLowerCase() === oreName.toLowerCase())
}
