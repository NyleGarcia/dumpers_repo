/**
 * Merge mineable locations from HPP provider presets (ship, FPS, ground-vehicle).
 * Compendium / localization desc often under-report per-body spawn coverage.
 */

import { existsSync, readFileSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import {
  hppRecordToSpawnKey,
  resolveAliasForSpawnKey,
  SPAWN_CODE_GUIDE_NAMES,
} from './miningLocationAliases.mjs'
import {
  HPP_MINEABLE_GROUPS,
  HPP_SKIP_BASENAMES,
  oreFromHppMineablePreset,
} from './hppMineablePresets.mjs'
import { normalizeMineableLabel, preferredGuideNameForSpawnKey } from './miningOreNames.mjs'

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

function walkJsonFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walkJsonFiles(p, acc)
    else if (entry.name.endsWith('.json')) acc.push(p)
  }
  return acc
}

function harvestablePresetBasename(harvestableRef) {
  const raw = String(harvestableRef?._RecordPath_ || harvestableRef || '')
  const normalized = raw.replace(/\\/g, '/')
  const fileName = normalized.split('/').pop() || ''
  return fileName.replace(/\.json$/i, '')
}

function guideLocationForHpp(hppKey, locationAliases) {
  const spawnKey = hppRecordToSpawnKey(hppKey)
  const resolved = resolveAliasForSpawnKey(spawnKey, locationAliases)
  const guideLoc = preferredGuideNameForSpawnKey(
    spawnKey,
    resolved.guideName ?? SPAWN_CODE_GUIDE_NAMES[spawnKey] ?? spawnKey
  )
  return { spawnKey, guideLoc, hppKey }
}

function ensureLocationMineables(locationMineables, guideLoc, spawnKey) {
  if (!locationMineables[guideLoc]) {
    locationMineables[guideLoc] = {
      shipMineables: [],
      groundVehicleMineables: [],
      handMineables: [],
      harvestables: [],
      creatures: [],
      spawnKey,
    }
    return
  }
  if (!locationMineables[guideLoc].spawnKey) {
    locationMineables[guideLoc].spawnKey = spawnKey
  }
}

function mergeOreAtSite({
  ore,
  guideLoc,
  spawnKey,
  mineableField,
  oreLocations,
  locationOres,
  locationMineables,
  assignOreRarity,
}) {
  if (!oreLocations[ore]) oreLocations[ore] = []
  if (!oreLocations[ore].includes(guideLoc)) {
    oreLocations[ore].push(guideLoc)
  }

  const rarity = assignOreRarity(ore)
  if (!locationOres[guideLoc]) locationOres[guideLoc] = []
  const existing = locationOres[guideLoc].find((entry) => entry.name === ore)
  if (existing) {
    if (rarity === 'handMineable') existing.rarity = 'handMineable'
  } else {
    locationOres[guideLoc].push({ name: ore, rarity })
  }

  ensureLocationMineables(locationMineables, guideLoc, spawnKey)
  const list = locationMineables[guideLoc][mineableField]
  const canonical = normalizeMineableLabel(ore)
  if (!list.some((label) => normalizeMineableLabel(label).toLowerCase() === canonical.toLowerCase())) {
    list.push(canonical)
  }
}

/**
 * Collect ore×site links from HPP mineable groups (for audits).
 * @returns {Array<{ ore, guideLoc, spawnKey, hppKey, groupName, mineableField }>}
 */
export function collectHppMineableSiteLinks({ extractedDataRoot, locationAliases }) {
  const hppDir = join(extractedDataRoot, 'libs/foundry/records/harvestable/providerpresets')
  if (!existsSync(hppDir)) return []

  const links = []
  const seen = new Set()

  for (const file of walkJsonFiles(hppDir)) {
    const fileBase = basename(file, '.json')
    if (!fileBase.startsWith('hpp_') || HPP_SKIP_BASENAMES.has(fileBase)) continue

    const json = readJson(file)
    if (!json?._RecordValue_) continue

    const hppKey = json._RecordName_ || fileBase
    const { spawnKey, guideLoc } = guideLocationForHpp(hppKey, locationAliases)

    for (const group of json._RecordValue_.harvestableGroups ?? []) {
      const mineableField = HPP_MINEABLE_GROUPS[group.groupName]
      if (!mineableField) continue

      for (const h of group.harvestables ?? []) {
        const presetBasename = harvestablePresetBasename(h.harvestable)
        const ore = oreFromHppMineablePreset(presetBasename)
        if (!ore) continue

        const dedupeKey = `${group.groupName}|${ore}|${guideLoc}`
        if (seen.has(dedupeKey)) continue
        seen.add(dedupeKey)

        links.push({
          ore,
          guideLoc,
          spawnKey,
          hppKey,
          groupName: group.groupName,
          mineableField,
        })
      }
    }
  }

  return links
}

/**
 * @returns {number} count of ore×site merges applied
 */
export function mergeHppMineableLocations({
  extractedDataRoot,
  locationAliases,
  oreLocations,
  locationOres,
  locationMineables,
  assignOreRarity,
}) {
  const links = collectHppMineableSiteLinks({ extractedDataRoot, locationAliases })
  let mergeCount = 0

  for (const link of links) {
    mergeOreAtSite({
      ore: link.ore,
      guideLoc: link.guideLoc,
      spawnKey: link.spawnKey,
      mineableField: link.mineableField,
      oreLocations,
      locationOres,
      locationMineables,
      assignOreRarity,
    })
    mergeCount++
  }

  return mergeCount
}

/**
 * @deprecated Use mergeHppMineableLocations
 */
export function mergeGroundVehicleGemLocationsFromHpp(ctx) {
  return mergeHppMineableLocations(ctx)
}
