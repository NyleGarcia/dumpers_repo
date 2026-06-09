import { getComponentMetadata } from './component-metadata.generated'

const GEM_RESOURCE_NAMES = new Set([
  'Aphorite', 'Beradom', 'Caranite', 'Dolivine', 'Feynmaline', 'Glacosite',
  'Hadanite', 'Janalite', 'Sadaryx',
])

/**
 * NPC retail markup on ore-only craft recipes, by item class + grade.
 * Calibrated vs UEX shop buy (Jun 2026): Competition B StarHeart, C SunFlare/SolarFlare, A LumaCore.
 */
const ORE_RETAIL_BY_CLASS_GRADE: Record<string, Partial<Record<string, number>>> = {
  civilian: { D: 5, C: 6, B: 8, A: 10 },
  military: { D: 6, C: 8, B: 10, A: 12 },
  competition: { D: 5, C: 7, B: 17, A: 12 },
  industrial: { D: 6, C: 8, B: 10, A: 12 },
  stealth: { D: 6, C: 9, B: 11, A: 14 },
}

const DEFAULT_ORE_RETAIL_FACTOR = 8

export function blueprintHasGemSlots(blueprint: {
  slots?: { options?: { resourceName?: string; entityName?: string }[] }[]
}): boolean {
  for (const slot of blueprint.slots ?? []) {
    for (const option of slot.options ?? []) {
      const resource = option.resourceName || option.entityName
      if (resource && GEM_RESOURCE_NAMES.has(resource)) return true
    }
  }
  return false
}

export function getOreRetailFactor(blueprint: {
  file?: string
  internalName?: string
  categoryName?: string
}): number {
  if (!blueprint.categoryName?.startsWith('Veh. Comp.')) return 1
  if (blueprintHasGemSlots(blueprint)) return 1

  const meta = getComponentMetadata(blueprint.file, blueprint.internalName)
  const itemClass = meta?.itemClass ?? 'civilian'
  const grade = (meta?.grade ?? 'C').toUpperCase()
  const table = ORE_RETAIL_BY_CLASS_GRADE[itemClass] ?? ORE_RETAIL_BY_CLASS_GRADE.civilian
  return table[grade] ?? DEFAULT_ORE_RETAIL_FACTOR
}
