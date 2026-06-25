#!/usr/bin/env node
/**
 * Verify site-specific mining guide indexing: broad compendium labels must not
 * imply every planet in a system (e.g. Stileron on Adir).
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(
  readFileSync(join(__dirname, '..', 'src', 'data', 'game-mining-locations.json'), 'utf-8')
)

const BROAD = new Set([
  'All Moons/Planets/Caves',
  'All Pyro Planets',
  'Pyro Asteroid Clusters',
  'Found in All Stanton Deposits (Rare)',
  'QV Breaker Stations (Nyx)',
])

/** Not real By Location sites — must never appear as planet/moon cards. */
const NON_SITE_BROAD = new Set([
  'All Moons/Planets/Caves',
  'All Pyro Planets',
  'Found in All Stanton Deposits (Rare)',
])

function siteMineablesFor(ore) {
  const sites = []
  for (const [loc, m] of Object.entries(data.locationMineables ?? {})) {
    const labels = [
      ...(m.shipMineables ?? []),
      ...(m.handMineables ?? []),
      ...(m.groundVehicleMineables ?? []),
    ]
    if (labels.some((l) => l.toLowerCase() === ore.toLowerCase())) sites.push(loc)
  }
  return sites
}

function specificGuideLocations(ore, compendiumLocs) {
  const fromComp = compendiumLocs.filter((l) => !BROAD.has(l))
  return [...new Set([...fromComp, ...siteMineablesFor(ore)])]
}

let exitCode = 0

const stileronSites = specificGuideLocations('Stileron', data.oreLocations.Stileron ?? [])
console.log('Stileron specific sites:', stileronSites.join(', '))
if (stileronSites.includes('Adir')) {
  console.error('FAIL: Stileron incorrectly indexed on Adir')
  exitCode = 1
}
if (!stileronSites.includes('Pyro I')) {
  console.error('FAIL: Stileron missing from Pyro I')
  exitCode = 1
}

function buildLocationOresMap(compendiumRows) {
  const map = {}
  const add = (loc, ore) => {
    if (!map[loc]) map[loc] = new Set()
    map[loc].add(ore)
  }
  for (const row of compendiumRows) {
    for (const loc of specificGuideLocations(row.ore_name, row.locations ?? [])) {
      add(loc, row.ore_name)
    }
    for (const loc of row.locations ?? []) {
      if (BROAD.has(loc) && !NON_SITE_BROAD.has(loc)) add(loc, row.ore_name)
    }
  }
  return map
}

const compendiumRows = []
for (const tier of Object.values(data.rarityTiers ?? {})) {
  for (const ore of tier) {
    compendiumRows.push({ ore_name: ore.name, locations: ore.locations ?? [] })
  }
}
const locationMap = buildLocationOresMap(compendiumRows)
if (locationMap['All Pyro Planets']) {
  console.error('FAIL: All Pyro Planets must not be a By Location card')
  exitCode = 1
} else {
  console.log('OK: All Pyro Planets excluded from By Location index')
}

const redundantSubsites = ['Magda Sand Caves']
for (const loc of redundantSubsites) {
  if (locationMap[loc]) {
    console.error(`FAIL: redundant subsite must not be a By Location card: ${loc}`)
    exitCode = 1
  } else {
    console.log(`OK: ${loc} excluded from By Location index`)
  }
}

for (const [ore, locs] of Object.entries(data.oreLocations ?? {})) {
  const hasBroadOnly = locs.some((l) => BROAD.has(l))
  const specifics = specificGuideLocations(ore, locs)
  if (hasBroadOnly && specifics.length === 0) {
    console.log(`OK broad-only (no per-site data): ${ore}`)
  }
}

process.exit(exitCode)
