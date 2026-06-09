import bluesPrints from '../data/Blueprints.json'

export interface BlueprintOrderableSource {
  file?: string
  isReward?: boolean
  rewardMissions?: unknown[]
}

const catalogByFile = new Map(
  bluesPrints.blueprints.map((bp) => [bp.file, bp] as const)
)

export function catalogIsReward(blueprintId: string): boolean {
  return catalogByFile.get(blueprintId)?.isReward === true
}

export function getCatalogBlueprint(blueprintId: string) {
  return catalogByFile.get(blueprintId)
}

export function resolveIsOrderable(
  blueprint: BlueprintOrderableSource,
  overridesMap: Record<string, boolean>
): boolean {
  const id = blueprint.file
  if (!id) return false
  if (id in overridesMap) return overridesMap[id]
  return blueprint.isReward === true
}

export function resolveIsOrderableById(
  blueprintId: string,
  overridesMap: Record<string, boolean>
): boolean {
  if (blueprintId in overridesMap) return overridesMap[blueprintId]
  return catalogIsReward(blueprintId)
}

export function hasRewardMissions(blueprint: BlueprintOrderableSource): boolean {
  return Array.isArray(blueprint.rewardMissions) && blueprint.rewardMissions.length > 0
}

export function canAddBlueprintToOrder(
  blueprint: BlueprintOrderableSource,
  overridesMap: Record<string, boolean>
): boolean {
  return resolveIsOrderable(blueprint, overridesMap)
}

export function canAddBlueprintToTargetList(
  blueprint: BlueprintOrderableSource,
  overridesMap: Record<string, boolean>
): boolean {
  if (resolveIsOrderable(blueprint, overridesMap)) return true
  return hasRewardMissions(blueprint)
}

export function canAddBlueprintToTargetListById(
  blueprintId: string,
  overridesMap: Record<string, boolean>
): boolean {
  const bp = catalogByFile.get(blueprintId)
  if (!bp) return false
  return canAddBlueprintToTargetList(bp, overridesMap)
}

export function filterOrderableBlueprints<T extends BlueprintOrderableSource>(
  blueprints: T[],
  overridesMap: Record<string, boolean>
): T[] {
  return blueprints.filter((bp) => resolveIsOrderable(bp, overridesMap))
}

export function validateOrderBlueprintIds(
  blueprintIds: string[],
  overridesMap: Record<string, boolean>
): { ok: true } | { ok: false; blueprintId: string } {
  for (const blueprintId of blueprintIds) {
    if (!resolveIsOrderableById(blueprintId, overridesMap)) {
      return { ok: false, blueprintId }
    }
  }
  return { ok: true }
}
