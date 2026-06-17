import reputationData from '../data/game-reputation.json'
import blueprintMissionData from '../data/game-blueprint-missions.json'

export interface MissionRepInfo {
  repMin: number | null
  repMax: number | null
  minReputation: number | null
  minStandingName: string | null
  variantCount: number
  missionGiver: string | null
  matched: boolean
  // New enhanced fields
  isLawful: boolean
  aUecMin: number
  aUecMax: number
  missionType: string | null
  missionLocations: string[]
}

export interface BlueprintUnlockInfo {
  unlockMinReputation: number | null
  unlockStandingName: string | null
  isAvailableByDefault: boolean
  matched: boolean
  matchedMissionCount: number
  unmatchedMissionCount: number
  isInferred: boolean
}

type MissionData = {
  label: string
  title: string
  faction: string
  missionGiver?: string
  isLawful?: boolean
  aUecReward?: { min: number; max: number }
  missionType?: string
  locations?: string[]
  reputationRequirements: Array<{
    factionRef: string
    scopeRef: string
    comparison: string
    standingRef: string
  }> | null
  reputationRewards: Array<{
    rewardRef: string
    factionRef: string
  }>
  repAmounts?: {
    success: Array<{
      rewardType: string
      factionKey: string
      rewardRef: string
    }>
  }
  blueprintRewards: Array<{
    poolRef: string
    weight: number
  }>
}

const missions = reputationData.missions as Record<string, MissionData>

const GIVER_ALIASES: Record<string, string[]> = {
  'citizensforprosperity': ['citizens for prosperity', 'cfp'],
  'bountyhuntersguild': ['bounty hunters guild', 'bhg', 'bounty hunter'],
  'shubin interstellar': ['shubin'],
  'crusader security': ['crusec', 'crusader'],
  'hurston security': ['hurston', 'hd'],
  'microtech': ['mt', 'micro tech'],
  'northrock': ['northrock service group', 'nrsg'],
  'headhunters': ['headhunter'],
  'nine tails': ['ninetails', '9tails'],
  'covalex': ['covalex shipping'],
  'rayari': ['rayari deltana'],
  'adagio': ['adagio holdings'],
  'eckhart': ['eckhart security'],
}

function buildMissionGiverIndex(): Map<string, MissionData[]> {
  const index = new Map<string, MissionData[]>()
  
  for (const [_key, mission] of Object.entries(missions)) {
    const giver = (mission.missionGiver || mission.faction || '').toLowerCase()
    if (!giver || giver === 'unknown' || giver.includes('~mission')) continue
    
    const normalizedGiver = giver.replace(/[^a-z0-9]/g, '')
    if (!index.has(normalizedGiver)) {
      index.set(normalizedGiver, [])
    }
    index.get(normalizedGiver)!.push(mission)
  }
  
  return index
}

const missionsByGiver = buildMissionGiverIndex()

function findMissionByGiverAndTitle(giverPrefix: string, titlePart: string): MissionData | null {
  const normalizedGiver = giverPrefix.toLowerCase().replace(/[^a-z0-9]/g, '')
  const normalizedTitle = normalizeMissionTitle(titlePart)
  
  const possibleGivers = [normalizedGiver]
  for (const [canonical, aliases] of Object.entries(GIVER_ALIASES)) {
    const canonicalNorm = canonical.replace(/[^a-z0-9]/g, '')
    if (canonicalNorm === normalizedGiver || aliases.some(a => a.replace(/[^a-z0-9]/g, '') === normalizedGiver)) {
      possibleGivers.push(canonicalNorm)
      aliases.forEach(a => possibleGivers.push(a.replace(/[^a-z0-9]/g, '')))
    }
  }
  
  for (const giver of possibleGivers) {
    const candidates = missionsByGiver.get(giver)
    if (!candidates) continue
    
    for (const mission of candidates) {
      const missionTitle = normalizeMissionTitle(mission.title || '')
      if (missionTitle === normalizedTitle) {
        return mission
      }
      if (missionTitle.includes(normalizedTitle) || normalizedTitle.includes(missionTitle)) {
        return mission
      }
    }
  }
  
  return null
}

const rewardAmounts = reputationData.rewardAmounts as Record<string, {
  name: string
  amount: number
  editorName: string
}>

const standingsByCategory = reputationData.standingsByCategory as Record<string, Array<{
  displayName: string
  minReputation: number
  gated: boolean
  filePath: string
}>>

const blueprintMissions = blueprintMissionData.blueprintMissions as Record<string, string[]>

function extractRewardKey(rewardRef: string): string {
  const match = rewardRef.match(/\/([^/]+)\.json$/i)
  return match ? match[1].toLowerCase() : ''
}

function extractStandingMinRep(standingRef: string): { minReputation: number; displayName: string } | null {
  const match = standingRef.match(/\/([^/]+)\.json$/i)
  if (!match) return null
  
  const standingFile = match[1].toLowerCase()
  
  for (const standings of Object.values(standingsByCategory)) {
    for (const s of standings) {
      if (s.filePath.toLowerCase().includes(standingFile)) {
        return { minReputation: s.minReputation, displayName: s.displayName }
      }
    }
  }
  return null
}

export function normalizeMissionTitle(title: string): string {
  const t = title
    .replace(/~mission\s*\(\s*Location[^)]*\)/gi, '[location]')
    .replace(/~mission\s*\(\s*TargetName[^)]*\)/gi, '[target]')
    .replace(/~mission\s*\(\s*Danger[^)]*\)/gi, '[danger]')
    .replace(/~mission\s*\([^)]*\)/gi, '[param]')
    .replace(/\[Location[^\]]*\]/gi, '[location]')
    .replace(/\[NearbyLocation[^\]]*\]/gi, '[location]')
    .replace(/\[TargetName[^\]]*\]/gi, '[target]')
    .replace(/\[Danger[^\]]*\]/gi, '[danger]')
    .replace(/\bat\s+[a-z0-9][\w\s'-]{1,40}?\s+(offline|online)\b/gi, 'at [location] $1')
    .replace(/\brally at\s+[a-z0-9][\w\s'-]{1,40}\b/gi, 'rally at [location]')
    .replace(/\bwipe\s+[a-z0-9][\w\s'-]{1,40}\s+out\b/gi, 'wipe [location] out')
    .replace(/\bat\s+[a-z0-9][\w\s'-]{1,40}\b/gi, 'at [location]')
    .replace(/\bnear\s+[a-z0-9][\w\s'-]{1,40}\b/gi, 'near [location]')
    .replace(/\bverified bounty:\s*.+$/gi, 'verified bounty: [target]')
    .replace(/\bbounty assignment:\s*.+$/gi, 'bounty assignment: [target]')
    .replace(/\bwanted:\s*.+$/gi, 'wanted: [target]')
    .replace(/\bgreen light on\s+.+/gi, 'green light on [target]')
    .replace(/\bdeal with\s+[\w\s]+?\s+at\b/gi, 'deal with [enemy] at')
    .replace(/\bkill\s+[\w\s]+?\s+at\b/gi, 'kill [enemy] at')
    .replace(/\bbutcher\s+[\w\s]+?\s+at\b/gi, 'butcher [enemy] at')
    .replace(/\bhit\s+[\w\s]+?\s+at\b/gi, 'hit [enemy] at')
    .replace(/uninitialized/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  return t
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

  // Strategy 1: Direct key lookup (for internal mission labels)
  const key = missionLookupKey(missionLabel)
  let entry: MissionData | undefined = missions[key]
  
  // Strategy 2: Parse "Giver: Title" format and try to match by giver + title
  if (!entry && missionLabel.includes(':')) {
    const colonIndex = missionLabel.indexOf(':')
    const giverPart = missionLabel.slice(0, colonIndex).trim()
    let titlePart = missionLabel.slice(colonIndex + 1).trim()
    
    // Remove "(Not currently available in game)" suffix
    titlePart = titlePart.replace(/\s*\(Not currently available in game\)\s*$/i, '').trim()
    
    const matched = findMissionByGiverAndTitle(giverPart, titlePart)
    if (matched) {
      entry = matched
    }
  }
  
  if (!entry) {
    return defaultReturn
  }

  let repMin: number | null = null
  let repMax: number | null = null
  
  // Try to get rep amounts from the new repAmounts.success array
  if (entry.repAmounts?.success?.length) {
    for (const ra of entry.repAmounts.success) {
      const rewardKey = ra.rewardType.toLowerCase()
      const rewardData = rewardAmounts[rewardKey]
      if (rewardData) {
        const amount = rewardData.amount
        if (repMin === null || amount < repMin) repMin = amount
        if (repMax === null || amount > repMax) repMax = amount
      }
    }
  }
  
  // Fallback to old method if no repAmounts
  if (repMin === null && entry.reputationRewards) {
    for (const reward of entry.reputationRewards) {
      const rewardKey = extractRewardKey(reward.rewardRef)
      const rewardData = rewardAmounts[rewardKey]
      if (rewardData) {
        const amount = rewardData.amount
        if (repMin === null || amount < repMin) repMin = amount
        if (repMax === null || amount > repMax) repMax = amount
      }
    }
  }

  let minReputation: number | null = null
  let minStandingName: string | null = null
  
  if (entry.reputationRequirements && entry.reputationRequirements.length > 0) {
    for (const req of entry.reputationRequirements) {
      const standingInfo = extractStandingMinRep(req.standingRef)
      if (standingInfo) {
        minReputation = standingInfo.minReputation
        minStandingName = standingInfo.displayName
        break
      }
    }
  }

  return {
    repMin,
    repMax,
    minReputation,
    minStandingName,
    variantCount: 1,
    missionGiver: entry.faction || null,
    matched: true,
    isLawful: entry.isLawful !== false,
    aUecMin: entry.aUecReward?.min || 0,
    aUecMax: entry.aUecReward?.max || 0,
    missionType: entry.missionType || null,
    missionLocations: entry.locations || [],
  }
}

export function getBlueprintUnlockInfo(blueprintFileId: string): BlueprintUnlockInfo {
  // Extract the blueprint name from the file path
  // Input: "LIVEfiles\\libs\\foundry\\records\\crafting\\blueprints\\crafting\\vehiclegear\\mining\\mining_laser_grin_arbor\\bp_craft_mining_laser_grin_arbor_mh2_scitem.json"
  // We need to try multiple extraction strategies since game data keys vary
  
  const normalized = blueprintFileId.replace(/\\/g, '/').toLowerCase()
  
  // Strategy 1: Extract from bp_craft_XXX_scitem.json pattern
  const scitemMatch = normalized.match(/bp_craft_([^/]+?)_scitem\.json$/i)
  const nameFromScitem = scitemMatch ? scitemMatch[1] : null
  
  // Strategy 2: Extract from bp_craft_XXX.json pattern
  const simpleMatch = normalized.match(/bp_craft_([^/]+?)\.json$/i)
  const nameFromSimple = simpleMatch ? simpleMatch[1] : null
  
  // Strategy 3: Get the folder name before the file
  const folderMatch = normalized.match(/\/([^/]+)\/bp_craft_[^/]+\.json$/i)
  const nameFromFolder = folderMatch ? folderMatch[1] : null
  
  // Try all possible keys
  const possibleKeys = [
    nameFromScitem,
    nameFromSimple,
    nameFromFolder,
    // Also try with common suffixes stripped
    nameFromScitem?.replace(/_s\d+$/, ''),
    nameFromSimple?.replace(/_s\d+$/, ''),
  ].filter(Boolean) as string[]
  
  // Find matching mission keys
  let missionKeys: string[] = []
  for (const key of possibleKeys) {
    if (blueprintMissions[key]) {
      missionKeys = blueprintMissions[key]
      break
    }
    // Also try matching with size suffix variations (s0, s1, s2, s3)
    for (const suffix of ['_s0', '_s1', '_s2', '_s3', '']) {
      const keyWithSuffix = key.replace(/_s\d+$/, '') + suffix
      if (blueprintMissions[keyWithSuffix]) {
        missionKeys = blueprintMissions[keyWithSuffix]
        break
      }
    }
    if (missionKeys.length > 0) break
  }
  
  if (missionKeys.length === 0) {
    return {
      unlockMinReputation: null,
      unlockStandingName: null,
      isAvailableByDefault: true,
      matched: false,
      matchedMissionCount: 0,
      unmatchedMissionCount: 0,
      isInferred: false,
    }
  }

  let lowestReputation: number | null = null
  let lowestStandingName: string | null = null
  let matchedCount = 0
  
  for (const missionKey of missionKeys) {
    const mission = missions[missionKey]
    if (!mission) continue
    
    matchedCount++
    
    if (mission.reputationRequirements && mission.reputationRequirements.length > 0) {
      for (const req of mission.reputationRequirements) {
        const standingInfo = extractStandingMinRep(req.standingRef)
        if (standingInfo) {
          if (lowestReputation === null || standingInfo.minReputation < lowestReputation) {
            lowestReputation = standingInfo.minReputation
            lowestStandingName = standingInfo.displayName
          }
        }
      }
    } else {
      if (lowestReputation === null) {
        lowestReputation = 0
        lowestStandingName = 'Neutral'
      }
    }
  }

  return {
    unlockMinReputation: lowestReputation,
    unlockStandingName: lowestStandingName,
    isAvailableByDefault: lowestReputation === 0 || lowestReputation === null,
    matched: matchedCount > 0,
    matchedMissionCount: matchedCount,
    unmatchedMissionCount: missionKeys.length - matchedCount,
    isInferred: false,
  }
}

export function formatBlueprintUnlockBadge(blueprintFileId: string, isReward?: boolean): string {
  const info = getBlueprintUnlockInfo(blueprintFileId)

  if (info.isAvailableByDefault) return 'Vendor / default — no rep required'
  if (isReward === false) return 'Craft-only — no mission unlock'

  if (info.unlockStandingName != null || info.unlockMinReputation != null) {
    const standing = formatStandingRequirement(info.unlockStandingName, info.unlockMinReputation)
    return standing ? `Unlock: ${standing}` : 'Unlock: rep required'
  }

  if (info.matched && info.matchedMissionCount === 0) return 'Rep unknown'
  if (!info.matched) return 'Rep unknown'

  return 'Rep unknown'
}

export const acquisitionDataVersion = reputationData._extracted
export const acquisitionStats = reputationData.summary
