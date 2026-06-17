import { getMissionRepInfo, getBlueprintUnlockInfo } from './missionAcquisition'

export type Region = 'stanton' | 'pyro' | 'nyx'

export function categorizeRegions(locations: string[] | undefined): Region[] {
  if (!locations?.length) return []
  const regions = new Set<Region>()
  for (const loc of locations) {
    const l = loc.toLowerCase()
    if (l.startsWith('stanton') || l === 'stantonandnyx' || l === 'stantonandpyro') {
      regions.add('stanton')
    }
    if (l.startsWith('pyro') || l === 'stantonandpyro') {
      regions.add('pyro')
    }
    if (l.startsWith('nyx') || l === 'stantonandnyx') {
      regions.add('nyx')
    }
  }
  return [...regions].sort()
}

export interface RewardMission {
  mission: string
  chance?: number
  locations?: string[]
}

export interface BlueprintMissionSource {
  blueprintId: string
  blueprintName: string
  rewardMissions?: RewardMission[]
}

export interface MissionListEntry {
  missionKey: string
  mission: string
  giver: string
  linkedBlueprintIds: string[]
  linkedBlueprintNames: string[]
  unacquiredBlueprintIds: string[]
  repMin?: number | null
  repMax?: number | null
  minReputation?: number | null
  minStandingName?: string | null
  dropChance?: number | null
  regions: Region[]
  // Enhanced mission info
  isLawful: boolean
  aUecMin: number
  aUecMax: number
  missionType: string | null
}

export interface MissionGiverGroup {
  giver: string
  missions: MissionListEntry[]
}

export function parseMissionGiver(mission: string): string {
  const colon = mission.indexOf(':')
  if (colon <= 0) return 'Unknown'
  return mission.slice(0, colon).trim()
}

export function missionKey(mission: string): string {
  const normalized = mission.trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i)
    hash |= 0
  }
  return `m_${Math.abs(hash).toString(36)}`
}

export function buildMissionList(
  targetBlueprints: BlueprintMissionSource[],
  acquiredBlueprintIds: Set<string>,
  missionPrefs: Record<string, boolean>
): MissionGiverGroup[] {
  const missionMap = new Map<string, MissionListEntry>()
  const missionLocations = new Map<string, Set<string>>()

  for (const bp of targetBlueprints) {
    for (const reward of bp.rewardMissions ?? []) {
      const mission = reward.mission?.trim()
      if (!mission) continue

      const key = missionKey(mission)
      
      // Aggregate locations for this mission
      if (!missionLocations.has(key)) {
        missionLocations.set(key, new Set())
      }
      for (const loc of reward.locations ?? []) {
        missionLocations.get(key)!.add(loc)
      }
      
      let entry = missionMap.get(key)
      if (!entry) {
        entry = attachMissionRep({
          missionKey: key,
          mission,
          giver: parseMissionGiver(mission),
          linkedBlueprintIds: [],
          linkedBlueprintNames: [],
          unacquiredBlueprintIds: [],
        }, reward.chance, reward.locations)
        missionMap.set(key, entry)
      } else {
        // Update regions with aggregated locations
        entry.regions = categorizeRegions([...missionLocations.get(key)!])
      }

      if (!entry.linkedBlueprintIds.includes(bp.blueprintId)) {
        entry.linkedBlueprintIds.push(bp.blueprintId)
        entry.linkedBlueprintNames.push(bp.blueprintName)
      }
    }
  }

  const activeMissions: MissionListEntry[] = []

  for (const entry of missionMap.values()) {
    entry.unacquiredBlueprintIds = entry.linkedBlueprintIds.filter(
      (id) => !acquiredBlueprintIds.has(id)
    )

    if (entry.unacquiredBlueprintIds.length === 0) continue

    if (missionPrefs[entry.missionKey] !== true) continue

    activeMissions.push(entry)
  }

  const byGiver = new Map<string, MissionListEntry[]>()
  for (const entry of activeMissions) {
    const list = byGiver.get(entry.giver) ?? []
    list.push(entry)
    byGiver.set(entry.giver, list)
  }

  return [...byGiver.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([giver, missions]) => ({
      giver,
      missions: missions.sort((a, b) => a.mission.localeCompare(b.mission)),
    }))
}

export interface TargetBlueprintMissionOption {
  missionKey: string
  mission: string
  giver: string
  repMin?: number | null
  repMax?: number | null
  minReputation?: number | null
  minStandingName?: string | null
  dropChance?: number | null
  regions: Region[]
  // Enhanced mission info
  isLawful: boolean
  aUecMin: number
  aUecMax: number
  missionType: string | null
}

interface FallbackRepInfo {
  minReputation: number | null
  minStandingName: string | null
  factionName: string | null
}

function attachMissionRep<T extends { mission: string }>(
  entry: T,
  dropChance?: number | null,
  locations?: string[],
  fallbackRep?: FallbackRepInfo
): T & Pick<TargetBlueprintMissionOption, 'repMin' | 'repMax' | 'minReputation' | 'minStandingName' | 'dropChance' | 'regions' | 'isLawful' | 'aUecMin' | 'aUecMax' | 'missionType'> {
  const rep = getMissionRepInfo(entry.mission)
  
  const minReputation = rep.minReputation ?? fallbackRep?.minReputation ?? null
  const minStandingName = rep.minStandingName ?? fallbackRep?.minStandingName ?? null
  
  return {
    ...entry,
    repMin: rep.repMin,
    repMax: rep.repMax,
    minReputation,
    minStandingName,
    dropChance: dropChance ?? null,
    regions: categorizeRegions(locations),
    isLawful: rep.isLawful,
    aUecMin: rep.aUecMin,
    aUecMax: rep.aUecMax,
    missionType: rep.missionType,
  }
}

export function getMissionsForBlueprint(
  blueprint: BlueprintMissionSource,
  acquiredBlueprintIds: Set<string>
): TargetBlueprintMissionOption[] {
  if (acquiredBlueprintIds.has(blueprint.blueprintId)) return []

  const seen = new Set<string>()
  const missionLocations = new Map<string, Set<string>>()
  const options: TargetBlueprintMissionOption[] = []

  const bpUnlockInfo = getBlueprintUnlockInfo(blueprint.blueprintId)
  const fallbackRep: FallbackRepInfo = {
    minReputation: bpUnlockInfo.unlockMinReputation,
    minStandingName: bpUnlockInfo.unlockStandingName,
    factionName: bpUnlockInfo.factionName,
  }

  // First pass: collect all locations for each mission
  for (const reward of blueprint.rewardMissions ?? []) {
    const mission = reward.mission?.trim()
    if (!mission) continue
    const key = missionKey(mission)
    if (!missionLocations.has(key)) {
      missionLocations.set(key, new Set())
    }
    for (const loc of reward.locations ?? []) {
      missionLocations.get(key)!.add(loc)
    }
  }

  // Second pass: create mission options with aggregated locations
  for (const reward of blueprint.rewardMissions ?? []) {
    const mission = reward.mission?.trim()
    if (!mission) continue

    const key = missionKey(mission)
    if (seen.has(key)) continue
    seen.add(key)

    const allLocations = [...(missionLocations.get(key) ?? [])]
    options.push(
      attachMissionRep(
        {
          missionKey: key,
          mission,
          giver: parseMissionGiver(mission),
        },
        reward.chance,
        allLocations,
        fallbackRep
      )
    )
  }

  return options.sort((a, b) => a.mission.localeCompare(b.mission))
}
