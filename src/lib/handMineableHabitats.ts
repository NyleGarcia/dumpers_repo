import { miningLocations } from '../data'
import { isHandMineableOre, normalizeMiningOreName } from './handMineables'

export type HandMineableHabitat = 'surface' | 'caves' | 'both'

export function formatHandMineableHabitat(habitat: HandMineableHabitat): string {
  switch (habitat) {
    case 'caves':
      return 'Caves only'
    case 'surface':
      return 'Surface only'
    case 'both':
      return 'Surface & caves'
  }
}

/** Per-body cave/surface availability from extracted localization (varies by planet). */
export function getHandMineableHabitat(
  oreName: string,
  locationName: string
): HandMineableHabitat | null {
  const ore = normalizeMiningOreName(oreName)
  if (!isHandMineableOre(ore)) return null

  const fromData = miningLocations.handMineableHabitats?.[ore]?.[locationName]
  if (fromData) return fromData

  if (/\bcaves?\b/i.test(locationName)) return 'caves'

  return null
}

export function formatHandMineableHabitatAtSite(oreName: string, locationName: string): string | null {
  const habitat = getHandMineableHabitat(oreName, locationName)
  return habitat ? formatHandMineableHabitat(habitat) : null
}
