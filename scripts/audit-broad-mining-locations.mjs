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

for (const [ore, locs] of Object.entries(data.oreLocations ?? {})) {
  const hasBroadOnly = locs.some((l) => BROAD.has(l))
  const specifics = specificGuideLocations(ore, locs)
  if (hasBroadOnly && specifics.length === 0) {
    console.log(`OK broad-only (no per-site data): ${ore}`)
  }
}

process.exit(exitCode)
