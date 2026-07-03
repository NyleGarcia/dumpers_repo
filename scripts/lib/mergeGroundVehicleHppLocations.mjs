/**
 * Merge ground-vehicle gem locations from HPP GroundVehicle_Mineables groups.
 * Compendium / localization desc often under-report where gems like Feynmaline spawn.
 */

import { existsSync, readFileSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import {
  hppRecordToSpawnKey,
  resolveAliasForSpawnKey,
  SPAWN_CODE_GUIDE_NAMES,
} from './miningLocationAliases.mjs'
import {
  GROUND_VEHICLE_GEMS,
  normalizeMineableLabel,
  preferredGuideNameForSpawnKey,
} from './miningOreNames.mjs'

const GROUND_VEHICLE_PRESET_SLUG_TO_ORE = {
  feynmaline: 'Feynmaline',
  glacosite: 'Glacosite',
  beradom: 'Beradom',
  beradon: 'Beradom',
}

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

function oreFromGroundVehiclePreset(presetBasename) {
  const m = String(presetBasename || '').match(/^groundvehiclemining_([a-z]+)$/i)
  if (!m) return null
  const ore = GROUND_VEHICLE_PRESET_SLUG_TO_ORE[m[1].toLowerCase()]
  return ore && GROUND_VEHICLE_GEMS.has(ore) ? ore : null
}

function guideLocationForHpp(hppKey, locationAliases) {
  const spawnKey = hppRecordToSpawnKey(hppKey)
  const resolved = resolveAliasForSpawnKey(spawnKey, locationAliases)
  const guideLoc = preferredGuideNameForSpawnKey(
    spawnKey,
    resolved.guideName ?? SPAWN_CODE_GUIDE_NAMES[spawnKey] ?? spawnKey
  )
  return { spawnKey, guideLoc }
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

function mergeGemAtSite({ ore, guideLoc, spawnKey, oreLocations, locationOres, locationMineables }) {
  if (!oreLocations[ore]) oreLocations[ore] = []
  if (!oreLocations[ore].includes(guideLoc)) {
    oreLocations[ore].push(guideLoc)
  }

  if (!locationOres[guideLoc]) locationOres[guideLoc] = []
  const existing = locationOres[guideLoc].find((entry) => entry.name === ore)
  if (existing) {
    if (existing.rarity !== 'handMineable') existing.rarity = 'handMineable'
  } else {
    locationOres[guideLoc].push({ name: ore, rarity: 'handMineable' })
  }

  ensureLocationMineables(locationMineables, guideLoc, spawnKey)
  const gv = locationMineables[guideLoc].groundVehicleMineables
  const canonical = normalizeMineableLabel(ore)
  if (!gv.some((label) => normalizeMineableLabel(label).toLowerCase() === canonical.toLowerCase())) {
    gv.push(canonical)
  }
}

/**
 * @returns {number} count of ore×site merges applied
 */
export function mergeGroundVehicleGemLocationsFromHpp({
  extractedDataRoot,
  locationAliases,
  oreLocations,
  locationOres,
  locationMineables,
}) {
  const hppDir = join(extractedDataRoot, 'libs/foundry/records/harvestable/providerpresets')
  if (!existsSync(hppDir)) return 0

  const seen = new Set()
  let mergeCount = 0

  for (const file of walkJsonFiles(hppDir)) {
    if (!basename(file).startsWith('hpp_')) continue
    const json = readJson(file)
    if (!json?._RecordValue_) continue

    const hppKey = json._RecordName_ || basename(file, '.json')
    const { spawnKey, guideLoc } = guideLocationForHpp(hppKey, locationAliases)

    for (const group of json._RecordValue_.harvestableGroups ?? []) {
      if (group.groupName !== 'GroundVehicle_Mineables') continue

      for (const h of group.harvestables ?? []) {
        const presetBasename = harvestablePresetBasename(h.harvestable)
        const ore = oreFromGroundVehiclePreset(presetBasename)
        if (!ore) continue

        const dedupeKey = `${ore}|${guideLoc}`
        if (seen.has(dedupeKey)) continue
        seen.add(dedupeKey)

        mergeGemAtSite({
          ore,
          guideLoc,
          spawnKey,
          oreLocations,
          locationOres,
          locationMineables,
        })
        mergeCount++
      }
    }
  }

  return mergeCount
}
