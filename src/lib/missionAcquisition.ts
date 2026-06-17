import blueprintMissionData from '../data/game-blueprint-missions.json'
import factionsData from '../data/factions.json'

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
}

type MissionPoolBlueprint = {
  name: string
  weight: number
  path: string
}

type FactionData = {
  name: string
  uuid: string
  standings: Array<{
    name: string
    minReputation: number
  }>
}

const missionBlueprints = blueprintMissionData.missionBlueprints as Record<string, MissionPoolBlueprint[]>
const factions = factionsData as Record<string, FactionData>

const FACTION_PATTERN_MAP: Record<string, string> = {
  'shubin': 'shubininterstellar',
  'adagio': 'adagioholdings',
  'covalex': 'covalex',
  'eckhart': 'eckhartsecurity',
  'northrock': 'northrockservicegroup',
  'crusader': 'crusadersecurity',
  'hurston': 'hurstonsecurity',
  'microtech': 'microtech',
  'citizensforprosperity': 'citizensforprosperity',
  'cfp': 'citizensforprosperity',
  'headhunter': 'headhunters',
  'ninetail': 'xenothreat',
  'bountyhunter': 'bountyhuntersguild',
  'cdf': 'civiliandefenseforce',
  'xenothreat': 'xenothreat',
  'rayari': 'rayariincorporated',
  'wildstar': 'wildstarracing',
  'ling': 'lingfamilyhauling',
  'ftl': 'ftlcourier',
  'mtprotection': 'mtprotectionservices',
  'blacjac': 'blacjacsecurity',
  'redwind': 'redwindlinehaul',
  'udm': 'unifieddistributionmanagement',
  'bitzeros': 'bitzeros',
  'clovus': 'clovusdarneely',
  'vaughn': 'vaughn',
  'ruto': 'ruto',
  'tecia': 'teciatwitchpacheco',
  'wallace': 'wallaceklim',
  'wikelo': 'wikeloemporium',
}

const RANK_TO_STANDING_INDEX: Record<string, number> = {
  '0': 1,
  '1': 2,
  '2': 3,
  '3': 4,
  '4': 5,
  '5': 6,
  '0to1': 2,
  '2to3': 4,
}

function parseMissionPoolKey(poolKey: string): { factionKey: string | null; rankIndex: number | null } {
  const keyLower = poolKey.toLowerCase()
  
  let factionKey: string | null = null
  for (const [pattern, key] of Object.entries(FACTION_PATTERN_MAP)) {
    if (keyLower.includes(pattern)) {
      factionKey = key
      break
    }
  }
  
  let rankIndex: number | null = null
  const rankMatch = keyLower.match(/rank(\d+(?:to\d+)?)/i)
  if (rankMatch) {
    const rankKey = rankMatch[1].toLowerCase()
    rankIndex = RANK_TO_STANDING_INDEX[rankKey] ?? null
  }
  
  return { factionKey, rankIndex }
}

function getStandingForRank(factionKey: string, rankIndex: number): { name: string; minReputation: number } | null {
  const faction = factions[factionKey]
  if (!faction || !faction.standings) return null
  
  if (rankIndex >= 0 && rankIndex < faction.standings.length) {
    return faction.standings[rankIndex]
  }
  return null
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
  }

  if (/uninitialized/i.test(missionLabel)) {
    return defaultReturn
  }

  if (missionLabel.includes(':')) {
    const colonIndex = missionLabel.indexOf(':')
    const giverPart = missionLabel.slice(0, colonIndex).trim().toLowerCase()
    
    for (const [pattern, factionKey] of Object.entries(FACTION_PATTERN_MAP)) {
      if (giverPart.includes(pattern) || giverPart.replace(/[^a-z]/g, '').includes(pattern)) {
        const faction = factions[factionKey]
        if (faction) {
          return {
            ...defaultReturn,
            missionGiver: faction.name,
            matched: true,
            isLawful: !['headhunters', 'xenothreat', 'ruto', 'vaughn'].includes(factionKey),
          }
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
  }
  
  if (!internalName) return defaultReturn
  
  const poolKeys = blueprintToPoolIndex.get(internalName)
  if (!poolKeys || poolKeys.length === 0) return defaultReturn
  
  let lowestReputation: number | null = null
  let lowestStandingName: string | null = null
  let factionName: string | null = null
  let bestPoolName: string | null = null
  let matchedCount = 0
  
  for (const poolKey of poolKeys) {
    const { factionKey, rankIndex } = parseMissionPoolKey(poolKey)
    
    if (!factionKey) continue
    
    const faction = factions[factionKey]
    if (!faction) continue
    
    matchedCount++
    factionName = faction.name
    bestPoolName = poolKey
    
    if (rankIndex !== null) {
      const standing = getStandingForRank(factionKey, rankIndex)
      if (standing) {
        if (lowestReputation === null || standing.minReputation < lowestReputation) {
          lowestReputation = standing.minReputation
          lowestStandingName = standing.name
        }
      }
    } else {
      if (lowestReputation === null) {
        lowestReputation = 0
        lowestStandingName = faction.standings?.[1]?.name || 'Neutral'
      }
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
    isInferred: true,
    missionPoolName: bestPoolName,
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

export const acquisitionDataVersion = blueprintMissionData._extracted
export const acquisitionStats = { 
  totalMissionPools: Object.keys(missionBlueprints).length,
  totalBlueprintsInPools: Object.values(missionBlueprints).reduce((sum, arr) => sum + arr.length, 0),
}
