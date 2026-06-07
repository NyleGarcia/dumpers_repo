import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(readFileSync(join(root, 'src', 'data', 'Blueprints.json'), 'utf8'))
const blueprints = data.blueprints

const FPS_WEAPON_TYPES = ['crossbow', 'lmg', 'pistol', 'rifle', 'shotgun', 'smg', 'sniper']

function getFpsWeaponTypeFromFilename(filename) {
  const fn = (filename || '').toLowerCase()
  for (const type of FPS_WEAPON_TYPES) {
    if (fn.includes(`_${type}_`) || fn.includes(`_${type}.`)) return type
  }
  return null
}

function getSubType(bp) {
  const parts = bp.file.split('\\')
  const filename = parts[parts.length - 1] || ''

  for (let i = 0; i < parts.length - 1; i++) {
    if (parts[i] === 'vehiclegear' && parts[i + 1] === 'weapons') {
      let next = parts[i + 2]?.replace('$', '')
      if (next === 'templates' && parts[i + 3]) next = parts[i + 3]
      return next || null
    }
    if (parts[i] === 'weapons' && parts[i - 1] === 'fpsgear') {
      const sub = parts[i + 1]?.replace('$', '')
      if (sub === 'templates') return getFpsWeaponTypeFromFilename(filename) || 'other'
      return sub
    }
    if (parts[i] === 'ammo' && parts[i - 1] === 'fpsgear') {
      const fromFilename = getFpsWeaponTypeFromFilename(filename)
      if (fromFilename) return fromFilename
      const folderType = parts[i + 1]?.replace('$', '')
      if (FPS_WEAPON_TYPES.includes(folderType)) return folderType
      return null
    }
    if (parts[i] === 'armour' && parts[i - 1] === 'fpsgear') {
      const rawSub = parts[i + 1]?.replace('$', '')
      const sub = rawSub === 'templates' && parts[i + 2] ? parts[i + 2] : rawSub
      if (sub === 'combat') return 'standard'
      if (sub === 'flightsuit') {
        if (filename.includes('_helmet')) return 'standard'
        return 'flightsuit'
      }
      return sub
    }
    if (parts[i] === 'vehiclegear' && parts[i + 1] !== 'weapons') {
      return parts[i + 1]?.replace('$', '')
    }
  }
  return null
}

const stats = {
  total: blueprints.length,
  withSlots: 0,
  withRewardMissions: 0,
  withResources: 0,
  ammo: 0,
  armour: 0,
  armourUntyped: 0,
  ammoUntyped: 0,
}

for (const bp of blueprints) {
  if (Array.isArray(bp.slots) && bp.slots.length > 0) stats.withSlots++
  if (Array.isArray(bp.rewardMissions) && bp.rewardMissions.length > 0) stats.withRewardMissions++

  let hasResource = false
  for (const slot of bp.slots ?? []) {
    for (const option of slot.options ?? []) {
      if (option.resourceName || option.entityName) hasResource = true
    }
  }
  if (hasResource) stats.withResources++

  const file = bp.file || ''
  if (file.includes('fpsgear\\ammo')) {
    stats.ammo++
    if (!getSubType(bp)) stats.ammoUntyped++
  }
  if (file.includes('fpsgear\\armour')) {
    stats.armour++
    if (!getSubType(bp)) stats.armourUntyped++
  }
}

const failures = []
if (stats.withSlots < stats.total * 0.9) failures.push('too few blueprints with slots')
if (stats.withResources < stats.total * 0.9) failures.push('too few blueprints with resource options')
if (stats.ammoUntyped > 0) failures.push(`${stats.ammoUntyped} ammo blueprints missing subtype`)
if (stats.armourUntyped > 5) failures.push(`${stats.armourUntyped} armour blueprints missing subtype`)

console.log(`Blueprints validation (${data.version})`)
console.log(JSON.stringify(stats, null, 2))

if (failures.length > 0) {
  console.error('Validation failed:', failures.join('; '))
  process.exit(1)
}

console.log('Validation passed')
