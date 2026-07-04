/**
 * Extract crafted-item base stats from entity SCItem JSON for blueprint modifier simulation.
 * Maps entity component fields → gameplay property keys used in crafting modifiers.
 */

import { existsSync, readFileSync, readdirSync } from 'fs'
import { join, basename, dirname, normalize } from 'path'

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

/** entityClass basename (lowercase) → absolute file path */
export function buildEntityClassPathIndex(extractedDataRoot) {
  const scitemDir = join(extractedDataRoot, 'libs/foundry/records/entities/scitem')
  const index = new Map()
  for (const file of walkJsonFiles(scitemDir)) {
    index.set(basename(file, '.json').toLowerCase(), file)
  }
  return index
}

/** All record JSON basenames under libs/foundry/records (for ammo params resolution). */
export function buildRecordBasenameIndex(extractedDataRoot) {
  const recordsDir = join(extractedDataRoot, 'libs/foundry/records')
  const index = new Map()
  for (const file of walkJsonFiles(recordsDir)) {
    index.set(basename(file, '.json').toLowerCase(), file)
  }
  return index
}

function resolveRecordRef(ref, fromFile, recordIndex, extractedDataRoot) {
  if (!ref || typeof ref !== 'string') return null

  if (ref.startsWith('file://')) {
    const rel = ref
      .replace(/^file:\/\/\.?\/?/i, '')
      .split(/[/\\]/)
      .filter(Boolean)

    while (rel[0] === '..') rel.shift()

    let candidate = normalize(join(dirname(fromFile), ...rel))
    if (existsSync(candidate)) return candidate

    const libsIdx = ref.toLowerCase().indexOf('libs/foundry/records/')
    if (libsIdx >= 0) {
      const tail = ref.slice(libsIdx).replace(/^file:\/\/\.?\/?/i, '')
      candidate = normalize(join(extractedDataRoot, tail))
      if (existsSync(candidate)) return candidate
    }
  }

  const key = basename(ref, '.json').toLowerCase()
  return recordIndex.get(key) || null
}

function walkObjectTree(root, visit) {
  const stack = [root]
  const seen = new Set()
  while (stack.length) {
    const node = stack.pop()
    if (!node || typeof node !== 'object') continue
    if (seen.has(node)) continue
    seen.add(node)
    visit(node)
    for (const val of Object.values(node)) {
      if (Array.isArray(val)) {
        for (const item of val) stack.push(item)
      } else if (val && typeof val === 'object') {
        stack.push(val)
      }
    }
  }
}

function firstDamageFromAmmo(ammoJson) {
  const damage = ammoJson?._RecordValue_?.projectileParams?.damage
  if (!damage) return null
  if (damage.DamageEnergy > 0) return damage.DamageEnergy
  if (damage.DamagePhysical > 0) return damage.DamagePhysical
  if (damage.DamageDistortion > 0) return damage.DamageDistortion
  return null
}

function extractWeaponDamage(entityJson, entityFile, recordIndex, extractedDataRoot) {
  let damage = null
  let ammoRef = null

  walkObjectTree(entityJson?._RecordValue_, (node) => {
    if (damage != null) return
    if (node._Type_ === 'DamageInfo') {
      if (node.DamageEnergy > 0) damage = node.DamageEnergy
      else if (node.DamagePhysical > 0) damage = node.DamagePhysical
      else if (node.DamageDistortion > 0) damage = node.DamageDistortion
    }
    if (!ammoRef && node.ammoParamsRecord) {
      ammoRef = node.ammoParamsRecord
    }
  })

  if (damage != null) return damage

  if (ammoRef) {
    const ammoPath = resolveRecordRef(ammoRef, entityFile, recordIndex, extractedDataRoot)
    if (ammoPath) {
      return firstDamageFromAmmo(readJson(ammoPath))
    }
  }

  return null
}

function extractItemResourceStats(components) {
  const stats = {}

  for (const comp of components ?? []) {
    if (comp._Type_ !== 'ItemResourceComponentParams') continue

    for (const state of comp.states ?? []) {
      for (const delta of state.deltas ?? []) {
        if (delta._Type_ === 'ItemResourceDeltaGeneration') {
          const gen = delta.generation
          const amount = gen?.resourceAmountPerSecond
          if (gen?.resource === 'Power' && amount?._Type_ === 'SPowerSegmentResourceUnit') {
            stats.Itemresource_Powergeneration = amount.units
          }
        }

        if (delta._Type_ === 'ItemResourceDeltaConversion') {
          const gen = delta.generation
          const amount = gen?.resourceAmountPerSecond
          if (gen?.resource === 'Coolant' && amount?._Type_ === 'SStandardResourceUnit') {
            stats.Itemresource_Coolantgeneration = amount.standardResourceUnits
          }
        }
      }
    }
  }

  return stats
}

function getAttachType(components) {
  const attach = (components ?? []).find((c) => c?._Type_ === 'SAttachableComponentParams')
  return attach?.AttachDef?.Type || ''
}

function entityLooksLikeWeapon(components, entityClass, entityFile) {
  if ((components ?? []).some((c) => c?._Type_ === 'SCItemWeaponComponentParams')) return true
  const attachType = getAttachType(components)
  if (/weapon|mininglaser|tractorbeam|missile|turret|salvage/i.test(attachType)) return true
  const id = `${entityClass || ''} ${entityFile || ''}`.toLowerCase()
  return /[/\\]weapons[/\\]|mining_laser_|tractorbeam|_mag\.json/.test(id)
}

function entityLooksLikeSalvageModule(components, entityClass, entityFile) {
  const attachType = getAttachType(components)
  if (attachType === 'SalvageModifier') return true
  const id = `${entityClass || ''} ${entityFile || ''}`.toLowerCase()
  return id.includes('salvage_modifier') || id.includes('salvagemodifiers')
}

function entityHasTractorBeamParams(root) {
  let found = false
  walkObjectTree(root, (node) => {
    if (node._Type_ === 'SWeaponActionFireTractorBeamParams') found = true
  })
  return found
}

function resolveEntityFile(entityClass, entityPathIndex) {
  if (!entityClass || !entityPathIndex) return null
  const key = String(entityClass).toLowerCase()
  if (entityPathIndex.has(key)) return entityPathIndex.get(key)

  // Common blueprint entityClass variants (e.g. fuel nozzles, missing _scitem suffix)
  const candidates = [
    `${key}_scitem`,
    key.replace(/^fuel_nozzle_/, 'nozzle_fuelgiver_'),
    key.replace(/^nozzle_fuelgiver_/, 'fuel_nozzle_'),
  ]
  for (const candidate of candidates) {
    if (entityPathIndex.has(candidate)) return entityPathIndex.get(candidate)
  }
  return null
}

function extractTractorAndSalvageStats(root, { includeSalvage, includeTractor }) {
  const stats = {}

  walkObjectTree(root, (node) => {
    if (includeTractor && node._Type_ === 'SWeaponActionFireTractorBeamParams') {
      if (node.fullStrengthDistance != null) {
        stats.Weapon_Tractor_Fullstrengthdist = node.fullStrengthDistance
      }
      if (node.maxDistance != null) {
        stats.Weapon_Tractor_Maxdist = node.maxDistance
      }
      if (node.maxForce != null) {
        stats.Weapon_Tractor_Force = node.maxForce
      } else if (node.minForce != null) {
        stats.Weapon_Tractor_Force = node.minForce
      }
      if (node.maxVolume != null) {
        stats.Weapon_Tractor_Maxvolume = node.maxVolume
      }
    }

    if (includeSalvage && node._Type_ === 'SSalvageModifier') {
      if (node.extractionEfficiency != null) {
        stats.Weapon_Hullscraping_Efficiency = node.extractionEfficiency
      }
      if (node.radiusMultiplier != null) {
        stats.Weapon_Hullscraping_Radius = node.radiusMultiplier
      }
      if (node.salvageSpeedMultiplier != null) {
        stats.Weapon_Hullscraping_Speed = node.salvageSpeedMultiplier
      }
    }
  })

  return stats
}

/**
 * Map gameplay property keys used by crafting modifiers to entity base values.
 * @returns {Record<string, number> | null}
 */
export function extractEntityBaseStats(
  entityClass,
  entityPathIndex,
  extractedDataRoot,
  recordIndex
) {
  if (!entityClass || !entityPathIndex) return null

  const file = resolveEntityFile(entityClass, entityPathIndex)
  if (!file) return null

  const json = readJson(file)
  const recordValue = json?._RecordValue_
  const components = recordValue?.Components
  if (!Array.isArray(components)) return null

  const isWeapon = entityLooksLikeWeapon(components, entityClass, file)
  const isSalvageModule = entityLooksLikeSalvageModule(components, entityClass, file)
  const isTractor = entityHasTractorBeamParams(recordValue)

  const stats = {}

  for (const comp of components) {
    if (!comp) continue

    if (comp._Type_ === 'SHealthComponentParams' && comp.Health != null) {
      stats.Health_Maxhealth = comp.Health
    }

    if (comp._Type_ === 'SCItemQuantumDriveParams') {
      if (comp.params?.driveSpeed != null) {
        stats.Quantum_Speed = comp.params.driveSpeed
      }
      if (comp.quantumFuelRequirement != null) {
        stats.Quantum_Fuelrequirement = comp.quantumFuelRequirement
      }
    }

    if (comp._Type_ === 'SCItemShieldGeneratorParams' && comp.MaxShieldHealth != null) {
      stats.Shield_Maxhealth = comp.MaxShieldHealth
    }

    if (comp._Type_ === 'SCItemRadarComponentParams' && comp.aimAssist) {
      if (comp.aimAssist.distanceMinAssignment != null) {
        stats.Radar_Minaimassistdistance = comp.aimAssist.distanceMinAssignment
      }
      if (comp.aimAssist.distanceMaxAssignment != null) {
        stats.Radar_Maxaimassistdistance = comp.aimAssist.distanceMaxAssignment
      }
    }

    // Legacy FPS weapon component (fallback)
    if (comp._Type_ === 'WeaponComponentParams') {
      if (comp.damage?.damagePhysical != null && stats.Weapon_Damage == null) {
        stats.Weapon_Damage = comp.damage.damagePhysical
      }
      if (comp.damage?.damageEnergy != null && stats.Weapon_Damage == null) {
        stats.Weapon_Damage = comp.damage.damageEnergy
      }
    }

    // Obsolete shield type (fallback)
    if (comp._Type_ === 'SShieldComponentParams' && comp.MaxCapacity != null && stats.Shield_Maxhealth == null) {
      stats.Shield_Maxhealth = comp.MaxCapacity
    }
  }

  Object.assign(stats, extractItemResourceStats(components))
  Object.assign(
    stats,
    extractTractorAndSalvageStats(recordValue, {
      includeSalvage: isSalvageModule,
      includeTractor: isTractor,
    })
  )

  if (isWeapon) {
    const weaponDamage = extractWeaponDamage(json, file, recordIndex, extractedDataRoot)
    if (weaponDamage != null && stats.Weapon_Damage == null) {
      stats.Weapon_Damage = weaponDamage
    }
  }

  return Object.keys(stats).length > 0 ? stats : null
}
