import blueprintMissionData from '../data/game-blueprint-missions.json'

export interface MissionRepInfo {
  repMin: number | null
  repMax: number | null
  minReputation: number | null
  minStandingName: string | null
  variantCount: number
  missionGiver: string | null
  matched: boolean
  isLawful: boolean
  aUecMin: number
  aUecMax: number
  missionType: string | null
  missionLocations: string[]
  repPoints: number
}

export interface BlueprintUnlockInfo {
  unlockMinReputation: number | null
  unlockStandingName: string | null
  factionName: string | null
  isAvailableByDefault: boolean
  matched: boolean
  matchedMissionCount: number
  unmatchedMissionCount: number
  isInferred: boolean
  missionPoolName: string | null
  repPoints: number
}

type MissionPoolBlueprint = {
  name: string
  weight: number
  path: string
}

type MissionPoolEntry = {
  title: string
  titleKey: string
  faction: string
  system: string
  minStanding: { name: string; minReputation: number } | null
  maxStanding: { name: string; minReputation: number } | null
  repPoints: number
}

const missionBlueprints = blueprintMissionData.missionBlueprints as Record<string, MissionPoolBlueprint[]>
const missionsByPool = blueprintMissionData.missionsByPool as Record<string, MissionPoolEntry[]>

const UNLAWFUL_FACTIONS = [
  'headhunters', 'xenothreat', 'ruto', 'vaughn', 'ninetails',
  'tarpits', 'bitzeros', 'dead saints'
]

function isUnlawfulFaction(factionName: string): boolean {
  const lower = factionName.toLowerCase()
  return UNLAWFUL_FACTIONS.some(f => lower.includes(f))
}

function buildBlueprintToPoolIndex(): Map<string, string[]> {
  const index = new Map<string, string[]>()
  
  for (const [poolKey, blueprints] of Object.entries(missionBlueprints)) {
    for (const bp of blueprints) {
      const bpName = bp.name.toLowerCase()
      if (!index.has(bpName)) {
        index.set(bpName, [])
      }
      index.get(bpName)!.push(poolKey)
    }
  }
  
  return index
}

const blueprintToPoolIndex = buildBlueprintToPoolIndex()

function extractBlueprintInternalName(fileId: string): string | null {
  const normalized = fileId.replace(/\\/g, '/').toLowerCase()
  
  const scitemMatch = normalized.match(/bp_craft_([^/]+?)_scitem\.json$/i)
  if (scitemMatch) return scitemMatch[1]
  
  const simpleMatch = normalized.match(/bp_craft_([^/]+?)\.json$/i)
  if (simpleMatch) return simpleMatch[1]
  
  return null
}

export function normalizeMissionTitle(title: string): string {
  return title
    .replace(/~mission\s*\([^)]*\)/gi, '[param]')
    .replace(/\[Location[^\]]*\]/gi, '[location]')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function missionLookupKey(missionLabel: string): string {
  return missionLabel.replace('MissionBrokerEntry.', '')
}

export function formatRepReward(repMin: number | null, repMax: number | null): string | null {
  if (repMin == null && repMax == null) return null
  if (repMin != null && repMax != null && repMin !== repMax) {
    return `+${repMin.toLocaleString()}–${repMax.toLocaleString()} rep`
  }
  const value = repMin ?? repMax
  if (value == null) return null
  return `+${value.toLocaleString()} rep`
}

export function formatStandingRequirement(
  standingName: string | null,
  minReputation: number | null
): string | null {
  if (standingName == null && minReputation == null) return null
  if (minReputation === 0) return 'Neutral (0 rep)'
  if (standingName && minReputation != null) {
    return `${standingName} (${minReputation.toLocaleString()} rep)`
  }
  if (standingName) return standingName
  if (minReputation != null) return `${minReputation.toLocaleString()} rep`
  return null
}

/**
 * Get mission rep info from the pool-based mission data.
 * Looks up by pool key or mission title.
 */
export function getMissionRepInfoFromPool(poolKey: string, missionTitle?: string): MissionRepInfo {
  const defaultReturn: MissionRepInfo = {
    repMin: null,
    repMax: null,
    minReputation: null,
    minStandingName: null,
    variantCount: 0,
    missionGiver: null,
    matched: false,
    isLawful: true,
    aUecMin: 0,
    aUecMax: 0,
    missionType: null,
    missionLocations: [],
    repPoints: 0,
  }

  const poolMissions = missionsByPool[poolKey] || missionsByPool[poolKey.toLowerCase()]
  if (!poolMissions || poolMissions.length === 0) {
    return defaultReturn
  }

  // If a specific title is provided, try to match it
  let mission: MissionPoolEntry | undefined
  if (missionTitle) {
    const normalizedTitle = missionTitle.toLowerCase()
    mission = poolMissions.find(m => 
      m.title.toLowerCase().includes(normalizedTitle) || 
      normalizedTitle.includes(m.title.toLowerCase())
    )
  }
  
  // Fall back to first mission in pool
  if (!mission) {
    mission = poolMissions[0]
  }

  return {
    repMin: mission.repPoints,
    repMax: mission.repPoints,
    minReputation: mission.minStanding?.minReputation ?? null,
    minStandingName: mission.minStanding?.name ?? null,
    variantCount: poolMissions.length,
    missionGiver: mission.faction,
    matched: true,
    isLawful: !isUnlawfulFaction(mission.faction),
    aUecMin: 0,
    aUecMax: 0,
    missionType: null,
    missionLocations: mission.system ? [mission.system] : [],
    repPoints: mission.repPoints,
  }
}

/**
 * Legacy getMissionRepInfo for backwards compatibility.
 * Tries to match mission label to pool data.
 */
export function getMissionRepInfo(missionLabel: string): MissionRepInfo {
  const defaultReturn: MissionRepInfo = {
    repMin: null,
    repMax: null,
    minReputation: null,
    minStandingName: null,
    variantCount: 0,
    missionGiver: null,
    matched: false,
    isLawful: true,
    aUecMin: 0,
    aUecMax: 0,
    missionType: null,
    missionLocations: [],
    repPoints: 0,
  }

  if (/uninitialized/i.test(missionLabel)) {
    return defaultReturn
  }

  // Try to find matching pool by searching all pools for matching titles
  for (const [poolKey, missions] of Object.entries(missionsByPool)) {
    for (const mission of missions) {
      if (mission.title.toLowerCase() === missionLabel.toLowerCase() ||
          missionLabel.toLowerCase().includes(mission.title.toLowerCase())) {
        return {
          repMin: mission.repPoints,
          repMax: mission.repPoints,
          minReputation: mission.minStanding?.minReputation ?? null,
          minStandingName: mission.minStanding?.name ?? null,
          variantCount: missions.length,
          missionGiver: mission.faction,
          matched: true,
          isLawful: !isUnlawfulFaction(mission.faction),
          aUecMin: 0,
          aUecMax: 0,
          missionType: null,
          missionLocations: mission.system ? [mission.system] : [],
          repPoints: mission.repPoints,
        }
      }
    }
  }

  return defaultReturn
}

export function getBlueprintUnlockInfo(blueprintFileId: string): BlueprintUnlockInfo {
  const internalName = extractBlueprintInternalName(blueprintFileId)
  
  const defaultReturn: BlueprintUnlockInfo = {
    unlockMinReputation: null,
    unlockStandingName: null,
    factionName: null,
    isAvailableByDefault: true,
    matched: false,
    matchedMissionCount: 0,
    unmatchedMissionCount: 0,
    isInferred: false,
    missionPoolName: null,
    repPoints: 0,
  }
  
  if (!internalName) return defaultReturn
  
  const poolKeys = blueprintToPoolIndex.get(internalName)
  if (!poolKeys || poolKeys.length === 0) return defaultReturn
  
  let lowestReputation: number | null = null
  let lowestStandingName: string | null = null
  let factionName: string | null = null
  let bestPoolName: string | null = null
  let matchedCount = 0
  let repPoints = 0
  
  for (const poolKey of poolKeys) {
    const poolMissions = missionsByPool[poolKey] || missionsByPool[poolKey.toLowerCase()]
    if (!poolMissions || poolMissions.length === 0) continue
    
    matchedCount++
    const mission = poolMissions[0]
    factionName = mission.faction
    bestPoolName = poolKey
    repPoints = mission.repPoints
    
    const minRep = mission.minStanding?.minReputation ?? 0
    if (lowestReputation === null || minRep < lowestReputation) {
      lowestReputation = minRep
      lowestStandingName = mission.minStanding?.name ?? 'Neutral'
    }
  }
  
  if (matchedCount === 0) return defaultReturn
  
  return {
    unlockMinReputation: lowestReputation,
    unlockStandingName: lowestStandingName,
    factionName,
    isAvailableByDefault: lowestReputation === 0 || lowestReputation === null,
    matched: true,
    matchedMissionCount: matchedCount,
    unmatchedMissionCount: poolKeys.length - matchedCount,
    isInferred: false,
    missionPoolName: bestPoolName,
    repPoints,
  }
}

export function formatBlueprintUnlockBadge(blueprintFileId: string, isReward?: boolean): string {
  const info = getBlueprintUnlockInfo(blueprintFileId)

  if (!info.matched) {
    if (isReward === false) return 'Craft-only — no mission unlock'
    return 'Vendor / default — no rep required'
  }

  if (info.unlockStandingName && info.unlockMinReputation != null && info.unlockMinReputation > 0) {
    const factionPrefix = info.factionName ? `${info.factionName}: ` : ''
    return `${factionPrefix}${info.unlockStandingName} (${info.unlockMinReputation.toLocaleString()} rep)`
  }

  if (info.factionName) {
    return `${info.factionName}: Neutral (0 rep)`
  }

  return 'Vendor / default — no rep required'
}

/**
 * Get all missions that reward a specific blueprint pool
 */
export function getMissionsForPool(poolKey: string): MissionPoolEntry[] {
  return missionsByPool[poolKey] || missionsByPool[poolKey.toLowerCase()] || []
}

/**
 * Get all pool keys that contain a specific blueprint
 */
export function getPoolsForBlueprint(blueprintFileId: string): string[] {
  const internalName = extractBlueprintInternalName(blueprintFileId)
  if (!internalName) return []
  return blueprintToPoolIndex.get(internalName) || []
}

export const acquisitionDataVersion = blueprintMissionData._extracted
export const acquisitionStats = { 
  totalMissionPools: Object.keys(missionBlueprints).length,
  totalBlueprintsInPools: Object.values(missionBlueprints).reduce((sum, arr) => sum + arr.length, 0),
  contractsWithMissionData: Object.keys(missionsByPool).length,
}
