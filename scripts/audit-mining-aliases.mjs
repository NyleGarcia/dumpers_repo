#!/usr/bin/env node
/**
 * Verify locationAliases coverage for all spawn keys in game-mining-spawns.json.
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { auditAliasCoverage } from './lib/miningLocationAliases.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'src', 'data')

const spawns = JSON.parse(readFileSync(join(DATA, 'game-mining-spawns.json'), 'utf-8'))
const locations = JSON.parse(readFileSync(join(DATA, 'game-mining-locations.json'), 'utf-8'))

const spawnKeys = new Set()
for (const ore of Object.values(spawns.ores ?? {})) {
  for (const loc of Object.values(ore.locations ?? {})) {
    spawnKeys.add(loc.spawnKey ?? loc.locationName)
  }
}

const aliases = locations.locationAliases ?? {}
const { unmapped, rawDisplayNames } = auditAliasCoverage(spawnKeys, aliases)

let exitCode = 0

console.log(`Spawn keys in game-mining-spawns.json: ${spawnKeys.size}`)
console.log(`locationAliases entries: ${Object.keys(aliases).length}`)

if (unmapped.length) {
  exitCode = 1
  console.error('\nMissing locationAliases entries:')
  for (const key of unmapped.sort()) console.error(`  - ${key}`)
}

if (rawDisplayNames.length) {
  console.warn('\nDisplay names still look like internal slugs:')
  for (const row of rawDisplayNames) {
    console.warn(`  - ${row.spawnKey}: "${row.displayName}" (${row.source})`)
  }
}

const missingDisplayOnProfiles = []
for (const ore of Object.values(spawns.ores ?? {})) {
  for (const loc of Object.values(ore.locations ?? {})) {
    if (!loc.displayName || (loc.displayName === loc.locationName && loc.displayName.match(/^(Stanton|Pyro)\d/i))) {
      missingDisplayOnProfiles.push(`${ore.oreName}: ${loc.locationName}`)
    }
  }
}

if (missingDisplayOnProfiles.length) {
  exitCode = 1
  console.error('\nSpawn profiles missing displayName:')
  for (const row of missingDisplayOnProfiles.slice(0, 20)) console.error(`  - ${row}`)
  if (missingDisplayOnProfiles.length > 20) {
    console.error(`  ... and ${missingDisplayOnProfiles.length - 20} more`)
  }
}

if (exitCode === 0) {
  console.log('\nAlias audit passed.')
} else {
  console.error('\nAlias audit failed.')
}

process.exit(exitCode)
