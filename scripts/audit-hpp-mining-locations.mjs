#!/usr/bin/env node
/**
 * Compare HPP mineable groups against game-mining-locations.json site data.
 * Reports ore×site pairs present in HPP but missing from locationMineables.
 */

import { readFileSync } from 'fs'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { collectHppMineableSiteLinks } from './lib/mergeHppMineableLocations.mjs'
import { buildLocationAliases } from './lib/miningLocationAliases.mjs'
import { normalizeMineableLabel } from './lib/miningOreNames.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')
const EXTRACTED_DATA = join(PROJECT_ROOT, 'extracted-data')
const DATA_FILE = join(PROJECT_ROOT, 'src', 'data', 'game-mining-locations.json')

function loadLocalization() {
  const path = join(EXTRACTED_DATA, 'Data', 'Localization', 'english', 'global.ini')
  const raw = readFileSync(path, 'utf-8')
  const localization = {}
  for (const line of raw.split(/\r?\n/)) {
    if (!line.includes('=')) continue
    const eq = line.indexOf('=')
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    localization[key] = value
    if (key.includes(',')) {
      const baseKey = key.split(',')[0]
      if (!localization[baseKey]) localization[baseKey] = value
    }
  }
  localization._lowerMap = Object.fromEntries(
    Object.entries(localization).map(([k, v]) => [k.toLowerCase(), v])
  )
  return localization
}

const data = JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
const localization = loadLocalization()
const locationAliases = buildLocationAliases(localization, EXTRACTED_DATA)
const hppLinks = collectHppMineableSiteLinks({ extractedDataRoot: EXTRACTED_DATA, locationAliases })

const FIELD_BY_GROUP = {
  SpaceShip_Mineables: 'shipMineables',
  FPS_Mineables: 'handMineables',
  GroundVehicle_Mineables: 'groundVehicleMineables',
}

const missing = []
for (const link of hppLinks) {
  const field = FIELD_BY_GROUP[link.groupName]
  const mineables = data.locationMineables?.[link.guideLoc]
  const labels = mineables?.[field] ?? []
  const canonical = normalizeMineableLabel(link.ore).toLowerCase()
  if (!labels.some((l) => normalizeMineableLabel(l).toLowerCase() === canonical)) {
    missing.push(link)
  }
}

const byGroup = {}
const byOre = {}
for (const link of missing) {
  byGroup[link.groupName] = (byGroup[link.groupName] ?? 0) + 1
  byOre[link.ore] = (byOre[link.ore] ?? 0) + 1
}

console.log(`HPP mineable links: ${hppLinks.length}`)
console.log(`Missing from locationMineables: ${missing.length}`)
console.log('By group:', byGroup)
console.log('By ore (top gaps):', Object.fromEntries(Object.entries(byOre).sort((a, b) => b[1] - a[1]).slice(0, 15)))

if (missing.length > 0) {
  console.log('\nSample gaps (first 20):')
  for (const link of missing.slice(0, 20)) {
    console.log(`  ${link.ore} @ ${link.guideLoc} (${link.groupName}, ${link.hppKey})`)
  }
  process.exit(1)
}

console.log('OK: all HPP mineables reflected in locationMineables')
