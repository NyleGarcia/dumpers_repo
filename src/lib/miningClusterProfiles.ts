import gameMiningSpawnsData from '../data/game-mining-spawns.json'
import type { MiningTrackerEntry } from './localGuestCache'

export type DepositType = 'surface' | 'asteroid'
export type ProfileMode = 'overall' | 'location'

export interface ClusterRow {
  nodes: number
  rs: number
  chancePercent: number
  bestAtLocation?: string
  minProximity?: number
  maxProximity?: number
}

export interface ClusterDisplayProfile {
  maxNodes: number
  clusterRows: ClusterRow[]
  bestLocation?: string
  bestLocationSpawnPercent?: number
}

export interface CompositionPart {
  elementName: string
  minPercentage: number
  maxPercentage: number
  qualityScale: number
}

export interface LocationSpawnProfile {
  locationName: string
  hppKey: string
  system: string
  depositType: DepositType
  groupName: string
  groupSpawnPercent: number
  relativeSpawnWeight: number
  poolSharePercent: number
  effectiveSpawnPercent: number
  harvestablePreset: string
  compositionRecordName: string | null
  compositionParts: CompositionPart[]
  clusterPresetKey: string
  probabilityOfClustering: number
  maxNodes: number
  clusterRows: ClusterRow[]
}

export interface OreSpawnProfile {
  oreName: string
  baseSignature: number
  depositTypes: DepositType[]
  overallByType: Partial<Record<DepositType, ClusterDisplayProfile>>
  locations: Record<string, LocationSpawnProfile>
  harvestablePresets: string[]
  compositionRecordIds: string[]
  clusterPresetKeys: string[]
}

export interface FormattedClusterDisplay {
  baseRs: number
  rows: Array<{ nodes: number; rs: number; chancePercent: number }>
  profile: ClusterDisplayProfile | LocationSpawnProfile
}

const spawns = gameMiningSpawnsData as {
  ores?: Record<string, OreSpawnProfile>
}

function getOreProfile(oreName: string): OreSpawnProfile | null {
  return spawns.ores?.[oreName] ?? null
}

export function getDepositTypes(oreName: string): DepositType[] {
  return getOreProfile(oreName)?.depositTypes ?? []
}

export function getOverallProfile(
  oreName: string,
  depositType: DepositType
): ClusterDisplayProfile | null {
  return getOreProfile(oreName)?.overallByType[depositType] ?? null
}

export function getLocationProfile(
  oreName: string,
  locationName: string,
  depositType?: DepositType
): LocationSpawnProfile | null {
  const profile = getOreProfile(oreName)
  if (!profile) return null

  const matches = Object.values(profile.locations ?? {}).filter(
    (loc) => loc.locationName === locationName && (!depositType || loc.depositType === depositType)
  )
  if (matches.length === 0) return null
  return matches.reduce((best, loc) =>
    loc.effectiveSpawnPercent > best.effectiveSpawnPercent ? loc : best
  )
}

export function getLocationProfilesForOre(oreName: string): LocationSpawnProfile[] {
  const profile = getOreProfile(oreName)
  if (!profile?.locations) return []
  return Object.values(profile.locations)
}

export function getGuideLocationProfiles(
  oreName: string,
  guideLocationName: string
): LocationSpawnProfile[] {
  return getLocationProfilesForOre(oreName).filter(
    (loc) => loc.locationName === guideLocationName
  )
}

export function getTrackerProfile(entry: MiningTrackerEntry): FormattedClusterDisplay | null {
  const ore = getOreProfile(entry.oreName)
  if (!ore) return null

  const depositType: DepositType = entry.depositType === 'asteroid' ? 'asteroid' : 'surface'

  if (entry.profileMode === 'location' && entry.locationName) {
    const locProfile = getLocationProfile(entry.oreName, entry.locationName, depositType)
    if (locProfile) return formatClusterRows(locProfile, ore.baseSignature)
    return null
  }

  const overall = getOverallProfile(entry.oreName, depositType)
  if (overall) return formatClusterRows(overall, ore.baseSignature)
  return null
}

export function formatClusterRows(
  profile: ClusterDisplayProfile | LocationSpawnProfile,
  baseSignature?: number
): FormattedClusterDisplay {
  const clusterRows = profile.clusterRows ?? []
  const resolvedBase =
    baseSignature != null && Number.isFinite(baseSignature) && baseSignature > 0
      ? baseSignature
      : clusterRows[0]?.nodes &&
          clusterRows[0]?.rs != null &&
          Number.isFinite(clusterRows[0].rs)
        ? Math.round(clusterRows[0].rs / clusterRows[0].nodes)
        : 0

  const baseRs = resolvedBase

  return {
    baseRs,
    rows: clusterRows.map((row) => ({
      nodes: row.nodes,
      rs:
        row.rs != null && Number.isFinite(row.rs)
          ? row.rs
          : resolvedBase > 0 && row.nodes
            ? resolvedBase * row.nodes
            : 0,
      chancePercent: row.chancePercent,
    })),
    profile,
  }
}

export type SpawnTagTier = 'best' | 'high' | 'medium' | 'low' | 'broad'

export function getLocationSpawnTag(
  oreName: string,
  locationName: string,
  depositType: DepositType
): { label: string; tier: SpawnTagTier } {
  const loc = getLocationProfile(oreName, locationName, depositType)
  if (!loc) return { label: 'Broad spawn', tier: 'broad' }

  const allOfType = getLocationProfilesForOre(oreName).filter(
    (l) => l.depositType === depositType
  )
  const maxSpawn = Math.max(...allOfType.map((l) => l.effectiveSpawnPercent), 0)
  const pct = loc.effectiveSpawnPercent

  if (pct >= maxSpawn && maxSpawn > 0) {
    return { label: 'Best', tier: 'best' }
  }
  if (pct >= 1) return { label: `${pct.toFixed(1)}% spawn`, tier: 'high' }
  if (pct >= 0.3) return { label: `${pct.toFixed(2)}% spawn`, tier: 'medium' }
  return { label: `${pct.toFixed(2)}% spawn`, tier: 'low' }
}

export function isLocationTrackerEntry(entry: MiningTrackerEntry): boolean {
  return entry.profileMode === 'location' && Boolean(entry.locationName)
}

export function getTrackerSubtitle(entry: MiningTrackerEntry): string {
  const depositType: DepositType = entry.depositType === 'asteroid' ? 'asteroid' : 'surface'

  if (isLocationTrackerEntry(entry) && entry.locationName) {
    return `Spawn & cluster · ${entry.locationName}`
  }
  const overall = getOverallProfile(entry.oreName, depositType)
  if (overall?.bestLocation) {
    return `Overall · best at ${overall.bestLocation}`
  }
  return 'Overall'
}

export function getTrackerProfileMissingMessage(entry: MiningTrackerEntry): string | null {
  if (!isLocationTrackerEntry(entry) || !entry.locationName) return null
  const depositType: DepositType = entry.depositType === 'asteroid' ? 'asteroid' : 'surface'
  if (getLocationProfile(entry.oreName, entry.locationName, depositType)) return null
  return `No spawn profile on file for ${entry.locationName}`
}

export function depositTypeLabel(depositType: DepositType): string {
  return depositType === 'surface' ? 'Surface' : 'Asteroid'
}

export function depositTypeUpper(depositType: DepositType | undefined): string {
  return depositType === 'asteroid' ? 'ASTEROID' : 'SURFACE'
}

export { spawns as miningSpawnData }
