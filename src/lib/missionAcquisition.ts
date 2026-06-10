import acquisitionData from '../data/blueprint-acquisition.json'

export interface MissionRepInfo {
  repMin: number | null
  repMax: number | null
  minReputation: number | null
  minStandingName: string | null
  variantCount: number
  missionGiver: string | null
  matched: boolean
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

function slugifyGiver(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function parseMissionLabel(label: string): { giverSlug: string; title: string } {
  const colon = label.indexOf(':')
  if (colon <= 0) return { giverSlug: '', title: label.trim() }
  return {
    giverSlug: slugifyGiver(label.slice(0, colon).trim()),
    title: label.slice(colon + 1).trim(),
  }
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
  const { giverSlug, title } = parseMissionLabel(missionLabel)
  return `${giverSlug}|${normalizeMissionTitle(title)}`
}

type MissionByLabel = {
  repMin: number | null
  repMax: number | null
  minReputation: number | null
  minStandingName: string | null
  variantCount: number
  missionGiver: string | null
}

type BlueprintAcquisition = {
  isAvailableByDefault?: boolean
  unlockMinReputation: number | null
  unlockStandingName: string | null
  matchedMissionCount?: number
  unmatchedMissionCount?: number
  _inferred?: boolean
  _unlockInferred?: boolean
  _starstringsEnriched?: boolean
}

const missionsByLabel = acquisitionData.missionsByLabel as Record<string, MissionByLabel>
const blueprints = acquisitionData.blueprints as Record<string, BlueprintAcquisition>

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
  if (/uninitialized/i.test(missionLabel)) {
    return {
      repMin: null,
      repMax: null,
      minReputation: null,
      minStandingName: null,
      variantCount: 0,
      missionGiver: null,
      matched: false,
    }
  }

  const entry = missionsByLabel[missionLookupKey(missionLabel)]
  if (!entry) {
    return {
      repMin: null,
      repMax: null,
      minReputation: null,
      minStandingName: null,
      variantCount: 0,
      missionGiver: null,
      matched: false,
    }
  }

  return {
    repMin: entry.repMin,
    repMax: entry.repMax,
    minReputation: entry.minReputation,
    minStandingName: entry.minStandingName,
    variantCount: entry.variantCount,
    missionGiver: entry.missionGiver,
    matched: true,
  }
}

export function getBlueprintUnlockInfo(blueprintFileId: string): BlueprintUnlockInfo {
  const entry = blueprints[blueprintFileId]
  if (!entry) {
    return {
      unlockMinReputation: null,
      unlockStandingName: null,
      isAvailableByDefault: false,
      matched: false,
      matchedMissionCount: 0,
      unmatchedMissionCount: 0,
      isInferred: false,
    }
  }

  const isInferred = !!(entry._inferred || entry._unlockInferred || entry._starstringsEnriched)

  return {
    unlockMinReputation: entry.unlockMinReputation,
    unlockStandingName: entry.unlockStandingName,
    isAvailableByDefault: entry.isAvailableByDefault ?? false,
    matched: true,
    matchedMissionCount: entry.matchedMissionCount ?? 0,
    unmatchedMissionCount: entry.unmatchedMissionCount ?? 0,
    isInferred,
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

export const acquisitionDataVersion = acquisitionData.version
export const acquisitionStats = acquisitionData.stats
