import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const catalogPath = join(root, 'src', 'data', 'game-blueprints.json')
const data = JSON.parse(readFileSync(catalogPath, 'utf8'))
const blueprints = data.blueprints ?? []

const stats = {
  total: blueprints.length,
  withInternalName: 0,
  withSlots: 0,
  withResourceOptions: 0,
  withRewardMissions: 0,
  missingInternalName: 0,
}

for (const bp of blueprints) {
  if (bp.internalName) stats.withInternalName++
  else stats.missingInternalName++

  if (Array.isArray(bp.slots) && bp.slots.length > 0) stats.withSlots++

  if (Array.isArray(bp.rewardMissions) && bp.rewardMissions.length > 0) {
    stats.withRewardMissions++
  }

  let hasResource = false
  for (const slot of bp.slots ?? []) {
    for (const opt of slot.options ?? []) {
      if (opt.type === 'resource' && (opt.resourceName || opt.internalName || opt.displayName)) {
        hasResource = true
      }
    }
  }
  if (hasResource) stats.withResourceOptions++
}

const failures = []
if (stats.missingInternalName > 0) {
  failures.push(`${stats.missingInternalName} blueprints missing internalName`)
}
if (stats.withSlots < stats.total * 0.85) {
  failures.push('too few blueprints with slots')
}
if (stats.withResourceOptions < stats.total * 0.5) {
  failures.push('too few blueprints with resource craft options')
}

console.log(`game-blueprints validation (${data.version ?? 'unknown'})`)
console.log(JSON.stringify(stats, null, 2))

if (failures.length > 0) {
  console.error('Validation failed:', failures.join('; '))
  process.exit(1)
}

console.log('Validation passed')
