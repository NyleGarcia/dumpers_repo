import type { MiningData } from '../hooks/useArchiveData'
import { MINING_RARITY_ORDER } from './miningConstants'
import { isHandMineableType, normalizeMiningOreName } from './handMineables'
import { LOCATION_SYSTEMS } from './miningConstants'

const RARITY_RANK = Object.fromEntries(MINING_RARITY_ORDER.map((r, i) => [r, i]))

/** When merging duplicate rows, keep ship tier (common/rare/…) over handMineable bucket. */
function pickDisplayRarity(a: string, b: string): string {
  if (a === 'handMineable' && b !== 'handMineable') return b
  if (b === 'handMineable' && a !== 'handMineable') return a
  const rankA = RARITY_RANK[a] ?? 99
  const rankB = RARITY_RANK[b] ?? 99
  return rankB < rankA ? b : a
}

/** Normalize names, merge alias duplicates (e.g. Beradon → Beradom), union locations. */
export function enrichMiningCatalog(rows: MiningData[]): MiningData[] {
  const byKey = new Map<string, MiningData>()

  for (const row of rows) {
    const ore_name = normalizeMiningOreName(row.ore_name)
    const key = ore_name.toLowerCase()
    const existing = byKey.get(key)

    if (!existing) {
      byKey.set(key, { ...row, ore_name })
      continue
    }

    const locations = [...new Set([...(existing.locations ?? []), ...(row.locations ?? [])])]
    const rarity = pickDisplayRarity(existing.rarity, row.rarity)

    byKey.set(key, { ...existing, ore_name, locations, rarity })
  }

  return Array.from(byKey.values())
}

export function countGuideRarityBucket(data: MiningData[], bucket: string): number {
  if (bucket === 'handMineable') {
    return data.filter((item) => isHandMineableType(item.ore_name)).length
  }
  return data.filter((item) => item.rarity === bucket).length
}

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
  const canonical = normalizeMiningOreName(oreName).toLowerCase()
  return data.find((o) => o.ore_name.toLowerCase() === canonical)
}
