import gameBlueprints from '../data/game-blueprints.json'

export const DEFAULT_BLUEPRINTS_CATEGORY = 'Default Blueprints'

export interface BlueprintDefaultFlag {
  internalName?: string
  file?: string
  isDefault?: boolean
  entityClass?: string | null
}

const defaultIds = new Set(
  (gameBlueprints.blueprints as BlueprintDefaultFlag[])
    .filter((bp) => bp.isDefault)
    .map((bp) => bp.internalName || bp.file)
    .filter((id): id is string => Boolean(id))
)

/** Starter blueprints from `defaultBlueprintSelection` in crafting global params. */
export const DEFAULT_BLUEPRINT_IDS: readonly string[] = [...defaultIds]

export function isDefaultBlueprint(blueprintId: string | null | undefined): boolean {
  if (!blueprintId) return false
  return defaultIds.has(blueprintId)
}

/** Always treat starter blueprints as acquired; used for display and guest cache. */
export function applyDefaultAcquiredState(
  acquired: Record<string, boolean>
): Record<string, boolean> {
  const merged = { ...acquired }
  for (const id of defaultIds) {
    merged[id] = true
  }
  return merged
}

/** Hide unreleased stubs (null entityClass) from the member blueprint browser. */
export function isBlueprintListable(blueprint: BlueprintDefaultFlag): boolean {
  if (!blueprint.internalName && !blueprint.file) return false
  if (blueprint.entityClass == null) return false
  return true
}

export function isDefaultBlueprintsCategory(category: string | null | undefined): boolean {
  return category === DEFAULT_BLUEPRINTS_CATEGORY
}
