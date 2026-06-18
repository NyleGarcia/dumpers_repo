import blueprintMissionData from '../data/game-blueprint-missions.json'

export interface BlueprintOrderableSource {
  file?: string
  isReward?: boolean
  rewardMissions?: unknown[]
}

const blueprintMissions = blueprintMissionData.blueprintMissions as Record<string, string[]>

// Build a set of blueprint names that are mission rewards
const rewardBlueprintNames = new Set(Object.keys(blueprintMissions))

function extractBlueprintName(fileId: string): string | null {
  const normalized = fileId.replace(/\\/g, '/').toLowerCase()
  
  // Match patterns like bp_craft_xxx_scitem.json or bp_craft_xxx.json
  const scitemMatch = normalized.match(/bp_craft_([^/]+?)_scitem\.json$/i)
  if (scitemMatch) return scitemMatch[1]
  
  const simpleMatch = normalized.match(/bp_craft_([^/]+?)\.json$/i)
  if (simpleMatch) return simpleMatch[1]
  
  return null
}

export function catalogIsReward(blueprintId: string): boolean {
  const name = extractBlueprintName(blueprintId)
  if (!name) return false
  return rewardBlueprintNames.has(name)
}

export function getCatalogBlueprint(blueprintId: string) {
  const name = extractBlueprintName(blueprintId)
  if (!name) return undefined
  
  const pools = blueprintMissions[name]
  if (!pools || pools.length === 0) return undefined
  
  return {
    file: blueprintId,
    isReward: true,
    rewardMissions: pools.map(poolKey => ({ mission: poolKey }))
  }
}

export function resolveIsOrderable(
  blueprint: BlueprintOrderableSource,
  overridesMap: Record<string, boolean>
): boolean {
  const id = blueprint.internalName
  if (!id) return false
  if (id in overridesMap) return overridesMap[id]
  
  // Check if explicitly marked as reward
  if (blueprint.isReward === true) return true
  
  // Check if in our mission reward data
  return catalogIsReward(id)
}

export function resolveIsOrderableById(
  blueprintId: string,
  overridesMap: Record<string, boolean>
): boolean {
  if (blueprintId in overridesMap) return overridesMap[blueprintId]
  return catalogIsReward(blueprintId)
}

export function hasRewardMissions(blueprint: BlueprintOrderableSource): boolean {
  // Check explicit rewardMissions array
  if (Array.isArray(blueprint.rewardMissions) && blueprint.rewardMissions.length > 0) {
    return true
  }
  
  // Check if in our mission reward data
  if (blueprint.internalName) {
    return catalogIsReward(blueprint.internalName)
  }
  
  return false
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
  if (resolveIsOrderableById(blueprintId, overridesMap)) return true
  return catalogIsReward(blueprintId)
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
